-- Staff identity lookup and teaching assignments.
-- Additive migration: does not delete or rewrite existing school records.

-- Staff users may read only their own active/inactive staff account row.
DROP POLICY IF EXISTS school_staff_read_own_account ON public.school_staff_accounts;
CREATE POLICY school_staff_read_own_account
  ON public.school_staff_accounts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Return the signed-in staff member's role and school-scoped assignment.
CREATE OR REPLACE FUNCTION public.get_my_staff_role()
RETURNS TABLE (
  staff_account_id uuid,
  school_id uuid,
  role text,
  class_id uuid,
  display_name text,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    ssa.id,
    ssa.school_id,
    ssa.role,
    ssa.class_id,
    ssa.display_name,
    ssa.is_active
  FROM public.school_staff_accounts AS ssa
  WHERE ssa.user_id = auth.uid()
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_my_staff_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_staff_role() TO authenticated;

-- Explicit class/subject assignments for subject teachers.
CREATE TABLE IF NOT EXISTS public.school_staff_teaching_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  staff_account_id uuid NOT NULL REFERENCES public.school_staff_accounts(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_staff_teaching_assignment_unique
    UNIQUE (staff_account_id, class_id, subject_id)
);

CREATE INDEX IF NOT EXISTS school_staff_teaching_assignments_staff_idx
  ON public.school_staff_teaching_assignments (staff_account_id, class_id);

ALTER TABLE public.school_staff_teaching_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_staff_teaching_assignments FROM anon, authenticated;
GRANT SELECT ON public.school_staff_teaching_assignments TO authenticated;

DROP POLICY IF EXISTS staff_read_own_teaching_assignments
  ON public.school_staff_teaching_assignments;
CREATE POLICY staff_read_own_teaching_assignments
  ON public.school_staff_teaching_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.school_staff_accounts AS ssa
      WHERE ssa.id = school_staff_teaching_assignments.staff_account_id
        AND ssa.user_id = auth.uid()
        AND ssa.is_active IS TRUE
        AND ssa.school_id = school_staff_teaching_assignments.school_id
    )
  );

DROP POLICY IF EXISTS school_admin_manage_teaching_assignments
  ON public.school_staff_teaching_assignments;
CREATE POLICY school_admin_manage_teaching_assignments
  ON public.school_staff_teaching_assignments
  FOR ALL TO authenticated
  USING (public.is_active_school_admin_for_school(school_id))
  WITH CHECK (
    public.is_active_school_admin_for_school(school_id)
    AND EXISTS (
      SELECT 1
      FROM public.school_staff_accounts AS ssa
      JOIN public.classes AS c ON c.id = school_staff_teaching_assignments.class_id
      JOIN public.subjects AS sub ON sub.id = school_staff_teaching_assignments.subject_id
      WHERE ssa.id = school_staff_teaching_assignments.staff_account_id
        AND ssa.school_id = school_staff_teaching_assignments.school_id
        AND ssa.role = 'teacher'
        AND c.school_id = school_staff_teaching_assignments.school_id
        AND sub.school_id = school_staff_teaching_assignments.school_id
    )
  );
