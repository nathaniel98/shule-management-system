-- Resolve the school for either an active School Admin or a staff login.
CREATE OR REPLACE FUNCTION public.get_my_school_for_staff()
RETURNS SETOF public.schools
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT sc.*
  FROM public.schools AS sc
  WHERE sc.id IN (
    SELECT sm.school_id
    FROM public.school_members AS sm
    WHERE sm.user_id = auth.uid()
      AND sm.role = 'school_admin'
      AND sm.is_active IS TRUE
    UNION
    SELECT ssa.school_id
    FROM public.school_staff_accounts AS ssa
    WHERE ssa.user_id = auth.uid()
      AND ssa.is_active IS TRUE
  )
  ORDER BY sc.school_name
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_my_school_for_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_school_for_staff() TO authenticated;
