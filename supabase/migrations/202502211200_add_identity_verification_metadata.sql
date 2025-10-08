-- Extend the public.profiles table with identity verification metadata.
-- Mirrors the Stripe Identity verification session status values we care about
-- and ensures existing rows have sensible defaults.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'profile_verification_status'
  ) THEN
    CREATE TYPE public.profile_verification_status AS ENUM (
      'unverified',
      'pending',
      'requires_input',
      'verified',
      'failed'
    );
  END IF;
END
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verification_status public.profile_verification_status NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS verification_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_verification_id text,
  ADD COLUMN IF NOT EXISTS verification_initiated_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_completed_at timestamptz;

-- Backfill defaults for existing rows to keep the data consistent.
UPDATE public.profiles
SET
  verification_status = 'unverified',
  verification_required = true,
  verification_attempts = 0
WHERE
  verification_status IS DISTINCT FROM 'unverified'
  OR verification_required IS DISTINCT FROM true
  OR verification_attempts IS DISTINCT FROM 0;

COMMENT ON COLUMN public.profiles.verification_status IS 'Stripe-backed identity verification status for the user profile.';
COMMENT ON COLUMN public.profiles.verification_required IS 'Whether this profile must pass identity verification before accessing gated features.';
COMMENT ON COLUMN public.profiles.verification_attempts IS 'Count of how many Stripe Identity verification sessions have been started.';
COMMENT ON COLUMN public.profiles.stripe_session_id IS 'Latest Stripe Identity VerificationSession id associated with the profile.';
COMMENT ON COLUMN public.profiles.stripe_verification_id IS 'Stripe Identity Verification id (if populated) associated with the profile.';
COMMENT ON COLUMN public.profiles.verification_initiated_at IS 'Timestamp when the current verification session was created.';
COMMENT ON COLUMN public.profiles.verification_completed_at IS 'Timestamp when the current verification session transitioned to a terminal state.';
