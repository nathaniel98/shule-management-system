-- Automatically assign a unique admission number to each new student.
-- Existing student admission numbers are preserved.
-- Format: SCHOOL PREFIX + six-digit running number (example: RG 000068).

CREATE TABLE IF NOT EXISTS public.student_admission_counters (
  school_id text PRIMARY KEY,
  last_number bigint NOT NULL DEFAULT 0 CHECK (last_number >= 0)
);

-- The counter is maintained only by the database trigger.
ALTER TABLE public.student_admission_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.student_admission_counters FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.assign_student_admission_no()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_code text;
  v_prefix text;
  v_next bigint;
  v_school_id text;
  v_existing_max bigint;
BEGIN
  -- Do not replace a number supplied intentionally by a trusted process.
  IF NEW.admission_no IS NOT NULL AND btrim(NEW.admission_no) <> '' THEN
    RETURN NEW;
  END IF;

  v_school_id := NEW.school_id::text;

  SELECT school_code
    INTO v_school_code
    FROM public.schools
   WHERE id = NEW.school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'School not found for student registration';
  END IF;

  -- Use the alphabetic part of the school's existing code (e.g. RG 0001 -> RG).
  v_prefix := upper(regexp_replace(coalesce(v_school_code, ''), '[^A-Za-z]', '', 'g'));
  IF v_prefix = '' THEN
    v_prefix := 'ST';
  END IF;

  -- Start after the largest numeric suffix already used by this school.
  SELECT coalesce(max(nullif(regexp_replace(admission_no, '[^0-9]', '', 'g'), '')::bigint), 0)
    INTO v_existing_max
    FROM public.students
   WHERE school_id = NEW.school_id;

  INSERT INTO public.student_admission_counters (school_id, last_number)
  VALUES (v_school_id, v_existing_max + 1)
  ON CONFLICT (school_id) DO UPDATE
     SET last_number = greatest(
       public.student_admission_counters.last_number,
       v_existing_max
     ) + 1
  RETURNING last_number INTO v_next;

  NEW.admission_no := v_prefix || ' ' || lpad(v_next::text, 6, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_student_admission_no ON public.students;

CREATE TRIGGER trg_assign_student_admission_no
BEFORE INSERT ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.assign_student_admission_no();
