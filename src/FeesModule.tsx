import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from './supabase';

type School = { id: string; school_name: string; phone?: string | null; email?: string | null; address?: string | null };
type Year = { id: string; year_name: string; is_current: boolean };
type SchoolClass = { id: string; class_name: string };
type Structure = {
  id: string; school_id: string; academic_year_id: string; class_id: string;
  school_fee: number; accommodation_fee: number; transport_fee: number;
};
type Charge = {
  id: string; fee_structure_id: string; charge_name: string; amount: number;
  applies_to: 'All' | 'Day' | 'Boarding'; is_mandatory: boolean;
};
type Enrollment = {
  id: string; student_id: string; class_id: string; stream_id: string | null;
  academic_year_id: string; accommodation_type: string; status: string;
};
type Stream = { id: string; class_id: string; stream_name: string };
type Student = {
  id: string; admission_no: string; first_name: string;
  middle_name: string | null; last_name: string;
};
type Account = {
  id: string; enrollment_id: string; fee_structure_id: string;
  school_fee: number; accommodation_fee: number; transport_fee: number;
  other_charges_total: number; total_amount: number;
};
type FeeAudit = { id: string; entity_type: string; action: string; old_data: any; new_data: any; changed_at: string; changed_by: string | null; reason: string | null };
type Payment = {
  id: string; student_fee_account_id: string; receipt_number: string;
  amount: number; payment_date: string; payment_method: string;
  reference_number: string | null; notes: string | null;
};

const money = (n: number) =>
  new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 0 }).format(Number(n || 0));

const today = () => new Date().toISOString().slice(0, 10);

const input: React.CSSProperties = {
  width: '100%', minWidth: 0, maxWidth: '100%',
  padding: 12, border: '1px solid #cbd5e1',
  borderRadius: 9, fontSize: 15, background: '#fff', color: '#243447'
};

const label: React.CSSProperties = {
  display: 'grid', gap: 7, minWidth: 0,
  fontSize: 14, fontWeight: 600, color: '#334155'
};

const button: React.CSSProperties = {
  background: '#173b5e', color: '#fff', border: 0,
  borderRadius: 9, padding: '11px 15px',
  fontWeight: 700, fontSize: 14, cursor: 'pointer'
};

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e2e8f0',
  borderRadius: 15, padding: 18, width: '100%',
  minWidth: 0, maxWidth: '100%'
};

const cell: React.CSSProperties = {
  textAlign: 'left', padding: 11,
  borderBottom: '1px solid #e2e8f0',
  whiteSpace: 'nowrap', fontSize: 14
};

export default function FeesModule({ isAccountant = false }: { isAccountant?: boolean }) {
  const [schools, setSchools] = useState<School[]>([]);
  const [years, setYears] = useState<Year[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [schoolId, setSchoolId] = useState('');
  const [yearId, setYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [tab, setTab] = useState<'setup' | 'accounts' | 'reports'>(isAccountant ? 'accounts' : 'setup');
  const [reportPeriod, setReportPeriod] = useState<'month' | 'year'>('month');
  const [reportMonth, setReportMonth] = useState(() => today().slice(5, 7));
  const [reportCalendarYear, setReportCalendarYear] = useState(() => today().slice(0, 4));

  const [fee, setFee] = useState({
    school_fee: '0', accommodation_fee: '0', transport_fee: '0'
  });

  const [charge, setCharge] = useState({
    charge_name: '', amount: '',
    applies_to: 'All' as 'All' | 'Day' | 'Boarding',
    is_mandatory: true
  });

  const [editingCharge, setEditingCharge] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [paymentAccount, setPaymentAccount] = useState<Account | null>(null);
  const [historyAccount, setHistoryAccount] = useState<Account | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editingFeeAccount, setEditingFeeAccount] = useState<Account | null>(null);
  const [auditRows, setAuditRows] = useState<FeeAudit[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [feeEdit, setFeeEdit] = useState({ school_fee: '', accommodation_fee: '', transport_fee: '', other_charges_total: '' });
  const [showFeeImport, setShowFeeImport] = useState(false);
  const [feeImportText, setFeeImportText] = useState('');
  const [feeImporting, setFeeImporting] = useState(false);

  const [payment, setPayment] = useState({
    amount: '', payment_date: today(), payment_method: 'Cash',
    reference_number: '', notes: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const structure = structures.find(
    x => x.academic_year_id === yearId && x.class_id === classId
  );

  const selectedCharges = charges.filter(
    x => x.fee_structure_id === structure?.id
  );

  const studentMap = useMemo(
    () => new Map(students.map(x => [x.id, x])), [students]
  );

  const enrollmentMap = useMemo(
    () => new Map(enrollments.map(x => [x.id, x])), [enrollments]
  );

  const rows = accounts.map(account => {
    const enrollment = enrollmentMap.get(account.enrollment_id);
    const student = enrollment ? studentMap.get(enrollment.student_id) : undefined;
    const paid = payments
      .filter(x => x.student_fee_account_id === account.id)
      .reduce((sum, x) => sum + Number(x.amount), 0);

    return {
      account, enrollment, student, paid,
      balance: Math.max(0, Number(account.total_amount) - paid)
    };
  });

  const filteredRows = rows.filter(x => {
    const name = [
      x.student?.admission_no, x.student?.first_name,
      x.student?.middle_name, x.student?.last_name
    ].filter(Boolean).join(' ').toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const totals = rows.reduce((a, x) => ({
    total: a.total + Number(x.account.total_amount),
    paid: a.paid + x.paid,
    debt: a.debt + x.balance
  }), { total: 0, paid: 0, debt: 0 });

  // Ripoti huchuja akaunti kwa mwaka wa masomo uliochaguliwa.
  const reportRows = rows.filter(
    x => x.enrollment?.academic_year_id === yearId
  );
  const reportAccountIds = new Set(reportRows.map(x => x.account.id));
  const reportPayments = payments.filter(
    x => reportAccountIds.has(x.student_fee_account_id)
  );
  const reportStartDate = reportPeriod === 'year'
    ? `${reportCalendarYear}-01-01`
    : `${reportCalendarYear}-${reportMonth}-01`;
  const reportEndDate = reportPeriod === 'year'
    ? `${reportCalendarYear}-12-31`
    : `${reportCalendarYear}-${reportMonth}-${String(new Date(Number(reportCalendarYear), Number(reportMonth), 0).getDate()).padStart(2, '0')}`;
  const periodPayments = reportPayments.filter(x =>
    x.payment_date >= reportStartDate && x.payment_date <= reportEndDate
  );
  const yearRevenue = reportPayments.reduce((sum, x) => sum + Number(x.amount), 0);
  const periodRevenue = periodPayments.reduce((sum, x) => sum + Number(x.amount), 0);
  const debtRows = reportRows.filter(x => x.balance > 0);
  const fullyPaidRows = reportRows.filter(
    x => Number(x.account.total_amount) > 0 && x.balance === 0
  );
  const reportStudentName = (student?: Student) => student
    ? `${student.first_name} ${student.middle_name || ''} ${student.last_name}`.replace(/\s+/g, ' ').trim()
    : '—';
  const reportClassName = (enrollment?: Enrollment) =>
    classes.find(c => c.id === enrollment?.class_id)?.class_name || '—';
  const reportStreamName = (enrollment?: Enrollment) =>
    streams.find(st => st.id === enrollment?.stream_id)?.stream_name || '—';

  function reportError(e: any) {
    setError(e?.message || 'Kuna tatizo. Jaribu tena.');
  }

  function setFeeValues(item?: Structure) {
    setFee(item ? {
      school_fee: String(item.school_fee ?? 0),
      accommodation_fee: String(item.accommodation_fee ?? 0),
      transport_fee: String(item.transport_fee ?? 0)
    } : {
      school_fee: '0', accommodation_fee: '0', transport_fee: '0'
    });
  }

  async function loadCharges(id: string) {
    const { data, error } = await supabase
      .from('fee_other_charges')
      .select('*')
      .eq('fee_structure_id', id)
      .order('created_at');

    if (error) throw error;
    setCharges((data || []) as Charge[]);
  }

  async function loadAccounts(structureRows: Structure[]) {
    const ids = structureRows.map(x => x.id);

    if (!ids.length) {
      setAccounts([]);
      setPayments([]);
      setEnrollments([]);
      setStudents([]);
      setStreams([]);
      return;
    }

    const { data: accountData, error: accountError } = await supabase
      .from('student_fee_accounts')
      .select('*')
      .in('fee_structure_id', ids);

    if (accountError) throw accountError;
    const accountRows = (accountData || []) as Account[];
    setAccounts(accountRows);

    const accountIds = accountRows.map(x => x.id);

    if (accountIds.length) {
      const { data, error } = await supabase
        .from('fee_payments')
        .select('*')
        .in('student_fee_account_id', accountIds)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setPayments((data || []) as Payment[]);
    } else {
      setPayments([]);
    }

    const enrollmentIds = accountRows.map(x => x.enrollment_id);

    if (!enrollmentIds.length) {
      setEnrollments([]);
      setStudents([]);
      setStreams([]);
      return;
    }

    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from('student_enrollments')
      .select('*')
      .in('id', enrollmentIds);

    if (enrollmentError) throw enrollmentError;
    const enrollmentRows = (enrollmentData || []) as Enrollment[];
    setEnrollments(enrollmentRows);

    const streamIds = [...new Set(
      enrollmentRows
        .map(x => x.stream_id)
        .filter((id): id is string => Boolean(id))
    )];

    if (streamIds.length) {
      const { data: streamData, error: streamError } = await supabase
        .from('streams')
        .select('id, class_id, stream_name')
        .in('id', streamIds);

      if (streamError) throw streamError;
      setStreams((streamData || []) as Stream[]);
    } else {
      setStreams([]);
    }

    const studentIds = [...new Set(enrollmentRows.map(x => x.student_id))];

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

  async function loadSchoolData(id: string) {
    const [yr, cls, fs] = await Promise.all([
      supabase.from('academic_years')
        .select('id, year_name, is_current')
        .eq('school_id', id)
        .order('year_name', { ascending: false }),
      supabase.from('classes')
        .select('id, class_name')
        .eq('school_id', id)
        .order('sort_order'),
      supabase.from('fee_structures')
        .select('*')
        .eq('school_id', id)
    ]);

    if (yr.error) throw yr.error;
    if (cls.error) throw cls.error;
    if (fs.error) throw fs.error;

    const yearRows = (yr.data || []) as Year[];
    const classRows = (cls.data || []) as SchoolClass[];
    const structureRows = (fs.data || []) as Structure[];

    setYears(yearRows);
    setClasses(classRows);
    setStructures(structureRows);

    const selectedYear = yearRows.find(x => x.is_current) || yearRows[0];
    const selectedClass = classRows[0];
    const nextYear = selectedYear?.id || '';
    const nextClass = selectedClass?.id || '';

    setYearId(nextYear);
    setClassId(nextClass);

    const found = structureRows.find(
      x => x.academic_year_id === nextYear && x.class_id === nextClass
    );

    setFeeValues(found);
    if (found) await loadCharges(found.id);
    else setCharges([]);

    await loadAccounts(structureRows);
}
  async function refresh() {
    if (!schoolId) return;

    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('fee_structures')
        .select('*')
        .eq('school_id', schoolId);

      if (error) throw error;

      const all = (data || []) as Structure[];
      setStructures(all);
      await loadAccounts(all);

      const found = all.find(
        x => x.academic_year_id === yearId && x.class_id === classId
      );

      setFeeValues(found);
      if (found) await loadCharges(found.id);
      else setCharges([]);
    } catch (e) {
      reportError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const { data, error } = await supabase
          .from('schools')
          .select('id, school_name')
          .order('school_name');

        if (error) throw error;
        if (!active) return;

        const list = (data || []) as School[];
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;

        const isPlatformAdmin =
          (authData.user?.email || '').toLowerCase() === 'goodlucknoel19@gmail.com';

        if (isPlatformAdmin) {
          setSchools(list);
          if (list.length) {
            setSchoolId(list[0].id);
            await loadSchoolData(list[0].id);
          }
        } else {
          // Staff roles, including accountants, use the same school assignment
          // RPC as the staff payroll and dashboard modules.
          const { data: assignedData, error: assignedError } =
            await supabase.rpc('get_my_school_for_staff');
          if (assignedError) throw assignedError;

          const assigned = Array.isArray(assignedData) ? assignedData[0] : assignedData;
          const assignedSchoolId = assigned?.id || assigned?.school_id;
          if (!assignedSchoolId) {
            throw new Error('Akaunti hii haijaunganishwa na shule. Wasiliana na msimamizi.');
          }

          const { data: schoolDetails } = await supabase.from('schools').select('id,school_name,phone,email,address').eq('id', assignedSchoolId).maybeSingle();
          const assignedSchool = {
            id: assignedSchoolId,
            school_name: schoolDetails?.school_name || assigned?.school_name || 'Shule yangu',
            phone: schoolDetails?.phone || null, email: schoolDetails?.email || null, address: schoolDetails?.address || null
          };
          setSchools([assignedSchool]);
          setSchoolId(assignedSchool.id);
          await loadSchoolData(assignedSchool.id);
        }
      } catch (e) {
        if (active) reportError(e);
      } finally {
        if (active) setLoading(false);
      }
    }

    init();
    return () => { active = false; };
  }, []);

  async function changeSchool(id: string) {
    setSchoolId(id);
    setYearId('');
    setClassId('');
    setStructures([]);
    setCharges([]);
    setError('');
    setMessage('');

    try {
      setLoading(true);
      await loadSchoolData(id);
    } catch (e) {
      reportError(e);
    } finally {
      setLoading(false);
    }
  }

  async function changeYear(id: string) {
    setYearId(id);
    const found = structures.find(
      x => x.academic_year_id === id && x.class_id === classId
    );
    setFeeValues(found);

    try {
      if (found) await loadCharges(found.id);
      else setCharges([]);
    } catch (e) {
      reportError(e);
    }
  }

  async function changeClass(id: string) {
    setClassId(id);
    const found = structures.find(
      x => x.academic_year_id === yearId && x.class_id === id
    );
    setFeeValues(found);

    try {
      if (found) await loadCharges(found.id);
      else setCharges([]);
    } catch (e) {
      reportError(e);
    }
  }

  async function saveFee(e: FormEvent) {
    e.preventDefault();

    if (!schoolId || !yearId || !classId) {
      setError('Chagua shule, mwaka wa masomo na darasa.');
      return;
    }

    if ([fee.school_fee, fee.accommodation_fee, fee.transport_fee]
      .some(x => x.trim() === '' || !Number.isFinite(Number(x)) || Number(x) < 0)) {
      setError('Weka kiasi sahihi cha ada. Kiasi hakiwezi kuwa hasi.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      let targetSchoolId = schoolId;
      const isPlatformAdmin =
        (authData.user?.email || '').toLowerCase() === 'goodlucknoel19@gmail.com';

      if (!isPlatformAdmin) {
        const { data: assignedData, error: assignedError } =
          await supabase.rpc('get_my_school');
        if (assignedError) throw assignedError;

        const assigned = Array.isArray(assignedData) ? assignedData[0] : assignedData;
        if (!assigned?.school_id) {
          throw new Error('Akaunti hii haina shule iliyounganishwa.');
        }
        if (assigned.school_id !== schoolId) {
          throw new Error('Shule iliyochaguliwa haifanani na shule ya akaunti hii. Tafadhali fungua upya ukurasa.');
        }
        targetSchoolId = assigned.school_id;
      }

      const payload = {
        school_id: targetSchoolId,
        academic_year_id: yearId,
        class_id: classId,
        school_fee: Number(fee.school_fee),
        accommodation_fee: Number(fee.accommodation_fee),
        transport_fee: Number(fee.transport_fee)
      };

      if (structure) {
        const { error } = await supabase
          .from('fee_structures')
          .update(payload)
          .eq('id', structure.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('fee_structures')
          .insert(payload);

        if (error) throw error;
      }

      const { data, error } = await supabase
        .from('fee_structures')
        .select('*')
        .eq('school_id', schoolId);

      if (error) throw error;

      const all = (data || []) as Structure[];
      setStructures(all);

      const updated = all.find(
        x => x.academic_year_id === yearId && x.class_id === classId
      );

      setFeeValues(updated);
      if (updated) await loadCharges(updated.id);
      setMessage('Ada za darasa zimehifadhiwa.');
    } catch (e) {
      reportError(e);
    } finally {
      setSaving(false);
    }
  }

  function resetCharge() {
    setEditingCharge(null);
    setCharge({
      charge_name: '', amount: '', applies_to: 'All', is_mandatory: true
    });
  }

  function editCharge(x: Charge) {
    setEditingCharge(x.id);
    setCharge({
      charge_name: x.charge_name,
      amount: String(x.amount),
      applies_to: x.applies_to,
      is_mandatory: x.is_mandatory
    });
  }

  async function saveCharge(e: FormEvent) {
    e.preventDefault();

    if (!structure) {
      setError('Hifadhi ada za darasa kwanza.');
      return;
    }

    if (!charge.charge_name.trim() || Number(charge.amount) <= 0) {
      setError('Jaza jina la gharama na kiasi sahihi.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        fee_structure_id: structure.id,
        charge_name: charge.charge_name.trim(),
        amount: Number(charge.amount),
        applies_to: charge.applies_to,
        is_mandatory: charge.is_mandatory
      };

      const result = editingCharge
        ? await supabase.from('fee_other_charges')
            .update(payload).eq('id', editingCharge)
        : await supabase.from('fee_other_charges').insert(payload);

      if (result.error) throw result.error;

      await loadCharges(structure.id);
      resetCharge();
      setMessage('Gharama nyingine imehifadhiwa.');
    } catch (e) {
      reportError(e);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCharge(x: Charge) {
    if (!window.confirm(`Una uhakika unataka kufuta ${x.charge_name}?`)) return;

    try {
      const { error } = await supabase
        .from('fee_other_charges')
        .delete()
        .eq('id', x.id);

      if (error) throw error;
      setCharges(old => old.filter(item => item.id !== x.id));
      if (editingCharge === x.id) resetCharge();
      setMessage('Gharama imefutwa.');
    } catch (e) {
      reportError(e);
    }
         }
    async function generateAccounts() {
    if (!structure) {
      setError('Tafadhali weka kwanza ada za darasa hili.');
      return;
    }

    setGenerating(true);
    setError('');
    setMessage('');

    try {
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('student_enrollments')
        .select('*')
        .eq('academic_year_id', yearId)
        .eq('class_id', classId)
        .eq('status', 'Active');

      if (enrollmentError) throw enrollmentError;

      const activeEnrollments = (enrollmentData || []) as Enrollment[];

      if (!activeEnrollments.length) {
        setMessage('Hakuna wanafunzi waliosajiliwa katika darasa hili kwa mwaka huu.');
        return;
      }

      const enrollmentIds = activeEnrollments.map(x => x.id);

      const { data: existingData, error: existingError } = await supabase
        .from('student_fee_accounts')
        .select('enrollment_id')
        .in('enrollment_id', enrollmentIds);

      if (existingError) throw existingError;

      const existingIds = new Set(
        (existingData || []).map(x => x.enrollment_id)
      );

      const newEnrollments = activeEnrollments.filter(
        x => !existingIds.has(x.id)
      );

      if (!newEnrollments.length) {
        setMessage('Akaunti za ada za wanafunzi hawa tayari zipo.');
        await refresh();
        return;
      }

      const { data: chargeData, error: chargeError } = await supabase
        .from('fee_other_charges')
        .select('*')
        .eq('fee_structure_id', structure.id)
        .eq('is_mandatory', true);

      if (chargeError) throw chargeError;

      const mandatoryCharges = (chargeData || []) as Charge[];

      const accountRows = newEnrollments.map(enrollment => {
        const isBoarding =
          enrollment.accommodation_type?.toLowerCase() === 'boarding';

        const applicableCharges = mandatoryCharges.filter(item =>
          item.applies_to === 'All' ||
          (item.applies_to === 'Boarding' && isBoarding) ||
          (item.applies_to === 'Day' && !isBoarding)
        );

        const otherTotal = applicableCharges.reduce(
          (sum, item) => sum + Number(item.amount || 0), 0
        );

        const schoolFee = Number(structure.school_fee || 0);
        const accommodationFee = isBoarding
          ? Number(structure.accommodation_fee || 0)
          : 0;
        const transportFee = !isBoarding
          ? Number(structure.transport_fee || 0)
          : 0;

        return {
          enrollment_id: enrollment.id,
          fee_structure_id: structure.id,
          school_fee: schoolFee,
          accommodation_fee: accommodationFee,
          transport_fee: transportFee,
          other_charges_total: otherTotal,
          total_amount:
            schoolFee + accommodationFee + transportFee + otherTotal
        };
      });

      const { error: insertError } = await supabase
        .from('student_fee_accounts')
        .insert(accountRows);

      if (insertError) throw insertError;

      await refresh();
      setTab('accounts');
      setMessage(
        `Akaunti za ada ${accountRows.length} zimefunguliwa kikamilifu.`
      );
    } catch (e: any) {
      reportError(e);
    } finally {
      setGenerating(false);
    }
  }

  function openPayment(account: Account) {
    setEditingPayment(null);
    setPaymentAccount(account);
    setPayment({
      amount: '',
      payment_date: today(),
      payment_method: 'Cash',
      reference_number: '',
      notes: ''
    });
    setError('');
    setMessage('');
  }

  function parseFeeImport(text: string) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return [];
    const splitLine = (line: string, delimiter: string) => {
      const values: string[] = [];
      let value = '', quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"' && line[i + 1] === '"' && quoted) { value += '"'; i++; }
        else if (ch === '"') quoted = !quoted;
        else if (ch === delimiter && !quoted) { values.push(value.trim()); value = ''; }
        else value += ch;
      }
      values.push(value.trim());
      return values;
    };
    const normalize = (value: string) => value.toLowerCase()
      .replace(/[⇅↑↓]/g, '').replace(/[^a-z0-9]/g, '');
    const delimiters = [',', '\t', ';'];
    let headerIndex = -1, delimiter = ',';
    let headers: string[] = [];
    for (let i = 0; i < Math.min(lines.length, 12); i++) {
      for (const candidate of delimiters) {
        const cells = splitLine(lines[i], candidate).map(normalize);
        if (cells.some(x => ['admissionno','registrationno','regno','nambayausajili','payername','payer'].includes(x)) &&
            cells.some(x => ['receiptnumber','receiptno','receipt','risiti'].includes(x)) &&
            cells.some(x => ['amount','amountpaid','paidamount','kiasichalipwa'].includes(x))) {
          headerIndex = i; delimiter = candidate; headers = cells; break;
        }
      }
      if (headerIndex >= 0) break;
    }
    if (headerIndex < 0) {
      delimiter = lines[0].includes('\t') ? '\t' : ',';
      headers = splitLine(lines[0], delimiter).map(normalize);
      headerIndex = 0;
    }
    const find = (row: string[], aliases: string[]) => {
      const index = headers.findIndex(h => aliases.includes(h));
      return index < 0 ? '' : (row[index] || '').trim();
    };
    const number = (value: string) => value.replace(/[,\s]/g, '').replace(/[^0-9.-]/g, '');
    return lines.slice(headerIndex + 1).map((line, index) => {
      const row = splitLine(line, delimiter);
      const amount = find(row, ['amount','amountpaid','paidamount','paid','kiasi','kiasichalipwa','malipo']);
      return {
        line: headerIndex + index + 2,
        admissionNo: find(row, ['admissionno','admission','registrationno','regno','nambayausajili','namba']),
        payerName: find(row, ['payername','payer','studentname','name','jinalamlipaji','jinalamwanafunzi']),
        total: number(find(row, ['totalamount','totalfee','fee','ada','adajumla','amountdue','jumlayada'])),
        paid: number(amount),
        date: find(row, ['paymentdate','date','tarehe','tareheyalipo']),
        method: find(row, ['paymentmethod','method','njia','njiyamalipo','account']),
        receipt: find(row, ['receiptnumber','receiptno','receipt','risiti']),
        reference: find(row, ['referencenumber','reference','transactionid','muamala','controlno']),
        notes: [find(row, ['payername','payer','jinalamlipaji']), find(row, ['notes','maelezo'])]
          .filter(Boolean).join(' | ')
      };
    }).filter(row => row.admissionNo || row.payerName || row.total || row.paid);
  }

  async function importFeeData() {
    if (!structure) { setError('Hifadhi kwanza ada za darasa hili kwenye Mpangilio wa Ada.'); return; }
    const imported = parseFeeImport(feeImportText);
    if (!imported.length) { setError('Hakuna mistari ya malipo iliyosomwa.'); return; }
    setFeeImporting(true); setError(''); setMessage('');
    let importedAccounts = 0, importedPayments = 0, skipped = 0;
    const issues: string[] = [];
    try {
      // Import across all classes in the selected school and academic year.
      const { data: enrollmentData, error: enrollmentError } = await supabase.from('student_enrollments')
        .select('*').eq('academic_year_id', yearId).eq('status', 'Active');
      if (enrollmentError) throw enrollmentError;
      const yearEnrollments = (enrollmentData || []) as Enrollment[];
      const studentIds = [...new Set(yearEnrollments.map(x => x.student_id))];
      const { data: studentData, error: studentError } = studentIds.length
        ? await supabase.from('students').select('id, admission_no, first_name, middle_name, last_name').in('id', studentIds)
        : { data: [], error: null };
      if (studentError) throw studentError;
      const normalizeStudentName = (value: string) => value.toLowerCase()
        .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
      const admissionMap = new Map((studentData || []).map((s: any) => [String(s.admission_no || '').trim().toLowerCase(), s.id]));
      const nameMap = new Map<string, string[]>();
      (studentData || []).forEach((s: any) => {
        const fullName = normalizeStudentName([s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' '));
        if (fullName) nameMap.set(fullName, [...(nameMap.get(fullName) || []), s.id]);
      });
      const enrollmentByStudent = new Map(yearEnrollments.map(x => [x.student_id, x]));
      const yearStructures = structures.filter(x => x.academic_year_id === yearId);
      const structureByClass = new Map(yearStructures.map(x => [x.class_id, x]));
      const feeStructureIds = yearStructures.map(x => x.id);
      const { data: accountData, error: accountError } = feeStructureIds.length
        ? await supabase.from('student_fee_accounts').select('*').in('fee_structure_id', feeStructureIds)
        : { data: [], error: null };
      if (accountError) throw accountError;
      const accountByEnrollment = new Map(((accountData || []) as Account[]).map(x => [x.enrollment_id, x]));
      const accountIds = (accountData || []).map((x: any) => x.id);
      const { data: paymentData, error: paymentError } = accountIds.length
        ? await supabase.from('fee_payments').select('receipt_number, student_fee_account_id').in('student_fee_account_id', accountIds)
        : { data: [], error: null };
      if (paymentError) throw paymentError;
      const receiptSet = new Set((paymentData || []).map((x: any) => x.student_fee_account_id + ':' + x.receipt_number));

      for (const row of imported) {
        const byAdmission = row.admissionNo ? admissionMap.get(row.admissionNo.trim().toLowerCase()) : undefined;
        const matchingNames = row.payerName ? nameMap.get(normalizeStudentName(row.payerName)) || [] : [];
        const studentId = byAdmission || (matchingNames.length === 1 ? matchingNames[0] : undefined);
        const enrollment = studentId ? enrollmentByStudent.get(studentId) : undefined;
        const classStructure = enrollment ? structureByClass.get(enrollment.class_id) : undefined;
        const paid = Number(row.paid);
        const totalProvided = row.total !== '';
        const total = totalProvided ? Number(row.total) : NaN;
        if (!enrollment || !Number.isFinite(paid) || paid <= 0 ||
            (totalProvided && (!Number.isFinite(total) || total < paid))) {
          skipped++; issues.push('Mstari ' + row.line + ': mwanafunzi hakupatikana kwa namba/jina, jina linafanana na wanafunzi zaidi ya mmoja, au kiasi si sahihi.'); continue;
        }

        let account = accountByEnrollment.get(enrollment.id);
        if (!account && !totalProvided) {
          skipped++; issues.push('Mstari ' + row.line + ': akaunti ya ada haijafunguliwa kwa mwanafunzi huyu. Fungua akaunti kwanza.'); continue;
        }
        if (!account && totalProvided && !classStructure) {
          skipped++; issues.push('Mstari ' + row.line + ': hakuna mpangilio wa ada kwa darasa la mwanafunzi huyu.'); continue;
        }
        if (account && totalProvided) {
          const { error: updateError } = await supabase.from('student_fee_accounts')
            .update({ total_amount: total }).eq('id', account.id);
          if (updateError) { skipped++; issues.push('Mstari ' + row.line + ': ' + updateError.message); continue; }
          account = { ...account, total_amount: total };
        } else if (!account && totalProvided) {
          const { data: created, error: createError } = await supabase.from('student_fee_accounts').insert({
            enrollment_id: enrollment.id, fee_structure_id: classStructure!.id,
            school_fee: total, accommodation_fee: 0, transport_fee: 0,
            other_charges_total: 0, total_amount: total
          }).select('*').single();
          if (createError) { skipped++; issues.push('Mstari ' + row.line + ': ' + createError.message); continue; }
          account = created as Account;
          accountByEnrollment.set(enrollment.id, account);
          importedAccounts++;
        }

        if (!account) { skipped++; continue; }
        const receipt = row.receipt || ('IMPORT-' + Date.now() + '-' + row.line);
        const key = account.id + ':' + receipt;
        if (receiptSet.has(key)) {
          skipped++; issues.push('Mstari ' + row.line + ': risiti ' + receipt + ' tayari imeingizwa.'); continue;
        }
        const { error: addPaymentError } = await supabase.from('fee_payments').insert({
          student_fee_account_id: account.id, receipt_number: receipt, amount: paid,
          payment_date: row.date || today(), payment_method: row.method || 'Import',
          reference_number: row.reference || null,
          notes: row.notes || 'Malipo yaliyoingizwa kutoka mfumo mwingine'
        });
        if (addPaymentError) { skipped++; issues.push('Mstari ' + row.line + ': ' + addPaymentError.message); }
        else { importedPayments++; receiptSet.add(key); }
      }
      await refresh();
      setFeeImportText(''); setShowFeeImport(false);
      setMessage('Import imekamilika. Akaunti mpya: ' + importedAccounts + '; malipo: ' + importedPayments + '; mistari iliyorukwa: ' + skipped + '.');
      if (issues.length) setError(issues.slice(0, 10).join('\\n'));
    } catch (e) { reportError(e); }
    finally { setFeeImporting(false); }
  }

  async function savePayment(e: FormEvent) {
    e.preventDefault();

    if (!paymentAccount) return;

    const amount = Number(payment.amount);

    if (!amount || amount <= 0) {
      setError('Weka kiasi sahihi cha malipo.');
      return;
    }

    const paidSoFar = payments
      .filter(x => x.student_fee_account_id === paymentAccount.id)
       .reduce((sum, x) => sum + Number(x.amount), 0);

    const remaining =
      Number(paymentAccount.total_amount) - paidSoFar + Number(editingPayment?.amount || 0);

    if (amount > remaining) {
      setError(
        `Kiasi kimezidi deni lililobaki. Deni ni TSh ${money(remaining)}.`
      );
      return;
    }

    setSaving(true);
    setError('');

    try {
      const receiptNumber =
        `ADA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const paymentPayload = {
        amount,
        payment_date: payment.payment_date,
        payment_method: payment.payment_method,
        reference_number: payment.reference_number.trim() || null,
        notes: payment.notes.trim() || null
      };
      if (editingPayment) {
        const { error: updateError } = await supabase.from('fee_payments')
          .update(paymentPayload).eq('id', editingPayment.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('fee_payments')
          .insert({ student_fee_account_id: paymentAccount.id, receipt_number: receiptNumber, ...paymentPayload });
        if (insertError) throw insertError;
      }
      setPaymentAccount(null);
      setEditingPayment(null);
      setMessage(editingPayment ? 'Malipo yamehaririwa na mabadiliko yamehifadhiwa kwenye historia.' : `Malipo yamehifadhiwa. Risiti: ${receiptNumber}`);
      await refresh();
    } catch (e: any) {
      reportError(e);
    } finally {
      setSaving(false);
    }
  }
    async function editPayment(p: Payment, account: Account) {
    setEditingPayment(p);
    setPaymentAccount(account);
    setPayment({ amount: String(p.amount), payment_date: p.payment_date, payment_method: p.payment_method, reference_number: p.reference_number || '', notes: p.notes || '' });
    setError('');
  }

  async function deletePayment(p: Payment) {
    if (!window.confirm(`Una uhakika unataka kufuta malipo ya TSh ${money(p.amount)}? Historia ya mabadiliko itabaki.`)) return;
    try {
      const { error } = await supabase.from('fee_payments').delete().eq('id', p.id);
      if (error) throw error;
      setMessage('Malipo yamefutwa. Rekodi ya ufutaji imehifadhiwa kwenye historia ya mabadiliko.');
      await refresh();
    } catch (e) { reportError(e); }
  }

  async function saveFeeAccount(e: FormEvent) {
    e.preventDefault();
    if (!editingFeeAccount) return;
    const values = {
      school_fee: Number(feeEdit.school_fee || 0),
      accommodation_fee: Number(feeEdit.accommodation_fee || 0),
      transport_fee: Number(feeEdit.transport_fee || 0),
      other_charges_total: Number(feeEdit.other_charges_total || 0)
    };
    const total_amount = Object.values(values).reduce((sum, value) => sum + value, 0);
    try {
      const { error } = await supabase.from('student_fee_accounts').update({ ...values, total_amount }).eq('id', editingFeeAccount.id);
      if (error) throw error;
      setEditingFeeAccount(null);
      setMessage('Ada ya mwanafunzi imehaririwa; mabadiliko yamehifadhiwa kwenye historia.');
      await refresh();
    } catch (e) { reportError(e); }
  }

  async function openAuditHistory() {
    try {
      const { data, error } = await supabase.from('fee_change_audit').select('*').eq('school_id', schoolId).order('changed_at', { ascending: false }).limit(200);
      if (error) throw error;
      setAuditRows((data || []) as FeeAudit[]);
      setShowAudit(true);
    } catch (e) { reportError(e); }
  }

  const historyEnrollment = historyAccount
    ? enrollmentMap.get(historyAccount.enrollment_id)
    : undefined;

  const historyStudent = historyEnrollment
    ? studentMap.get(historyEnrollment.student_id)
    : undefined;

  const historyPayments = historyAccount
    ? payments.filter(
        x => x.student_fee_account_id === historyAccount.id
      )
    : [];

  const historyPaid = historyPayments.reduce(
    (sum, x) => sum + Number(x.amount), 0
  );

  async function printReceipt(p: Payment, account: Account, format: '80mm' | 'A4') {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Ruhusu popup kwenye browser ili kuchapisha risiti.');
      return;
    }

    const enrollment = enrollmentMap.get(account.enrollment_id);
    const student = enrollment ? studentMap.get(enrollment.student_id) : undefined;
    const { data: schoolDetails } = await supabase.from('schools').select('school_name,phone,email,address').eq('id', schoolId).maybeSingle();
    const school = { ...schools.find(x => x.id === schoolId), ...schoolDetails };
    const accountPayments = payments.filter(x => x.student_fee_account_id === account.id);
    const totalPaid = accountPayments.reduce((sum, item) => sum + Number(item.amount), 0);
    const balance = Math.max(0, Number(account.total_amount) - totalPaid);
    let logoUrl = '';
    let letterheadUrl = '';

    try {
      const { data } = await supabase
        .from('school_branding')
        .select('logo_path,letterhead_path')
        .eq('school_id', schoolId)
        .maybeSingle();
      const storage = supabase.storage.from('school-branding');
      if (data?.logo_path) logoUrl = storage.getPublicUrl(data.logo_path).data.publicUrl;
      if (data?.letterhead_path) letterheadUrl = storage.getPublicUrl(data.letterhead_path).data.publicUrl;
    } catch (error) {
      console.error('Imeshindikana kupakia branding ya shule kwenye risiti:', error);
    }

    const isThermal = format === '80mm';
    const verifyUrl = `${window.location.origin}/verify-receipt?receipt=${encodeURIComponent(p.receipt_number)}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${isThermal ? '180x180' : '220x220'}&margin=2&data=${encodeURIComponent(verifyUrl)}`;
    const header = `<div class="school-header">${logoUrl ? `<img class="logo" src="${logoUrl}" alt="Logo ya shule">` : ''}<strong>${school?.school_name || 'SHULE'}</strong>${school?.address ? `<div>${school.address}</div>` : ''}${school?.phone ? `<div>Simu: ${school.phone}</div>` : ''}${school?.email ? `<div>${school.email}</div>` : ''}</div>`;
    const letterheadBackground = !isThermal && letterheadUrl
      ? `<img class="letterhead-background" src="${letterheadUrl}" alt="">`
      : '';

    const content = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Risiti ${p.receipt_number}</title>
        <style>
          @page { size: ${isThermal ? '80mm auto' : 'A4'}; margin: 0; }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #111; }
          .receipt-page { position: relative; width: ${isThermal ? '80mm' : '210mm'}; ${isThermal ? '' : 'min-height:297mm;'} box-sizing: border-box; padding: ${isThermal ? '3mm' : letterheadUrl ? '48mm 18mm 24mm' : '18mm'}; overflow: visible; }
          .letterhead-background { position: absolute; inset: 0; z-index: 0; width: 210mm; height: 297mm; object-fit: fill; }
          .receipt-content { position: relative; z-index: 1; width: 100%; }
          .receipt { ${isThermal ? 'border:1px dashed #555; padding:1.5mm;' : 'border:1px solid #999; padding:18px;'} }
          .school-header { text-align:center; font-size:${isThermal ? '8px' : '18px'}; font-weight:bold; }
          .school-header strong { display:block; }
          .logo { display:block; width:${isThermal ? '9mm' : '24mm'}; height:${isThermal ? '9mm' : '24mm'}; object-fit:contain; margin:0 auto 1mm; }
          h3 { text-align:center; font-size:${isThermal ? '8px' : '16px'}; margin:${isThermal ? '1mm 0' : '4mm 0'}; }
          .line { border-bottom:1px dashed #555; margin:${isThermal ? '0.8mm' : '3mm'} 0; }
          .row { display:flex; justify-content:space-between; align-items:flex-start; gap:${isThermal ? '0.8mm' : '3mm'}; margin:${isThermal ? '0.5mm' : '2.2mm'} 0; font-size:${isThermal ? '7px' : '13px'}; }
          .row span:first-child { flex:0 0 42%; }
          .row b, .row span:last-child { text-align:right; overflow-wrap:anywhere; }
          .amount { font-size:${isThermal ? '9px' : '20px'}; font-weight:bold; border-top:1px dashed #555; border-bottom:1px dashed #555; padding:${isThermal ? '0.8mm' : '3mm'} 0; }
          .footer { text-align:center; margin-top:${isThermal ? '1mm' : '5mm'}; font-size:${isThermal ? '7px' : '12px'}; }
          .verify { text-align:center; margin-top:${isThermal ? '0.8mm' : '3mm'}; font-size:${isThermal ? '6px' : '10px'}; overflow-wrap:anywhere; }
          .qr-wrap { text-align:center; margin:${isThermal ? '1mm' : '4mm'} auto 0; }
          .qr-code { width:${isThermal ? '14mm' : '28mm'}; height:${isThermal ? '14mm' : '28mm'}; display:block; margin:0 auto 1mm; image-rendering:pixelated; }
          .qr-caption { font-size:${isThermal ? '5px' : '9px'}; text-align:center; }
          @media print { @page { margin:0; } }
          @media print { html, body { margin:0; padding:0; width:${isThermal ? '80mm' : '210mm'}; } .receipt-page { break-inside:auto; page-break-inside:auto; } .receipt { border-color:#555; } }
        </style>
      </head>
      <body>
        <div class="receipt-page">
          ${letterheadBackground}
          <div class="receipt-content">
            <div class="receipt">
              ${header}
              <h3>RISITI YA MALIPO YA ADA</h3>
              <div class="line"></div>
              <div class="row"><span>Namba ya Risiti</span><b>${p.receipt_number}</b></div>
              <div class="row"><span>Tarehe</span><b>${p.payment_date}</b></div>
              <div class="row"><span>Mwanafunzi</span><b>${student ? `${student.first_name} ${student.middle_name || ''} ${student.last_name}` : '—'}</b></div>
              <div class="row"><span>Namba ya Usajili</span><b>${student?.admission_no || '—'}</b></div>
              <div class="row"><span>Njia ya Malipo</span><b>${p.payment_method}</b></div>
              <div class="row"><span>Namba ya Muamala</span><b>${p.reference_number || '—'}</b></div>
              <div class="line"></div>
              <div class="row amount"><span>Kiasi Kilicholipwa</span><span>TSh ${money(p.amount)}</span></div>
              <div class="row"><span>Jumla ya Ada</span><b>TSh ${money(account.total_amount)}</b></div>
              <div class="row"><span>Jumla Iliyolipwa</span><b>TSh ${money(totalPaid)}</b></div>
              <div class="row"><span>Salio</span><b>TSh ${money(balance)}</b></div>
              <div class="row"><span>Maelezo</span><b>${p.notes || '—'}</b></div>
              <div class="footer">Asante kwa kufanya malipo.</div>
              <div class="verify">Hifadhi risiti hii kwa kumbukumbu. Namba ya uthibitisho: ${p.receipt_number}</div>
              <div class="qr-wrap"><img class="qr-code" src="${qrUrl}" alt="QR code ya kuthibitisha risiti"><div class="qr-caption">Changanua QR code kuthibitisha risiti</div></div>
            </div>
          </div>
        </div>
        <script>window.onload = () => { const images = Array.from(document.images); Promise.all(images.map(img => img.decode ? img.decode().catch(() => {}) : Promise.resolve())).then(() => window.print()); };</script>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  }
  const page: React.CSSProperties = {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    padding: 16,
    boxSizing: 'border-box',
    color: '#243447'
  };

  const fieldGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
    gap: 14,
    width: '100%',
    minWidth: 0
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 900
  };

  const smallButton: React.CSSProperties = {
    ...button,
    padding: '8px 11px',
    fontSize: 13,
    whiteSpace: 'nowrap'
  };

  const tabButton = (active: boolean): React.CSSProperties => ({
    padding: '11px 17px',
    border: 0,
    borderBottom: active ? '3px solid #173b5e' : '3px solid transparent',
    background: 'transparent',
    color: active ? '#173b5e' : '#64748b',
    fontWeight: 700,
    cursor: 'pointer'
  });

  return (
    <div className="fees-module" style={page}>
      <div style={{
        display: 'flex', flexWrap: 'wrap',
        justifyContent: 'space-between', alignItems: 'center',
        gap: 12, marginBottom: 20
      }}>
        <div>
          <h2 style={{ margin: 0, color: '#173b5e' }}>Ada na Malipo</h2>
          <p style={{ margin: '6px 0 0', color: '#64748b' }}>
            Usimamizi wa ada, akaunti za wanafunzi na risiti za malipo
          </p>
        </div>
      </div>

      {error && (
        <div style={{
          padding: 12, marginBottom: 12, borderRadius: 9,
          background: '#fee2e2', color: '#991b1b'
        }}>
          {error}
          <button
            onClick={() => setError('')}
            style={{ float: 'right', border: 0, background: 'transparent' }}
          >
            ✕
          </button>
        </div>
      )}

      {message && (
        <div style={{
          padding: 12, marginBottom: 12, borderRadius: 9,
          background: '#dcfce7', color: '#166534'
        }}>
          {message}
          <button
            onClick={() => setMessage('')}
            style={{ float: 'right', border: 0, background: 'transparent' }}
          >
            ✕
          </button>
        </div>
      )}

      <div style={{ ...card, marginBottom: 16 }}>
        <div style={fieldGrid}>
          <label style={label}>
            Shule
            <select
              style={input}
              value={schoolId}
              onChange={e => changeSchool(e.target.value)}
            >
              <option value="">Chagua shule</option>
              {schools.map(x => (
                <option key={x.id} value={x.id}>{x.school_name}</option>
              ))}
            </select>
          </label>

          <label style={label}>
            Mwaka wa Masomo
            <select
              style={input}
              value={yearId}
              onChange={e => changeYear(e.target.value)}
            >
              {years.map(x => (
                <option key={x.id} value={x.id}>{x.year_name}</option>
              ))}
            </select>
          </label>

          <label style={label}>
            Darasa
            <select
              style={input}
              value={classId}
              onChange={e => changeClass(e.target.value)}
            >
              {classes.map(x => (
                <option key={x.id} value={x.id}>{x.class_name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0',
        marginBottom: 16, overflowX: 'auto'
      }}>
        {!isAccountant && <button style={tabButton(tab === 'setup')} onClick={() => setTab('setup')}>
          Mpangilio wa Ada
        </button>}
        <button style={tabButton(tab === 'accounts')} onClick={() => setTab('accounts')}>
          Akaunti za Wanafunzi
        </button>
        <button style={tabButton(tab === 'reports')} onClick={() => setTab('reports')}>
          Ripoti za Ada
        </button>
        {isAccountant && (
          <button style={tabButton(false)} onClick={openAuditHistory}>
            Historia ya Mabadiliko
          </button>
        )}
      </div>

      {loading ? (
        <div style={card}>Inapakia taarifa...</div>
      ) : (
        <>
          {tab === 'setup' && !isAccountant && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={card}>
                <h3 style={{ marginTop: 0, color: '#173b5e' }}>
                  Ada za Mwaka
                </h3>
                <p style={{ color: '#64748b', fontSize: 13 }}>
                  Weka ada kwa mwaka mzima wa masomo kwa darasa lililochaguliwa.
                </p>

                <form onSubmit={saveFee}>
                  <div style={fieldGrid}>
                    <label style={label}>
                      Ada ya Shule (TSh)
                      <input
                        style={input}
                        type="number"
                        min="0"
                        value={fee.school_fee}
                        onChange={e => setFee({ ...fee, school_fee: e.target.value })}
                      />
                    </label>

                    <label style={label}>
                      Ada ya Malazi - Boarding (TSh)
                      <input
                        style={input}
                        type="number"
                        min="0"
                        value={fee.accommodation_fee}
                        onChange={e => setFee({ ...fee, accommodation_fee: e.target.value })}
                      />
                    </label>

                    <label style={label}>
                      Ada ya Usafiri - Day (TSh)
                      <input
                        style={input}
                        type="number"
                        min="0"
                        value={fee.transport_fee}
                        onChange={e => setFee({ ...fee, transport_fee: e.target.value })}
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    style={{ ...button, marginTop: 16 }}
                    disabled={saving || !schoolId || !yearId || !classId}
                  >
                    {saving ? 'Inahifadhi...' : 'Hifadhi Ada'}
                  </button>
                </form>
              </div>

              <div style={card}>
                <h3 style={{ marginTop: 0, color: '#173b5e' }}>
                  Ada na Huduma Nyingine
                </h3>
                <p style={{ color: '#64748b', fontSize: 13 }}>
                  Ongeza huduma kama sare, huduma ya kwanza, mahafali, safari na mitihani.
                </p>

                {!structure ? (
                  <p>Hifadhi kwanza ada za shule ili uweze kuongeza huduma nyingine.</p>
                ) : (
                  <>
                    <form onSubmit={saveCharge}>
                      <div style={fieldGrid}>
                        <label style={label}>
                          Jina la Huduma
                          <input
                            style={input}
                            value={charge.charge_name}
                            onChange={e => setCharge({ ...charge, charge_name: e.target.value })}
                            placeholder="Mfano: Sare"
                          />
                        </label>

                        <label style={label}>
                          Kiasi (TSh)
                          <input
                            style={input}
                            type="number"
                            min="0"
                            value={charge.amount}
                            onChange={e => setCharge({ ...charge, amount: e.target.value })}
                          />
                        </label>

                        <label style={label}>
                          Inamhusu nani?
                          <select
                            style={input}
                            value={charge.applies_to}
                            onChange={e => setCharge({
                              ...charge,
                              applies_to: e.target.value as 'All' | 'Day' | 'Boarding'
                            })}
                          >
                            <option value="All">Wanafunzi wote</option>
                            <option value="Day">Day tu</option>
                            <option value="Boarding">Boarding tu</option>
                          </select>
                        </label>

                        <label style={label}>
                          Aina ya Malipo
                          <select
                            style={input}
                            value={charge.is_mandatory ? 'yes' : 'no'}
                            onChange={e => setCharge({
                              ...charge, is_mandatory: e.target.value === 'yes'
                            })}
                          >
                            <option value="yes">Lazima</option>
                            <option value="no">Hiari</option>
                          </select>
                        </label>
                      </div>

                      <div style={{
                        display: 'flex', flexWrap: 'wrap',
                        gap: 8, marginTop: 14
                      }}>
                        <button type="submit" style={button} disabled={saving}>
                          {editingCharge ? 'Hifadhi Mabadiliko' : 'Ongeza Huduma'}
                        </button>
                        {editingCharge && (
                          <button
                            type="button"
                            style={{ ...button, background: '#64748b' }}
                            onClick={resetCharge}
                          >
                            Ghairi
                          </button>
                        )}
                      </div>
                    </form>

                    <div className="table-scroll" style={{ overflowX: 'auto', marginTop: 18 }}>
                      <table style={{ ...tableStyle, minWidth: 650 }}>
                        <thead>
                          <tr>
                            {['Huduma', 'Kiasi', 'Aina ya Wanafunzi', 'Malipo', 'Vitendo'].map(x => (
                              <th key={x} style={{ ...cell, background: '#f1f5f9' }}>{x}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCharges.map(x => (
                            <tr key={x.id}>
                              <td style={cell}>{x.charge_name}</td>
                              <td style={cell}>TSh {money(x.amount)}</td>
                              <td style={cell}>{x.applies_to}</td>
                              <td style={cell}>{x.is_mandatory ? 'Lazima' : 'Hiari'}</td>
                              <td style={cell}>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button style={smallButton} onClick={() => editCharge(x)}>
                                    Hariri
                                  </button>
                                  <button
                                    style={{ ...smallButton, background: '#b91c1c' }}
                                    onClick={() => deleteCharge(x.id)}
                                  >
                                    Futa
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {!selectedCharges.length && (
                            <tr><td style={cell} colSpan={5}>Hakuna huduma zilizoongezwa.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {tab === 'accounts' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12
              }}>
                {[
                  ['Jumla ya Ada', totals.total],
                  ['Jumla Iliyolipwa', totals.paid],
                  ['Deni Lililobaki', totals.debt],
                  ['Idadi ya Wanafunzi', rows.length]
                ].map(([name, value]) => (
                  <div key={String(name)} style={card}>
                    <div style={{ color: '#64748b', fontSize: 13 }}>{name}</div>
                    <strong style={{
                      display: 'block', marginTop: 8,
                      color: '#173b5e', fontSize: 20
                    }}>
                      {typeof value === 'number' && name !== 'Idadi ya Wanafunzi'
                        ? `TSh ${money(value)}`
                        : value}
                    </strong>
                  </div>
                ))}
              </div>

              <div style={card}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  flexWrap: 'wrap', alignItems: 'center', gap: 10
                }}>
                  <h3 style={{ margin: 0, color: '#173b5e' }}>
                    Orodha ya Akaunti za Wanafunzi
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button type="button" style={{ ...button, background: '#eaf1f7', color: '#173b5e' }}
                      onClick={() => {
                        setError('');
                        setMessage('');
                        if (!structure) {
                          setTab('setup');
                          setError('Kwanza hifadhi ada za shule, mwaka wa masomo na darasa ulilochagua kwenye Mpangilio wa Ada. Kisha rudi hapa kuingiza taarifa.');
                          return;
                        }
                        setShowFeeImport(true);
                      }}>
                      Import Ada na Malipo
                    </button>
                    <button type="button" style={button} onClick={() => {
                      if (!structure) {
                        setTab('setup');
                        setError('Kwanza weka na uhifadhi ada za darasa kwenye Mpangilio wa Ada. Mfumo utatumia kiasi hicho kufungua akaunti za wanafunzi.');
                        return;
                      }
                      void generateAccounts();
                    }} disabled={generating}>
                      {generating ? 'Inafungua akaunti...' : 'Fungua Akaunti za Wanafunzi'}
                    </button>
                  </div>
                </div>

                <input
                  style={{ ...input, marginTop: 15, marginBottom: 12 }}
                  placeholder="Tafuta mwanafunzi au namba ya usajili..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />

                <div className="table-scroll" style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        {[
                          'Namba ya Usajili', 'Mwanafunzi', 'Darasa',
                          'Mkondo', 'Aina', 'Ada Jumla', 'Amelipa',
                          'Deni', 'Vitendo'
                        ].map(x => (
                          <th key={x} style={{ ...cell, background: '#f1f5f9' }}>{x}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map(({ account, enrollment, student, paid, balance }) => (
                        <tr key={account.id}>
                          <td style={cell}>{student?.admission_no || '—'}</td>
                          <td style={cell}>
                            {student
                              ? `${student.first_name} ${student.middle_name || ''} ${student.last_name}`
                              : '—'}
                          </td>
                          <td style={cell}>
                            {classes.find(c => c.id === enrollment?.class_id)?.class_name || '—'}
                          </td>
                          <td style={cell}>
                            {streams.find(st => st.id === enrollment?.stream_id)?.stream_name || '—'}
                          </td>
                          <td style={cell}>{enrollment?.accommodation_type || '—'}</td>
                          <td style={cell}>TSh {money(account.total_amount)}</td>
                          <td style={cell}>TSh {money(paid)}</td>
                          <td style={cell}>TSh {money(balance)}</td>
                          <td style={cell}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button style={smallButton} onClick={() => openPayment(account)}>
                                Lipa
                              </button>
                              <button style={{ ...smallButton, background: '#0f766e' }}
                                onClick={() => { setEditingFeeAccount(account); setFeeEdit({ school_fee: String(account.school_fee), accommodation_fee: String(account.accommodation_fee), transport_fee: String(account.transport_fee), other_charges_total: String(account.other_charges_total) }); }}>
                                Hariri Ada
                              </button>
                              <button style={{ ...smallButton, background: '#475569' }} onClick={() => setHistoryAccount(account)}>Historia</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!filteredRows.length && (
                        <tr>
                          <td style={cell} colSpan={9}>Hakuna akaunti zilizopatikana.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === 'reports' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={card}>
                <h3 style={{ marginTop: 0, color: '#173b5e' }}>Ripoti za Ada</h3>
                <p style={{ marginTop: 0, color: '#64748b', fontSize: 13 }}>
                  Chagua kuona makusanyo kwa mwezi mmoja au mwaka mzima. Ripoti itajisasisha kulingana na chaguo lako.
                </p>
                <div style={{ ...fieldGrid, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                  <label style={label}>
                    Aina ya Ripoti
                    <select style={input} value={reportPeriod}
                      onChange={e => setReportPeriod(e.target.value as 'month' | 'year')}>
                      <option value="month">Kwa Mwezi</option>
                      <option value="year">Kwa Mwaka</option>
                    </select>
                  </label>
                  {reportPeriod === 'month' && (
                    <label style={label}>
                      Chagua Mwezi
                      <select style={input} value={reportMonth}
                        onChange={e => setReportMonth(e.target.value)}>
                        {[
                          ['01', 'Januari'], ['02', 'Februari'], ['03', 'Machi'],
                          ['04', 'Aprili'], ['05', 'Mei'], ['06', 'Juni'],
                          ['07', 'Julai'], ['08', 'Agosti'], ['09', 'Septemba'],
                          ['10', 'Oktoba'], ['11', 'Novemba'], ['12', 'Desemba']
                        ].map(([value, name]) => <option key={value} value={value}>{name}</option>)}
                      </select>
                    </label>
                  )}
                  <label style={label}>
                    Chagua Mwaka
                    <select style={input} value={reportCalendarYear}
                      onChange={e => setReportCalendarYear(e.target.value)}>
                      {Array.from(new Set([
                        String(new Date().getFullYear()),
                        ...payments.map(p => p.payment_date.slice(0, 4)),
                        ...years.map(y => String(y.year_name).match(/\d{4}/)?.[0] || '')
                      ].filter(Boolean))).sort((a, b) => Number(b) - Number(a)).map(y =>
                        <option key={y} value={y}>{y}</option>
                      )}
                    </select>
                  </label>
                </div>
                <p style={{ color: '#64748b', fontSize: 13, marginBottom: 0 }}>
                  Kipindi kinachoonyeshwa: <b>{reportStartDate}</b> hadi <b>{reportEndDate}</b>
                </p>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 12
              }}>
                {[
                  ['Jumla ya Makusanyo - Mwaka', yearRevenue],
                  [reportPeriod === 'month' ? 'Makusanyo kwa Mwezi' : 'Makusanyo kwa Mwaka', periodRevenue],
                  ['Wanafunzi Wenye Deni', debtRows.length],
                  ['Waliolipa Kikamilifu', fullyPaidRows.length]
                ].map(([name, value]) => (
                  <div key={String(name)} style={{ ...card, borderTop: '4px solid #173b5e' }}>
                    <div style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>{name}</div>
                    <div style={{ color: '#173b5e', fontSize: 22, fontWeight: 800, marginTop: 8 }}>
                      {typeof value === 'number' && String(name).includes('Wanafunzi') || String(name).includes('Waliolipa')
                        ? money(Number(value))
                        : `TSh ${money(Number(value))}`}
                    </div>
                  </div>
                ))}
              </div>

              <div style={card}>
                <h3 style={{ marginTop: 0, color: '#173b5e' }}>Wanafunzi Wenye Madeni</h3>
                <div className="table-scroll" style={{ overflowX: 'auto' }}>
                  <table style={{ ...tableStyle, minWidth: 850 }}>
                    <thead><tr>
                      {['Namba ya Usajili', 'Mwanafunzi', 'Darasa', 'Mkondo', 'Ada Jumla', 'Amelipa', 'Deni'].map(x =>
                        <th key={x} style={{ ...cell, background: '#f1f5f9' }}>{x}</th>)}
                    </tr></thead>
                    <tbody>
                      {debtRows.map(({ account, enrollment, student, paid, balance }) => (
                        <tr key={account.id}>
                          <td style={cell}>{student?.admission_no || '—'}</td>
                          <td style={cell}>{reportStudentName(student)}</td>
                          <td style={cell}>{reportClassName(enrollment)}</td>
                          <td style={cell}>{reportStreamName(enrollment)}</td>
                          <td style={cell}>TSh {money(account.total_amount)}</td>
                          <td style={cell}>TSh {money(paid)}</td>
                          <td style={{ ...cell, color: '#b91c1c', fontWeight: 700 }}>TSh {money(balance)}</td>
                        </tr>
                      ))}
                      {!debtRows.length && <tr><td style={cell} colSpan={7}>Hakuna mwanafunzi mwenye deni kwa mwaka huu.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={card}>
                <h3 style={{ marginTop: 0, color: '#173b5e' }}>Wanafunzi Waliolipa Ada Kikamilifu</h3>
                <div className="table-scroll" style={{ overflowX: 'auto' }}>
                  <table style={{ ...tableStyle, minWidth: 750 }}>
                    <thead><tr>
                      {['Namba ya Usajili', 'Mwanafunzi', 'Darasa', 'Mkondo', 'Ada Jumla', 'Amelipa'].map(x =>
                        <th key={x} style={{ ...cell, background: '#f1f5f9' }}>{x}</th>)}
                    </tr></thead>
                    <tbody>
                      {fullyPaidRows.map(({ account, enrollment, student, paid }) => (
                        <tr key={account.id}>
                          <td style={cell}>{student?.admission_no || '—'}</td>
                          <td style={cell}>{reportStudentName(student)}</td>
                          <td style={cell}>{reportClassName(enrollment)}</td>
                          <td style={cell}>{reportStreamName(enrollment)}</td>
                          <td style={cell}>TSh {money(account.total_amount)}</td>
                          <td style={cell}>TSh {money(paid)}</td>
                        </tr>
                      ))}
                      {!fullyPaidRows.length && <tr><td style={cell} colSpan={6}>Hakuna mwanafunzi aliyelipa kikamilifu kwa mwaka huu.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={card}>
                <h3 style={{ marginTop: 0, color: '#173b5e' }}>Makusanyo kwa Tarehe</h3>
                <p style={{ marginTop: 0, color: '#64748b', fontSize: 13 }}>
                  Jumla ya kipindi: <b>TSh {money(periodRevenue)}</b>
                </p>
                <div className="table-scroll" style={{ overflowX: 'auto' }}>
                  <table style={{ ...tableStyle, minWidth: 850 }}>
                    <thead><tr>
                      {['Tarehe', 'Risiti', 'Namba ya Usajili', 'Mwanafunzi', 'Darasa', 'Mkondo', 'Njia ya Malipo', 'Kiasi'].map(x =>
                        <th key={x} style={{ ...cell, background: '#f1f5f9' }}>{x}</th>)}
                    </tr></thead>
                    <tbody>
                      {periodPayments.map(p => {
                        const account = accounts.find(a => a.id === p.student_fee_account_id);
                        const enrollment = account ? enrollmentMap.get(account.enrollment_id) : undefined;
                        const student = enrollment ? studentMap.get(enrollment.student_id) : undefined;
                        return (
                          <tr key={p.id}>
                            <td style={cell}>{p.payment_date}</td>
                            <td style={cell}>{p.receipt_number}</td>
                            <td style={cell}>{student?.admission_no || '—'}</td>
                            <td style={cell}>{reportStudentName(student)}</td>
                            <td style={cell}>{reportClassName(enrollment)}</td>
                            <td style={cell}>{reportStreamName(enrollment)}</td>
                            <td style={cell}>{p.payment_method}</td>
                            <td style={cell}>TSh {money(p.amount)}</td>
                          </tr>
                        );
                      })}
                      {(!periodPayments.length) &&
                        <tr><td style={cell} colSpan={8}>Hakuna makusanyo yaliyopatikana katika kipindi hiki.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showFeeImport && (
        <div role="dialog" aria-modal="true" aria-label="Import ada na malipo" style={{
          position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,23,42,.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, overflowY: 'auto'
        }}>
          <div style={{ ...card, maxWidth: 650, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <h3 style={{ marginTop: 0, color: '#173b5e' }}>Import Ada na Malipo</h3>
              <button type="button" style={{ ...smallButton, background: '#64748b' }} onClick={() => setShowFeeImport(false)}>Funga ✕</button>
            </div>
            <p style={{ color: '#64748b', fontSize: 14 }}>
              Pakia CSV iliyotolewa Excel au bandika data kutoka Excel. Mfumo hutambua mwanafunzi kwa Namba ya Usajili ya shule, darasa na mwaka uliochagua.
            </p>
            <label style={label}>Chagua faili (Excel, CSV, PDF au Word)
              <input style={input} type="file"
                accept=".csv,.txt,.xlsx,.xls,.pdf,.docx,.doc,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setError('');
                  setMessage('');
                  try {
                    const ext = file.name.split('.').pop()?.toLowerCase();
                    let extracted = '';
                    if (ext === 'csv' || ext === 'txt') {
                      extracted = await file.text();
                    } else if (ext === 'xlsx' || ext === 'xls') {
                      const XLSX = await import('xlsx');
                      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
                      extracted = workbook.SheetNames.map(name =>
                        XLSX.utils.sheet_to_csv(workbook.Sheets[name])
                      ).join('\n');
                    } else if (ext === 'pdf') {
                      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
                      const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
                      const pages: string[] = [];
                      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
                        const page = await pdf.getPage(pageNo);
                        const content = await page.getTextContent();
                        pages.push(content.items.map((item: any) => item.str || '').join(' '));
                      }
                      extracted = pages.join('\n');
                      if (!extracted.trim()) {
                        throw new Error('PDF hii haina maandishi yanayoweza kusomwa. Badili iwe Excel/CSV au nakili maandishi yake.');
                      }
                    } else if (ext === 'docx') {
                      const mammoth = await import('mammoth/mammoth.browser');
                      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
                      extracted = result.value;
                    } else if (ext === 'doc') {
                      throw new Error('Faili la zamani la .doc halisomwi moja kwa moja. Tafadhali lihifadhi kama .docx au PDF.');
                    } else {
                      throw new Error('Aina ya faili hii haijaungwa mkono.');
                    }
                    setFeeImportText(extracted);
                    if (ext === 'pdf' || ext === 'docx') {
                      setMessage('Maandishi yamesomwa. Hakikisha safu zinafuata mpangilio wa admission_no, total_amount, paid_amount kabla ya ku-import.');
                    }
                  } catch (err: any) {
                    setError('Imeshindikana kusoma faili: ' + (err?.message || 'Hitilafu isiyojulikana'));
                  }
                }} />
            </label>
            <label style={{ ...label, marginTop: 14 }}>Au bandika data hapa (Excel / CSV)
              <textarea style={{ ...input, minHeight: 170, fontFamily: 'monospace', whiteSpace: 'pre' }}
                value={feeImportText} onChange={e => setFeeImportText(e.target.value)}
                placeholder={'admission_no,total_amount,paid_amount,payment_date,payment_method,receipt_number\nBFA-0001,500000,200000,2026-01-15,Cash,RCT-001\nBFA-0002,450000,450000,2026-01-16,Bank,RCT-002'} />
            </label>
            <div style={{ background: '#f1f5f9', borderRadius: 10, padding: 12, marginTop: 12, fontSize: 13, color: '#334155' }}>
              <b>Safu zinazotumika:</b>
              <p style={{ margin: '6px 0' }}>admission_no au payer_name, amount, payment_date, receipt_number, control_no, account</p>
              <p style={{ margin: 0 }}>Mfumo hutambua mwanafunzi kwa namba ya usajili au jina lake kamili. Kiasi cha Amount ni malipo yaliyofanyika; kila mstari ni muamala mmoja. Majina yanayojirudia bila namba sahihi yatarukwa ili kuzuia malipo kwenda kwa mwanafunzi asiye sahihi.</p>
            </div>
            <button type="button" style={{ ...button, width: '100%', marginTop: 14 }}
              disabled={feeImporting || !feeImportText.trim() || !structure} onClick={importFeeData}>
              {feeImporting ? 'Inaingiza taarifa...' : 'Import Ada na Malipo'}
            </button>
          </div>
        </div>
      )}

      {paymentAccount && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(15,23,42,.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          padding: 12, overflowY: 'auto'
        }}>
          <div style={{
            ...card, maxWidth: 520, width: '100%',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <h3 style={{ marginTop: 0, color: '#173b5e' }}>{editingPayment ? 'Hariri Malipo' : 'Pokea Malipo'}</h3>
            <form onSubmit={savePayment}>
              <div style={fieldGrid}>
                <label style={label}>
                  Kiasi (TSh)
                  <input
                    style={input}
                    type="number"
                    min="1"
                    max={Math.max(0, Number(paymentAccount.total_amount) -
                      payments.filter(x => x.student_fee_account_id === paymentAccount.id)
                        .reduce((s, x) => s + Number(x.amount), 0))}
                    value={payment.amount}
                    onChange={e => setPayment({ ...payment, amount: e.target.value })}
                    required
                  />
                </label>

                <label style={label}>
                  Tarehe ya Malipo
                  <input
                    style={input}
                    type="date"
                    value={payment.payment_date}
                    onChange={e => setPayment({ ...payment, payment_date: e.target.value })}
                    required
                  />
                </label>

                <label style={label}>
                  Njia ya Malipo
                  <select
                    style={input}
                    value={payment.payment_method}
                    onChange={e => setPayment({ ...payment, payment_method: e.target.value })}
                  >
                    <option value="Cash">Taslimu</option>
                    <option value="Bank">Benki</option>
                    <option value="Mobile Money">Mobile Money</option>
                    <option value="Cheque">Hundi</option>
                  </select>
                </label>

                <label style={label}>
                  Namba ya Muamala / Hundi
                  <input
                    style={input}
                    value={payment.reference_number}
                    onChange={e => setPayment({ ...payment, reference_number: e.target.value })}
                    placeholder="Si lazima"
                  />
                </label>

                <label style={{ ...label, gridColumn: '1 / -1' }}>
                  Maelezo
                  <textarea
                    style={{ ...input, minHeight: 75 }}
                    value={payment.notes}
                    onChange={e => setPayment({ ...payment, notes: e.target.value })}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button type="submit" style={button} disabled={saving}>
                  {saving ? 'Inahifadhi...' : editingPayment ? 'Hifadhi Mabadiliko' : 'Hifadhi Malipo'}
                </button>
                <button
                  type="button"
                  style={{ ...button, background: '#64748b' }}
                  onClick={() => setPaymentAccount(null)}
                >
                  Funga
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingFeeAccount && (
        <div style={{ position:'fixed', inset:0, zIndex:1100, background:'rgba(15,23,42,.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:12, overflowY:'auto' }}>
          <form onSubmit={saveFeeAccount} style={{ ...card, maxWidth:520, width:'100%' }}>
            <h3>Hariri Ada ya Mwanafunzi</h3>
            {(['school_fee','accommodation_fee','transport_fee','other_charges_total'] as const).map((key) => (
              <label key={key} style={{ ...label, marginBottom:12 }}>{({school_fee:'Ada ya Shule',accommodation_fee:'Malazi',transport_fee:'Usafiri',other_charges_total:'Ada/Nyinginezo'} as any)[key]} (TSh)
                <input style={input} type="number" min="0" value={feeEdit[key]} onChange={e=>setFeeEdit({...feeEdit,[key]:e.target.value})}/>
              </label>
            ))}
            <p>Jumla mpya: <b>TSh {money(Object.values(feeEdit).reduce((s,v)=>s+Number(v||0),0))}</b></p>
            <div style={{display:'flex',gap:8}}><button style={button} type="submit">Hifadhi Mabadiliko</button><button type="button" style={{...button,background:'#64748b'}} onClick={()=>setEditingFeeAccount(null)}>Funga</button></div>
          </form>
        </div>
      )}

      {showAudit && (
        <div style={{ position:'fixed', inset:0, zIndex:1200, background:'rgba(15,23,42,.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:12, overflowY:'auto' }}>
          <div style={{...card,maxWidth:850,width:'100%',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h3>Historia ya Mabadiliko ya Ada na Malipo</h3><button style={smallButton} onClick={()=>setShowAudit(false)}>Funga</button></div>
            <div style={{overflowX:'auto'}}><table style={{...tableStyle,minWidth:700}}><thead><tr>{['Tarehe','Aliyebadilisha (ID)','Aina','Kitendo','Taarifa za Awali','Taarifa Mpya','Sababu'].map(x=><th style={cell} key={x}>{x}</th>)}</tr></thead>
              <tbody>{auditRows.map(a=><tr key={a.id}><td style={cell}>{new Date(a.changed_at).toLocaleString('sw-TZ')}</td><td style={cell}>{a.changed_by || '—'}</td><td style={cell}>{a.entity_type==='payment'?'Malipo':'Ada'}</td><td style={cell}>{a.action==='DELETE'?'Imefutwa':'Imehaririwa'}</td><td style={{...cell,whiteSpace:'normal'}}>{a.old_data?.amount ? 'TSh '+money(a.old_data.amount) : a.old_data?.total_amount ? 'TSh '+money(a.old_data.total_amount) : '—'}</td><td style={{...cell,whiteSpace:'normal'}}>{a.new_data?.amount ? 'TSh '+money(a.new_data.amount) : a.new_data?.total_amount ? 'TSh '+money(a.new_data.total_amount) : '—'}</td><td style={{...cell,whiteSpace:'normal'}}>{a.reason || 'Mabadiliko kupitia mfumo'}</td></tr>)}
              {!auditRows.length && <tr><td style={cell} colSpan={7}>Hakuna mabadiliko yaliyorekodiwa.</td></tr>}</tbody></table></div>
          </div>
        </div>
      )}

      {historyAccount && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(15,23,42,.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          padding: 12, overflowY: 'auto'
        }}>
          <div style={{
            ...card, maxWidth: 750, width: '100%',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', gap: 10
            }}>
              <h3 style={{ margin: 0, color: '#173b5e' }}>Historia ya Malipo</h3>
              <button
                style={{ ...smallButton, background: '#64748b' }}
                onClick={() => setHistoryAccount(null)}
              >
                Funga
              </button>
            </div>

            <p>
              <b>Mwanafunzi:</b>{' '}
              {historyStudent
                ? `${historyStudent.first_name} ${historyStudent.middle_name || ''} ${historyStudent.last_name}`
                : '—'}
            </p>
            <p><b>Jumla ya Ada:</b> TSh {money(historyAccount.total_amount)}</p>
            <p><b>Amelipa:</b> TSh {money(historyPaid)}</p>
            <p>
              <b>Deni:</b>{' '}
              TSh {money(Math.max(0, Number(historyAccount.total_amount) - historyPaid))}
            </p>

            <div className="table-scroll" style={{ overflowX: 'auto' }}>
              <table style={{ ...tableStyle, minWidth: 650 }}>
                <thead>
                  <tr>
                    {['Tarehe', 'Namba ya Risiti', 'Njia', 'Kiasi', 'Muamala', 'Risiti'].map(x => (
                      <th key={x} style={{ ...cell, background: '#f1f5f9' }}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historyPayments.map(p => (
                    <tr key={p.id}>
                      <td style={cell}>{p.payment_date}</td>
                      <td style={cell}>{p.receipt_number}</td>
                      <td style={cell}>{p.payment_method}</td>
                      <td style={cell}>TSh {money(p.amount)}</td>
                      <td style={cell}>{p.reference_number || '—'}</td>
                      <td style={cell}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <button style={{ ...smallButton, padding: '7px 9px' }} onClick={() => printReceipt(p, historyAccount, '80mm')}>80mm</button>
                          <button style={{ ...smallButton, padding: '7px 9px', background: '#2563eb' }} onClick={() => printReceipt(p, historyAccount, 'A4')}>A4</button>
                          {isAccountant && <button style={{ ...smallButton, padding: '7px 9px', background: '#0f766e' }} onClick={() => editPayment(p, historyAccount)}>Hariri</button>}
                          {isAccountant && <button style={{ ...smallButton, padding: '7px 9px', background: '#b91c1c' }} onClick={() => deletePayment(p)}>Futa</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!historyPayments.length && (
                    <tr>
                      <td style={cell} colSpan={6}>Hakuna malipo yaliyorekodiwa.</td>
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
