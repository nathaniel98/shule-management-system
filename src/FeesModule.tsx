import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from './supabase';

type School = { id: string; school_name: string };
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

export default function FeesModule() {
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
  const [tab, setTab] = useState<'setup' | 'accounts'>('setup');

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
