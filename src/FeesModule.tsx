
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from './supabase';

type School = {
  id: string;
  school_name: string;
  school_code?: string;
};

type AcademicYear = {
  id: string;
  year_name: string;
  is_current?: boolean;
};

type SchoolClass = {
  id: string;
  class_name: string;
  education_level?: string;
};

type FeeStructure = {
  id: string;
  school_id: string;
  academic_year_id: string;
  class_id: string;
  school_fee: number;
  accommodation_fee: number;
  transport_fee: number;
};

type OtherCharge = {
  id: string;
  fee_structure_id: string;
  charge_name: string;
  amount: number;
  applies_to: 'All' | 'Day' | 'Boarding';
  is_mandatory: boolean;
};

type Enrollment = {
  id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string;
  accommodation_type: string;
  status: string;
};

type Student = {
  id: string;
  admission_no: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
};

type FeeAccount = {
  id: string;
  enrollment_id: string;
  fee_structure_id: string;
  school_fee: number;
  accommodation_fee: number;
  transport_fee: number;
  other_charges_total: number;
  total_amount: number;
};

type FeePayment = {
  id: string;
  student_fee_account_id: string;
  receipt_number: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number?: string | null;
  notes?: string | null;
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 13px',
  border: '1px solid #cbd5e1',
  borderRadius: 9,
  fontSize: 14,
  background: '#fff',
  color: '#1e293b'
};

const labelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 7,
  fontWeight: 600,
  color: '#334155',
  fontSize: 13
};

const buttonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 9,
  padding: '10px 14px',
  background: '#173b5e',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer'
};

const money = (value: number) =>
  new Intl.NumberFormat('en-TZ', {
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const emptyFee = {
  school_fee: '0',
  accommodation_fee: '0',
  transport_fee: '0'
};

const emptyCharge = {
  charge_name: '',
  amount: '',
  applies_to: 'All' as 'All' | 'Day' | 'Boarding',
  is_mandatory: true
};

const today = () => new Date().toISOString().slice(0, 10);

export default function FeesModule() {
  const [schools, setSchools] = useState<School[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [charges, setCharges] = useState<OtherCharge[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [accounts, setAccounts] = useState<FeeAccount[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);

  const [schoolId, setSchoolId] = useState('');
  const [yearId, setYearId] = useState('');
  const [classId, setClassId] = useState('');

  const [feeForm, setFeeForm] = useState(emptyFee);
  const [chargeForm, setChargeForm] = useState(emptyCharge);
  const [editingChargeId, setEditingChargeId] = useState<string | null>(null);

  const [paymentAccount, setPaymentAccount] = useState<FeeAccount | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: today(),
    payment_method: 'Cash',
    reference_number: '',
    notes: ''
  });

  const [historyAccount, setHistoryAccount] = useState<FeeAccount | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [tab, setTab] = useState<'setup' | 'accounts'>('setup');

  const selectedStructure = structures.find(
    item =>
      item.academic_year_id === yearId &&
      item.class_id === classId
  );

  const selectedCharges = charges.filter(
    item => item.fee_structure_id === selectedStructure?.id
  );

  const studentMap = useMemo(
    () => new Map(students.map(student => [student.id, student])),
    [students]
  );

  const enrollmentMap = useMemo(
    () => new Map(enrollments.map(item => [item.id, item])),
    [enrollments]
  );

  const accountStudents = accounts.map(account => {
    const enrollment = enrollmentMap.get(account.enrollment_id);
    const student = enrollment
      ? studentMap.get(enrollment.student_id)
      : undefined;

    const accountPayments = payments.filter(
      item => item.student_fee_account_id === account.id
    );

    const paid = accountPayments.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    return {
      account,
      enrollment,
      student,
      paid,
      balance: Math.max(0, Number(account.total_amount) - paid)
    };
  });

  const filteredAccounts = accountStudents.filter(item => {
    const name = [
      item.student?.admission_no,
      item.student?.first_name,
      item.student?.middle_name,
      item.student?.last_name
    ].filter(Boolean).join(' ').toLowerCase();

    return name.includes(search.toLowerCase());
  });

  const totals = accountStudents.reduce(
    (result, item) => ({
      total: result.total + Number(item.account.total_amount || 0),
      paid: result.paid + item.paid,
      debt: result.debt + item.balance
    }),
    { total: 0, paid: 0, debt: 0 }
  );

  function showError(e: unknown) {
    const err = e as { message?: string };
    setError(err.message || 'Imeshindikana kutekeleza ombi.');
  }

  async function loadSchools() {
    const { data, error } = await supabase
      .from('schools')
      .select('id, school_name, school_code')
      .order('school_name');

    if (error) throw error;

    const rows = (data || []) as School[];
    setSchools(rows);

    if (rows.length) {
      const selected = rows[0].id;
      setSchoolId(selected);
      await loadSchoolData(selected);
    }
  }

  async function loadSchoolData(id: string) {
    const [yearResult, classResult, structureResult] = await Promise.all([
      supabase
        .from('academic_years')
        .select('id, year_name, is_current')
        .eq('school_id', id)
        .order('year_name', { ascending: false }),

      supabase
        .from('classes')
        .select('id, class_name, education_level')
        .eq('school_id', id)
        .order('sort_order'),

      supabase
        .from('fee_structures')
        .select('*')
        .eq('school_id', id)
    ]);

    if (yearResult.error) throw yearResult.error;
    if (classResult.error) throw classResult.error;
    if (structureResult.error) throw structureResult.error;

    const yearRows = (yearResult.data || []) as AcademicYear[];
    const classRows = (classResult.data || []) as SchoolClass[];
    const structureRows = (structureResult.data || []) as FeeStructure[];

    setYears(yearRows);
    setClasses(classRows);
    setStructures(structureRows);

    const currentYear = yearRows.find(item => item.is_current) || yearRows[0];
    const firstClass = classRows[0];

    setYearId(currentYear?.id || '');
    setClassId(firstClass?.id || '');

    if (currentYear && firstClass) {
      const structure = structureRows.find(
        item =>
          item.academic_year_id === currentYear.id &&
          item.class_id === firstClass.id
      );

      setFeeForm(
        structure
          ? {
              school_fee: String(structure.school_fee || 0),
              accommodation_fee: String(structure.accommodation_fee || 0),
              transport_fee: String(structure.transport_fee || 0)
            }
          : emptyFee
      );

      if (structure) {
        await loadCharges(structure.id);
      } else {
        setCharges([]);
      }
    } else {
      setFeeForm(emptyFee);
      setCharges([]);
    }

    await loadAccounts(id);
  }

  async function loadCharges(structureId: string) {
    const { data, error } = await supabase
      .from('fee_other_charges')
      .select('*')
      .eq('fee_structure_id', structureId)
      .order('created_at');

    if (error) throw error;
    setCharges((data || []) as OtherCharge[]);
  }

  async function loadAccounts(id: string) {
    const { data: accountData, error: accountError } = await supabase
      .from('student_fee_accounts')
      .select('*')
      .in(
        'fee_structure_id',
        (structures
          .filter(item => item.school_id === id)
          .map(item => item.id).length
          ? structures
              .filter(item => item.school_id === id)
              .map(item => item.id)
          : ['00000000-0000-0000-0000-000000000000'])
      );

    if (accountError) throw accountError;

    const accountRows = (accountData || []) as FeeAccount[];
    setAccounts(accountRows);

    const { data: paymentData, error: paymentError } = await supabase
      .from('fee_payments')
      .select('*')
      .order('payment_date', { ascending: false });

    if (paymentError) throw paymentError;
    setPayments((paymentData || []) as FeePayment[]);

    const enrollmentIds = accountRows.map(item => item.enrollment_id);

    if (!enrollmentIds.length) {
      setEnrollments([]);
      setStudents([]);
      return;
    }

    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from('student_enrollments')
      .select('*')
      .in('id', enrollmentIds);

    if (enrollmentError) throw enrollmentError;

    const enrollmentRows = (enrollmentData || []) as Enrollment[];
    setEnrollments(enrollmentRows);

    const studentIds = [...new Set(
      enrollmentRows.map(item => item.student_id)
    )];

    if (!studentIds.length) {
      setStudents([]);
      return;
    }

    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('id, admission_no, first_name, middle_name, last_name')
      .in('id', studentIds);

    if (studentError) throw studentError;
    setStudents((studentData || []) as Student[]);
  }

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        setLoading(true);
        setError('');
        await loadSchools();
      } catch (e) {
        if (active) showError(e);
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, []);

  async function refreshAll() {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('fee_structures')
        .select('*')
        .eq('school_id', schoolId);

      if (error) throw error;
      setStructures((data || []) as FeeStructure[]);

      await loadSchoolData(schoolId);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }

  async function changeSchool(id: string) {
    setSchoolId(id);
    setYearId('');
    setClassId('');
    setStructures([]);
    setCharges([]);
    setAccounts([]);
    setPayments([]);
    setStudents([]);
    setEnrollments([]);
    setFeeForm(emptyFee);
    setError('');
    setMessage('');

    try {
      setLoading(true);
      await loadSchoolData(id);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }

  async function changeYear(id: string) {
    setYearId(id);
    setError('');
    setMessage('');

    const structure = structures.find(
      item => item.academic_year_id === id && item.class_id === classId
    );

    setFeeForm(
      structure
        ? {
            school_fee: String(structure.school_fee || 0),
            accommodation_fee: String(structure.accommodation_fee || 0),
            transport_fee: String(structure.transport_fee || 0)
          }
        : emptyFee
    );

    try {
      if (structure) {
        await loadCharges(structure.id);
      } else {
        setCharges([]);
      }
    } catch (e) {
      showError(e);
    }
  }

  async function changeClass(id: string) {
    setClassId(id);
    setError('');
    setMessage('');

    const structure = structures.find(
      item => item.academic_year_id === yearId && item.class_id === id
    );

    setFeeForm(
      structure
        ? {
            school_fee: String(structure.school_fee || 0),
            accommodation_fee: String(structure.accommodation_fee || 0),
            transport_fee: String(structure.transport_fee || 0)
          }
        : emptyFee
    );

    try {
      if (structure) {
        await loadCharges(structure.id);
      } else {
        setCharges([]);
      }
    } catch (e) {
      showError(e);
    }
  }

  async function saveFeeStructure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!schoolId || !yearId || !classId) {
      setError('Chagua shule, mwaka wa masomo na darasa.');
      return;
    }

    const values = [
      feeForm.school_fee,
      feeForm.accommodation_fee,
      feeForm.transport_fee
    ];

    if (values.some(value => value.trim() === '' || Number(value) < 0)) {
      setError('Kiasi cha ada hakiwezi kuwa pungufu ya sifuri.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        school_id: schoolId,
        academic_year_id: yearId,
        class_id: classId,
        school_fee: Number(feeForm.school_fee || 0),
        accommodation_fee: Number(feeForm.accommodation_fee || 0),
        transport_fee: Number(feeForm.transport_fee || 0)
      };

      let structureId = selectedStructure?.id;

      if (structureId) {
        const { error } = await supabase
          .from('fee_structures')
          .update(payload)
          .eq('id', structureId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('fee_structures')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        structureId = (data as FeeStructure).id;
      }

      const { data, error } = await supabase
        .from('fee_structures')
        .select('*')
        .eq('school_id', schoolId);

      if (error) throw error;

      setStructures((data || []) as FeeStructure[]);
      setMessage('Ada za darasa zimehifadhiwa kikamilifu.');

      if (structureId) await loadCharges(structureId);
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  }

  function startEditCharge(charge: OtherCharge) {
    setEditingChargeId(charge.id);
    setChargeForm({
      charge_name: charge.charge_name,
      amount: String(charge.amount),
      applies_to: charge.applies_to,
      is_mandatory: charge.is_mandatory
    });
  }

  function resetChargeForm() {
    setEditingChargeId(null);
    setChargeForm(emptyCharge);
  }

  async function saveCharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedStructure) {
      setError('Hifadhi ada za darasa kwanza.');
      return;
    }

    if (!chargeForm.charge_name.trim() || Number(chargeForm.amount) <= 0) {
      setError('Jaza jina la gharama na kiasi sahihi.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        fee_structure_id: selectedStructure.id,
        charge_name: chargeForm.charge_name.trim(),
        amount: Number(chargeForm.amount),
        applies_to: chargeForm.applies_to,
        is_mandatory: chargeForm.is_mandatory
      };

      const result = editingChargeId
        ? await supabase
            .from('fee_other_charges')
            .update(payload)
            .eq('id', editingChargeId)
        : await supabase
            .from('fee_other_charges')
            .insert(payload);

      if (result.error) throw result.error;

      await loadCharges(selectedStructure.id);
      resetChargeForm();
      setMessage('Gharama nyingine imehifadhiwa.');
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCharge(charge: OtherCharge) {
    if (!window.confirm(`Una uhakika unataka kufuta ${charge.charge_name}?`)) {
      return;
    }

    setError('');
    setMessage('');

    try {
      const { error } = await supabase
        .from('fee_other_charges')
        .delete()
        .eq('id', charge.id);

      if (error) throw error;

      setCharges(current =>
        current.filter(item => item.id !== charge.id)
      );

      if (editingChargeId === charge.id) resetChargeForm();

      setMessage('Gharama imefutwa.');
    } catch (e) {
      showError(e);
    }
  }

  async function generateAccounts() {
    if (!selectedStructure) {
      setError('Hifadhi ada za darasa kwanza.');
      return;
    }

    if (!window.confirm(
      'Unataka kutengeneza akaunti za ada kwa wanafunzi wote hai wa darasa hili katika mwaka huu? Akaunti zilizopo hazitabadilishwa.'
    )) return;

    setGenerating(true);
    setError('');
    setMessage('');

    try {
      const { data: enrollmentData, error: enrollmentError } =
        await supabase
          .from('student_enrollments')
          .select('*')
          .eq('class_id', classId)
          .eq('academic_year_id', yearId)
          .eq('status', 'Active');

      if (enrollmentError) throw enrollmentError;

      const activeEnrollments = (enrollmentData || []) as Enrollment[];

      if (!activeEnrollments.length) {
        setMessage('Hakuna wanafunzi hai walioandikishwa katika darasa hili na mwaka huu.');
        return;
      }

      const { data: existingData, error: existingError } = await supabase
        .from('student_fee_accounts')
        .select('enrollment_id')
        .eq('fee_structure_id', selectedStructure.id);

      if (existingError) throw existingError;

      const existingIds = new Set(
        (existingData || []).map(item => item.enrollment_id)
      );

      const newAccounts = activeEnrollments
        .filter(enrollment => !existingIds.has(enrollment.id))
        .map(enrollment => {
          const type = String(enrollment.accommodation_type || '').toLowerCase();
          const isBoarding = type === 'boarding';
          const isDay = type === 'day';

          const applicableCharges = selectedCharges.filter(charge => {
            if (!charge.is_mandatory) return false;

            if (charge.applies_to === 'All') return true;
            if (charge.applies_to === 'Boarding') return isBoarding;
            if (charge.applies_to === 'Day') return isDay;

            return false;
          });

          const otherTotal = applicableCharges.reduce(
            (sum, charge) => sum + Number(charge.amount || 0),
            0
          );

          const schoolFee = Number(selectedStructure.school_fee || 0);
          const accommodationFee = isBoarding
            ? Number(selectedStructure.accommodation_fee || 0)
            : 0;
          const transportFee = isDay
            ? Number(selectedStructure.transport_fee || 0)
            : 0;

          return {
            enrollment_id: enrollment.id,
            fee_structure_id: selectedStructure.id,
            school_fee: schoolFee,
            accommodation_fee: accommodationFee,
            transport_fee: transportFee,
            other_charges_total: otherTotal,
            total_amount:
              schoolFee + accommodationFee + transportFee + otherTotal
          };
        });

      if (!newAccounts.length) {
        setMessage('Akaunti za wanafunzi hawa tayari zipo. Hakuna akaunti mpya iliyotengenezwa.');
      } else {
        const { error } = await supabase
          .from('student_fee_accounts')
          .insert(newAccounts);

        if (error) throw error;

        setMessage(
          `Akaunti ${newAccounts.length} za wanafunzi zimetengenezwa kikamilifu.`
        );
      }

      await refreshAll();
      setTab('accounts');
    } catch (e) {
      showError(e);
    } finally {
      setGenerating(false);
    }
  }

  function openPayment(account: FeeAccount) {
    setPaymentAccount(account);
    setPaymentForm({
      amount: '',
      payment_date: today(),
      payment_method: 'Cash',
      reference_number: '',
      notes: ''
    });
    setError('');
    setMessage('');
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!paymentAccount) return;

    const amount = Number(paymentForm.amount);

    const paidAlready = payments
      .filter(item => item.student_fee_account_id === paymentAccount.id)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const balance = Number(paymentAccount.total_amount) - paidAlready;

    if (!amount || amount <= 0) {
      setError('Weka kiasi sahihi cha malipo.');
      return;
    }

    if (amount > balance) {
      setError(`Malipo yanazidi deni. Salio linalodaiwa ni TSh ${money(balance)}.`);
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const receiptNumber =
        `RCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const { error } = await supabase
        .from('fee_payments')
        .insert({
          student_fee_account_id: paymentAccount.id,
          receipt_number: receiptNumber,
          amount,
          payment_date: paymentForm.payment_date,
          payment_method: paymentForm.payment_method,
          reference_number: paymentForm.reference_number.trim() || null,
          notes: paymentForm.notes.trim() || null
        });

      if (error) throw error;

      setPaymentAccount(null);
      setMessage(`Malipo yamehifadhiwa. Namba ya risiti: ${receiptNumber}`);

      await refreshAll();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  }

  function printReceipt(payment: FeePayment, account: FeeAccount) {
    const enrollment = enrollmentMap.get(account.enrollment_id);
    const student = enrollment
      ? studentMap.get(enrollment.student_id)
      : undefined;

    const studentName = student
      ? [student.first_name, student.middle_name, student.last_name]
          .filter(Boolean).join(' ')
      : 'Mwanafunzi';

    const school = schools.find(item => item.id === schoolId);
    const year = years.find(item => item.id === yearId);

    const receiptWindow = window.open('', '_blank');

    if (!receiptWindow) {
      setError('Ruhusu popup kwenye browser ili kuchapisha risiti.');
      return;
    }

    const safe = (value: string) =>
      value.replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[char] || char);

    receiptWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Risiti ${safe(payment.receipt_number)}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; padding: 28px; color: #172b42; }
          .receipt { max-width: 650px; margin: auto; border: 1px solid #cbd5e1; padding: 28px; }
          h1, h2, p { text-align: center; }
          h1 { font-size: 23px; margin-bottom: 5px; }
          h2 { font-size: 17px; color: #173b5e; }
          .line { border-top: 1px dashed #94a3b8; margin: 20px 0; }
          .row { display: flex; justify-content: space-between; gap: 20px; padding: 9px 0; border-bottom: 1px solid #e2e8f0; }
          .amount { font-size: 22px; font-weight: bold; text-align: center; margin: 24px 0; }
          .footer { margin-top: 40px; font-size: 12px; color: #64748b; }
          @media print { button { display: none; } body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="receipt">
          <h1>${safe(school?.school_name || 'SHULE')}</h1>
          <p>RISITI YA MALIPO YA ADA</p>
          <div class="line"></div>
          <div class="row"><strong>Namba ya Risiti</strong><span>${safe(payment.receipt_number)}</span></div>
          <div class="row"><strong>Mwanafunzi</strong><span>${safe(studentName)}</span></div>
          <div class="row"><strong>Namba ya Usajili</strong><span>${safe(student?.admission_no || '—')}</span></div>
          <div class="row"><strong>Mwaka wa Masomo</strong><span>${safe(year?.year_name || '—')}</span></div>
          <div class="row"><strong>Tarehe ya Malipo</strong><span>${safe(payment.payment_date)}</span></div>
          <div class="row"><strong>Njia ya Malipo</strong><span>${safe(payment.payment_method)}</span></div>
          <div class="row"><strong>Rejea</strong><span>${safe(payment.reference_number || '—')}</span></div>
          <div class="amount">TSh ${money(payment.amount)}</div>
          <div class="row"><strong>Maelezo</strong><span>${safe(payment.notes || 'Malipo ya ada')}</span></div>
          <div class="footer">
            <p>Asante kwa kufanya malipo.</p>
            <p>Risiti hii imetolewa na mfumo wa usimamizi wa shule.</p>
          </div>
          <button onclick="window.print()">Chapisha Risiti</button>
        </div>
      </body>
      </html>
    `);

    receiptWindow.document.close();
    receiptWindow.focus();
    receiptWindow.print();
  }

  function openHistory(account: FeeAccount) {
    setHistoryAccount(account);
  }

  const historyPayments = historyAccount
    ? payments.filter(
        item => item.student_fee_account_id === historyAccount.id
      )
    : [];

  const historyPaid = historyPayments.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const historyEnrollment = historyAccount
    ? enrollmentMap.get(historyAccount.enrollment_id)
    : undefined;

  const historyStudent = historyEnrollment
    ? studentMap.get(historyEnrollment.student_id)
    : undefined;

  const historyName = historyStudent
    ? [
        historyStudent.first_name,
        historyStudent.middle_name,
        historyStudent.last_name
      ].filter(Boolean).join(' ')
    : '';

  return (
    <div style={{ display: 'grid', gap: 20, color: '#243447' }}>
      <section style={{
        background: '#173b5e',
        color: '#fff',
        padding: 22,
        borderRadius: 16
      }}>
        <h2 style={{ margin: '0 0 8px' }}>Ada na Malipo</h2>
        <p style={{ margin: 0, opacity: 0.9 }}>
          Usimamizi wa ada za mwaka mzima, malipo ya awamu na madeni ya wanafunzi.
        </p>
      </section>

      {error && (
        <div role="alert" style={{
          background: '#fff1f0',
          color: '#b42318',
          padding: 13,
          borderRadius: 9
        }}>
          {error}
        </div>
      )}

      {message && (
        <div role="status" style={{
          background: '#ecfdf3',
          color: '#16845b',
          padding: 13,
          borderRadius: 9
        }}>
          {message}
        </div>
      )}

      <section style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 15,
        padding: 18,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
        gap: 14
      }}>
        <label style={labelStyle}>
          Shule
          <select
            style={inputStyle}
            value={schoolId}
            onChange={e => changeSchool(e.target.value)}
          >
            {schools.map(item => (
              <option key={item.id} value={item.id}>
                {item.school_name}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Mwaka wa masomo
          <select
            style={inputStyle}
            value={yearId}
            onChange={e => changeYear(e.target.value)}
          >
            <option value="">Chagua mwaka</option>
            {years.map(item => (
              <option key={item.id} value={item.id}>
                {item.year_name}{item.is_current ? ' (Wa sasa)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Darasa
          <select
            style={inputStyle}
            value={classId}
            onChange={e => changeClass(e.target.value)}
          >
            <option value="">Chagua darasa</option>
            {classes.map(item => (
              <option key={item.id} value={item.id}>
                {item.class_name}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: 'flex', alignItems: 'end' }}>
          <button
            type="button"
            style={{ ...buttonStyle, width: '100%' }}
            onClick={refreshAll}
            disabled={loading || !schoolId}
          >
            {loading ? 'Inapakia...' : 'Onyesha upya'}
          </button>
        </div>
      </section>

      <div style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap'
      }}>
        <button
          type="button"
          onClick={() => setTab('setup')}
          style={{
            ...buttonStyle,
            background: tab === 'setup' ? '#173b5e' : '#eaf1f7',
            color: tab === 'setup' ? '#fff' : '#173b5e'
          }}
        >
          Mpangilio wa Ada
        </button>

        <button
          type="button"
          onClick={() => setTab('accounts')}
          style={{
            ...buttonStyle,
            background: tab === 'accounts' ? '#173b5e' : '#eaf1f7',
            color: tab === 'accounts' ? '#fff' : '#173b5e'
          }}
        >
          Akaunti na Malipo
        </button>
      </div>

      {tab === 'setup' && (
        <>
          <section style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 15,
            padding: 20
          }}>
            <h3 style={{ marginTop: 0 }}>Ada za Mwaka kwa Darasa</h3>
            <p style={{ color: '#64748b', fontSize: 13 }}>
              Ada hizi zitatumika kwa wanafunzi wa darasa hili katika mwaka uliochaguliwa.
            </p>

            {!yearId || !classId ? (
              <p>Chagua mwaka wa masomo na darasa kwanza.</p>
            ) : (
              <form
                onSubmit={saveFeeStructure}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
                  gap: 14
                }}
              >
                <label style={labelStyle}>
                  Ada ya shule (TSh)
                  <input
                    type="number"
                    min="0"
                    style={inputStyle}
                    value={feeForm.school_fee}
                    onChange={e => setFeeForm({
                      ...feeForm,
                      school_fee: e.target.value
                    })}
                  />
                </label>

                <label style={labelStyle}>
                  Malazi (Boarding) (TSh)
                  <input
                    type="number"
                    min="0"
                    style={inputStyle}
                    value={feeForm.accommodation_fee}
                    onChange={e => setFeeForm({
                      ...feeForm,
                      accommodation_fee: e.target.value
                    })}
                  />
                </label>

                <label style={labelStyle}>
                  Usafiri (Day) (TSh)
                  <input
                    type="number"
                    min="0"
                    style={inputStyle}
                    value={feeForm.transport_fee}
                    onChange={e => setFeeForm({
                      ...feeForm,
                      transport_fee: e.target.value
                    })}
                  />
                </label>

                <div style={{
                  display: 'flex',
                  alignItems: 'end'
                }}>
                  <button
                    type="submit"
                    style={{ ...buttonStyle, width: '100%' }}
                    disabled={saving}
                  >
                    {saving ? 'Inahifadhi...' : 'Hifadhi Ada'}
                  </button>
                </div>
              </form>
            )}

            {selectedStructure && (
              <div style={{
                marginTop: 15,
                padding: 12,
                background: '#eff6ff',
                color: '#173b5e',
                borderRadius: 9,
                fontSize: 13
              }}>
                <strong>Muundo wa ada upo.</strong> Ukibadilisha viwango hapa, akaunti mpya zitatumia viwango vipya. Akaunti zilizokwisha tengenezwa hazitabadilishwa.
              </div>
            )}
          </section>

          <section style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 15,
            padding: 20
          }}>
            <h3 style={{ marginTop: 0 }}>Gharama Nyingine (Other Charges)</h3>
            <p style={{ color: '#64748b', fontSize: 13 }}>
              Ongeza gharama kama huduma ya kwanza, sare, mahafali, safari na mitihani.
            </p>

            <form
              onSubmit={saveCharge}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
                gap: 12,
                alignItems: 'end'
              }}
            >
              <label style={labelStyle}>
                Jina la gharama
                <input
                  style={inputStyle}
                  value={chargeForm.charge_name}
                  onChange={e => setChargeForm({
                    ...chargeForm,
                    charge_name: e.target.value
                  })}
                  placeholder="Mfano: Sare"
                />
              </label>

              <label style={labelStyle}>
                Kiasi (TSh)
                <input
                  type="number"
                  min="1"
                  style={inputStyle}
                  value={chargeForm.amount}
                  onChange={e => setChargeForm({
                    ...chargeForm,
                    amount: e.target.value
                  })}
                />
              </label>

              <label style={labelStyle}>
                Inawahusu
                <select
                  style={inputStyle}
                  value={chargeForm.applies_to}
                  onChange={e => setChargeForm({
                    ...chargeForm,
                    applies_to: e.target.value as 'All' | 'Day' | 'Boarding'
                  })}
                >
                  <option value="All">Wanafunzi wote</option>
                  <option value="Day">Day</option>
                  <option value="Boarding">Boarding</option>
                </select>
              </label>

              <label style={{
                ...labelStyle,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 42
              }}>
                <span>Hali ya gharama</span>
                <span style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={chargeForm.is_mandatory}
                    onChange={e => setChargeForm({
                      ...chargeForm,
                      is_mandatory: e.target.checked
                    })}
                  />
                  Lazima ilipwe
                </span>
              </label>

              <div style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap'
              }}>
                <button
                  type="submit"
                  style={buttonStyle}
                  disabled={saving || !selectedStructure}
                >
                  {saving
                    ? 'Inahifadhi...'
                    : editingChargeId
                      ? 'Hifadhi Mabadiliko'
                      : 'Ongeza Gharama'}
                </button>

                {editingChargeId && (
                  <button
                    type="button"
                    onClick={resetChargeForm}
                    style={{ ...buttonStyle, background: '#64748b' }}
                  >
                    Ghairi
                  </button>
                )}
              </div>
            </form>

            <div style={{ overflowX: 'auto', marginTop: 20 }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: 600
              }}>
                <thead>
                  <tr>
                    {['Gharama', 'Kiasi', 'Inawahusu', 'Hali', 'Vitendo'].map(item => (
                      <th key={item} style={{
                        textAlign: 'left',
                        padding: 10,
                        borderBottom: '1px solid #e2e8f0'
                      }}>
                        {item}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedCharges.map(charge => (
                    <tr key={charge.id}>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>
                        {charge.charge_name}
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>
                        TSh {money(charge.amount)}
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>
                        {charge.applies_to === 'All'
                          ? 'Wote'
                          : charge.applies_to}
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>
                        {charge.is_mandatory ? 'Lazima' : 'Hiari'}
                      </td>
                      <td style={{
                        padding: 10,
                        borderBottom: '1px solid #e2e8f0',
                        whiteSpace: 'nowrap'
                      }}>
                        <button
                          type="button"
                          onClick={() => startEditCharge(charge)}
                          style={{
                            ...buttonStyle,
                            padding: '7px 10px',
                            marginRight: 6
                          }}
                        >
                          Hariri
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCharge(charge)}
                          style={{
                            ...buttonStyle,
                            background: '#b42318',
                            padding: '7px 10px'
                          }}
                        >
                          Futa
                        </button>
                      </td>
                    </tr>
                  ))}

                  {selectedCharges.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: 14, color: '#64748b' }}>
                        Hakuna gharama nyingine zilizoongezwa.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 15,
            padding: 20
          }}>
            <h3 style={{ marginTop: 0 }}>Tengeneza Akaunti za Wanafunzi</h3>
            <p style={{ color: '#64748b', fontSize: 13 }}>
              Mfumo utatumia aina ya malazi ya mwanafunzi: Boarding atalipishwa malazi, Day atalipishwa usafiri. Gharama nyingine za lazima zitaongezwa kulingana na kundi husika.
            </p>
            <button
              type="button"
              style={buttonStyle}
              onClick={generateAccounts}
              disabled={generating || !selectedStructure}
            >
              {generating ? 'Inatengeneza akaunti...' : 'Tengeneza Akaunti za Darasa'}
            </button>
          </section>
        </>
      )}

      {tab === 'accounts' && (
        <>
          <section style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
            gap: 12
          }}>
            {[
              { label: 'Jumla ya Ada', value: totals.total, color: '#173b5e' },
              { label: 'Jumla Iliyolipwa', value: totals.paid, color: '#16845b' },
              { label: 'Jumla ya Madeni', value: totals.debt, color: '#b42318' }
            ].map(item => (
              <div key={item.label} style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 13,
                padding: 16
              }}>
                <div style={{ color: '#64748b', fontSize: 12 }}>
                  {item.label}
                </div>
                <strong style={{
                  display: 'block',
                  color: item.color,
                  fontSize: 19,
                  marginTop: 7
                }}>
                  TSh {money(item.value)}
                </strong>
              </div>
            ))}
          </section>

          <section style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 15,
            padding: 18
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10
            }}>
              <h3 style={{ margin: 0 }}>Akaunti za Wanafunzi</h3>
              <span style={{ color: '#64748b', fontSize: 13 }}>
                {filteredAccounts.length} mwanafunzi
              </span>
            </div>

            <input
              style={{ ...inputStyle, marginTop: 15, marginBottom: 15 }}
              placeholder="Tafuta mwanafunzi kwa jina au namba ya usajili..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: 850
              }}>
                <thead>
                  <tr>
                    {[
                      'Namba ya Usajili',
                      'Mwanafunzi',
                      'Aina',
                      'Ada Jumla',
                      'Amelipa',
                      'Deni',
                      'Vitendo'
                    ].map(item => (
                      <th key={item} style={{
                        textAlign: 'left',
                        padding: 10,
                        borderBottom: '1px solid #e2e8f0'
                      }}>
                        {item}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredAccounts.map(item => (
                    <tr key={item.account.id}>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>
                        {item.student?.admission_no || '—'}
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>
                        {[
                          item.student?.first_name,
                          item.student?.middle_name,
                          item.student?.last_name
                        ].filter(Boolean).join(' ') || 'Mwanafunzi'}
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>
                        {item.enrollment?.accommodation_type || '—'}
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>
                        {money(item.account.total_amount)}
                      </td>
                      <td style={{
                        padding: 10,
                        borderBottom: '1px solid #e2e8f0',
                        color: '#16845b',
                        fontWeight: 700
                      }}>
                        {money(item.paid)}
                      </td>
                      <td style={{
                        padding: 10,
                        borderBottom: '1px solid #e2e8f0',
                        color: item.balance > 0 ? '#b42318' : '#16845b',
                        fontWeight: 700
                      }}>
                        {money(item.balance)}
                      </td>
                      <td style={{
                        padding: 10,
                        borderBottom: '1px solid #e2e8f0',
                        whiteSpace: 'nowrap'
                      }}>
                        <button
                          type="button"
                          onClick={() => openPayment(item.account)}
                          disabled={item.balance <= 0}
                          style={{
                            ...buttonStyle,
                            padding: '7px 10px',
                            opacity: item.balance <= 0 ? 0.5 : 1,
                            marginRight: 5
                          }}
                        >
                          Lipa
                        </button>
                        <button
                          type="button"
                          onClick={() => openHistory(item.account)}
                          style={{
                            ...buttonStyle,
                            background: '#64748b',
                            padding: '7px 10px'
                          }}
                        >
                          Historia
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredAccounts.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 16, color: '#64748b' }}>
                        Hakuna akaunti zilizopatikana. Kwanza weka ada na tengeneza akaunti za darasa.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {paymentAccount && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15,23,42,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 14
          }}
          onClick={() => setPaymentAccount(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              width: '100%',
              maxWidth: 520,
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: 15,
              padding: 20
            }}
          >
            <h3 style={{ marginTop: 0 }}>Rekodi Malipo</h3>

            <form onSubmit={savePayment} style={{ display: 'grid', gap: 13 }}>
              <label style={labelStyle}>
                Kiasi cha malipo (TSh)
                <input
                  type="number"
                  min="1"
                  max={Math.max(0,
                    Number(paymentAccount.total_amount) -
                    payments
                      .filter(item => item.student_fee_account_id === paymentAccount.id)
                      .reduce((sum, item) => sum + Number(item.amount), 0)
                  )}
                  required
                  style={inputStyle}
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm({
                    ...paymentForm,
                    amount: e.target.value
                  })}
                />
              </label>

              <label style={labelStyle}>
                Tarehe ya malipo
                <input
                  type="date"
                  required
                  style={inputStyle}
                  value={paymentForm.payment_date}
                  onChange={e => setPaymentForm({
                    ...paymentForm,
                    payment_date: e.target.value
                  })}
                />
              </label>

              <label style={labelStyle}>
                Njia ya malipo
                <select
                  style={inputStyle}
                  value={paymentForm.payment_method}
                  onChange={e => setPaymentForm({
                    ...paymentForm,
                    payment_method: e.target.value
                  })}
                >
                  <option value="Cash">Taslimu</option>
                  <option value="Bank">Benki</option>
                  <option value="Mobile Money">Mobile Money</option>
                  <option value="Cheque">Hundi</option>
                </select>
              </label>

              <label style={labelStyle}>
                Namba ya kumbukumbu (si lazima)
                <input
                  style={inputStyle}
                  value={paymentForm.reference_number}
                  onChange={e => setPaymentForm({
                    ...paymentForm,
                    reference_number: e.target.value
                  })}
                />
              </label>

              <label style={labelStyle}>
                Maelezo (si lazima)
                <textarea
                  style={inputStyle}
                  rows={2}
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm({
                    ...paymentForm,
                    notes: e.target.value
                  })}
                />
              </label>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="submit"
                  style={buttonStyle}
                  disabled={saving}
                >
                  {saving ? 'Inahifadhi...' : 'Hifadhi Malipo'}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentAccount(null)}
                  style={{ ...buttonStyle, background: '#64748b' }}
                >
                  Funga
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyAccount && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15,23,42,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12
          }}
          onClick={() => setHistoryAccount(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              width: '100%',
              maxWidth: 750,
              maxHeight: '85vh',
              overflowY: 'auto',
              borderRadius: 15,
              padding: 20
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10
            }}>
              <div>
                <h3 style={{ margin: '0 0 5px' }}>Historia ya Malipo</h3>
                <div style={{ color: '#64748b', fontSize: 13 }}>
                  {historyName} — {historyStudent?.admission_no || ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryAccount(null)}
                style={{ ...buttonStyle, background: '#64748b' }}
              >
                Funga
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))',
              gap: 10,
              margin: '18px 0'
            }}>
              <div style={{ background: '#eff6ff', padding: 12, borderRadius: 9 }}>
                <small>Jumla ya Ada</small>
                <strong style={{ display: 'block' }}>
                  {money(historyAccount.total_amount)}
                </strong>
              </div>
              <div style={{ background: '#ecfdf3', padding: 12, borderRadius: 9 }}>
                <small>Amelipa</small>
                <strong style={{ display: 'block', color: '#16845b' }}>
                  {money(historyPaid)}
                </strong>
              </div>
              <div style={{ background: '#fff1f0', padding: 12, borderRadius: 9 }}>
                <small>Deni</small>
                <strong style={{ display: 'block', color: '#b42318' }}>
                  {money(Math.max(0, Number(historyAccount.total_amount) - historyPaid))}
                </strong>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: 550
              }}>
                <thead>
                  <tr>
                    {['Risiti', 'Tarehe', 'Njia', 'Kiasi', 'Vitendo'].map(item => (
                      <th key={item} style={{
                        textAlign: 'left',
                        padding: 9,
                        borderBottom: '1px solid #e2e8f0'
                      }}>
                        {item}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historyPayments.map(payment => (
                    <tr key={payment.id}>
                      <td style={{ padding: 9, borderBottom: '1px solid #e2e8f0' }}>
                        {payment.receipt_number}
                      </td>
                      <td style={{ padding: 9, borderBottom: '1px solid #e2e8f0' }}>
                        {payment.payment_date}
                      </td>
                      <td style={{ padding: 9, borderBottom: '1px solid #e2e8f0' }}>
                        {payment.payment_method}
                      </td>
                      <td style={{ padding: 9, borderBottom: '1px solid #e2e8f0' }}>
                        {money(payment.amount)}
                      </td>
                      <td style={{ padding: 9, borderBottom: '1px solid #e2e8f0' }}>
                        <button
                          type="button"
                          onClick={() => printReceipt(payment, historyAccount)}
                          style={{ ...buttonStyle, padding: '7px 10px' }}
                        >
                          Risiti
                        </button>
                      </td>
                    </tr>
                  ))}

                  {historyPayments.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: 14, color: '#64748b' }}>
                        Hakuna malipo yaliyorekodiwa kwa mwanafunzi huyu.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
