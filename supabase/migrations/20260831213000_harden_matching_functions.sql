-- Harden the matching RPCs so they stop trusting their caller.
--
-- find_match and debug_matches are SECURITY DEFINER and are called directly by
-- the browser. They took the caller's identity, search vector, mode, block list
-- and threshold as arguments and used them as given. Verified against the live
-- database: passing another member's uuid as p_user_id ran the match on their
-- behalf and created a room. The same trust allowed:
--
--   * p_excluded_user_ids => '{}'  - bypass blocks entirely
--   * p_threshold         => 0     - ignore topic similarity
--   * p_topic_embedding   => any   - probe what others are waiting to discuss
--
-- Every one of those inputs is now derived server-side from auth.uid() and the
-- caller's own queue row. The signatures are unchanged so the existing client
-- keeps working; the arguments are simply no longer trusted.

-- Remove the stale 3-argument overload. Its presence makes PostgREST fail with
-- PGRST203 (cannot choose candidate) whenever debug_matches is called with
-- three arguments.
drop function if exists public.debug_matches(uuid, vector(768), text);

-- Blocks are mutual for matching purposes: neither party should be offered the
-- other, regardless of who initiated the block.
create or replace function public.matching_excluded_user_ids(p_caller uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(array_agg(distinct excluded_id), '{}')
  from (
    select blocked_user_id as excluded_id
    from blocked_users
    where user_id = p_caller

    union

    select user_id as excluded_id
    from blocked_users
    where blocked_user_id = p_caller
  ) blocks
  where excluded_id is not null;
$$;

comment on function public.matching_excluded_user_ids is
  'Users the caller must not be matched with, in either block direction. Derived server-side so a client cannot opt out of its own blocks.';

create or replace function public.caller_has_active_ban(p_caller uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from user_bans
    where user_id = p_caller
      and lifted_at is null
      and now() >= starts_at
      and now() < ends_at
  );
$$;

comment on function public.caller_has_active_ban is
  'True when the user is currently banned. Checked inside matching so a banned member cannot queue by calling the RPC directly.';

-- Never let a caller widen matching below the product floor.
create or replace function public.clamp_match_threshold(p_threshold float)
returns float
language sql
immutable
as $$
  select least(greatest(coalesce(p_threshold, 0.65), 0.65), 1.0);
$$;

-- ---------------------------------------------------------------------------
-- find_match
-- ---------------------------------------------------------------------------
create or replace function find_match(
  p_user_id uuid,
  p_topic_embedding vector(768),
  p_mode text,
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
  -- Identity comes from the JWT, never from the argument. p_user_id is retained
  -- for signature compatibility and deliberately ignored.
  if v_caller is null then
    return query select false, null::text, null::uuid;
    return;
  end if;

  if public.caller_has_active_ban(v_caller) then
    return query select false, null::text, null::uuid;
    return;
  end if;

  -- Lazy Cleanup: Remove any request that hasn't heartbeated in 20 seconds
  delete from match_queue
  where updated_at < now() - interval '20 seconds';

  -- 1. Get My ID/Status (No Lock - Optimistic Read)
  select * into v_my_queue_record
  from match_queue
  where user_id = v_caller and status = 'waiting'
  limit 1;

  if v_my_queue_record.id is null then
     -- caller not found or not waiting
     return query select false, null::text, null::uuid;
     return;
  end if;

  v_excluded := public.matching_excluded_user_ids(v_caller);

  -- 2. Priority Check: Mutual Consent (No Lock - Optimistic Read)
  if v_my_queue_record.consented_queue_id is not null then
    select
      id,
      user_id
    into v_match
    from match_queue
    where id = v_my_queue_record.consented_queue_id
      and status = 'waiting'
      and consented_queue_id = v_my_queue_record.id -- They must point back to me
      and updated_at > now() - interval '15 seconds' -- Ensure they are alive
      and not (user_id = any(v_excluded))
    limit 1;

    if found then
      v_is_match_found := true;
    end if;
  end if;

  -- 3. If no mutual consent match, Find the best semantic match.
  -- The search vector and mode come from the caller's own queue row, so a
  -- client cannot search on a topic it did not actually queue with.
  if not v_is_match_found then
    select
      id,
      user_id
    into v_match
    from match_queue
    where status = 'waiting'
      and mode = v_my_queue_record.mode
      and user_id != v_caller
      and not (user_id = any(v_excluded))
      and 1 - (topic_embedding <=> v_my_queue_record.topic_embedding) > v_threshold
      and updated_at > now() - interval '15 seconds' -- Ensure they are alive
    order by topic_embedding <=> v_my_queue_record.topic_embedding asc
    limit 1;

    if found then
      v_is_match_found := true;
    end if;
  end if;

  if v_is_match_found then
    -- Generate simple room ID
    v_room_id := 'room_' || encode(gen_random_bytes(12), 'hex');

    -- 4. Atomic Update: Mark BOTH as matched
    with updates as (
        update match_queue
        set status = 'matched', room_id = v_room_id
        where id in (v_my_queue_record.id, v_match.id)
          and status = 'waiting'
        returning id
    )
    select count(*) into v_updated_count from updates;

    if v_updated_count = 2 then
        return query select
          true as match_found,
          v_room_id as match_room_id,
          v_match.user_id as peer_user_id;
    else
        -- Failed to grab both (race condition).
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

-- ---------------------------------------------------------------------------
-- debug_matches (suggestion fallback)
-- ---------------------------------------------------------------------------
create or replace function debug_matches(
  p_user_id uuid,
  p_topic_embedding vector(768),
  p_mode text,
  p_my_queue_id uuid default null
)
returns table (
  queue_id uuid,
  topic text,
  similarity float,
  peer_consented_to_me boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller uuid := auth.uid();
  v_my_queue_record record;
  v_excluded uuid[];
begin
  if v_caller is null then
    return;
  end if;

  -- The caller's own waiting row supplies identity, search vector and mode, so
  -- arbitrary embeddings can no longer be used to enumerate other members'
  -- topics. p_user_id, p_topic_embedding, p_mode and p_my_queue_id are retained
  -- for signature compatibility and ignored.
  select * into v_my_queue_record
  from match_queue
  where user_id = v_caller and status = 'waiting'
  limit 1;

  if v_my_queue_record.id is null then
    return;
  end if;

  v_excluded := public.matching_excluded_user_ids(v_caller);

  return query
  select
    mq.id as queue_id,
    mq.topic,
    (1 - (mq.topic_embedding <=> v_my_queue_record.topic_embedding))::float as similarity,
    (mq.consented_queue_id = v_my_queue_record.id) as peer_consented_to_me
  from match_queue mq
  where mq.mode = v_my_queue_record.mode
    and mq.user_id != v_caller
    and mq.status = 'waiting'
    and not (mq.user_id = any(v_excluded))
    -- FILTER STALE USERS: Must have heartbeated recently
    and mq.updated_at > now() - interval '15 seconds'
  order by similarity desc
  limit 5;
end;
$$;
