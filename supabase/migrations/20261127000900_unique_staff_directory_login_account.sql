-- A staff directory person can have only one system login account per school.
CREATE UNIQUE INDEX IF NOT EXISTS school_staff_accounts_staff_member_unique
  ON public.school_staff_accounts (staff_member_id)
  WHERE staff_member_id IS NOT NULL;
