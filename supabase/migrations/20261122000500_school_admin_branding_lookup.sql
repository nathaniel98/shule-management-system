-- Resolve the signed-in School Admin's own school for branding settings.
-- Supports both active school_members and the explicit school_admin_profiles link.
CREATE OR REPLACE FUNCTION public.is_active_school_admin_for_school(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.school_members AS sm
      WHERE sm.user_id = auth.uid()
        AND sm.school_id = p_school_id
        AND sm.role = 'school_admin'
        AND sm.is_active IS TRUE
    )
    OR EXISTS (
      SELECT 1
      FROM public.school_admin_profiles AS sap
      WHERE sap.user_id = auth.uid()
        AND sap.school_id = p_school_id
    );
$function$;

REVOKE ALL ON FUNCTION public.is_active_school_admin_for_school(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_school_admin_for_school(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_school()
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
    SELECT sap.school_id
    FROM public.school_admin_profiles AS sap
    WHERE sap.user_id = auth.uid()
  )
  ORDER BY sc.school_name
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_my_school() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_school() TO authenticated;
