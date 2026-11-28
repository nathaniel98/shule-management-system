-- Allow accountants to read their own school's staff directory for payroll verification.
CREATE OR REPLACE FUNCTION public.is_active_school_accountant_for_school(target_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_staff_accounts a
    WHERE a.user_id = auth.uid()
      AND a.school_id = target_school_id
      AND a.role = 'accountant'
      AND a.is_active = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_school_accountant_for_school(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_school_accountant_for_school(uuid) TO authenticated;

DROP POLICY IF EXISTS school_accountant_read_staff_directory ON public.school_staff_directory;
CREATE POLICY school_accountant_read_staff_directory
  ON public.school_staff_directory
  FOR SELECT
  TO authenticated
  USING (public.is_active_school_accountant_for_school(school_id));
