-- Stop members granting themselves admin.
--
-- profiles has an RLS policy `profiles_update_own` with using (auth.uid() = id)
-- and no WITH CHECK, and anon/authenticated held UPDATE on every column. A
-- member could PATCH their own row and set:
--
--   role                  => 'admin'      -- is_admin() then returns true, and
--                                            that is the RLS predicate guarding
--                                            moderation_reports and user_bans:
--                                            every report, transcript and ban
--                                            control in the product
--   verification_status   => 'verified'   -- skip Stripe Identity entirely
--   verification_required => false        -- short-circuit lib/verification.ts
--   date_of_birth         => any date     -- forge age
--
-- NOTE: this migration is a no-op and is kept only so the history explains why
-- the next one exists. The grant is table-level, and a column-level revoke
-- cannot carve a column out of a table-wide grant. See
-- 20260912201800_restrict_profiles_update_to_safe_columns.sql.

revoke update (role) on public.profiles from anon;
revoke update (role) on public.profiles from authenticated;

revoke update (date_of_birth) on public.profiles from anon;
revoke update (date_of_birth) on public.profiles from authenticated;

revoke update (verification_required) on public.profiles from anon;
revoke update (verification_required) on public.profiles from authenticated;
