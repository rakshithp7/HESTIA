-- Roles, moderation reports, and user bans schema update.

-- 1. Profile roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'profile_role'
  ) THEN
    CREATE TYPE public.profile_role AS ENUM ('member', 'admin');
  END IF;
END
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role public.profile_role NOT NULL DEFAULT 'member';

COMMENT ON COLUMN public.profiles.role IS 'Application role for gating privileged admin features.';

-- 2. Helper to check admin status inside RLS policies
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- 3. Moderation reports table
CREATE TABLE IF NOT EXISTS public.moderation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  topic text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('voice', 'chat')),
  reporter_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reporter_email text,
  reported_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reported_email text,
  reasons text[] NOT NULL,
  notes text,
  chat_log jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moderation_reports_reported_idx ON public.moderation_reports (reported_id);
CREATE INDEX IF NOT EXISTS moderation_reports_reporter_idx ON public.moderation_reports (reporter_id);
CREATE INDEX IF NOT EXISTS moderation_reports_status_idx ON public.moderation_reports (status);

ALTER TABLE public.moderation_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moderation reports admin access" ON public.moderation_reports;
CREATE POLICY "moderation reports admin access"
  ON public.moderation_reports
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. User bans table
CREATE TABLE IF NOT EXISTS public.user_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.moderation_reports (id) ON DELETE SET NULL,
  reason text,
  notes text,
  duration_label text NOT NULL DEFAULT 'custom' CHECK (duration_label IN ('1d', '1w', '1m', '1y', 'custom')),
  issued_by uuid NOT NULL REFERENCES auth.users (id),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  lifted_at timestamptz,
  lifted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_bans_user_idx ON public.user_bans (user_id);
CREATE INDEX IF NOT EXISTS user_bans_active_idx ON public.user_bans (user_id, ends_at) WHERE lifted_at IS NULL;

ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user bans admin access" ON public.user_bans;
CREATE POLICY "user bans admin access"
  ON public.user_bans
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5. Convenience view for active bans
CREATE OR REPLACE VIEW public.active_user_bans AS
SELECT
  b.*
FROM public.user_bans b
WHERE
  b.lifted_at IS NULL
  AND now() >= b.starts_at
  AND now() < b.ends_at;

COMMENT ON VIEW public.active_user_bans IS 'Helper view exposing currently active bans (not lifted and within the ban window).';
