-- Allow an active school_admin to register students only in their own school.
-- This is additive: existing SELECT/UPDATE/DELETE policies and student data remain unchanged.

-- SECURITY DEFINER keeps membership verification independent of school_members RLS,
-- while auth.uid() still binds the check to the signed-in user.
CREATE OR REPLACE FUNCTION public.is_active_school_admin_for_school(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_members AS sm
    WHERE sm.user_id = auth.uid()
      AND sm.school_id = p_school_id
      AND sm.role = 'school_admin'
      AND sm.is_active IS TRUE
  );
$function$;

REVOKE ALL ON FUNCTION public.is_active_school_admin_for_school(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_school_admin_for_school(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_internal_student_admission_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_prefix text;
  v_existing_max numeric;
  v_next numeric;
BEGIN
  -- Trusted service-role and system-admin callers retain their existing access.
  -- A school administrator is authorized only for their active school membership.
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_system_admin()
     AND NOT public.is_active_school_admin_for_school(NEW.school_id)
  THEN
    RAISE EXCEPTION 'Not authorized to register students for this school'
      USING ERRCODE = '42501';
  END IF;

  SELECT public.student_admission_initials(sc.school_name)
    INTO v_prefix
  FROM public.schools AS sc
  WHERE sc.id = NEW.school_id;

  IF v_prefix IS NULL OR v_prefix = '' THEN
    RAISE EXCEPTION 'School must exist and have a name with initials';
  END IF;

  SELECT COALESCE(
           MAX(substring(s.admission_no FROM '([0-9]+)$')::numeric),
           0
         )
    INTO v_existing_max
  FROM public.students AS s
  WHERE s.school_id = NEW.school_id;

  -- Lock/update the school's counter atomically to prevent duplicate numbers.
  INSERT INTO public.student_admission_counters AS counter (school_id, last_number)
  VALUES (NEW.school_id, v_existing_max + 1)
  ON CONFLICT (school_id) DO UPDATE
    SET last_number = GREATEST(counter.last_number, v_existing_max) + 1,
        updated_at = now()
  RETURNING last_number INTO v_next;

  NEW.admission_no := v_prefix || '-' ||
    lpad(v_next::text, GREATEST(4, length(v_next::text)), '0');

  RETURN NEW;
END;
$function$;

-- PostgreSQL permissive INSERT policies are OR-combined. Adding this policy
-- preserves existing policies while granting active school_admins access
-- only when the new student's school matches their membership.
DROP POLICY IF EXISTS students_insert_school_admin_own_school
  ON public.students;

CREATE POLICY students_insert_school_admin_own_school
  ON public.students
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_system_admin()
    OR public.is_active_school_admin_for_school(students.school_id)
  );
