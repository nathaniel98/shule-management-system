-- A unified school staff directory keeps employment records separate from login roles.
CREATE TABLE IF NOT EXISTS public.school_staff_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  employee_no text,
  full_name text NOT NULL,
  staff_category text NOT NULL CHECK (staff_category IN ('teaching', 'support')),
  job_title text NOT NULL,
  phone text,
  email text,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_staff_directory_teacher_category_check CHECK (teacher_id IS NULL OR staff_category = 'teaching')
);
CREATE UNIQUE INDEX IF NOT EXISTS school_staff_directory_teacher_unique ON public.school_staff_directory (teacher_id) WHERE teacher_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS school_staff_directory_employee_no_unique ON public.school_staff_directory (school_id, lower(employee_no)) WHERE employee_no IS NOT NULL AND trim(employee_no) <> '';
CREATE INDEX IF NOT EXISTS school_staff_directory_school_idx ON public.school_staff_directory (school_id, full_name);
ALTER TABLE public.school_staff_directory ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_staff_directory FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_staff_directory TO authenticated;
GRANT ALL ON public.school_staff_directory TO service_role;
DROP POLICY IF EXISTS school_admin_manage_staff_directory ON public.school_staff_directory;
CREATE POLICY school_admin_manage_staff_directory ON public.school_staff_directory FOR ALL TO authenticated
  USING (public.is_active_school_admin_for_school(school_id))
  WITH CHECK (public.is_active_school_admin_for_school(school_id));
INSERT INTO public.school_staff_directory (school_id, employee_no, full_name, staff_category, job_title, phone, email, status, teacher_id)
SELECT t.school_id, t.employee_no, trim(concat_ws(' ', t.first_name, NULLIF(t.middle_name, ''), t.last_name)),
  'teaching', 'Mwalimu', t.phone, t.email,
  CASE WHEN lower(coalesce(t.status, 'active')) IN ('inactive', 'terminated', 'left') THEN 'Inactive' ELSE 'Active' END, t.id
FROM public.teachers t
ON CONFLICT (teacher_id) WHERE teacher_id IS NOT NULL DO NOTHING;
ALTER TABLE public.school_staff_accounts ADD COLUMN IF NOT EXISTS staff_member_id uuid REFERENCES public.school_staff_directory(id) ON DELETE SET NULL;
UPDATE public.school_staff_accounts a SET staff_member_id = d.id
FROM public.school_staff_directory d
WHERE a.staff_member_id IS NULL AND a.teacher_id IS NOT NULL AND d.teacher_id = a.teacher_id AND d.school_id = a.school_id;
CREATE INDEX IF NOT EXISTS school_staff_accounts_staff_member_idx ON public.school_staff_accounts (staff_member_id);
