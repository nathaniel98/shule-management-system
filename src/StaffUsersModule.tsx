import { useEffect, useState, type FormEvent, type CSSProperties } from 'react';
import { supabase } from './supabase';

type StaffRole = 'class_teacher' | 'head_teacher' | 'accountant' | 'teacher';
type SchoolClass = { id: string; class_name: string };
type Subject = { id: string; subject_name: string };
type TeachingAssignment = { id: string; staff_account_id: string; class_id: string; subject_id: string };
type StaffAccount = { id: string; display_name: string; email: string; role: StaffRole; class_id: string | null; is_active: boolean; created_at: string };

const roleLabels: Record<StaffRole, string> = {
  class_teacher: 'Mwalimu wa darasa',
  head_teacher: 'Mwalimu Mkuu',
  accountant: 'Mhasibu',
  teacher: 'Mwalimu',
};

export default function StaffUsersModule() {
  const [schoolId, setSchoolId] = useState('');
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [assignmentStaffId, setAssignmentStaffId] = useState('');
  const [assignmentClassId, setAssignmentClassId] = useState('');
  const [assignmentSubjectIds, setAssignmentSubjectIds] = useState<string[]>([]);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [classTeacherStaffId, setClassTeacherStaffId] = useState('');
  const [classTeacherClassId, setClassTeacherClassId] = useState('');
  const [classTeacherSaving, setClassTeacherSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole>('class_teacher');
  const [classId, setClassId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadAccounts(id: string) {
    const { data, error } = await supabase!.from('school_staff_accounts')
      .select('id, display_name, email, role, class_id, is_active, created_at')
      .eq('school_id', id).order('created_at', { ascending: false });
    if (error) throw error;
    setAccounts((data || []) as StaffAccount[]);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        // School Admin accounts are stored in school_members, while staff
        // accounts are stored in school_staff_accounts. Support both identities.
        const { data: staffSchoolData, error: staffSchoolError } =
          await supabase!.rpc('get_my_school_for_staff');
        if (staffSchoolError) throw staffSchoolError;
        const staffSchool = Array.isArray(staffSchoolData)
          ? staffSchoolData[0]
          : staffSchoolData;

        let id = staffSchool?.id || staffSchool?.school_id || '';

        if (!id) {
          const { data: { user }, error: userError } = await supabase!.auth.getUser();
          if (userError) throw userError;
          if (!user) throw new Error('Tafadhali ingia tena kwenye mfumo.');

          const { data: memberships, error: membershipError } = await supabase!
            .from('school_members')
            .select('school_id')
            .eq('user_id', user.id)
            .eq('role', 'school_admin')
            .eq('is_active', true)
            .order('created_at', { ascending: true })
            .limit(1);
          if (membershipError) throw membershipError;
          id = memberships?.[0]?.school_id || '';
        }

        if (!id) throw new Error('Akaunti hii haijaunganishwa na shule kama School Admin au mtumishi.');
        const [classResult, staffResult, subjectResult, assignmentResult] = await Promise.all([
          supabase!.from('classes').select('id, class_name').eq('school_id', id).order('class_name'),
          supabase!.from('school_staff_accounts').select('id, display_name, email, role, class_id, is_active, created_at').eq('school_id', id).order('created_at', { ascending: false }),
          supabase!.from('subjects').select('id, subject_name').eq('school_id', id).order('subject_name'),
          supabase!.from('school_staff_teaching_assignments').select('id, staff_account_id, class_id, subject_id').eq('school_id', id),
        ]);
        if (classResult.error) throw classResult.error;
        if (staffResult.error) throw staffResult.error;
        if (subjectResult.error) throw subjectResult.error;
        if (assignmentResult.error) throw assignmentResult.error;
        if (!active) return;
        setSchoolId(id);
        setClasses((classResult.data || []) as SchoolClass[]);
        setAccounts((staffResult.data || []) as StaffAccount[]);
        setSubjects((subjectResult.data || []) as Subject[]);
        setAssignments((assignmentResult.data || []) as TeachingAssignment[]);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Imeshindikana kupakia watumiaji.');
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function getFunctionErrorMessage(error: unknown): Promise<string> {
    const fallback = error instanceof Error ? error.message : 'Imeshindikana kutengeneza akaunti.';
    if (!error || typeof error !== 'object' || !('context' in error)) return fallback;

    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as Record<string, unknown>;
        const message = payload.error ?? payload.message ?? payload.msg;
        if (typeof message === 'string' && message.trim()) return message;
      } catch {
        try {
          const raw = await context.clone().text();
          if (raw.trim()) return raw.slice(0, 500);
        } catch { /* Keep the original error message. */ }
      }
      return `Hitilafu ya seva (HTTP ${context.status}). ${fallback}`;
    }
    return fallback;
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!schoolId) return;
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const { data, error } = await supabase!.functions.invoke('create-school-staff-user', {
        body: { display_name: displayName, email, password, role, class_id: role === 'class_teacher' ? classId : null },
      });

      if (error) {
        setError(await getFunctionErrorMessage(error));
        return;
      }
      if (data?.error) {
        setError(String(data.error));
        return;
      }

      setMessage('Akaunti imetengenezwa. Mpe mtumiaji barua pepe na nenosiri uliloweka.');
      setDisplayName('');
      setEmail('');
      setPassword('');
      setClassId('');
      try {
        await loadAccounts(schoolId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Akaunti imetengenezwa lakini orodha haijapakiwa.');
      }
    } catch (e) {
      setError(await getFunctionErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveTeachingAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!schoolId || !assignmentStaffId || !assignmentClassId || assignmentSubjectIds.length === 0) return;
    setAssignmentSaving(true);
    setError('');
    setMessage('');
    try {
      const alreadyAssigned = new Set(
        assignments
          .filter(a => a.staff_account_id === assignmentStaffId && a.class_id === assignmentClassId)
          .map(a => a.subject_id)
      );
      const newSubjectIds = assignmentSubjectIds.filter(id => !alreadyAssigned.has(id));
      if (newSubjectIds.length > 0) {
        const rows = newSubjectIds.map(subjectId => ({
          school_id: schoolId,
          staff_account_id: assignmentStaffId,
          class_id: assignmentClassId,
          subject_id: subjectId
        }));
        const { error } = await supabase!.from('school_staff_teaching_assignments').insert(rows);
        if (error) throw error;
      }
      const { data, error: loadError } = await supabase!.from('school_staff_teaching_assignments')
        .select('id, staff_account_id, class_id, subject_id').eq('school_id', schoolId);
      if (loadError) throw loadError;
      setAssignments((data || []) as TeachingAssignment[]);
      setMessage(newSubjectIds.length
        ? `Masomo ${newSubjectIds.length} yamepangiwa mwalimu kikamilifu.`
        : 'Masomo uliyochagua tayari yamepangiwa mwalimu huyu.');
      setAssignmentClassId('');
      setAssignmentSubjectIds([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Imeshindikana kuhifadhi upangaji.');
    } finally { setAssignmentSaving(false); }
  }

  async function removeTeachingAssignment(id: string) {
    if (!window.confirm('Una uhakika unataka kuondoa upangaji huu?')) return;
    try {
      const { error } = await supabase!.from('school_staff_teaching_assignments').delete().eq('id', id);
      if (error) throw error;
      setAssignments(current => current.filter(item => item.id !== id));
      setMessage('Upangaji umeondolewa.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Imeshindikana kuondoa upangaji.');
    }
  }

  async function assignClassTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classTeacherStaffId || !classTeacherClassId) return;
    setClassTeacherSaving(true);
    setError('');
    setMessage('');
    try {
      const { error } = await supabase!.rpc('assign_school_class_teacher', {
        p_staff_account_id: classTeacherStaffId,
        p_class_id: classTeacherClassId
      });
      if (error) throw error;
      await loadAccounts(schoolId);
      setMessage('Darasa limepangiwa mwalimu kikamilifu.');
      setClassTeacherStaffId('');
      setClassTeacherClassId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Imeshindikana kumpangia mwalimu darasa.');
    } finally {
      setClassTeacherSaving(false);
    }
  }

  const input: CSSProperties = { width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: 9, boxSizing: 'border-box', fontSize: 15 };
  const label: CSSProperties = { display: 'grid', gap: 7, fontWeight: 600, color: '#334155', fontSize: 14 };

  return <div className="staff-users-module" style={{ display: 'grid', gap: 20, color: '#243447', width: '100%', minWidth: 0, maxWidth: '100%' }}>
    <section className="staff-users-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, minWidth: 0, maxWidth: '100%' }}>
      <h2 style={{ marginTop: 0 }}>Usimamizi wa Watumiaji</h2>
      <p style={{ color: '#64748b' }}>School Admin anaweza kutengeneza akaunti za wafanyakazi wa shule yake na kuwapa majukumu.</p>
      {error && <div role="alert" style={{ background: '#fff1f0', color: '#b42318', padding: 12, borderRadius: 9, marginBottom: 12 }}>{error}</div>}
      {message && <div role="status" style={{ background: '#ecfdf3', color: '#16845b', padding: 12, borderRadius: 9, marginBottom: 12 }}>{message}</div>}
      <form className="staff-users-form" onSubmit={createUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(220px,100%),1fr))', gap: 14, minWidth: 0 }}>
        <label style={label}>Jina kamili<input style={input} value={displayName} onChange={e => setDisplayName(e.target.value)} required /></label>
        <label style={label}>Barua pepe ya kuingia<input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label style={label}>Nenosiri la mwanzo (angalau herufi 8)<input style={input} type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></label>
        <label style={label}>Jukumu<select style={input} value={role} onChange={e => { setRole(e.target.value as StaffRole); setClassId(''); }}>
          <option value="class_teacher">Mwalimu wa darasa</option>
          <option value="head_teacher">Mwalimu Mkuu</option>
          <option value="accountant">Mhasibu</option>
          <option value="teacher">Mwalimu</option>
        </select></label>
        {role === 'class_teacher' && <label style={label}>Darasa analosimamia<select style={input} value={classId} onChange={e => setClassId(e.target.value)} required>
          <option value="">Chagua darasa</option>{classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
        </select></label>}
        <div style={{ display: 'flex', alignItems: 'end' }}><button type="submit" disabled={saving || loading || (role === 'class_teacher' && !classId)} style={{ width: '100%', padding: 13, border: 0, borderRadius: 9, background: '#173b5e', color: '#fff', fontWeight: 700 }}>{saving ? 'Inatengeneza...' : '＋ Tengeneza Akaunti'}</button></div>
      </form>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 0 }}>Akaunti itatumia barua pepe na nenosiri uliloweka. Mabadiliko ya majukumu na ruhusa za kila sehemu yataunganishwa kulingana na nafasi husika.</p>
    </section>
    <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18 }}>
      <h3 style={{ marginTop: 0 }}>Watumiaji wa shule hii</h3>
      {loading ? <p>Inapakia...</p> : accounts.length === 0 ? <p>Hakuna akaunti za wafanyakazi zilizotengenezwa bado.</p> : <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
          <thead><tr><th style={{ textAlign: 'left', padding: 10 }}>Jina</th><th style={{ textAlign: 'left', padding: 10 }}>Barua pepe</th><th style={{ textAlign: 'left', padding: 10 }}>Jukumu</th><th style={{ textAlign: 'left', padding: 10 }}>Darasa</th></tr></thead>
          <tbody>{accounts.map(a => <tr key={a.id} style={{ borderTop: '1px solid #e2e8f0' }}>
            <td style={{ padding: 10 }}>{a.display_name}</td><td style={{ padding: 10 }}>{a.email}</td><td style={{ padding: 10 }}>{roleLabels[a.role]}</td><td style={{ padding: 10 }}>{classes.find(c => c.id === a.class_id)?.class_name || '—'}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
    <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18 }}>
      <h3 style={{ marginTop: 0 }}>Kupanga mwalimu wa darasa</h3>
      <p style={{ color: '#64748b' }}>Chagua mwalimu mwenye jukumu la Mwalimu wa darasa na umpatie darasa analolisimamia. Unaweza kubadilisha darasa lake wakati wowote.</p>
      <form className="staff-users-form" onSubmit={assignClassTeacher} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(200px,100%),1fr))', gap: 12, minWidth: 0 }}>
        <label style={label}>Mwalimu wa darasa<select style={input} value={classTeacherStaffId} onChange={e => setClassTeacherStaffId(e.target.value)} required>
          <option value="">Chagua mwalimu</option>{accounts.filter(a => a.role === 'class_teacher' && a.is_active).map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
        </select></label>
        <label style={label}>Darasa<select style={input} value={classTeacherClassId} onChange={e => setClassTeacherClassId(e.target.value)} required>
          <option value="">Chagua darasa</option>{classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
        </select></label>
        <div style={{ display: 'flex', alignItems: 'end' }}><button type="submit" disabled={classTeacherSaving || !classTeacherStaffId || !classTeacherClassId} style={{ width: '100%', padding: 13, border: 0, borderRadius: 9, background: '#173b5e', color: '#fff', fontWeight: 700 }}>{classTeacherSaving ? 'Inahifadhi...' : '＋ Panga darasa'}</button></div>
      </form>
      {accounts.filter(a => a.role === 'class_teacher' && a.is_active).length === 0
        ? <p>Hakuna akaunti hai za walimu wa darasa. Tengeneza akaunti yenye jukumu la Mwalimu wa darasa kwanza.</p>
        : <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
            <thead><tr><th style={{ textAlign: 'left', padding: 10 }}>Mwalimu</th><th style={{ textAlign: 'left', padding: 10 }}>Darasa analosimamia</th></tr></thead>
            <tbody>{accounts.filter(a => a.role === 'class_teacher' && a.is_active).map(a => <tr key={a.id} style={{ borderTop: '1px solid #e2e8f0' }}>
              <td style={{ padding: 10 }}>{a.display_name}</td>
              <td style={{ padding: 10 }}>{classes.find(c => c.id === a.class_id)?.class_name || 'Hajapangiwa'}</td>
            </tr>)}</tbody>
          </table>
        </div>}
    </section>
    <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18 }}>
      <h3 style={{ marginTop: 0 }}>Kupanga walimu kwenye madarasa na masomo</h3>
      <p style={{ color: '#64748b' }}>Chagua mwalimu, darasa na somo. Mwalimu ataona taarifa za madarasa na masomo aliyopangiwa tu.</p>
      <form className="staff-users-form" onSubmit={saveTeachingAssignment} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(180px,100%),1fr))', gap: 12, minWidth: 0 }}>
        <label style={label}>Mwalimu<select style={input} value={assignmentStaffId} onChange={e => setAssignmentStaffId(e.target.value)} required>
          <option value="">Chagua mwalimu</option>{accounts.filter(a => a.role === 'teacher' && a.is_active).map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
        </select></label>
        <label style={label}>Darasa<select style={input} value={assignmentClassId} onChange={e => setAssignmentClassId(e.target.value)} required>
          <option value="">Chagua darasa</option>{classes.map(item => <option key={item.id} value={item.id}>{item.class_name}</option>)}
        </select></label>
        <fieldset className="staff-subject-picker" style={{ border: '1px solid #cbd5e1', borderRadius: 9, padding: 12, minWidth: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, color: '#334155', fontSize: 14, padding: '0 5px' }}>Masomo (chagua moja au zaidi)</legend>
          {subjects.length === 0 ? <p style={{ margin: 0, color: '#64748b' }}>Hakuna masomo yaliyosajiliwa kwenye shule hii.</p> :
            <div className="staff-subject-options">
              {subjects.map(item => <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 4px', fontWeight: 500, minWidth: 0 }}>
                <input type="checkbox" checked={assignmentSubjectIds.includes(item.id)} onChange={e => setAssignmentSubjectIds(current => e.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} style={{ width: 18, height: 18, flex: '0 0 auto' }} />
                <span>{item.subject_name}</span>
              </label>)}
            </div>}
          <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 12 }}>Yamechaguliwa: {assignmentSubjectIds.length}</p>
        </fieldset>
        <div style={{ display: 'flex', alignItems: 'end' }}><button type="submit" disabled={assignmentSaving || !assignmentStaffId || !assignmentClassId || assignmentSubjectIds.length === 0} style={{ width: '100%', padding: 13, border: 0, borderRadius: 9, background: '#173b5e', color: '#fff', fontWeight: 700 }}>{assignmentSaving ? 'Inahifadhi...' : '＋ Panga masomo yaliyochaguliwa'}</button></div>
      </form>
      {assignments.length === 0 ? <p>Hakuna walimu waliopangiwa masomo bado.</p> : <div style={{ overflowX: 'auto', marginTop: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
          <thead><tr><th style={{ textAlign: 'left', padding: 10 }}>Mwalimu</th><th style={{ textAlign: 'left', padding: 10 }}>Darasa</th><th style={{ textAlign: 'left', padding: 10 }}>Somo</th><th style={{ textAlign: 'left', padding: 10 }}>Kitendo</th></tr></thead>
          <tbody>{assignments.map(a => <tr key={a.id} style={{ borderTop: '1px solid #e2e8f0' }}>
            <td style={{ padding: 10 }}>{accounts.find(x => x.id === a.staff_account_id)?.display_name || '—'}</td>
            <td style={{ padding: 10 }}>{classes.find(x => x.id === a.class_id)?.class_name || '—'}</td>
            <td style={{ padding: 10 }}>{subjects.find(x => x.id === a.subject_id)?.subject_name || '—'}</td>
            <td style={{ padding: 10 }}><button type="button" onClick={() => removeTeachingAssignment(a.id)} style={{ border: 0, borderRadius: 8, padding: '8px 10px', background: '#fff1f0', color: '#b42318', fontWeight: 700 }}>Ondoa</button></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  </div>;
}
