-- Allow staff accounts to use a phone number without requiring a personal email.
-- Phone-only staff authenticate through the server-side login function using
-- an internal confirmed Auth email; their real phone remains in this table.
ALTER TABLE public.school_staff_accounts
  ALTER COLUMN email DROP NOT NULL;

COMMENT ON COLUMN public.school_staff_accounts.email IS
  'Optional contact email. Staff may sign in with their registered phone number and password.';
