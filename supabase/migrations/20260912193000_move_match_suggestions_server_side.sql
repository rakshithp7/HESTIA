-- Move the suggestion fallback behind the server.
--
-- `debug_matches` was hardened in 20260831213000 so it derives identity, search
-- vector and mode from the caller's own queue row. Two gaps remained, both a
-- consequence of it being callable straight from the browser with the anon key:
--
--   * it returned the top 5 waiting peers' topic text, while the UI only ever
--     shows the best one - four strangers' topics disclosed per poll for no
--     product reason
--   * unlike find_match it never checked for an active ban, so a banned member
--     could keep reading suggestions
--
-- The replacement takes the caller as an explicit argument and is executable
-- only by service_role, so it cannot be reached with the anon key at all. The
-- caller uuid is supplied by `/api/match/suggest` after verifying the session.

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

  select * into v_my_queue_record
  from match_queue
  where user_id = p_caller and status = 'waiting'
  limit 1;

  if v_my_queue_record.id is null then
    return;
  end if;

  v_excluded := public.matching_excluded_user_ids(p_caller);

  -- Only the single best candidate leaves the database. The caller sees one
  -- stranger's topic because the UI offers it to them, and no more.
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
    -- FILTER STALE USERS: Must have heartbeated recently
    and mq.updated_at > now() - interval '15 seconds'
    and (1 - (mq.topic_embedding <=> v_my_queue_record.topic_embedding)) > coalesce(p_min_similarity, 0.1)
  order by similarity desc
  limit 1;
end;
$$;

comment on function public.suggested_match_for is
  'Best suggestion for a waiting member, once matching has decayed to the threshold floor. Takes the caller explicitly and is service_role-only, so it is reachable solely through /api/match/suggest.';

revoke all on function public.suggested_match_for(uuid, float) from public;
revoke all on function public.suggested_match_for(uuid, float) from anon;
revoke all on function public.suggested_match_for(uuid, float) from authenticated;
grant execute on function public.suggested_match_for(uuid, float) to service_role;

-- Nothing calls the browser-facing version any more.
drop function if exists public.debug_matches(uuid, vector(768), text, uuid);
