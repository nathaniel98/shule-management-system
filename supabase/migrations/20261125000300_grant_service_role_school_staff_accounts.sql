-- Allow the trusted Edge Function service-role client to manage staff account rows.
-- Browser roles remain unable to insert, update, or delete these records.
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.school_staff_accounts
TO service_role;
