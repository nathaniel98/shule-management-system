-- School administrator credentials, kept separate from platform super-admin accounts.
CREATE TABLE IF NOT EXISTS public.school_admin_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_admin_profiles_username_format
    CHECK (username = lower(username) AND username ~ '^[a-z0-9._-]{3,30}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS school_admin_profiles_username_unique
  ON public.school_admin_profiles (lower(username));

ALTER TABLE public.school_admin_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_admin_profiles_owner_read ON public.school_admin_profiles;
CREATE POLICY school_admin_profiles_owner_read
  ON public.school_admin_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS school_admin_profiles_owner_update ON public.school_admin_profiles;
CREATE POLICY school_admin_profiles_owner_update
  ON public.school_admin_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin());

-- Authenticated users may change only the username, not school_id or user_id.
REVOKE ALL ON public.school_admin_profiles FROM anon;
REVOKE UPDATE ON public.school_admin_profiles FROM authenticated;
GRANT SELECT ON public.school_admin_profiles TO authenticated;
GRANT UPDATE (username) ON public.school_admin_profiles TO authenticated;

-- Keep updated_at current whenever a username is changed.
CREATE OR REPLACE FUNCTION public.set_school_admin_profile_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS school_admin_profiles_set_updated_at ON public.school_admin_profiles;
CREATE TRIGGER school_admin_profiles_set_updated_at
  BEFORE UPDATE OF username ON public.school_admin_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_school_admin_profile_updated_at();
