CREATE OR REPLACE FUNCTION public.assign_school_class_teacher(
  p_staff_account_id uuid,
  p_class_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_school_id uuid;
BEGIN
  SELECT ssa.school_id
    INTO v_school_id
  FROM public.school_staff_accounts ssa
  WHERE ssa.id = p_staff_account_id
    AND ssa.role IN ('class_teacher', 'teacher')
    AND ssa.is_active IS TRUE;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Akaunti hai ya mwalimu haijapatikana.';
  END IF;

  IF NOT public.is_active_school_admin_for_school(v_school_id) THEN
    RAISE EXCEPTION 'Huna ruhusa ya kupanga walimu katika shule hii.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.classes c
    WHERE c.id = p_class_id
      AND c.school_id = v_school_id
  ) THEN
    RAISE EXCEPTION 'Darasa ulilochagua si la shule hii.';
  END IF;

  UPDATE public.school_staff_accounts
  SET class_id = p_class_id
  WHERE id = p_staff_account_id
    AND school_id = v_school_id
    AND role IN ('class_teacher', 'teacher')
    AND is_active IS TRUE;
END;
$function$;
