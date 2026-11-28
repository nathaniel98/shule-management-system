-- Monthly staff payroll schema.
CREATE TABLE IF NOT EXISTS public.staff_salary_profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
 staff_member_id uuid NOT NULL REFERENCES public.school_staff_directory(id) ON DELETE RESTRICT,
 base_salary numeric(14,2) NOT NULL CHECK(base_salary>=0), payment_day smallint NOT NULL DEFAULT 30 CHECK(payment_day BETWEEN 1 AND 31),
 effective_from date NOT NULL DEFAULT CURRENT_DATE, is_active boolean NOT NULL DEFAULT true, notes text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(school_id,staff_member_id)
);
CREATE TABLE IF NOT EXISTS public.staff_salary_adjustments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
 staff_member_id uuid NOT NULL REFERENCES public.school_staff_directory(id) ON DELETE RESTRICT,
 adjustment_type text NOT NULL CHECK(adjustment_type IN ('allowance','deduction')), description text NOT NULL,
 amount numeric(14,2) NOT NULL CHECK(amount>0), frequency text NOT NULL DEFAULT 'monthly' CHECK(frequency IN ('monthly','one_time')),
 effective_from date NOT NULL DEFAULT CURRENT_DATE, effective_until date, is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), CHECK(effective_until IS NULL OR effective_until>=effective_from)
);
CREATE TABLE IF NOT EXISTS public.staff_salary_advances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
 staff_member_id uuid NOT NULL REFERENCES public.school_staff_directory(id) ON DELETE RESTRICT,
 advance_date date NOT NULL DEFAULT CURRENT_DATE, amount numeric(14,2) NOT NULL CHECK(amount>0),
 repaid_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK(repaid_amount>=0 AND repaid_amount<=amount),
 monthly_deduction numeric(14,2) NOT NULL CHECK(monthly_deduction>0),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','settled','cancelled')), notes text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.monthly_payroll_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
 payroll_month date NOT NULL CHECK(EXTRACT(DAY FROM payroll_month)=1), status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','partially_paid','paid')),
 total_gross numeric(14,2) NOT NULL DEFAULT 0 CHECK(total_gross>=0), total_deductions numeric(14,2) NOT NULL DEFAULT 0 CHECK(total_deductions>=0),
 total_net numeric(14,2) NOT NULL DEFAULT 0 CHECK(total_net>=0), created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(school_id,payroll_month)
);
CREATE TABLE IF NOT EXISTS public.monthly_payroll_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
 payroll_run_id uuid NOT NULL REFERENCES public.monthly_payroll_runs(id) ON DELETE CASCADE,
 staff_member_id uuid NOT NULL REFERENCES public.school_staff_directory(id) ON DELETE RESTRICT,
 base_salary numeric(14,2) NOT NULL CHECK(base_salary>=0), allowances numeric(14,2) NOT NULL DEFAULT 0 CHECK(allowances>=0),
 deductions numeric(14,2) NOT NULL DEFAULT 0 CHECK(deductions>=0), advance_deduction numeric(14,2) NOT NULL DEFAULT 0 CHECK(advance_deduction>=0),
 net_pay numeric(14,2) NOT NULL CHECK(net_pay>=0), payment_status text NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','paid')),
 paid_at timestamptz, payment_method text CHECK(payment_method IN ('cash','bank','mobile_money','cheque')), payment_reference text,
 notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(payroll_run_id,staff_member_id)
);
CREATE INDEX IF NOT EXISTS staff_salary_profiles_school_idx ON public.staff_salary_profiles(school_id,is_active);
CREATE INDEX IF NOT EXISTS staff_salary_adjustments_lookup_idx ON public.staff_salary_adjustments(school_id,staff_member_id,is_active);
CREATE INDEX IF NOT EXISTS staff_salary_advances_lookup_idx ON public.staff_salary_advances(school_id,staff_member_id,status);
CREATE INDEX IF NOT EXISTS monthly_payroll_runs_school_month_idx ON public.monthly_payroll_runs(school_id,payroll_month DESC);
CREATE INDEX IF NOT EXISTS monthly_payroll_items_run_idx ON public.monthly_payroll_items(payroll_run_id,payment_status);
ALTER TABLE public.staff_salary_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_salary_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_salary_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_payroll_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.staff_salary_profiles,public.staff_salary_adjustments,public.staff_salary_advances,public.monthly_payroll_runs,public.monthly_payroll_items TO authenticated;
REVOKE ALL ON public.staff_salary_profiles,public.staff_salary_adjustments,public.staff_salary_advances,public.monthly_payroll_runs,public.monthly_payroll_items FROM anon;
CREATE POLICY salary_profiles_read_school ON public.staff_salary_profiles FOR SELECT TO authenticated USING(public.is_active_school_admin_for_school(school_id) OR public.is_active_school_accountant_for_school(school_id));
CREATE POLICY salary_profiles_admin_write ON public.staff_salary_profiles FOR ALL TO authenticated USING(public.is_active_school_admin_for_school(school_id)) WITH CHECK(public.is_active_school_admin_for_school(school_id));
CREATE POLICY salary_adjustments_read_school ON public.staff_salary_adjustments FOR SELECT TO authenticated USING(public.is_active_school_admin_for_school(school_id) OR public.is_active_school_accountant_for_school(school_id));
CREATE POLICY salary_adjustments_admin_write ON public.staff_salary_adjustments FOR ALL TO authenticated USING(public.is_active_school_admin_for_school(school_id)) WITH CHECK(public.is_active_school_admin_for_school(school_id));
CREATE POLICY salary_advances_read_school ON public.staff_salary_advances FOR SELECT TO authenticated USING(public.is_active_school_admin_for_school(school_id) OR public.is_active_school_accountant_for_school(school_id));
CREATE POLICY salary_advances_accountant_insert ON public.staff_salary_advances FOR INSERT TO authenticated WITH CHECK(public.is_active_school_admin_for_school(school_id) OR public.is_active_school_accountant_for_school(school_id));
CREATE POLICY salary_advances_admin_update ON public.staff_salary_advances FOR UPDATE TO authenticated USING(public.is_active_school_admin_for_school(school_id)) WITH CHECK(public.is_active_school_admin_for_school(school_id));
CREATE POLICY payroll_runs_read_school ON public.monthly_payroll_runs FOR SELECT TO authenticated USING(public.is_active_school_admin_for_school(school_id) OR public.is_active_school_accountant_for_school(school_id));
CREATE POLICY payroll_runs_accountant_insert ON public.monthly_payroll_runs FOR INSERT TO authenticated WITH CHECK((public.is_active_school_admin_for_school(school_id) OR public.is_active_school_accountant_for_school(school_id)) AND created_by=auth.uid());
CREATE POLICY payroll_items_read_school ON public.monthly_payroll_items FOR SELECT TO authenticated USING(public.is_active_school_admin_for_school(school_id) OR public.is_active_school_accountant_for_school(school_id));
CREATE POLICY payroll_items_accountant_insert ON public.monthly_payroll_items FOR INSERT TO authenticated WITH CHECK(public.is_active_school_admin_for_school(school_id) OR public.is_active_school_accountant_for_school(school_id));
REVOKE UPDATE ON public.monthly_payroll_runs,public.monthly_payroll_items FROM authenticated;
GRANT UPDATE(status,total_gross,total_deductions,total_net,updated_at) ON public.monthly_payroll_runs TO authenticated;
GRANT UPDATE(payment_status,paid_at,payment_method,payment_reference,notes,updated_at) ON public.monthly_payroll_items TO authenticated;
CREATE POLICY payroll_runs_accountant_update_totals ON public.monthly_payroll_runs FOR UPDATE TO authenticated USING(public.is_active_school_admin_for_school(school_id) OR public.is_active_school_accountant_for_school(school_id)) WITH CHECK(public.is_active_school_admin_for_school(school_id) OR public.is_active_school_accountant_for_school(school_id));
CREATE POLICY payroll_items_accountant_payment_update ON public.monthly_payroll_items FOR UPDATE TO authenticated USING(public.is_active_school_admin_for_school(school_id) OR public.is_active_school_accountant_for_school(school_id)) WITH CHECK((public.is_active_school_admin_for_school(school_id) OR public.is_active_school_accountant_for_school(school_id)) AND payment_status IN ('unpaid','paid'));
