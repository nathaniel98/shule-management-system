-- Prefer the active School Admin membership when resolving the current school.
-- A user may have both an admin membership and a staff account, potentially
-- associated with different schools. The admin console must resolve to the
-- school where the user has School Admin permissions.
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
        FROM public.school_members AS sm
        WHERE sm.school_id = sc.id
          AND sm.user_id = auth.uid()
          AND sm.role = 'school_admin'
          AND sm.is_active IS TRUE
      ) THEN 0
      ELSE 1
    END,
    sc.school_name
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_my_school_for_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_school_for_staff() TO authenticated;
