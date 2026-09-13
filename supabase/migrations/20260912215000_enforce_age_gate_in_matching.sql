-- Enforce the age gate inside matching.
--
-- Mirrors the ban check exactly: the RPCs are the only way into the queue, so
-- this is the layer a client cannot route around. Both functions are SECURITY
-- DEFINER and so may call caller_is_adult even though members hold no grant
-- on it.
--
-- Underage callers get the same shape as banned callers - no match, no
-- suggestion. /api/match/register returns a reason so the UI can explain.

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

  if not public.caller_is_adult(v_caller) then
    return query select false, null::text, null::uuid;
    return;
  end if;

  delete from match_queue
  where updated_at < now() - interval '20 seconds';

  select * into v_my_queue_record
  from match_queue
  where user_id = v_caller and status = 'waiting'
  limit 1;

  if v_my_queue_record.id is null then
     return query select false, null::text, null::uuid;
     return;
  end if;

  v_excluded := public.matching_excluded_user_ids(v_caller);

  if v_my_queue_record.consented_queue_id is not null then
    select id, user_id into v_match
    from match_queue
    where id = v_my_queue_record.consented_queue_id
      and status = 'waiting'
      and consented_queue_id = v_my_queue_record.id
      and updated_at > now() - interval '15 seconds'
      and not (user_id = any(v_excluded))
    limit 1;

    if found then
      v_is_match_found := true;
    end if;
  end if;

  if not v_is_match_found then
    select id, user_id into v_match
    from match_queue
    where status = 'waiting'
      and mode = v_my_queue_record.mode
      and user_id != v_caller
      and not (user_id = any(v_excluded))
      and 1 - (topic_embedding <=> v_my_queue_record.topic_embedding) > v_threshold
      and updated_at > now() - interval '15 seconds'
    order by topic_embedding <=> v_my_queue_record.topic_embedding asc
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
begin
  if p_caller is null then
    return;
  end if;

  if public.caller_has_active_ban(p_caller) then
    return;
  end if;

  if not public.caller_is_adult(p_caller) then
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

  return query
  select
    mq.id as queue_id,
    mq.topic,
    (1 - (mq.topic_embedding <=> v_my_queue_record.topic_embedding))::float as similarity,
    (mq.consented_queue_id = v_my_queue_record.id) as peer_consented_to_me
  from match_queue mq
  where mq.mode = v_my_queue_record.mode
    and mq.user_id != p_caller
    and mq.status = 'waiting'
    and not (mq.user_id = any(v_excluded))
    and mq.updated_at > now() - interval '15 seconds'
    and (1 - (mq.topic_embedding <=> v_my_queue_record.topic_embedding)) > coalesce(p_min_similarity, 0.1)
  order by similarity desc
  limit 1;
end;
$$;
