-- Close the last self-service column on profiles.
--
-- 20260912201800 had to leave verification_status grantable because
-- /api/identity/session and /api/identity/retry wrote it with the caller's own
-- Supabase client. Both now use the service client, so members no longer need
-- the grant - and with it they could set verification_status => 'verified' and
-- skip Stripe Identity entirely.
--
-- DEPLOY ORDER: this one goes AFTER the application deploy, not before. Applied
-- early, those two routes lose a grant they are still using and verification
-- fails to start. That is the opposite of the find_match change, where the
-- migration had to land first.

revoke update (verification_status) on public.profiles from authenticated;
