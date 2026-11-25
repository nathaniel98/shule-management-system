-- Secure, school-scoped permissions for staff accounts.
-- Additive migration: preserves existing school_members policies and records.
-- Staff roles are deliberately NOT added to has_school_role(), because existing
-- teacher policies there are school-wide and would expose all results.

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
  ON public.school_staff_teaching_assignments (staff_account_id, class_id, subject_id);

ALTER TABLE public.school_staff_teaching_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_staff_teaching_assignments FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_staff_teaching_assignments TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_staff_role()
RETURNS TABLE (
  staff_account_id uuid,
  school_id uuid,
  role text,
  class_id uuid,
  display_name text,
  is_active boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT ssa.id, ssa.school_id, ssa.role, ssa.class_id, ssa.display_name, ssa.is_active
  FROM public.school_staff_accounts ssa
  WHERE ssa.user_id = (SELECT auth.uid())
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_my_staff_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_staff_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_active_school_staff_for_school(
  p_school_id uuid,
  p_roles text[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_staff_accounts ssa
    WHERE ssa.user_id = (SELECT auth.uid())
      AND ssa.school_id = p_school_id
      AND ssa.is_active IS TRUE
      AND (p_roles IS NULL OR ssa.role = ANY(p_roles))
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_school_staff_for_school(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_school_staff_for_school(uuid, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_can_access_class(p_school_id uuid, p_class_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_staff_accounts ssa
    WHERE ssa.user_id = (SELECT auth.uid())
      AND ssa.school_id = p_school_id
      AND ssa.is_active IS TRUE
      AND (
        ssa.role = 'head_teacher'
        OR (ssa.role = 'class_teacher' AND ssa.class_id = p_class_id)
        OR (
          ssa.role = 'teacher'
          AND EXISTS (
            SELECT 1 FROM public.school_staff_teaching_assignments a
            WHERE a.staff_account_id = ssa.id
              AND a.school_id = p_school_id
              AND a.class_id = p_class_id
          )
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION public.staff_can_access_class(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_can_access_class(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_can_access_subject(p_school_id uuid, p_subject_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_staff_accounts ssa
    WHERE ssa.user_id = (SELECT auth.uid())
      AND ssa.school_id = p_school_id
      AND ssa.is_active IS TRUE
      AND (
        ssa.role = 'head_teacher'
        OR (
          ssa.role = 'teacher'
          AND EXISTS (
            SELECT 1 FROM public.school_staff_teaching_assignments a
            WHERE a.staff_account_id = ssa.id
              AND a.school_id = p_school_id
              AND a.subject_id = p_subject_id
          )
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION public.staff_can_access_subject(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_can_access_subject(uuid, uuid) TO authenticated;


-- SECURITY DEFINER scope helpers avoid recursive RLS evaluation when a
-- policy needs to inspect enrollment/student/result relationships.
CREATE OR REPLACE FUNCTION public.staff_can_access_student(p_student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $staff$
  SELECT EXISTS (
    SELECT 1 FROM public.students st
    JOIN public.student_enrollments e ON e.student_id = st.id
    WHERE st.id = p_student_id
      AND (
        EXISTS (
          SELECT 1 FROM public.school_staff_accounts ssa
          WHERE ssa.user_id = (SELECT auth.uid())
            AND ssa.school_id = st.school_id
            AND ssa.is_active IS TRUE
            AND ssa.role = 'head_teacher'
        )
        OR public.staff_can_access_class(st.school_id, e.class_id)
      )
  );
$staff$;
REVOKE ALL ON FUNCTION public.staff_can_access_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_can_access_student(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_can_access_enrollment(p_enrollment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $staff$
  SELECT EXISTS (
    SELECT 1 FROM public.student_enrollments e
    JOIN public.students st ON st.id = e.student_id
    WHERE e.id = p_enrollment_id
      AND (
        EXISTS (
          SELECT 1 FROM public.school_staff_accounts ssa
          WHERE ssa.user_id = (SELECT auth.uid())
            AND ssa.school_id = st.school_id
            AND ssa.is_active IS TRUE
            AND ssa.role = 'head_teacher'
        )
        OR public.staff_can_access_class(st.school_id, e.class_id)
      )
  );
$staff$;
REVOKE ALL ON FUNCTION public.staff_can_access_enrollment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_can_access_enrollment(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_can_access_result(p_exam_subject_id uuid, p_enrollment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $staff$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_enrollments e
    JOIN public.students st ON st.id = e.student_id
    JOIN public.exam_subjects es ON es.id = p_exam_subject_id
    JOIN public.exams ex ON ex.id = es.exam_id
    JOIN public.school_staff_accounts ssa
      ON ssa.user_id = (SELECT auth.uid())
     AND ssa.school_id = st.school_id
     AND ssa.is_active IS TRUE
    WHERE e.id = p_enrollment_id
      AND ex.school_id = st.school_id
      AND ex.class_id = e.class_id
      AND (
        ssa.role = 'head_teacher'
        OR (ssa.role = 'class_teacher' AND ssa.class_id = e.class_id)
        OR (
          ssa.role = 'teacher'
          AND EXISTS (
            SELECT 1 FROM public.school_staff_teaching_assignments a
            WHERE a.staff_account_id = ssa.id
              AND a.school_id = st.school_id
              AND a.class_id = e.class_id
              AND a.subject_id = es.subject_id
          )
        )
      )
  );
$staff$;
REVOKE ALL ON FUNCTION public.staff_can_access_result(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_can_access_result(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS staff_read_assigned_exam_subjects ON public.exam_subjects;
CREATE POLICY staff_read_assigned_exam_subjects ON public.exam_subjects
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exams ex
      WHERE ex.id = exam_subjects.exam_id
        AND (
          EXISTS (
            SELECT 1 FROM public.school_staff_accounts ssa
            WHERE ssa.user_id = (SELECT auth.uid())
              AND ssa.school_id = ex.school_id
              AND ssa.is_active IS TRUE
              AND (
                ssa.role = 'head_teacher'
                OR (ssa.role = 'class_teacher' AND ssa.class_id = ex.class_id)
                OR (
                  ssa.role = 'teacher'
                  AND EXISTS (
                    SELECT 1 FROM public.school_staff_teaching_assignments a
                    WHERE a.staff_account_id = ssa.id
                      AND a.school_id = ex.school_id
                      AND a.class_id = ex.class_id
                      AND a.subject_id = exam_subjects.subject_id
                  )
                )
              )
          )
        )
    )
  );

-- Own staff row and own assignment visibility.
DROP POLICY IF EXISTS school_staff_read_own_account ON public.school_staff_accounts;
CREATE POLICY school_staff_read_own_account
  ON public.school_staff_accounts FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS staff_read_own_teaching_assignments ON public.school_staff_teaching_assignments;
CREATE POLICY staff_read_own_teaching_assignments
  ON public.school_staff_teaching_assignments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.school_staff_accounts ssa
      WHERE ssa.id = school_staff_teaching_assignments.staff_account_id
        AND ssa.user_id = (SELECT auth.uid())
        AND ssa.is_active IS TRUE
        AND ssa.school_id = school_staff_teaching_assignments.school_id
    )
  );

DROP POLICY IF EXISTS school_admin_manage_teaching_assignments ON public.school_staff_teaching_assignments;
CREATE POLICY school_admin_manage_teaching_assignments
  ON public.school_staff_teaching_assignments FOR ALL TO authenticated
  USING (public.is_active_school_admin_for_school(school_id))
  WITH CHECK (
    public.is_active_school_admin_for_school(school_id)
    AND EXISTS (
      SELECT 1
      FROM public.school_staff_accounts ssa
      JOIN public.classes c ON c.id = school_staff_teaching_assignments.class_id
      JOIN public.subjects sub ON sub.id = school_staff_teaching_assignments.subject_id
      WHERE ssa.id = school_staff_teaching_assignments.staff_account_id
        AND ssa.school_id = school_staff_teaching_assignments.school_id
        AND ssa.role = 'teacher'
        AND ssa.is_active IS TRUE
        AND c.school_id = school_staff_teaching_assignments.school_id
        AND sub.school_id = school_staff_teaching_assignments.school_id
    )
  );

-- Class and subject catalog access is limited to the staff member's scope.
DROP POLICY IF EXISTS staff_read_assigned_classes ON public.classes;
CREATE POLICY staff_read_assigned_classes ON public.classes
  FOR SELECT TO authenticated
  USING (public.staff_can_access_class(school_id, id));

DROP POLICY IF EXISTS staff_read_assigned_subjects ON public.subjects;
CREATE POLICY staff_read_assigned_subjects ON public.subjects
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.school_staff_accounts ssa
      WHERE ssa.user_id = (SELECT auth.uid())
        AND ssa.school_id = subjects.school_id
        AND ssa.is_active IS TRUE
        AND ssa.role = 'head_teacher'
    )
    OR public.staff_can_access_subject(school_id, id)
  );

-- Head teachers see all students in their school; class teachers see only
-- students enrolled in their assigned class. Subject teachers see students
-- only in classes for which they have a teaching assignment.
DROP POLICY IF EXISTS staff_read_scoped_students ON public.students;
CREATE POLICY staff_read_scoped_students ON public.students
  FOR SELECT TO authenticated
  USING (public.staff_can_access_student(id));

DROP POLICY IF EXISTS staff_read_scoped_enrollments ON public.student_enrollments;
CREATE POLICY staff_read_scoped_enrollments ON public.student_enrollments
  FOR SELECT TO authenticated
  USING (public.staff_can_access_enrollment(id));

DROP POLICY IF EXISTS staff_read_scoped_exams ON public.exams;
CREATE POLICY staff_read_scoped_exams ON public.exams
  FOR SELECT TO authenticated
  USING (
    public.staff_can_access_class(school_id, class_id)
  );

-- Staff can read results only where the exam subject and enrolled class match
-- their assignment. Class teachers can access all subjects in their class.
DROP POLICY IF EXISTS staff_read_scoped_results ON public.student_results;
CREATE POLICY staff_read_scoped_results ON public.student_results
  FOR SELECT TO authenticated
  USING (public.staff_can_access_result(exam_subject_id, enrollment_id));

DROP POLICY IF EXISTS staff_insert_scoped_results ON public.student_results;
CREATE POLICY staff_insert_scoped_results ON public.student_results
  FOR INSERT TO authenticated
  WITH CHECK (
    public.staff_can_access_result(exam_subject_id, enrollment_id)
    AND EXISTS (
      SELECT 1 FROM public.school_staff_accounts ssa
      WHERE ssa.user_id = (SELECT auth.uid())
        AND ssa.is_active IS TRUE
        AND ssa.role IN ('head_teacher', 'class_teacher')
    )
  );

DROP POLICY IF EXISTS staff_update_scoped_results ON public.student_results;
CREATE POLICY staff_update_scoped_results ON public.student_results
  FOR UPDATE TO authenticated
  USING (
    public.staff_can_access_result(exam_subject_id, enrollment_id)
    AND EXISTS (
      SELECT 1 FROM public.school_staff_accounts ssa
      WHERE ssa.user_id = (SELECT auth.uid())
        AND ssa.is_active IS TRUE
        AND ssa.role IN ('head_teacher', 'class_teacher')
    )
  )
  WITH CHECK (
    public.staff_can_access_result(exam_subject_id, enrollment_id)
    AND EXISTS (
      SELECT 1 FROM public.school_staff_accounts ssa
      WHERE ssa.user_id = (SELECT auth.uid())
        AND ssa.is_active IS TRUE
        AND ssa.role IN ('head_teacher', 'class_teacher')
    )
  );

-- Accountant staff accounts may use the existing fee-management policies.
-- Existing school_admin membership access is retained.
CREATE OR REPLACE FUNCTION public.is_school_fee_admin(target_school_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_members sm
    WHERE sm.school_id = target_school_id
      AND sm.user_id = (SELECT auth.uid())
      AND sm.role = 'school_admin'
      AND sm.is_active IS TRUE
  )
  OR public.is_active_school_staff_for_school(target_school_id, ARRAY['accountant']);
$$;
REVOKE ALL ON FUNCTION public.is_school_fee_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_school_fee_admin(uuid) TO authenticated;
