-- Generate monthly payroll atomically and apply outstanding salary advances.
CREATE OR REPLACE FUNCTION public.generate_monthly_staff_payroll(p_school_id uuid, p_payroll_month date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
  v_staff record;
  v_adv record;
  v_take numeric(14,2);
  v_allowances numeric(14,2);
  v_regular_deductions numeric(14,2);
  v_advance_due numeric(14,2);
  v_advance_deduct numeric(14,2);
  v_gross numeric(14,2);
  v_deductions numeric(14,2);
  v_net numeric(14,2);
  v_total_gross numeric(14,2) := 0;
  v_total_deductions numeric(14,2) := 0;
  v_total_net numeric(14,2) := 0;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT (
    public.is_active_school_admin_for_school(p_school_id)
    OR public.is_active_school_accountant_for_school(p_school_id)
  ) THEN
    RAISE EXCEPTION 'Huna ruhusa ya kutengeneza payroll ya shule hii.';
  END IF;
  IF p_payroll_month IS NULL OR EXTRACT(DAY FROM p_payroll_month) <> 1 THEN
    RAISE EXCEPTION 'Chagua mwezi sahihi wa payroll.';
  END IF;

  INSERT INTO public.monthly_payroll_runs(school_id,payroll_month,created_by)
  VALUES(p_school_id,p_payroll_month,v_user)
  RETURNING id INTO v_run_id;

  FOR v_staff IN
    SELECT p.staff_member_id,p.base_salary
    FROM public.staff_salary_profiles p
    JOIN public.school_staff_directory d ON d.id=p.staff_member_id AND d.school_id=p.school_id
    WHERE p.school_id=p_school_id AND p.is_active=true AND d.status='Active'
    ORDER BY p.staff_member_id
  LOOP
    SELECT
      COALESCE(sum(amount) FILTER (WHERE adjustment_type='allowance'),0),
      COALESCE(sum(amount) FILTER (WHERE adjustment_type='deduction'),0)
    INTO v_allowances,v_regular_deductions
    FROM public.staff_salary_adjustments
    WHERE school_id=p_school_id AND staff_member_id=v_staff.staff_member_id
      AND is_active=true AND effective_from < (p_payroll_month + interval '1 month')
      AND (effective_until IS NULL OR effective_until >= p_payroll_month)
      AND (frequency='monthly' OR (frequency='one_time' AND effective_from >= p_payroll_month));

    v_gross := v_staff.base_salary + v_allowances;
    v_deductions := LEAST(v_regular_deductions,v_gross);

    -- Lock each outstanding advance and apply at most one agreed deduction per advance.
    v_advance_deduct := 0;
    FOR v_adv IN
      SELECT id,monthly_deduction,amount,repaid_amount
      FROM public.staff_salary_advances
      WHERE school_id=p_school_id AND staff_member_id=v_staff.staff_member_id
        AND status='active' AND repaid_amount<amount
      ORDER BY advance_date,created_at
      FOR UPDATE
    LOOP
      EXIT WHEN v_advance_deduct >= GREATEST(0,v_gross-v_deductions);
      v_take := LEAST(v_adv.monthly_deduction,v_adv.amount-v_adv.repaid_amount,
        GREATEST(0,v_gross-v_deductions-v_advance_deduct));
      IF v_take > 0 THEN
        UPDATE public.staff_salary_advances
        SET repaid_amount=repaid_amount+v_take,
            status=CASE WHEN repaid_amount+v_take>=amount THEN 'settled' ELSE 'active' END
        WHERE id=v_adv.id;
        v_advance_deduct := v_advance_deduct + v_take;
      END IF;
    END LOOP;

    v_net := GREATEST(0,v_gross-v_deductions-v_advance_deduct);
    INSERT INTO public.monthly_payroll_items(
      school_id,payroll_run_id,staff_member_id,base_salary,allowances,
      deductions,advance_deduction,net_pay
    ) VALUES (
      p_school_id,v_run_id,v_staff.staff_member_id,v_staff.base_salary,
      v_allowances,v_deductions,v_advance_deduct,v_net
    );
    v_total_gross := v_total_gross + v_gross;
    v_total_deductions := v_total_deductions + v_deductions + v_advance_deduct;
    v_total_net := v_total_net + v_net;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.monthly_payroll_items WHERE payroll_run_id=v_run_id) THEN
    RAISE EXCEPTION 'Hakuna watumishi hai wenye mishahara iliyowekwa.';
  END IF;

  UPDATE public.monthly_payroll_runs
  SET total_gross=v_total_gross,total_deductions=v_total_deductions,
      total_net=v_total_net,updated_at=now()
  WHERE id=v_run_id;
  RETURN v_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_monthly_staff_payroll(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_monthly_staff_payroll(uuid,date) TO authenticated;
