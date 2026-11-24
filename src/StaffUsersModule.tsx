import { useEffect, useState, type FormEvent, type CSSProperties } from 'react';
import { supabase } from './supabase';

type StaffRole = 'class_teacher' | 'head_teacher' | 'accountant' | 'teacher';
type SchoolClass = { id: string; class_name: string };
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
        const { data, error } = await supabase!.rpc('get_my_school');
        if (error) throw error;
        const school = Array.isArray(data) ? data[0] : data;
        const id = school?.id || school?.school_id;
        if (!id) throw new Error('Akaunti hii haijaunganishwa na shule.');
        const [classResult, staffResult] = await Promise.all([
          supabase!.from('classes').select('id, class_name').eq('school_id', id).order('class_name'),
          supabase!.from('school_staff_accounts').select('id, display_name, email, role, class_id, is_active, created_at').eq('school_id', id).order('created_at', { ascending: false }),
        ]);
        if (classResult.error) throw classResult.error;
        if (staffResult.error) throw staffResult.error;
        if (!active) return;
        setSchoolId(id);
        setClasses((classResult.data || []) as SchoolClass[]);
        setAccounts((staffResult.data || []) as StaffAccount[]);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Imeshindikana kupakia watumiaji.');
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!schoolId) return;
    setSaving(true); setError(''); setMessage('');
    const { data, error } = await supabase!.functions.invoke('create-school-staff-user', {
      body: { display_name: displayName, email, password, role, class_id: role === 'class_teacher' ? classId : null },
    });
    if (error || data?.error) {
      setError(data?.error || error?.message || 'Imeshindikana kutengeneza akaunti.');
    } else {
      setMessage('Akaunti imetengenezwa. Mpe mtumiaji barua pepe na nenosiri uliloweka.');
      setDisplayName(''); setEmail(''); setPassword(''); setClassId('');
      try { await loadAccounts(schoolId); } catch (e) { setError(e instanceof Error ? e.message : 'Akaunti imetengenezwa lakini orodha haijapakiwa.'); }
    }
    setSaving(false);
  }

  const input: CSSProperties = { width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: 9, boxSizing: 'border-box', fontSize: 15 };
  const label: React.CSSProperties = { display: 'grid', gap: 7, fontWeight: 600, color: '#334155', fontSize: 14 };

  return <div style={{ display: 'grid', gap: 20, color: '#243447' }}>
    <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18 }}>
      <h2 style={{ marginTop: 0 }}>Usimamizi wa Watumiaji</h2>
      <p style={{ color: '#64748b' }}>School Admin anaweza kutengeneza akaunti za wafanyakazi wa shule yake na kuwapa majukumu.</p>
      {error && <div role="alert" style={{ background: '#fff1f0', color: '#b42318', padding: 12, borderRadius: 9, marginBottom: 12 }}>{error}</div>}
      {message && <div role="status" style={{ background: '#ecfdf3', color: '#16845b', padding: 12, borderRadius: 9, marginBottom: 12 }}>{message}</div>}
      <form onSubmit={createUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
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
  </div>;
}
