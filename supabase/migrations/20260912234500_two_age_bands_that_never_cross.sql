-- Replace the flat 18+ gate with two cohorts that never meet.
--
--   16-17  -> 'minor', matched only with other 16-17 year olds
--   18+    -> 'adult', matched only with other adults
--   under 16, or no DOB on file -> null, never matched at all
--
-- The adult<->minor contact path is the one that ended Omegle, so it is removed
-- by construction here rather than by policy: the band is derived from the DOB
-- Stripe Identity captured, members hold no UPDATE grant on date_of_birth, and
-- the comparison happens inside the SECURITY DEFINER matching functions that
-- are the only way into the queue.

-- Pure band derivation. Takes a DOB rather than a uuid, so it is not an oracle
-- over other members, but it stays locked down for consistency with the rest of
-- the definer helpers.
create or replace function public.age_band(p_dob date)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select case
    when p_dob is null then null
    when p_dob <= (current_date - interval '18 years') then 'adult'
    when p_dob <= (current_date - interval '16 years') then 'minor'
    else null
  end;
$$;

comment on function public.age_band(date) is
  'adult for 18+, minor for 16-17, null for under 16 or unknown. Null fails closed - no band means no matching.';

revoke all on function public.age_band(date) from public;
revoke execute on function public.age_band(date) from anon;
revoke execute on function public.age_band(date) from authenticated;
grant execute on function public.age_band(date) to service_role;

-- Band for one member. SECURITY DEFINER so the matching functions can use it
-- while members hold no grant on it - it takes a caller uuid, so leaving it
-- reachable with the browser key would let anyone probe any member's age.
create or replace function public.caller_age_band(p_caller uuid)
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
  select public.age_band((select date_of_birth from profiles where id = p_caller));
$$;

comment on function public.caller_age_band(uuid) is
  'Matching cohort for a member, from the DOB Stripe Identity captured. Members cannot write date_of_birth, so this cannot be forged.';

revoke all on function public.caller_age_band(uuid) from public;
revoke execute on function public.caller_age_band(uuid) from anon;
revoke execute on function public.caller_age_band(uuid) from authenticated;
grant execute on function public.caller_age_band(uuid) to service_role;

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

  -- The consent path is a direct pairing rather than a search, so it needs the
  -- band check too or it would be a way around it.
  if v_my_queue_record.consented_queue_id is not null then
    select mq.id, mq.user_id into v_match
    from match_queue mq
    join profiles p on p.id = mq.user_id
    where mq.id = v_my_queue_record.consented_queue_id
      and mq.status = 'waiting'
      and mq.consented_queue_id = v_my_queue_record.id
      and mq.updated_at > now() - interval '15 seconds'
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
      and mq.updated_at > now() - interval '15 seconds'
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
    and mq.updated_at > now() - interval '15 seconds'
    and (1 - (mq.topic_embedding <=> v_my_queue_record.topic_embedding)) > coalesce(p_min_similarity, 0.1)
  order by similarity desc
  limit 1;
end;
$$;
