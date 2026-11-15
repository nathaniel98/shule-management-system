
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
  id: string; student_id: string; class_id: string; academic_year_id: string;
  accommodation_type: string; status: string;
};
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
      return;
    }

    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from('student_enrollments')
      .select('*')
      .in('id', enrollmentIds);

    if (enrollmentError) throw enrollmentError;
    const enrollmentRows = (enrollmentData || []) as Enrollment[];
    setEnrollments(enrollmentRows);

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
        setSchools(list);

        if (list.length) {
          setSchoolId(list[0].id);
          await loadSchoolData(list[0].id);
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
      const payload = {
        school_id: schoolId,
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
      setError('Hifadhi ada za darasa kwanza.');
      return;
    }

    if (!window.confirm(
      'Tengeneza akaunti za ada kwa wanafunzi hai wa darasa hili? Akaunti zilizopo hazitabadilishwa.'
    )) return;

    setGenerating(true);
    setError('');
    setMessage('');

    try {
      const { data, error } = await supabase
        .from('student_enrollments')
        .select('*')
        .eq('class_id', classId)
        .eq('academic_year_id', yearId)
        .eq('status', 'Active');

      if (error) throw error;

      const active = (data || []) as Enrollment[];

      if (!active.length) {
        setMessage('Hakuna wanafunzi hai katika darasa hili kwa mwaka huu.');
        return;
      }

      const { data: existing, error: existingError } = await supabase
        .from('student_fee_accounts')
        .select('enrollment_id')
        .eq('fee_structure_id', structure.id);

      if (existingError) throw existingError;

      const existingIds = new Set((existing || []).map(x => x.enrollment_id));

      const newRows = active.filter(x => !existingIds.has(x.id)).map(x => {
        const type = String(x.accommodation_type || '').toLowerCase();
        const boarding = type === 'boarding';
        const day = type === 'day';

        const other = selectedCharges
          .filter(c => c.is_mandatory)
          .filter(c =>
            c.applies_to === 'All' ||
            (c.applies_to === 'Boarding' && boarding) ||
            (c.applies_to === 'Day' && day)
          )
          .reduce((sum, c) => sum + Number(c.amount), 0);

        const schoolFee = Number(structure.school_fee || 0);
        const accommodationFee = boarding ? Number(structure.accommodation_fee || 0) : 0;
        const transportFee = day ? Number(structure.transport_fee || 0) : 0;

        return {
          enrollment_id: x.id,
          fee_structure_id: structure.id,
          school_fee: schoolFee,
          accommodation_fee: accommodationFee,
          transport_fee: transportFee,
          other_charges_total: other,
          total_amount: schoolFee + accommodationFee + transportFee + other
        };
      });

      if (newRows.length) {
        const { error: insertError } = await supabase
          .from('student_fee_accounts')
          .insert(newRows);

        if (insertError) throw insertError;
      }

      setMessage(newRows.length
        ? `Akaunti ${newRows.length} zimetengenezwa.`
        : 'Akaunti za wanafunzi hawa tayari zipo.');

      await refresh();
      setTab('accounts');
    } catch (e) {
      reportError(e);
    } finally {
      setGenerating(false);
    }
  }

  function openPayment(account: Account) {
    setPaymentAccount(account);
    setPayment({
      amount: '', payment_date: today(), payment_method: 'Cash',
      reference_number: '', notes: ''
    });
  }

  async function savePayment(e: FormEvent) {
    e.preventDefault();
    if (!paymentAccount) return;

    const paid = payments
      .filter(x => x.student_fee_account_id === paymentAccount.id)
      .reduce((sum, x) => sum + Number(x.amount), 0);

    const balance = Number(paymentAccount.total_amount) - paid;
    const amount = Number(payment.amount);

    if (!amount || amount <= 0 || amount > balance) {
      setError(`Weka kiasi sahihi. Deni lililobaki ni TSh ${money(balance)}.`);
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const receipt = `RCP-${Date.now()}`;

      const { error } = await supabase.from('fee_payments').insert({
        student_fee_account_id: paymentAccount.id,
        receipt_number: receipt,
        amount,
        payment_date: payment.payment_date,
        payment_method: payment.payment_method,
        reference_number: payment.reference_number.trim() || null,
        notes: payment.notes.trim() || null
      });

      if (error) throw error;

      setPaymentAccount(null);
      setMessage(`Malipo yamehifadhiwa. Risiti: ${receipt}`);
      await refresh();
    } catch (e) {
      reportError(e);
    } finally {
      setSaving(false);
    }
  }

  function printReceipt(p: Payment, account: Account) {
    const enrollment = enrollmentMap.get(account.enrollment_id);
    const student = enrollment ? studentMap.get(enrollment.student_id) : undefined;
    const name = [
      student?.first_name, student?.middle_name, student?.last_name
    ].filter(Boolean).join(' ');

    const school = schools.find(x => x.id === schoolId);
    const year = years.find(x => x.id === yearId);
    const win = window.open('', '_blank');

    if (!win) {
      setError('Ruhusu popup kwenye browser ili kuchapisha risiti.');
      return;
    }

    const safe = (value: string) => value.replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#39;'
    })[c] || c);

    win.document.write(`
      <!doctype html><html><head><meta charset="utf-8">
      <title>Risiti ${safe(p.receipt_number)}</title>
      <style>
      body{font-family:Arial;padding:25px;color:#173b5e}
      .paper{max-width:650px;margin:auto;border:1px solid #ccc;padding:25px}
      h2,p{text-align:center}
      .row{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #ddd}
      .amount{text-align:center;font-size:25px;font-weight:bold;margin:25px}
      @media print{button{display:none}}
      </style></head><body><div class="paper">
      <h2>${safe(school?.school_name || 'SHULE')}</h2>
      <p>RISITI YA MALIPO YA ADA</p>
      <div class="row"><b>Namba ya risiti</b><span>${safe(p.receipt_number)}</span></div>
      <div class="row"><b>Mwanafunzi</b><span>${safe(name || 'Mwanafunzi')}</span></div>
      <div class="row"><b>Namba ya usajili</b><span>${safe(student?.admission_no || '—')}</span></div>
      <div class="row"><b>Mwaka wa masomo</b><span>${safe(year?.year_name || '—')}</span></div>
      <div class="row"><b>Tarehe</b><span>${safe(p.payment_date)}</span></div>
      <div class="row"><b>Njia ya malipo</b><span>${safe(p.payment_method)}</span></div>
      <div class="amount">TSh ${money(p.amount)}</div>
      <div class="row"><b>Maelezo</b><span>${safe(p.notes || 'Malipo ya ada')}</span></div>
      <p>Asante kwa kufanya malipo.</p>
      <button onclick="window.print()">Chapisha Risiti</button>
      </div></body></html>
    `);

    win.document.close();
    win.focus();
    win.print();
  }

  const historyPayments = historyAccount
    ? payments.filter(x => x.student_fee_account_id === historyAccount.id)
    : [];

  const historyPaid = historyPayments.reduce(
    (sum, x) => sum + Number(x.amount), 0
  );

  const historyEnrollment = historyAccount
    ? enrollmentMap.get(historyAccount.enrollment_id)
    : undefined;

  const historyStudent = historyEnrollment
    ? studentMap.get(historyEnrollment.student_id)
    : undefined;

  return (
    <div className="fees-module" style={{
      display: 'grid', gap: 18, width: '100%',
      maxWidth: '100%', minWidth: 0, overflowX: 'hidden',
      color: '#243447'
    }}>
      <style>{`
        .fees-module, .fees-module * { box-sizing: border-box; }
        .fees-module input, .fees-module select, .fees-module textarea {
          width:100%; max-width:100%; min-width:0;
        }
        .fees-module .fees-grid {
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:14px;
          width:100%;
          min-width:0;
        }
        .fees-module .table-scroll {
          width:100%; max-width:100%; overflow-x:auto;
          -webkit-overflow-scrolling:touch;
        }
        .fees-module .table-scroll table { min-width:650px; }
        @media(max-width:700px) {
          .fees-module .fees-grid {
            grid-template-columns:minmax(0,1fr) !important;
          }
          .fees-module .fees-grid > * { min-width:0; width:100%; }
          .fees-module section { padding:14px !important; }
          .fees-module h2,.fees-module h3 { overflow-wrap:anywhere; }
        }
      `}</style>

      <header style={{
        background: '#173b5e', color: '#fff',
        padding: 22, borderRadius: 16
      }}>
        <h2 style={{ margin: '0 0 8px' }}>Ada na Malipo</h2>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          Usimamizi wa ada za mwaka mzima, malipo ya awamu na madeni ya wanafunzi.
        </p>
      </header>

      {error && (
        <div role="alert" style={{
          background: '#fff1f0', color: '#b42318',
          padding: 13, borderRadius: 9, overflowWrap: 'anywhere'
        }}>{error}</div>
      )}

      {message && (
        <div role="status" style={{
          background: '#ecfdf3', color: '#16845b',
          padding: 13, borderRadius: 9, overflowWrap: 'anywhere'
        }}>{message}</div>
      )}

      <section style={card}>
        <div className="fees-grid">
          <label style={label}>
            Shule
            <select style={input} value={schoolId}
              onChange={e => changeSchool(e.target.value)}>
              <option value="">Chagua shule</option>
              {schools.map(x => <option key={x.id} value={x.id}>{x.school_name}</option>)}
            </select>
          </label>

          <label style={label}>
            Mwaka wa masomo
            <select style={input} value={yearId}
              onChange={e => changeYear(e.target.value)}>
              <option value="">Chagua mwaka</option>
              {years.map(x => (
                <option key={x.id} value={x.id}>
                  {x.year_name}{x.is_current ? ' (Wa sasa)' : ''}
                </option>
              ))}
            </select>
          </label>

          <label style={label}>
            Darasa
            <select style={input} value={classId}
              onChange={e => changeClass(e.target.value)}>
              <option value="">Chagua darasa</option>
              {classes.map(x => <option key={x.id} value={x.id}>{x.class_name}</option>)}
            </select>
          </label>

          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button type="button" style={{ ...button, width: '100%' }}
              onClick={refresh} disabled={loading || !schoolId}>
              {loading ? 'Inapakia...' : 'Onyesha upya'}
            </button>
          </div>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
        <button type="button" style={{
          ...button, background: tab === 'setup' ? '#173b5e' : '#eaf1f7',
          color: tab === 'setup' ? '#fff' : '#173b5e'
        }} onClick={() => setTab('setup')}>Mpangilio wa Ada</button>

        <button type="button" style={{
          ...button, background: tab === 'accounts' ? '#173b5e' : '#eaf1f7',
          color: tab === 'accounts' ? '#fff' : '#173b5e'
        }} onClick={() => setTab('accounts')}>Akaunti na Malipo</button>
      </div>

      {tab === 'setup' && (
        <>
          <section style={card}>
            <h3 style={{ marginTop: 0 }}>Ada za Mwaka kwa Darasa</h3>
            <p style={{ color: '#64748b', lineHeight: 1.5 }}>
              Ada hizi zitatumika kwa wanafunzi wa darasa hili katika mwaka uliochaguliwa.
            </p>

            {!yearId || !classId ? (
              <p>Chagua mwaka wa masomo na darasa kwanza.</p>
            ) : (
              <form onSubmit={saveFee} className="fees-grid">
                <label style={label}>
                  Ada ya shule (TSh)
                  <input style={input} type="number" min="0"
                    value={fee.school_fee}
                    onChange={e => setFee({ ...fee, school_fee: e.target.value })} />
                </label>

                <label style={label}>
                  Malazi (Boarding) (TSh)
                  <input style={input} type="number" min="0"
                    value={fee.accommodation_fee}
                    onChange={e => setFee({ ...fee, accommodation_fee: e.target.value })} />
                </label>

                <label style={label}>
                  Usafiri (Day) (TSh)
                  <input style={input} type="number" min="0"
                    value={fee.transport_fee}
                    onChange={e => setFee({ ...fee, transport_fee: e.target.value })} />
                </label>

                <div style={{ display: 'flex', alignItems: 'end' }}>
                  <button type="submit" style={{ ...button, width: '100%' }} disabled={saving}>
                    {saving ? 'Inahifadhi...' : 'Hifadhi Ada'}
                  </button>
                </div>
              </form>
            )}

            {structure && (
              <p style={{
                background: '#eff6ff', color: '#173b5e',
                padding: 12, borderRadius: 9, lineHeight: 1.5
              }}>
                Muundo wa ada upo. Mabadiliko ya viwango hayabadilishi akaunti zilizokwisha tengenezwa.
              </p>
            )}
          </section>

          <section style={card}>
            <h3 style={{ marginTop: 0 }}>Gharama Nyingine (Other Charges)</h3>
            <p style={{ color: '#64748b', lineHeight: 1.5 }}>
              Ongeza gharama kama huduma ya kwanza, sare, mahafali, safari na mitihani.
            </p>

            <form onSubmit={saveCharge} className="fees-grid">
              <label style={label}>
                Jina la gharama
                <input style={input} value={charge.charge_name}
                  placeholder="Mfano: Sare"
                  onChange={e => setCharge({ ...charge, charge_name: e.target.value })} />
              </label>

              <label style={label}>
                Kiasi (TSh)
                <input style={input} type="number" min="1"
                  value={charge.amount}
                  onChange={e => setCharge({ ...charge, amount: e.target.value })} />
              </label>

              <label style={label}>
                Inawahusu
                <select style={input} value={charge.applies_to}
                  onChange={e => setCharge({
                    ...charge,
                    applies_to: e.target.value as 'All' | 'Day' | 'Boarding'
                  })}>
                  <option value="All">Wanafunzi wote</option>
                  <option value="Day">Day</option>
                  <option value="Boarding">Boarding</option>
                </select>
              </label>

              <label style={{
                ...label, display: 'flex', flexDirection: 'row',
                alignItems: 'center', gap: 9
              }}>
                <input type="checkbox" style={{ width: 19, height: 19 }}
                  checked={charge.is_mandatory}
                  onChange={e => setCharge({
                    ...charge, is_mandatory: e.target.checked
                  })} />
                Lazima ilipwe
              </label>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="submit" style={button} disabled={saving || !structure}>
                  {saving ? 'Inahifadhi...' : editingCharge ? 'Hifadhi Mabadiliko' : 'Ongeza Gharama'}
                </button>
                {editingCharge && (
                  <button type="button" style={{
                    ...button, background: '#64748b'
                  }} onClick={resetCharge}>Ghairi</button>
                )}
              </div>
            </form>

            <div className="table-scroll" style={{ marginTop: 20 }}>
              <table style={{ width: '100%', minWidth: 650, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Gharama', 'Kiasi', 'Inawahusu', 'Hali', 'Vitendo'].map(x =>
                      <th key={x} style={cell}>{x}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {selectedCharges.map(x => (
                    <tr key={x.id}>
                      <td style={cell}>{x.charge_name}</td>
                      <td style={cell}>TSh {money(x.amount)}</td>
                      <td style={cell}>{x.applies_to === 'All' ? 'Wote' : x.applies_to}</td>
                      <td style={cell}>{x.is_mandatory ? 'Lazima' : 'Hiari'}</td>
                      <td style={cell}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button type="button" style={button} onClick={() => editCharge(x)}>Hariri</button>
                          <button type="button" style={{
                            ...button, background: '#b42318'
                          }} onClick={() => deleteCharge(x)}>Futa</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!selectedCharges.length && (
                    <tr><td colSpan={5} style={cell}>Hakuna gharama nyingine zilizoongezwa.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section style={card}>
            <h3 style={{ marginTop: 0 }}>Tengeneza Akaunti za Wanafunzi</h3>
            <p style={{ color: '#64748b', lineHeight: 1.5 }}>
              Boarding atalipishwa malazi na Day atalipishwa usafiri. Gharama nyingine za lazima zitaongezwa kulingana na kundi husika.
            </p>
            <button type="button" style={button}
              onClick={generateAccounts}
              disabled={generating || !structure}>
              {generating ? 'Inatengeneza akaunti...' : 'Tengeneza Akaunti za Darasa'}
            </button>
          </section>
        </>
      )}

      {tab === 'accounts' && (
        <>
          <div className="fees-grid">
            {[
              { title: 'Jumla ya Ada', value: totals.total, color: '#173b5e' },
              { title: 'Jumla Iliyolipwa', value: totals.paid, color: '#16845b' },
              { title: 'Jumla ya Madeni', value: totals.debt, color: '#b42318' }
            ].map(x => (
              <section key={x.title} style={card}>
                <div style={{ color: '#64748b', fontSize: 13 }}>{x.title}</div>
                <strong style={{
                  display: 'block', color: x.color,
                  fontSize: 20, marginTop: 8
                }}>TSh {money(x.value)}</strong>
              </section>
            ))}
          </div>

          <section style={card}>
            <h3 style={{ marginTop: 0 }}>Akaunti za Wanafunzi</h3>
            <input style={input}
              placeholder="Tafuta kwa jina au namba ya usajili..."
              value={search} onChange={e => setSearch(e.target.value)} />

            <div className="table-scroll" style={{ marginTop: 15 }}>
              <table style={{ width: '100%', minWidth: 850, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Namba ya Usajili', 'Mwanafunzi', 'Aina', 'Ada Jumla', 'Amelipa', 'Deni', 'Vitendo'].map(x =>
                      <th key={x} style={cell}>{x}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(x => (
                    <tr key={x.account.id}>
                      <td style={cell}>{x.student?.admission_no || '—'}</td>
                      <td style={cell}>
                        {[x.student?.first_name, x.student?.middle_name, x.student?.last_name].filter(Boolean).join(' ') || 'Mwanafunzi'}
                      </td>
                      <td style={cell}>{x.enrollment?.accommodation_type || '—'}</td>
                      <td style={cell}>{money(x.account.total_amount)}</td>
                      <td style={{ ...cell, color: '#16845b' }}>{money(x.paid)}</td>
                      <td style={{
                        ...cell, color: x.balance > 0 ? '#b42318' : '#16845b'
                      }}>{money(x.balance)}</td>
                      <td style={cell}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button type="button" style={button}
                            disabled={x.balance <= 0}
                            onClick={() => openPayment(x.account)}>Lipa</button>
                          <button type="button" style={{
                            ...button, background: '#64748b'
                          }} onClick={() => setHistoryAccount(x.account)}>Historia</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filteredRows.length && (
                    <tr><td colSpan={7} style={cell}>
                      Hakuna akaunti zilizopatikana. Tengeneza akaunti za darasa kwanza.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {paymentAccount && (
        <div role="dialog" aria-modal="true" style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(15,23,42,.65)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 12
        }} onClick={() => setPaymentAccount(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 15, padding: 20,
            width: '100%', maxWidth: 500, maxHeight: '90vh',
            overflowY: 'auto', boxSizing: 'border-box'
          }}>
            <h3 style={{ marginTop: 0 }}>Rekodi Malipo</h3>
            <form onSubmit={savePayment} style={{ display: 'grid', gap: 13 }}>
              <label style={label}>Kiasi cha malipo (TSh)
                <input style={input} type="number" min="1" required
                  value={payment.amount}
                  onChange={e => setPayment({ ...payment, amount: e.target.value })} />
              </label>

              <label style={label}>Tarehe ya malipo
                <input style={input} type="date" required
                  value={payment.payment_date}
                  onChange={e => setPayment({ ...payment, payment_date: e.target.value })} />
              </label>

              <label style={label}>Njia ya malipo
                <select style={input} value={payment.payment_method}
                  onChange={e => setPayment({ ...payment, payment_method: e.target.value })}>
                  <option value="Cash">Taslimu</option>
                  <option value="Bank">Benki</option>
                  <option value="Mobile Money">Mobile Money</option>
                  <option value="Cheque">Hundi</option>
                </select>
              </label>

              <label style={label}>Namba ya kumbukumbu (si lazima)
                <input style={input} value={payment.reference_number}
                  onChange={e => setPayment({ ...payment, reference_number: e.target.value })} />
              </label>

              <label style={label}>Maelezo (si lazima)
                <textarea style={input} rows={2} value={payment.notes}
                  onChange={e => setPayment({ ...payment, notes: e.target.value })} />
              </label>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="submit" style={button} disabled={saving}>
                  {saving ? 'Inahifadhi...' : 'Hifadhi Malipo'}
                </button>
                <button type="button" style={{
                  ...button, background: '#64748b'
                }} onClick={() => setPaymentAccount(null)}>Funga</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyAccount && (
        <div role="dialog" aria-modal="true" style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(15,23,42,.65)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 12
        }} onClick={() => setHistoryAccount(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 15, padding: 18,
            width: '100%', maxWidth: 700, maxHeight: '85vh',
            overflowY: 'auto', boxSizing: 'border-box'
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              gap: 10, alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: '0 0 5px' }}>Historia ya Malipo</h3>
                <span style={{ color: '#64748b', fontSize: 13 }}>
                  {[historyStudent?.first_name, historyStudent?.middle_name, historyStudent?.last_name].filter(Boolean).join(' ')}
                </span>
              </div>
              <button type="button" style={{
                ...button, background: '#64748b'
              }} onClick={() => setHistoryAccount(null)}>Funga</button>
            </div>

            <div className="fees-grid" style={{ margin: '18px 0' }}>
              <div style={{ background: '#eff6ff', padding: 12, borderRadius: 9 }}>
                <small>Jumla ya Ada</small>
                <strong style={{ display: 'block' }}>{money(historyAccount.total_amount)}</strong>
              </div>
              <div style={{ background: '#ecfdf3', padding: 12, borderRadius: 9 }}>
                <small>Amelipa</small>
                <strong style={{ display: 'block', color: '#16845b' }}>{money(historyPaid)}</strong>
              </div>
              <div style={{ background: '#fff1f0', padding: 12, borderRadius: 9 }}>
                <small>Deni</small>
                <strong style={{ display: 'block', color: '#b42318' }}>
                  {money(Math.max(0, Number(historyAccount.total_amount) - historyPaid))}
                </strong>
              </div>
            </div>

            <div className="table-scroll">
              <table style={{ width: '100%', minWidth: 550, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Risiti', 'Tarehe', 'Njia', 'Kiasi', 'Vitendo'].map(x =>
                      <th key={x} style={cell}>{x}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {historyPayments.map(p => (
                    <tr key={p.id}>
                      <td style={cell}>{p.receipt_number}</td>
                      <td style={cell}>{p.payment_date}</td>
                      <td style={cell}>{p.payment_method}</td>
                      <td style={cell}>{money(p.amount)}</td>
                      <td style={cell}>
                        <button type="button" style={button}
                          onClick={() => printReceipt(p, historyAccount)}>
                          Risiti
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!historyPayments.length && (
                    <tr><td colSpan={5} style={cell}>Hakuna malipo yaliyorekodiwa.</td></tr>
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
