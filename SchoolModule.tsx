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
  minWidth: 0,
  maxWidth: '100%',
  boxSizing: 'border-box' as const,
  padding: '12px 14px',
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  fontSize: 16,
  lineHeight: 1.4,
  background: '#fff',
  color: '#172b3d',
};

const labelStyle = {
  display: 'grid',
  minWidth: 0,
  width: '100%',
  gap: 8,
  fontWeight: 600 as const,
  color: '#334155',
  fontSize: 14,
};

const cardStyle = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: 'clamp(14px, 3vw, 20px)',
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  boxSizing: 'border-box' as const,
  overflow: 'hidden',
};

export function SchoolModule() {
  const [schools, setSchools] = useState<School[]>([]);
  const [form, setForm] = useState<SchoolForm>({ ...emptyForm });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);

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
      setError(
        loadError.code === '42501'
          ? 'Huna ruhusa ya kuona taarifa za shule. Kagua sera ya SELECT ya RLS.'
          : `Imeshindikana kupakia shule: ${loadError.message}`
      );
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

    if (!form.school_name.trim()) {
      setError('Jina la shule linahitajika.');
      return;
    }

    if (!form.education_system) {
      setError('Chagua mfumo wa elimu wa shule.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const { data: result, error: createError } = await supabase.functions.invoke('create-school-admin', {
      body: {
        school_name: form.school_name.trim(),
        school_type: form.school_type,
        education_system: form.education_system,
        school_email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        username: form.admin_username.trim().toLowerCase(),
        admin_email: form.admin_email.trim().toLowerCase(),
        password: form.admin_password
      }
    });

    if (createError || !result?.success) {
      setError(result?.error || createError?.message || 'Usajili wa shule na akaunti umeshindikana.');
    } else {
      setMessage(`Shule imesajiliwa. Username ya msimamizi: ${result.username}. Barua pepe ya kuingia: ${result.admin_email}`);
      setForm({ ...emptyForm });
      setShowForm(false);
      await loadSchools();
    }

    setSaving(false);
  }

  async function deleteSchool(school: School) {
    const confirmed = window.confirm(
      `Una uhakika unataka kufuta usajili wa shule "${school.school_name}" (${school.school_code})? Kitendo hiki hakiwezi kutenguliwa.`
    );

    if (!confirmed) return;

    if (!supabase) {
      setError('Supabase haijaunganishwa.');
      return;
    }

    setError('');
    setMessage('');

    const { data, error: deleteError } = await supabase
      .from('schools')
      .delete()
      .eq('id', school.id)
      .select('id')
      .maybeSingle();

    if (deleteError) {
      setError(
        deleteError.code === '23503'
          ? 'Shule hii haiwezi kufutwa kwa sababu ina taarifa zinazohusiana nayo, kama wanafunzi au madarasa. Ondoa au hamisha taarifa hizo kwanza.'
          : `Imeshindikana kufuta shule: ${deleteError.message}`
      );
      return;
    }

    if (!data) {
      setError('Shule haikufutwa. Hakikisha una ruhusa ya kufuta shule kupitia sera za RLS.');
      return;
    }

    setMessage(`Usajili wa shule "${school.school_name}" umefutwa.`);
    await loadSchools();
  }

  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: 18,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: '0 0 6px', color: '#173b5e', fontSize: 'clamp(22px, 5vw, 30px)' }}>Dashboard ya Shule</h2>
            <p style={{ margin: 0, color: '#64748b' }}>Jumla ya shule zilizosajiliwa na orodha ya majina.</p>
          </div>
          <strong style={{ fontSize: 34, color: '#173b5e' }}>{loading ? '...' : schools.length}</strong>
        </div>
        <button type="button" onClick={() => { setShowForm(value => !value); setError(''); setMessage(''); }}
          style={{ marginTop: 18, padding: '12px 18px', minHeight: 46, border: 0, borderRadius: 10, background: '#173b5e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          {showForm ? 'Funga fomu' : '+ Sajili shule mpya'}
        </button>
      </div>

      {showForm && <div style={cardStyle}>
        <h2 style={{ margin: '0 0 8px', color: '#173b5e', fontSize: 'clamp(22px, 5vw, 30px)' }}>
          Usajili wa Shule
        </h2>

        <p style={{ margin: '0 0 20px', color: '#64748b', lineHeight: 1.6 }}>
          Sajili shule na angalia orodha ya shule zilizosajiliwa.
        </p>

        {error && (
          <div
            role="alert"
            style={{
              background: '#fff1f0',
              color: '#9f2929',
              padding: 13,
              borderRadius: 9,
              marginBottom: 15,
              overflowWrap: 'anywhere',
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            style={{
              background: '#ecfdf3',
              color: '#166534',
              padding: 13,
              borderRadius: 9,
              marginBottom: 15,
            }}
          >
            {message}
          </div>
        )}

        <form onSubmit={registerSchool} style={{ width: '100%', minWidth: 0 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr)',
              gap: 16,
              width: '100%',
              minWidth: 0,
            }}
          >
            <label style={labelStyle}>
              Jina la shule *
              <input
                style={inputStyle}
                required
                value={form.school_name}
                onChange={(event) => setForm({ ...form, school_name: event.target.value })}
                placeholder="Jina la shule"
                autoComplete="organization"
              />
            </label>

            <div
              style={{
                padding: 13,
                borderRadius: 10,
                background: '#f1f5f9',
                color: '#475569',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <strong>Namba ya shule:</strong> Itatengenezwa na mfumo moja kwa moja baada ya kusajili shule.
              <br />
              Mfano: {form.education_system === 'Tanzania Mainland' ? 'TZA' : 'ZNZ'}/SCH/{new Date().getFullYear()}/0001
            </div>

            <label style={labelStyle}>
              Aina ya shule *
              <select
                style={inputStyle}
                value={form.school_type}
                onChange={(event) => setForm({ ...form, school_type: event.target.value })}
              >
                <option value="Private">Private</option>
                <option value="Public">Public</option>
              </select>
            </label>

            <label style={labelStyle}>
              Mfumo wa elimu *
              <select
                style={inputStyle}
                required
                value={form.education_system}
                onChange={(event) => setForm({ ...form, education_system: event.target.value })}
              >
                <option value="Zanzibar">Zanzibar</option>
                <option value="Tanzania Mainland">Tanzania Bara</option>
              </select>
            </label>

            <label style={labelStyle}>
              Barua pepe
              <input
                style={inputStyle}
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="Barua pepe"
                autoComplete="email"
              />
            </label>

            <label style={labelStyle}>
              Username ya msimamizi wa shule *
              <input style={inputStyle} required minLength={3} maxLength={30} pattern="[a-zA-Z0-9._-]+"
                value={form.admin_username}
                onChange={(event) => setForm({ ...form, admin_username: event.target.value })}
                placeholder="mfano: brightfuture" autoComplete="username" />
            </label>
            <label style={labelStyle}>
              Barua pepe ya msimamizi *
              <input style={inputStyle} required type="email" value={form.admin_email}
                onChange={(event) => setForm({ ...form, admin_email: event.target.value })}
                placeholder="admin@shule.co.tz" autoComplete="email" />
            </label>
            <label style={labelStyle}>
              Nenosiri la mwanzo * (angalau herufi/namba 10)
              <input style={inputStyle} required type="password" minLength={10} value={form.admin_password}
                onChange={(event) => setForm({ ...form, admin_password: event.target.value })}
                placeholder="Tengeneza nenosiri salama" autoComplete="new-password" />
            </label>
            <label style={labelStyle}>
              Namba ya simu
              <input
                style={inputStyle}
                type="tel"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="Namba ya simu"
                autoComplete="tel"
              />
            </label>

            <label style={labelStyle}>
              Anwani ya shule
              <input
                style={inputStyle}
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                placeholder="Mkoa, wilaya au eneo la shule"
                autoComplete="street-address"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              marginTop: 18,
              width: '100%',
              maxWidth: 240,
              minHeight: 48,
              padding: '12px 20px',
              border: 0,
              borderRadius: 10,
              background: saving ? '#94a3b8' : '#173b5e',
              color: '#fff',
              fontWeight: 700,
              fontSize: 15,
              cursor: saving ? 'wait' : 'pointer',
            }}
          >
            {saving ? 'Inasajili...' : 'Sajili Shule'}
          </button>
        </form>
      </div>}

      <div style={cardStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            minWidth: 0,
          }}
        >
          <h2 style={{ margin: 0, color: '#173b5e', fontSize: 'clamp(20px, 4.5vw, 28px)' }}>
            Shule zilizosajiliwa ({schools.length})
          </h2>

          <button
            type="button"
            onClick={() => void loadSchools()}
            disabled={loading}
            style={{
              padding: '10px 14px',
              minHeight: 42,
              border: '1px solid #cbd5e1',
              borderRadius: 9,
              background: '#fff',
              color: '#173b5e',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Inapakia...' : 'Onyesha upya'}
          </button>
        </div>

        {loading ? (
          <p style={{ color: '#64748b' }}>Inapakia taarifa...</p>
        ) : schools.length === 0 ? (
          <p style={{ color: '#64748b' }}>Bado hakuna shule zilizosajiliwa.</p>
        ) : (
          <div
            style={{
              overflowX: 'auto',
              overflowY: 'hidden',
              marginTop: 12,
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <table
              style={{
                width: '100%',
                minWidth: 620,
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr>
                  {['Jina la shule', 'Namba ya shule', 'Aina', 'Mfumo wa elimu', 'Simu', 'Kitendo'].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        textAlign: 'left',
                        padding: '12px 10px',
                        borderBottom: '1px solid #e2e8f0',
                        color: '#475569',
                        fontSize: 13,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {schools.map((school) => (
                  <tr key={school.id}>
                    <td style={{ padding: 11, borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                      {school.school_name}
                    </td>
                    <td style={{ padding: 11, borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                      {school.school_code}
                    </td>
                    <td style={{ padding: 11, borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                      {school.school_type}
                    </td>
                    <td style={{ padding: 11, borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                      {school.education_system}
                    </td>
                    <td style={{ padding: 11, borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                      {school.phone || '—'}
                    </td>
                    <td style={{ padding: 11, borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => void deleteSchool(school)}
                        style={{
                          padding: '8px 12px',
                          border: '1px solid #fecaca',
                          borderRadius: 8,
                          background: '#fff1f2',
                          color: '#b91c1c',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Futa
                      </button>
                    </td>
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
