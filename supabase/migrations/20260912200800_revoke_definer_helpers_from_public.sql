-- Follow-up to 20260912200500, which did not actually close the hole.
--
-- Postgres grants EXECUTE on a new function to PUBLIC by default, and anon and
-- authenticated inherit that. Revoking from those two roles leaves the PUBLIC
-- grant in place, so the functions stayed callable over /rest/v1/rpc. Measured:
-- after the role-level revokes, an anon-key POST to
-- /rest/v1/rpc/caller_has_active_ban still returned 200.
--
-- Revoking from PUBLIC is what actually removes the access. Table and view
-- grants do not have this problem, which is why the active_user_bans revoke in
-- the previous migration worked first time.

revoke execute on function public.caller_has_active_ban(uuid) from public;
revoke execute on function public.matching_excluded_user_ids(uuid) from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_user_metadata_updated() from public;

-- is_admin() and consent_linked_queue_ids() are referenced by RLS policies on
-- moderation_reports, user_bans and match_queue, which evaluate as the querying
-- role. They need an explicit grant back to authenticated once the blanket
-- PUBLIC grant is gone. Neither takes an argument and both derive everything
-- from auth.uid(), so there is nothing to forge or enumerate through them.
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

revoke execute on function public.consent_linked_queue_ids() from public;
grant execute on function public.consent_linked_queue_ids() to authenticated;
