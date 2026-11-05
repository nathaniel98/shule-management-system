
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from './supabase';

type School = {
  id: string;
  school_name: string;
  school_code: string;
  school_type: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at?: string;
};

type SchoolForm = {
  school_name: string;
  school_code: string;
  school_type: string;
  email: string;
  phone: string;
  address: string;
};

const emptyForm: SchoolForm = {
  school_name: '',
  school_code: '',
  school_type: 'Private',
  email: '',
  phone: '',
  address: '',
};

export function SchoolModule() {
  const [schools, setSchools] = useState<School[]>([]);
  const [form, setForm] = useState<SchoolForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadSchools() {
    if (!supabase) {
      setError('Supabase haijaunganishwa.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError(
        error.code === '42501'
          ? 'Huna ruhusa ya kuona taarifa za shule. Kagua sera za RLS.'
          : error.message
      );
    } else {
      setSchools((data || []) as School[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadSchools();
  }, []);

  async function registerSchool(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!supabase) {
      setError('Supabase haijaunganishwa.');
      return;
    }

    if (!form.school_name.trim() || !form.school_code.trim()) {
      setError('Jina la shule na namba ya usajili vinahitajika.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const { error } = await supabase.from('schools').insert({
      school_name: form.school_name.trim(),
      school_code: form.school_code.trim().toUpperCase(),
      school_type: form.school_type,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
    });

    if (error) {
      if (error.code === '42501') {
        setError(
          'Usajili umezuiwa na ruhusa za RLS. Hakikisha sera ya INSERT inaruhusu system admin.'
        );
      } else if (error.code === '23505') {
        setError('Namba hii ya usajili tayari imetumika.');
      } else {
        setError(error.message);
      }
    } else {
      setMessage('Shule imesajiliwa kikamilifu.');
      setForm({ ...emptyForm });
      await loadSchools();
    }

    setSaving(false);
  }

  return (
    <div className="panel" style={{ padding: 20 }}>
      <h2>Usajili wa Shule</h2>
      <p>Sajili shule na angalia orodha ya shule zilizosajiliwa.</p>

      {error && (
        <div style={{
          background: '#fff1f0',
          color: '#b42318',
          padding: 12,
          borderRadius: 8,
          marginBottom: 15
        }}>
          {error}
        </div>
      )}

      {message && (
        <div style={{
          background: '#ecfdf3',
          color: '#16845b',
          padding: 12,
          borderRadius: 8,
          marginBottom: 15
        }}>
          {message}
        </div>
      )}

      <form onSubmit={registerSchool}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12
        }}>
          <label>
            Jina la shule *
            <input
              required
              value={form.school_name}
              onChange={e => setForm({
                ...form,
                school_name: e.target.value
              })}
              placeholder="Jina la shule"
            />
          </label>

          <label>
            Namba ya usajili *
            <input
              required
              value={form.school_code}
              onChange={e => setForm({
                ...form,
                school_code: e.target.value
              })}
              placeholder="School code"
            />
          </label>

          <label>
            Aina ya shule *
            <select
              value={form.school_type}
              onChange={e => setForm({
                ...form,
                school_type: e.target.value
              })}
            >
              <option value="Private">Private</option>
              <option value="Public">Public</option>
            </select>
          </label>

          <label>
            Barua pepe
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({
                ...form,
                email: e.target.value
              })}
              placeholder="Email"
            />
          </label>

          <label>
            Namba ya simu
            <input
              value={form.phone}
              onChange={e => setForm({
                ...form,
                phone: e.target.value
              })}
              placeholder="Namba ya simu"
            />
          </label>

          <label>
            Anwani ya shule
            <input
              value={form.address}
              onChange={e => setForm({
                ...form,
                address: e.target.value
              })}
              placeholder="Anwani ya shule"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{ marginTop: 18 }}
        >
          {saving ? 'Inasajili...' : 'Sajili Shule'}
        </button>
      </form>

      <hr style={{ margin: '25px 0' }} />

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10
      }}>
        <h3>Shule zilizosajiliwa ({schools.length})</h3>
        <button type="button" onClick={loadSchools}>
          Onyesha upya
        </button>
      </div>

      {loading ? (
        <p>Inapakia taarifa...</p>
      ) : schools.length === 0 ? (
        <p>Bado hakuna shule zilizosajiliwa.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: 12
          }}>
            <thead>
              <tr>
                {['Jina la shule', 'Namba', 'Aina', 'Simu'].map(item => (
                  <th key={item} style={{
                    textAlign: 'left',
                    padding: 10,
                    borderBottom: '1px solid #ddd'
                  }}>
                    {item}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schools.map(school => (
                <tr key={school.id}>
                  <td style={{ padding: 10 }}>{school.school_name}</td>
                  <td style={{ padding: 10 }}>{school.school_code}</td>
                  <td style={{ padding: 10 }}>{school.school_type}</td>
                  <td style={{ padding: 10 }}>{school.phone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
