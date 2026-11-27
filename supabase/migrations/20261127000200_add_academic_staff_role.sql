alter table public.school_staff_accounts
  drop constraint if exists school_staff_accounts_role_check;

alter table public.school_staff_accounts
  add constraint school_staff_accounts_role_check
  check (role = any (array['class_teacher', 'head_teacher', 'accountant', 'teacher', 'academic']::text[]));
