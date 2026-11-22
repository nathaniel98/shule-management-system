-- Let active School Admins manage exam records and their subject rows
-- only within their own school. Super Admin access remains unchanged.

DROP POLICY IF EXISTS school_admin_manage_exams ON public.exams;
CREATE POLICY school_admin_manage_exams
  ON public.exams
  FOR ALL
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_active_school_admin_for_school(school_id)
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.is_active_school_admin_for_school(school_id)
  );

DROP POLICY IF EXISTS school_admin_manage_exam_subjects
  ON public.exam_subjects;
CREATE POLICY school_admin_manage_exam_subjects
  ON public.exam_subjects
  FOR ALL
  TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.exams AS e
      WHERE e.id = exam_subjects.exam_id
        AND public.is_active_school_admin_for_school(e.school_id)
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.exams AS e
      WHERE e.id = exam_subjects.exam_id
        AND public.is_active_school_admin_for_school(e.school_id)
    )
  );
