-- Let a member stay matchable while their tab is in the background.
--
-- A queue row was ignored once its updated_at was 15 seconds old and deleted at
-- 20. Keeping it fresh is a client-side timer, and browsers clamp timers in
-- hidden tabs - to roughly once a minute after a tab has been hidden for five
-- minutes. Measured on a real session: the heartbeat fired 60 seconds apart, so
-- the row was stale for about 50 of every 60 seconds and the member was
-- invisible to everyone for most of the time they were waiting.
--
-- No client-side interval can fix that, because the throttling applies to
-- whatever interval is chosen. The windows have to tolerate it instead:
--
--   matchable while updated_at is younger than   90s  (was 15s)
--   deleted once updated_at is older than       150s  (was 20s)
--
-- 90s clears the once-a-minute worst case with margin. The cost is that someone
-- who closes their tab stays matchable for up to 90 seconds, so a match can be
-- offered against a member who has already gone; the signalling handshake
-- already has to cope with a peer that never answers.
--
-- Everything else about these two functions is unchanged - bans, age bands,
-- blocks and the consent path all still apply.

create or replace function find_match(
  p_user_id uuid default null,
  p_topic_embedding vector(768) default null,
  p_mode text default null,
  p_excluded_user_ids uuid[] default '{}',
  p_threshold float default 0.7
)
returns table (
  match_found boolean,
  match_room_id text,
  peer_user_id uuid
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller uuid := auth.uid();
  v_match record;
  v_room_id text;
  v_my_queue_record record;
  v_is_match_found boolean := false;
  v_updated_count int;
  v_excluded uuid[];
  v_band text;
  v_threshold float := public.clamp_match_threshold(p_threshold);
begin
  if v_caller is null then
    return query select false, null::text, null::uuid;
    return;
  end if;

  if public.caller_has_active_ban(v_caller) then
    return query select false, null::text, null::uuid;
    return;
  end if;

  v_band := public.caller_age_band(v_caller);

  if v_band is null then
    return query select false, null::text, null::uuid;
    return;
  end if;

  delete from match_queue
  where updated_at < now() - interval '150 seconds';

  select * into v_my_queue_record
  from match_queue
  where user_id = v_caller and status = 'waiting'
  limit 1;

  if v_my_queue_record.id is null then
     return query select false, null::text, null::uuid;
     return;
  end if;

  v_excluded := public.matching_excluded_user_ids(v_caller);

  -- The consent path is a direct pairing rather than a search, so it needs the
  -- band check too or it would be a way around it.
  if v_my_queue_record.consented_queue_id is not null then
    select mq.id, mq.user_id into v_match
    from match_queue mq
    join profiles p on p.id = mq.user_id
    where mq.id = v_my_queue_record.consented_queue_id
      and mq.status = 'waiting'
      and mq.consented_queue_id = v_my_queue_record.id
      and mq.updated_at > now() - interval '90 seconds'
      and not (mq.user_id = any(v_excluded))
      and public.age_band(p.date_of_birth) = v_band
    limit 1;

    if found then
      v_is_match_found := true;
    end if;
  end if;

  if not v_is_match_found then
    select mq.id, mq.user_id into v_match
    from match_queue mq
    join profiles p on p.id = mq.user_id
    where mq.status = 'waiting'
      and mq.mode = v_my_queue_record.mode
      and mq.user_id != v_caller
      and not (mq.user_id = any(v_excluded))
      and public.age_band(p.date_of_birth) = v_band
      and 1 - (mq.topic_embedding <=> v_my_queue_record.topic_embedding) > v_threshold
      and mq.updated_at > now() - interval '90 seconds'
    order by mq.topic_embedding <=> v_my_queue_record.topic_embedding asc
    limit 1;

    if found then
      v_is_match_found := true;
    end if;
  end if;

  if v_is_match_found then
    v_room_id := 'room_' || encode(gen_random_bytes(12), 'hex');

    with updates as (
        update match_queue
        set status = 'matched', room_id = v_room_id
        where id in (v_my_queue_record.id, v_match.id)
          and status = 'waiting'
        returning id
    )
    select count(*) into v_updated_count from updates;

    if v_updated_count = 2 then
        return query select true, v_room_id, v_match.user_id;
    else
        return query select false, null::text, null::uuid;
    end if;
  else
    return query select false, null::text, null::uuid;
  end if;

EXCEPTION
  WHEN deadlock_detected THEN
    return query select false, null::text, null::uuid;
end;
$$;

create or replace function public.suggested_match_for(
  p_caller uuid,
  p_min_similarity float default 0.1
)
returns table (
  queue_id uuid,
  topic text,
  similarity float,
  peer_consented_to_me boolean
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_my_queue_record record;
  v_excluded uuid[];
  v_band text;
begin
  if p_caller is null then
    return;
  end if;

  if public.caller_has_active_ban(p_caller) then
    return;
  end if;

  v_band := public.caller_age_band(p_caller);

  if v_band is null then
    return;
  end if;

  select * into v_my_queue_record
  from match_queue
  where user_id = p_caller and status = 'waiting'
  limit 1;

  if v_my_queue_record.id is null then
    return;
  end if;

  v_excluded := public.matching_excluded_user_ids(p_caller);

  -- Suggestions must use the same band filter as find_match, or the UI would
  -- offer a peer that matching then refuses to pair.
  return query
  select
    mq.id as queue_id,
    mq.topic,
    (1 - (mq.topic_embedding <=> v_my_queue_record.topic_embedding))::float as similarity,
    (mq.consented_queue_id = v_my_queue_record.id) as peer_consented_to_me
  from match_queue mq
  join profiles p on p.id = mq.user_id
  where mq.mode = v_my_queue_record.mode
    and mq.user_id != p_caller
    and mq.status = 'waiting'
    and not (mq.user_id = any(v_excluded))
    and public.age_band(p.date_of_birth) = v_band
    and mq.updated_at > now() - interval '90 seconds'
    and (1 - (mq.topic_embedding <=> v_my_queue_record.topic_embedding)) > coalesce(p_min_similarity, 0.1)
  order by similarity desc
  limit 1;
end;
$$;
