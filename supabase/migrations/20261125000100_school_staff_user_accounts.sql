-- School Admin can create staff login accounts for their own school only.
CREATE TABLE IF NOT EXISTS public.school_staff_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('class_teacher', 'head_teacher', 'accountant', 'teacher')),
  class_id uuid NULL REFERENCES public.classes(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_staff_class_required CHECK (role <> 'class_teacher' OR class_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS school_staff_accounts_school_idx
  ON public.school_staff_accounts (school_id, created_at DESC);

ALTER TABLE public.school_staff_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_staff_accounts FROM anon, authenticated;
GRANT SELECT ON public.school_staff_accounts TO authenticated;

DROP POLICY IF EXISTS school_admin_read_own_staff_accounts ON public.school_staff_accounts;
CREATE POLICY school_admin_read_own_staff_accounts
  ON public.school_staff_accounts FOR SELECT TO authenticated
  USING (public.is_active_school_admin_for_school(school_id));

-- Keep staff account creation/deactivation server-side via the Edge Function
-- using the service-role key; never expose service credentials in the browser.
