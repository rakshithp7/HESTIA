-- Add date_of_birth column to profiles for storing Stripe verified DOB metadata.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date;

COMMENT ON COLUMN public.profiles.date_of_birth IS 'Date of birth as returned by Stripe Identity verification.';
