import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from './supabase';

type School = {
  id: string;
  school_name: string;
  school_code: string;
  school_type: string;
  education_system: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at?: string;
};

type SchoolForm = {
  school_name: string;
  school_code: string;
  school_type: string;
  education_system: string;
  email: string;
  phone: string;
  address: string;
};

const emptyForm: SchoolForm = {
  school_name: '',
  school_code: '',
  school_type: 'Private',
  education_system: 'Zanzibar',
  email: '',
  phone: '',
  address: '',
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: '11px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  fontSize: 15,
  background: '#fff',
  color: '#172b3d',
};

const labelStyle = {
  display: 'grid',
  gap: 7,
  fontWeight: 600 as const,
  color: '#334155',
  fontSize: 14,
};

export function SchoolModule() {
  const [schools, setSchools] = useState<School[]>([]);
  const [form, setForm] = useState<SchoolForm>({ ...emptyForm });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadSchools() {
    if (!supabase) {
      setError('Supabase haijaunganishwa. Hakikisha VITE_SUPABASE_URL na VITE_SUPABASE_ANON_KEY zimewekwa kwenye Vercel.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase
      .from('schools')
      .select('*')
      .order('created_at', { ascending: false });

    if (loadError) {
      setError(loadError.code === '42501'
        ? 'Huna ruhusa ya kuona taarifa za shule. Kagua sera ya SELECT ya RLS.'
        : `Imeshindikana kupakia shule: ${loadError.message}`);
    } else {
      setSchools((data ?? []) as School[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadSchools();
  }, []);

  async function registerSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError('Supabase haijaunganishwa.');
      return;
    }
    if (!form.school_name.trim() || !form.school_code.trim()) {
      setError('Jina la shule na namba ya usajili vinahitajika.');
      return;
    }
    if (!form.education_system) {
      setError('Chagua mfumo wa elimu wa shule.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const { error: insertError } = await supabase.from('schools').insert({
      school_name: form.school_name.trim(),
      school_code: form.school_code.trim().toUpperCase(),
      school_type: form.school_type,
      education_system: form.education_system,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
    });

    if (insertError) {
      if (insertError.code === '42501') {
        setError('Usajili umezuiwa na ruhusa za RLS. Hakikisha umeingia kwa akaunti yenye ruhusa ya System Admin.');
      } else if (insertError.code === '23505') {
        setError('Namba hii ya usajili tayari imetumika. Tumia namba nyingine.');
      } else if (insertError.code === '23502') {
        setError(`Kuna taarifa ya lazima haijatumwa: ${insertError.message}`);
      } else {
        setError(`Usajili umeshindikana: ${insertError.message}`);
      }
    } else {
      setMessage('Shule imesajiliwa kikamilifu.');
      setForm({ ...emptyForm });
      await loadSchools();
    }
    setSaving(false);
  }

  return (
    <section style={{ display: 'grid', gap: 20 }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
        <h2 style={{ margin: '0 0 8px', color: '#173b5e' }}>Usajili wa Shule</h2>
        <p style={{ margin: '0 0 20px', color: '#64748b' }}>
          Sajili shule na angalia orodha ya shule zilizosajiliwa.
        </p>

        {error && (
          <div role="alert" style={{ background: '#fff1f0', color: '#9f2929', padding: 13, borderRadius: 9, marginBottom: 15 }}>
            {error}
          </div>
        )}
        {message && (
          <div role="status" style={{ background: '#ecfdf3', color: '#166534', padding: 13, borderRadius: 9, marginBottom: 15 }}>
            {message}
          </div>
        )}

        <form onSubmit={registerSchool}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <label style={labelStyle}>
              Jina la shule *
              <input style={inputStyle} required value={form.school_name}
                onChange={(event) => setForm({ ...form, school_name: event.target.value })}
                placeholder="Jina la shule" />
            </label>

            <label style={labelStyle}>
              Namba ya usajili *
              <input style={inputStyle} required value={form.school_code}
                onChange={(event) => setForm({ ...form, school_code: event.target.value })}
                placeholder="Mfano: RG 000023" />
            </label>

            <label style={labelStyle}>
              Aina ya shule *
              <select style={inputStyle} value={form.school_type}
                onChange={(event) => setForm({ ...form, school_type: event.target.value })}>
                <option value="Private">Private</option>
                <option value="Public">Public</option>
              </select>
            </label>

            <label style={labelStyle}>
              Mfumo wa elimu *
              <select style={inputStyle} required value={form.education_system}
                onChange={(event) => setForm({ ...form, education_system: event.target.value })}>
                <option value="Zanzibar">Zanzibar</option>
                <option value="Tanzania">Tanzania Bara</option>
              </select>
            </label>

            <label style={labelStyle}>
              Barua pepe
              <input style={inputStyle} type="email" value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="Barua pepe" />
            </label>

            <label style={labelStyle}>
              Namba ya simu
              <input style={inputStyle} type="tel" value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="Namba ya simu" />
            </label>

            <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
              Anwani ya shule
              <input style={inputStyle} value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                placeholder="Mkoa, wilaya au eneo la shule" />
            </label>
          </div>

          <button type="submit" disabled={saving}
            style={{ marginTop: 18, padding: '12px 20px', border: 0, borderRadius: 9,
              background: saving ? '#94a3b8' : '#173b5e', color: '#fff',
              fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? 'Inasajili...' : 'Sajili Shule'}
          </button>
        </form>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ margin: 0, color: '#173b5e' }}>Shule zilizosajiliwa ({schools.length})</h2>
          <button type="button" onClick={() => void loadSchools()}
            style={{ padding: '9px 14px', border: '1px solid #cbd5e1', borderRadius: 8,
              background: '#fff', color: '#173b5e', fontWeight: 600 }}>
            Onyesha upya
          </button>
        </div>

        {loading ? (
          <p style={{ color: '#64748b' }}>Inapakia taarifa...</p>
        ) : schools.length === 0 ? (
          <p style={{ color: '#64748b' }}>Bado hakuna shule zilizosajiliwa.</p>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
              <thead>
                <tr>
                  {['Jina la shule', 'Namba', 'Aina', 'Mfumo wa elimu', 'Simu'].map((heading) => (
                    <th key={heading} style={{ textAlign: 'left', padding: 11,
                      borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 13 }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schools.map((school) => (
                  <tr key={school.id}>
                    <td style={{ padding: 11, borderBottom: '1px solid #f1f5f9' }}>{school.school_name}</td>
                    <td style={{ padding: 11, borderBottom: '1px solid #f1f5f9' }}>{school.school_code}</td>
                    <td style={{ padding: 11, borderBottom: '1px solid #f1f5f9' }}>{school.school_type}</td>
                    <td style={{ padding: 11, borderBottom: '1px solid #f1f5f9' }}>{school.education_system}</td>
                    <td style={{ padding: 11, borderBottom: '1px solid #f1f5f9' }}>{school.phone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
