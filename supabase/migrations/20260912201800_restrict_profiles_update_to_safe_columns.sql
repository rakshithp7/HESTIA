-- Follow-up to 20260912201500, which did nothing.
--
-- anon/authenticated hold a TABLE-level UPDATE grant on profiles.
-- information_schema.column_privileges expands that per column, so it reads as
-- a set of column grants, but `revoke update (role) ...` cannot carve a column
-- out of a table-wide grant - it is a silent no-op. Measured: after the previous
-- migration all four privileged columns still showed UPDATE for both roles.
--
-- The table-level grant has to go, then the safe columns are granted back.

revoke update on public.profiles from anon;
revoke update on public.profiles from authenticated;

-- Members may edit their own display name. Nothing else.
grant update (first_name, last_name) on public.profiles to authenticated;

-- Verification bookkeeping written by /api/identity/session and
-- /api/identity/retry with the caller's own client. role, date_of_birth and
-- verification_required are deliberately absent: those are the privilege, age
-- and gate-bypass columns.
--
-- verification_status is here only because those two routes still write it as
-- the user. Once they use the service client it is dropped from this list by
-- 20260912202500; until that ships a member can still mark themselves verified,
-- though they can no longer become an admin or forge a DOB.
grant update (
  verification_status,
  verification_attempts,
  stripe_session_id,
  stripe_verification_id,
  verification_initiated_at,
  verification_completed_at
) on public.profiles to authenticated;
