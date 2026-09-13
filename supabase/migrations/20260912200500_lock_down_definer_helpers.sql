-- Close the remaining findings from the Supabase security advisor.
--
-- All of these are the same shape as the find_match bug: a SECURITY DEFINER
-- object reachable from the browser with the anon key, trusting an argument or
-- exposing rows it should not.

-- 1. active_user_bans (advisor level: ERROR)
--
-- A SECURITY DEFINER view, so it runs with its creator's rights and ignores RLS
-- on user_bans. anon and authenticated could select it, meaning any signed-in
-- member could read the full ban list - who is banned, why, and until when. On
-- an anonymous mental-health product that is a straightforward deanonymising
-- leak.
--
-- Its only three consumers (lib/moderation/server-bans.ts and the two admin
-- report routes) all use the service client, which bypasses grants, so nothing
-- in the app loses access.
revoke select on public.active_user_bans from anon;
revoke select on public.active_user_bans from authenticated;

-- 2. Matching helpers that take a caller uuid
--
-- Both are SECURITY DEFINER and both accept an arbitrary uuid, so calling them
-- over /rest/v1/rpc let anyone ask "is this user banned?" and "who has this
-- user blocked?" about any member. They exist only to be called from inside
-- find_match and suggested_match_for, which run as their owner and so are
-- unaffected by these revokes. Confirmed against pg_policies: neither is
-- referenced by an RLS policy.
revoke execute on function public.caller_has_active_ban(uuid) from anon;
revoke execute on function public.caller_has_active_ban(uuid) from authenticated;
revoke execute on function public.matching_excluded_user_ids(uuid) from anon;
revoke execute on function public.matching_excluded_user_ids(uuid) from authenticated;

-- is_admin() and consent_linked_queue_ids() are deliberately left executable:
-- both are referenced by RLS policies (moderation_reports, user_bans and
-- match_queue respectively), which evaluate as the querying role. Both derive
-- everything from auth.uid() and take no arguments, so there is nothing to
-- forge and nothing to enumerate.

-- 3. Trigger functions
--
-- These fire from triggers, which execute as the table owner. Nothing should be
-- able to invoke them directly as an RPC.
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.handle_user_metadata_updated() from anon;
revoke execute on function public.handle_user_metadata_updated() from authenticated;

-- 4. clamp_match_threshold had no pinned search_path (advisor: WARN)
--
-- Added in 20260831213000 without one - an omission, and the same class of hole
-- cce4863 fixed on the other matching functions. It is pure arithmetic with no
-- schema references, so an empty search_path is safe.
alter function public.clamp_match_threshold(float) set search_path = '';
