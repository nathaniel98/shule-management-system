-- Allow staff accounts to store a phone number for phone/password authentication.
ALTER TABLE public.school_staff_accounts
  ADD COLUMN IF NOT EXISTS phone text;

CREATE UNIQUE INDEX IF NOT EXISTS school_staff_accounts_phone_unique
  ON public.school_staff_accounts (phone)
  WHERE phone IS NOT NULL AND btrim(phone) <> '';
