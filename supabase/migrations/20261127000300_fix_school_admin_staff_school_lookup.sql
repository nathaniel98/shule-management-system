-- Resolve the current School Admin's school using either supported admin link.
-- The admin profile is authoritative for the signed-in school context.
CREATE OR REPLACE FUNCTION public.get_my_school_for_staff()
RETURNS SETOF public.schools
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT sc.*
  FROM public.schools AS sc
  WHERE
    EXISTS (
      SELECT 1
      FROM public.school_admin_profiles AS sap
      WHERE sap.school_id = sc.id
        AND sap.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.school_members AS sm
      WHERE sm.school_id = sc.id
        AND sm.user_id = auth.uid()
        AND sm.role = 'school_admin'
        AND sm.is_active IS TRUE
    )
    OR EXISTS (
      SELECT 1
      FROM public.school_staff_accounts AS ssa
      WHERE ssa.school_id = sc.id
        AND ssa.user_id = auth.uid()
        AND ssa.is_active IS TRUE
    )
  ORDER BY
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.school_admin_profiles AS sap
        WHERE sap.school_id = sc.id
          AND sap.user_id = auth.uid()
      ) THEN 0
      WHEN EXISTS (
        SELECT 1
        FROM public.school_members AS sm
        WHERE sm.school_id = sc.id
          AND sm.user_id = auth.uid()
          AND sm.role = 'school_admin'
          AND sm.is_active IS TRUE
      ) THEN 1
      ELSE 2
    END,
    sc.school_name
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_my_school_for_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_school_for_staff() TO authenticated;
