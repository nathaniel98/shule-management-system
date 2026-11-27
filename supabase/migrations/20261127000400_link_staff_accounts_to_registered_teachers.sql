-- Link staff login accounts to the school's registered teacher records.
-- Existing accounts are linked only when the full name is an unambiguous match.

ALTER TABLE public.school_staff_accounts
  ADD COLUMN IF NOT EXISTS teacher_id uuid NULL
  REFERENCES public.teachers(id) ON DELETE SET NULL;

WITH candidate_pairs AS (
  SELECT
    ssa.id AS staff_account_id,
    t.id AS teacher_id
  FROM public.school_staff_accounts AS ssa
  JOIN public.teachers AS t
    ON t.school_id = ssa.school_id
   AND lower(regexp_replace(trim(concat_ws(' ', t.first_name, NULLIF(t.middle_name, ''), t.last_name)), '[[:space:]]+', ' ', 'g'))
       = lower(regexp_replace(trim(ssa.display_name), '[[:space:]]+', ' ', 'g'))
  WHERE ssa.teacher_id IS NULL
    AND ssa.role IN ('teacher', 'class_teacher')
), unambiguous_staff AS (
  SELECT staff_account_id, min(teacher_id::text)::uuid AS teacher_id
  FROM candidate_pairs
  GROUP BY staff_account_id
  HAVING count(*) = 1
), unambiguous_teachers AS (
  SELECT teacher_id
  FROM unambiguous_staff
  GROUP BY teacher_id
  HAVING count(*) = 1
)
UPDATE public.school_staff_accounts AS ssa
SET teacher_id = us.teacher_id
FROM unambiguous_staff AS us
JOIN unambiguous_teachers AS ut ON ut.teacher_id = us.teacher_id
WHERE ssa.id = us.staff_account_id;

CREATE UNIQUE INDEX IF NOT EXISTS school_staff_accounts_teacher_unique
  ON public.school_staff_accounts (teacher_id)
  WHERE teacher_id IS NOT NULL;

COMMENT ON COLUMN public.school_staff_accounts.teacher_id IS
  'Optional link to the registered teacher record belonging to the same school.';
