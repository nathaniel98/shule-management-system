
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from './supabase';

type AcademicYear = {
  id: string;
  school_id: string;
  year_name: string;
  is_current: boolean;
};

type School = {
  id: string;
  school_name: string;
};

export default function AcademicYearsModule({ isReadOnly = false }: { isReadOnly?: boolean }) {
  const [schools, setSchools] = useState<School[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [yearName, setYearName] = useState('');
  const [isCurrent, setIsCurrent] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadSchools();
  }, []);

  useEffect(() => {
    if (schoolId) loadYears();
    else setYears([]);
  }, [schoolId]);

  async function loadSchools() {
    if (!supabase) return;

    if (isReadOnly) {
      const { data, error } = await supabase.rpc('get_my_school_for_staff');
      if (error) { setError(error.message); return; }
      const assigned = Array.isArray(data) ? data[0] : data;
      if (!assigned?.id) { setError('Akaunti hii haijaunganishwa na shule.'); return; }
      const school = { id: assigned.id, school_name: assigned.school_name || 'Shule yangu' };
      setSchools([school]);
      setSchoolId(school.id);
      return;
    }

    const { data, error } = await supabase
      .from('schools')
      .select('id, school_name')
      .order('school_name');

    if (error) { setError(error.message); return; }
    setSchools(data || []);
    if (data?.length) setSchoolId(data[0].id);
  }

  async function loadYears() {
    if (!supabase || !schoolId) return;

    setLoading(true);
    setError('');

    const { data, error } = await supabase
      .from('academic_years')
      .select('id, school_id, year_name, is_current')
      .eq('school_id', schoolId)
      .order('year_name', { ascending: false });

    if (error) setError(error.message);
    else setYears((data || []) as AcademicYear[]);

    setLoading(false);
  }

  function resetForm() {
    setYearName('');
    setIsCurrent(false);
    setEditingId(null);
  }

  async function saveYear(event: FormEvent) {
    event.preventDefault();

    if (!supabase || !schoolId) return;

    if (!yearName.trim()) {
      setError('Weka mwaka wa masomo.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        school_id: schoolId,
        year_name: yearName.trim(),
        is_current: isCurrent,
      };

      if (isCurrent) {
        const { error } = await supabase
          .from('academic_years')
          .update({ is_current: false })
          .eq('school_id', schoolId);

        if (error) throw error;
      }

      if (editingId) {
        const { error } = await supabase
          .from('academic_years')
          .update(payload)
          .eq('id', editingId)
          .eq('school_id', schoolId);

        if (error) throw error;
        setMessage('Mwaka wa masomo umehaririwa.');
      } else {
        const { error } = await supabase
          .from('academic_years')
          .insert(payload);

        if (error) throw error;
        setMessage('Mwaka wa masomo umesajiliwa.');
      }

      resetForm();
      await loadYears();
    } catch (err: any) {
      setError(err.message || 'Imeshindikana kuhifadhi taarifa.');
    } finally {
      setLoading(false);
    }
  }

  function editYear(year: AcademicYear) {
    setEditingId(year.id);
    setYearName(year.year_name);
    setIsCurrent(year.is_current);
    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      setMessage(`${year.year_name} umewekwa kuwa mwaka wa sasa.`);
      await loadYears();
    }

    setLoading(false);
  }

  async function deleteYear(year: AcademicYear) {
    if (!supabase) return;

    if (year.is_current) {
      setError('Huwezi kufuta mwaka unaotumika sasa.');
      return;
    }

    if (!window.confirm(`Una uhakika wa kufuta mwaka ${year.year_name}?`)) {
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
      setMessage('Mwaka umefutwa.');
      if (editingId === year.id) resetForm();
      await loadYears();
    }

    setLoading(false);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 13,
    border: '1px solid #cbd5e1',
    borderRadius: 9,
    fontSize: 16,
    boxSizing: 'border-box',
    background: '#fff',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '11px 16px',
    border: 0,
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
  };

  return (
    <div style={{
      maxWidth: 1100,
      margin: '0 auto',
      padding: 20,
      color: '#26384b',
    }}>
      <h1 style={{ color: '#173b5e' }}>Miaka ya Masomo</h1>
      <p>{isReadOnly ? 'Angalia mwaka wa masomo unaotumika na historia ya miaka ya shule yako.' : 'Sajili na simamia miaka ya masomo ya shule.'}</p>

      {error && (
        <div style={{
          background: '#fee2e2',
          color: '#991b1b',
          padding: 13,
          borderRadius: 9,
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {message && (
        <div style={{
          background: '#dcfce7',
          color: '#166534',
          padding: 13,
          borderRadius: 9,
          marginBottom: 16,
        }}>
          {message}
        </div>
      )}

      {!isReadOnly && <section style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        padding: 20,
        marginBottom: 22,
      }}>
        <h2>{editingId ? 'Hariri Mwaka' : 'Sajili Mwaka wa Masomo'}</h2>

        <form onSubmit={saveYear}>
          <label style={{ display: 'block', marginBottom: 15 }}>
            <strong>Shule</strong>
            <select
              value={schoolId}
              onChange={e => setSchoolId(e.target.value)}
              style={inputStyle}
              required
            >
              {schools.map(s => (
                <option key={s.id} value={s.id}>{s.school_name}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'block', marginBottom: 15 }}>
            <strong>Mwaka wa Masomo</strong>
            <input
              value={yearName}
              onChange={e => setYearName(e.target.value)}
              placeholder="Mfano: 2026"
              style={inputStyle}
              required
            />
          </label>

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 18,
          }}>
            <input
              type="checkbox"
              checked={isCurrent}
              onChange={e => setIsCurrent(e.target.checked)}
            />
            Weka huu kuwa mwaka wa masomo unaotumika sasa
          </label>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={loading || !schoolId}
              style={{ ...buttonStyle, background: '#173b5e', color: '#fff' }}
            >
              {loading ? 'Inahifadhi...' : editingId ? 'Hifadhi Mabadiliko' : 'Sajili Mwaka'}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                style={{ ...buttonStyle, background: '#e2e8f0' }}
              >
                Ghairi
              </button>
            )}
          </div>
        </form>
      </section>}

      <section style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        padding: 20,
      }}>
        <h2>Orodha ya Miaka ya Masomo</h2>

        {loading && <p>Inapakia taarifa...</p>}

        {!loading && years.length === 0 && (
          <p>Hakuna mwaka wa masomo uliosajiliwa.</p>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          {years.map(year => (
            <article
              key={year.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: 15,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <strong style={{ fontSize: 20 }}>{year.year_name}</strong>
                <div style={{
                  marginTop: 7,
                  color: year.is_current ? '#15803d' : '#64748b',
                  fontWeight: 600,
                }}>
                  {year.is_current ? 'Mwaka wa Sasa' : 'Sio mwaka wa sasa'}
                </div>
              </div>

              {!isReadOnly && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
              </div>}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
