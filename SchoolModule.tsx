
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

type School = {
  id: string;
  school_name: string;
  school_code: string;
  school_type: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export function SchoolModule() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    school_name: '',
    school_code: '',
    school_type: 'Private',
    email: '',
    phone: '',
    address: '',
  });

  async function loadSchools() {
    if (!supabase) {
      setError('Supabase haijaunganishwa.');
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setSchools((data || []) as School[]);
      setError('');
    }
    setLoading(false);
  }

  useEffect(() => {
    loadSchools();
  }, []);

  async function registerSchool(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;

    setSaving(true);
    setError('');
    setMessage('');

    const { error } = await supabase.from('schools').insert({
      school_name: form.school_name,
      school_code: form.school_code,
      school_type: form.school_type,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('Shule imesajiliwa kikamilifu.');
      setForm({
        school_name: '',
        school_code: '',
        school_type: 'Private',
        email: '',
        phone: '',
        address: '',
      });
      await loadSchools();
    }

    setSaving(false);
  }

  return (
    <div className="panel" style={{ padding: 20 }}>
      <h2>Usajili wa Shule</h2>
      <p>Sajili shule na angalia orodha ya shule zilizosajiliwa.</p>

      {error && (
        <p style={{ color: '#b42318' }}>{error}</p>
      )}
      {message && (
        <p style={{ color: '#16845b' }}>{message}</p>
      )}

      <form onSubmit={registerSchool}>
        <div style={{ display: 'grid', gap: 12 }}>
          <label>
            Jina la shule *
            <input
              required
              value={form.school_name}
              onChange={e => setForm({ ...form, school_name: e.target.value })}
              placeholder="Jina la shule"
            />
          </label>

          <label>
            Namba ya usajili *
            <input
              required
              value={form.school_code}
              onChange={e => setForm({ ...form, school_code: e.target.value })}
              placeholder="School code"
            />
          </label>

          <label>
            Aina ya shule *
            <select
              value={form.school_type}
              onChange={e => setForm({ ...form, school_type: e.target.value })}
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
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
            />
          </label>

          <label>
            Namba ya simu
            <input
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="Simu"
            />
          </label>

          <label>
            Anwani
            <input
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              placeholder="Anwani ya shule"
            />
          </label>

          <button type="submit" disabled={saving}>
            {saving ? 'Inasajili...' : 'Sajili Shule'}
          </button>
        </div>
      </form>

      <hr />
      <h3>Shule zilizosajiliwa ({schools.length})</h3>

      {loading ? (
        <p>Inapakia...</p>
      ) : schools.length === 0 ? (
        <p>Bado hakuna shule zilizosajiliwa.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Jina la shule</th>
                <th>Namba</th>
                <th>Aina</th>
                <th>Simu</th>
              </tr>
            </thead>
            <tbody>
              {schools.map(school => (
                <tr key={school.id}>
                  <td>{school.school_name}</td>
                  <td>{school.school_code}</td>
                  <td>{school.school_type}</td>
                  <td>{school.phone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
