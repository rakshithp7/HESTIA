-- Two fixes: the profiles policies that allowed the privilege escalation, and
-- an age gate that is actually an age gate.

-- ---------------------------------------------------------------------------
-- 1. profiles policies
-- ---------------------------------------------------------------------------
-- All three policies were scoped `to public`, which includes anon, and the
-- UPDATE policy had no WITH CHECK. Column grants (20260912201800) already stop
-- the escalation, but the policies are the layer that should have stopped it:
-- a permissive `using (auth.uid() = id)` with no explicit check is the shape
-- that made "any column on my own row" feel safe when it was not.
--
-- Scope them to authenticated and state the check explicitly. Postgres falls
-- back to USING when WITH CHECK is absent, so this is not a behaviour change -
-- it is making the intent unmissable to the next person reading it.

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (auth.uid() = id);

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 2. Age gate
-- ---------------------------------------------------------------------------
-- Stripe Identity verifies identity; profileNeedsVerification checks
-- verification_status. Neither checks age. date_of_birth was persisted and an
-- age was computed for display only, so a verified 15-year-old passed every
-- gate and could enter the queue.
--
-- Fails closed: a null date_of_birth is not an adult. Age is recomputed at
-- match time rather than stamped as a boolean at verification, so nobody ages
-- into or out of the gate incorrectly.
--
-- This is only trustworthy because 20260912201800 revoked UPDATE on
-- date_of_birth from members. Before that a member could have set it.

create or replace function public.caller_is_adult(p_caller uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    (select date_of_birth <= (current_date - interval '18 years')
     from profiles
     where id = p_caller),
    false
  );
$$;

comment on function public.caller_is_adult is
  'True when the member is 18 or older by the DOB Stripe Identity captured. Null DOB is false - fails closed. Members cannot write date_of_birth, so this cannot be forged.';

revoke all on function public.caller_is_adult(uuid) from public;
grant execute on function public.caller_is_adult(uuid) to service_role;

-- Added after tests/security-posture.test.ts caught this: `revoke all ... from
-- public` above is NOT sufficient on Supabase. ALTER DEFAULT PRIVILEGES in the
-- public schema grants EXECUTE to anon and authenticated explicitly, and an
-- explicit role grant survives a PUBLIC revoke. Without these two lines anyone
-- could ask whether any member is an adult.
revoke execute on function public.caller_is_adult(uuid) from anon;
revoke execute on function public.caller_is_adult(uuid) from authenticated;
