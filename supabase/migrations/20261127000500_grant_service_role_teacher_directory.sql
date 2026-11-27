-- The teacher directory Edge Function uses the service-role client after
-- validating the signed-in School Admin and requested school.
-- Grant only the read access required by that trusted endpoint.
GRANT SELECT ON TABLE public.teachers TO service_role;
