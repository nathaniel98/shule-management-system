-- Public, read-only receipt verification by receipt number. Exposes only receipt details needed for verification.
CREATE OR REPLACE FUNCTION public.verify_fee_receipt(p_receipt_number text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'receipt_number', p.receipt_number,
    'payment_date', p.payment_date,
    'payment_method', p.payment_method,
    'amount_paid', p.amount,
    'student_name', concat_ws(' ', s.first_name, s.middle_name, s.last_name),
    'admission_no', s.admission_no,
    'school_name', sch.school_name,
    'total_fees', a.total_amount,
    'total_paid', COALESCE((
      SELECT SUM(fp.amount)
      FROM public.fee_payments fp
      WHERE fp.student_fee_account_id = a.id
    ), 0),
    'balance', GREATEST(0, a.total_amount - COALESCE((
      SELECT SUM(fp.amount)
      FROM public.fee_payments fp
      WHERE fp.student_fee_account_id = a.id
    ), 0))
  )
  FROM public.fee_payments p
  JOIN public.student_fee_accounts a ON a.id = p.student_fee_account_id
  JOIN public.student_enrollments e ON e.id = a.enrollment_id
  JOIN public.students s ON s.id = e.student_id
  JOIN public.fee_structures fs ON fs.id = a.fee_structure_id
  JOIN public.schools sch ON sch.id = fs.school_id
  WHERE p.receipt_number = p_receipt_number
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_fee_receipt(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_fee_receipt(text) TO anon, authenticated;
