-- Drop the un-hardened find_match overload.
--
-- A second find_match existed in the live database that appears in no migration
-- file:
--
--   find_match(uuid, vector, text, uuid, uuid[], double precision)
--                                   ^^^^ p_queue_id
--
-- It is the original, pre-hardening function. 20260831213000 replaced the
-- 5-argument signature, and `create or replace` matches on argument types, so
-- this overload was never touched. Read back from the live database with
-- pg_get_functiondef, it still has every flaw that migration fixed:
--
--   * no auth.uid() anywhere - identity is taken from p_user_id
--   * SECURITY DEFINER, so it bypasses RLS while doing so
--   * no `set search_path`, the hole cce4863 closed on the other functions
--   * p_excluded_user_ids honoured as given => blocks bypassable
--   * p_threshold honoured as given => pass 0 and match anyone, any topic
--   * no ban check
--
-- Concretely: any signed-in member could call it with their own queue row,
-- p_excluded_user_ids => '{}' and p_threshold => 0 and be put into a session
-- with someone who had blocked them. Nothing in the codebase calls it - the
-- client has only ever passed the 5-argument shape - so dropping it is safe and
-- needs no client change.
--
-- Ordered before 20260912195000 deliberately: `comment on function find_match`
-- there fails with 42725 (name not unique) while two overloads exist.

drop function if exists public.find_match(
  uuid, vector, text, uuid, uuid[], double precision
);
