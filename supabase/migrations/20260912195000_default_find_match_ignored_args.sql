-- Let callers stop passing find_match's ignored arguments.
--
-- 20260831213000 stopped find_match trusting p_user_id, p_topic_embedding and
-- p_excluded_user_ids - identity comes from auth.uid() and the rest from the
-- caller's own queue row. The parameters stayed in the signature so the shipped
-- client kept working, but three arguments that look load-bearing and are not
-- invite someone to trust them again.
--
-- They now default to null, so the client can drop them. p_threshold is NOT in
-- that group: it is a real input, clamped to the product floor by
-- clamp_match_threshold, and the client decays it while a member waits.
--
-- Deliberately not a signature change. Dropping the parameters would mean the
-- migration and the client bundle had to land together, and any browser still
-- running the old bundle would fail to match until it reloaded. Defaults let
-- both call shapes work; a later migration can remove the dead parameters once
-- no old bundle is in the wild. A second overload was also rejected - two
-- candidates is what produced PGRST203 here before.

create or replace function find_match(
  p_user_id uuid default null,              -- ignored: identity is auth.uid()
  p_topic_embedding vector(768) default null, -- ignored: read from queue row
  p_mode text default null,                 -- ignored: read from queue row
  p_excluded_user_ids uuid[] default '{}',  -- ignored: derived from blocks
  p_threshold float default 0.7             -- used, clamped to the floor
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
  -- Identity comes from the JWT, never from the argument.
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

comment on function find_match is
  'Matches the calling member against the queue. Identity, search vector, mode and block list are derived server-side; p_user_id, p_topic_embedding, p_mode and p_excluded_user_ids are accepted for backwards compatibility and ignored. Only p_threshold is honoured, clamped by clamp_match_threshold.';
