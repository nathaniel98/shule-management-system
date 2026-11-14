
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from './supabase';

type AcademicYear = {
  id: string;
  school_id: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at?: string;
};

const emptyForm = {
  academic_year: '',
  start_date: '',
  end_date: '',
  is_current: false,
};

export default function AcademicYearsModule() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [schools, setSchools] = useState<{ id: string; school_name: string }[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadSchools();
  }, []);

  useEffect(() => {
    if (schoolId) loadYears();
    else setYears([]);
  }, [schoolId]);

  async function loadSchools() {
    if (!supabase) {
      setError('Supabase haijaunganishwa.');
      return;
    }

    const { data, error } = await supabase
      .from('schools')
      .select('id, school_name')
      .order('school_name');

    if (error) {
      setError(error.message);
      return;
    }

    setSchools(data || []);

    if (data?.length) {
      setSchoolId(data[0].id);
    }
  }

  async function loadYears() {
    if (!supabase || !schoolId) return;

    setLoading(true);
    setError('');

    const { data, error } = await supabase
      .from('academic_years')
      .select('*')
      .eq('school_id', schoolId)
      .order('academic_year', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setYears((data || []) as AcademicYear[]);
    }

    setLoading(false);
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function saveYear(event: FormEvent) {
    event.preventDefault();

    if (!supabase || !schoolId) return;

    if (form.end_date < form.start_date) {
      setError('Tarehe ya mwisho haiwezi kuwa kabla ya tarehe ya kuanza.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        school_id: schoolId,
        academic_year: form.academic_year.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        is_current: form.is_current,
      };

      if (form.is_current) {
        const { error: currentError } = await supabase
          .from('academic_years')
          .update({ is_current: false })
          .eq('school_id', schoolId);

        if (currentError) throw currentError;
      }

      if (editingId) {
        const { error } = await supabase
          .from('academic_years')
          .update(payload)
          .eq('id', editingId)
          .eq('school_id', schoolId);

        if (error) throw error;
        setMessage('Mwaka wa masomo umehaririwa kikamilifu.');
      } else {
        const { error } = await supabase
          .from('academic_years')
          .insert(payload);

        if (error) throw error;
        setMessage('Mwaka wa masomo umesajiliwa kikamilifu.');
      }

      resetForm();
      await loadYears();
    } catch (err: any) {
      setError(err.message || 'Imeshindikana kuhifadhi mwaka wa masomo.');
    }

    setLoading(false);
  }

  function editYear(year: AcademicYear) {
    setEditingId(year.id);
    setForm({
      academic_year: year.academic_year || '',
      start_date: year.start_date || '',
      end_date: year.end_date || '',
      is_current: year.is_current || false,
    });
    setMessage('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteYear(year: AcademicYear) {
    if (!supabase) return;

    if (year.is_current) {
      setError('Huwezi kufuta mwaka wa masomo unaotumika sasa.');
      return;
    }

    if (!window.confirm(`Una uhakika unataka kufuta mwaka ${year.academic_year}?`)) {
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    const { error } = await supabase
      .from('academic_years')
      .delete()
      .eq('id', year.id)
      .eq('school_id', schoolId);

    if (error) {
      setError(error.message);
    } else {
      setMessage('Mwaka wa masomo umefutwa.');
      if (editingId === year.id) resetForm();
      await loadYears();
    }

    setLoading(false);
  }

  async function makeCurrent(year: AcademicYear) {
    if (!supabase) return;

    setLoading(true);
    setError('');
    setMessage('');

    const { error: clearError } = await supabase
      .from('academic_years')
      .update({ is_current: false })
      .eq('school_id', schoolId);

    if (clearError) {
      setError(clearError.message);
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('academic_years')
      .update({ is_current: true })
      .eq('id', year.id)
      .eq('school_id', schoolId);

    if (error) {
      setError(error.message);
    } else {
      setMessage(`${year.academic_year} umewekwa kuwa mwaka wa sasa.`);
      await loadYears();
    }

    setLoading(false);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '13px 14px',
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    fontSize: 15,
    boxSizing: 'border-box',
    background: '#fff',
    color: '#1e293b',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '11px 17px',
    border: 0,
    borderRadius: 9,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14,
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px', color: '#26384b' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, margin: '0 0 8px', color: '#173b5e' }}>
          Miaka ya Masomo
        </h1>
        <p style={{ color: '#64748b', margin: 0 }}>
          Sajili na simamia miaka ya masomo ya shule.
        </p>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: 13, borderRadius: 9, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {message && (
        <div style={{ background: '#dcfce7', color: '#166534', padding: 13, borderRadius: 9, marginBottom: 16 }}>
          {message}
        </div>
      )}

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, marginBottom: 22 }}>
        <h2 style={{ fontSize: 21, marginTop: 0 }}>
          {editingId ? 'Hariri Mwaka wa Masomo' : 'Sajili Mwaka wa Masomo'}
        </h2>

        <form onSubmit={saveYear}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <label>
              <span style={{ display: 'block', marginBottom: 7, fontWeight: 600 }}>Shule</span>
              <select
                value={schoolId}
                onChange={e => setSchoolId(e.target.value)}
                style={inputStyle}
                required
              >
                {schools.map(school => (
                  <option key={school.id} value={school.id}>{school.school_name}</option>
                ))}
              </select>
            </label>

            <label>
              <span style={{ display: 'block', marginBottom: 7, fontWeight: 600 }}>Mwaka wa Masomo</span>
              <input
                style={inputStyle}
                value={form.academic_year}
                onChange={e => setForm({ ...form, academic_year: e.target.value })}
                placeholder="Mfano: 2026"
                required
              />
            </label>

            <label>
              <span style={{ display: 'block', marginBottom: 7, fontWeight: 600 }}>Tarehe ya Kuanza</span>
              <input
                type="date"
                style={inputStyle}
                value={form.start_date}
                onChange={e => setForm({ ...form, start_date: e.target.value })}
                required
              />
            </label>

            <label>
              <span style={{ display: 'block', marginBottom: 7, fontWeight: 600 }}>Tarehe ya Kumalizika</span>
              <input
                type="date"
                style={inputStyle}
                value={form.end_date}
                onChange={e => setForm({ ...form, end_date: e.target.value })}
                min={form.start_date || undefined}
                required
              />
            </label>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 18 }}>
            <input
              type="checkbox"
              checked={form.is_current}
              onChange={e => setForm({ ...form, is_current: e.target.checked })}
            />
            Weka huu kuwa mwaka wa masomo unaotumika sasa
          </label>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
            <button
              type="submit"
              disabled={loading || !schoolId}
              style={{ ...buttonStyle, background: '#173b5e', color: '#fff', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Inahifadhi...' : editingId ? 'Hifadhi Mabadiliko' : 'Sajili Mwaka'}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                style={{ ...buttonStyle, background: '#e2e8f0', color: '#334155' }}
              >
                Ghairi
              </button>
            )}
          </div>
        </form>
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
        <h2 style={{ fontSize: 21, marginTop: 0 }}>Orodha ya Miaka ya Masomo</h2>

        {loading && <p>Inapakia taarifa...</p>}

        {!loading && years.length === 0 && (
          <p style={{ color: '#64748b' }}>Hakuna mwaka wa masomo uliosajiliwa.</p>
        )}

        <div style={{ display: 'grid', gap: 13 }}>
          {years.map(year => (
            <article
              key={year.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 14,
              }}
            >
              <div>
                <strong style={{ fontSize: 19 }}>{year.academic_year}</strong>
                <div style={{ color: '#64748b', fontSize: 14, marginTop: 7 }}>
                  {year.start_date} hadi {year.end_date}
                </div>
                <span style={{
                  display: 'inline-block',
                  marginTop: 9,
                  padding: '5px 10px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  background: year.is_current ? '#dcfce7' : '#e2e8f0',
                  color: year.is_current ? '#166534' : '#475569',
                }}>
                  {year.is_current ? 'Mwaka wa Sasa' : 'Sio mwaka wa sasa'}
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {!year.is_current && (
                  <button
                    onClick={() => makeCurrent(year)}
                    disabled={loading}
                    style={{ ...buttonStyle, background: '#dbeafe', color: '#1d4ed8' }}
                  >
                    Weka wa Sasa
                  </button>
                )}

                <button
                  onClick={() => editYear(year)}
                  style={{ ...buttonStyle, background: '#fef3c7', color: '#92400e' }}
                >
                  Hariri
                </button>

                <button
                  onClick={() => deleteYear(year)}
                  disabled={loading || year.is_current}
                  style={{ ...buttonStyle, background: '#fee2e2', color: '#b91c1c' }}
                >
                  Futa
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
