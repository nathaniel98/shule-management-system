
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from './supabase';

type School = { id: string; school_name: string };

type Subject = {
  id: string;
  school_id: string;
  subject_code: string;
  subject_name: string;
  education_level: string;
};

const levels = [
  'Primary',
  'Ordinary Secondary',
  'Advanced Secondary'
];

const emptyForm = {
  subject_code: '',
  subject_name: '',
  education_level: 'Primary'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: 12,
  border: '1px solid #cbd5e1',
  borderRadius: 9,
  fontSize: 15,
  background: 'white'
};

const buttonStyle: React.CSSProperties = {
  padding: '11px 16px',
  border: 0,
  borderRadius: 9,
  background: '#173b5e',
  color: 'white',
  fontWeight: 700,
  cursor: 'pointer'
};

export default function SubjectsModule() {
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadSubjects(id: string) {
    if (!supabase || !id) {
      setSubjects([]);
      return;
    }

    const { data, error } = await supabase
      .from('subjects')
      .select('id,school_id,subject_code,subject_name,education_level')
      .eq('school_id', id)
      .order('subject_name');

    if (error) throw error;
    setSubjects((data || []) as Subject[]);
  }

  useEffect(() => {
    let active = true;

    async function initialise() {
      try {
        if (!supabase) throw new Error('Supabase haijaunganishwa.');

        const { data, error } = await supabase
          .from('schools')
          .select('id,school_name')
          .order('school_name');

        if (error) throw error;
        if (!active) return;

        const rows = (data || []) as School[];
        setSchools(rows);

        if (rows.length) {
          setSchoolId(rows[0].id);

          const result = await supabase
            .from('subjects')
            .select('id,school_id,subject_code,subject_name,education_level')
            .eq('school_id', rows[0].id)
            .order('subject_name');

          if (result.error) throw result.error;

          if (active) {
            setSubjects((result.data || []) as Subject[]);
          }
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    }

    initialise();
    return () => { active = false; };
  }, []);

  async function changeSchool(id: string) {
    setSchoolId(id);
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setNotice('');

    try {
      setLoading(true);
      await loadSubjects(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setNotice('');
  }

  function editSubject(item: Subject) {
    setEditingId(item.id);
    setForm({
      subject_code: item.subject_code,
      subject_name: item.subject_name,
      education_level: item.education_level
    });
    setError('');
    setNotice('');
  }

  async function saveSubject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!supabase || !schoolId) {
      setError('Chagua shule kwanza.');
      return;
    }

    const code = form.subject_code.trim();
    const name = form.subject_name.trim();

    if (!code || !name) {
      setError('Jaza code na jina la somo.');
      return;
    }

    const duplicate = subjects.some(item =>
      item.id !== editingId &&
      item.education_level === form.education_level &&
      (
        item.subject_code.toLowerCase() === code.toLowerCase() ||
        item.subject_name.toLowerCase() === name.toLowerCase()
      )
    );

    if (duplicate) {
      setError('Code au jina la somo tayari lipo kwenye ngazi hii.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    const payload = {
      school_id: schoolId,
      subject_code: code,
      subject_name: name,
      education_level: form.education_level
    };

    try {
      const result = editingId
        ? await supabase
            .from('subjects')
            .update(payload)
            .eq('id', editingId)
            .eq('school_id', schoolId)
        : await supabase
            .from('subjects')
            .insert(payload);

      if (result.error) throw result.error;

      setNotice(editingId ? 'Somo limehaririwa.' : 'Somo limeongezwa.');
      setEditingId(null);
      setForm(emptyForm);
      await loadSubjects(schoolId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSubject(item: Subject) {
    if (!supabase) return;

    if (!window.confirm(`Una uhakika unataka kufuta ${item.subject_name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', item.id)
        .eq('school_id', schoolId);

      if (error) throw error;

      setSubjects(current => current.filter(row => row.id !== item.id));
      setNotice('Somo limefutwa.');

      if (editingId === item.id) cancelEdit();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();

    return subjects.filter(item =>
      (!q ||
        item.subject_name.toLowerCase().includes(q) ||
        item.subject_code.toLowerCase().includes(q)) &&
      (levelFilter === 'All' || item.education_level === levelFilter)
    );
  }, [subjects, search, levelFilter]);

  return (
    <div style={{ display: 'grid', gap: 20, color: '#243447' }}>
      <section style={{
        background: 'white',
        padding: 20,
        border: '1px solid #e2e8f0',
        borderRadius: 18
      }}>
        <h2>{editingId ? 'Hariri Somo' : 'Usajili wa Masomo'}</h2>

        {error && <p style={{ color: '#b42318' }}>{error}</p>}
        {notice && <p style={{ color: '#16845b' }}>{notice}</p>}

        <label>
          Chagua shule
          <select
            style={inputStyle}
            value={schoolId}
            disabled={!!editingId}
            onChange={e => changeSchool(e.target.value)}
          >
            <option value="">Chagua shule</option>
            {schools.map(s => (
              <option key={s.id} value={s.id}>{s.school_name}</option>
            ))}
          </select>
        </label>

        <form
          onSubmit={saveSubject}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
            gap: 14,
            marginTop: 16
          }}
        >
          <label>
            Code ya somo *
            <input
              style={inputStyle}
              required
              value={form.subject_code}
              placeholder="Mfano: MAT"
              onChange={e => setForm({
                ...form,
                subject_code: e.target.value
              })}
            />
          </label>

          <label>
            Jina la somo *
            <input
              style={inputStyle}
              required
              value={form.subject_name}
              placeholder="Mfano: Mathematics"
              onChange={e => setForm({
                ...form,
                subject_name: e.target.value
              })}
            />
          </label>

          <label>
            Ngazi ya elimu *
            <select
              style={inputStyle}
              value={form.education_level}
              onChange={e => setForm({
                ...form,
                education_level: e.target.value
              })}
            >
              {levels.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </label>

          <div style={{
            display: 'flex',
            gap: 8,
            alignItems: 'end',
            flexWrap: 'wrap'
          }}>
            <button style={buttonStyle} disabled={saving || !schoolId}>
              {saving ? 'Inahifadhi...' :
                editingId ? 'Hifadhi Mabadiliko' : 'Sajili Somo'}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                style={{ ...buttonStyle, background: '#64748b' }}
              >
                Ghairi
              </button>
            )}
          </div>
        </form>
      </section>

      <section style={{
        background: 'white',
        padding: 20,
        border: '1px solid #e2e8f0',
        borderRadius: 18,
        overflowX: 'auto'
      }}>
        <h2>Masomo Yaliyosajiliwa ({visible.length})</h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
          gap: 10
        }}>
          <input
            style={inputStyle}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tafuta kwa jina au code..."
          />

          <select
            style={inputStyle}
            value={levelFilter}
            onChange={e => setLevelFilter(e.target.value)}
          >
            <option value="All">Ngazi zote</option>
            {levels.map(level => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>

        {loading ? <p>Inapakia...</p> :
          visible.length === 0 ? <p>Hakuna masomo yaliyopatikana.</p> : (
          <table style={{
            width: '100%',
            minWidth: 560,
            borderCollapse: 'collapse',
            marginTop: 14
          }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: 11, textAlign: 'left' }}>Na.</th>
                <th style={{ padding: 11, textAlign: 'left' }}>Code</th>
                <th style={{ padding: 11, textAlign: 'left' }}>Jina la somo</th>
                <th style={{ padding: 11, textAlign: 'left' }}>Ngazi</th>
                <th style={{ padding: 11, textAlign: 'left' }}>Vitendo</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item, index) => (
                <tr key={item.id}>
                  <td style={{ padding: 11 }}>{index + 1}</td>
                  <td style={{ padding: 11 }}>{item.subject_code}</td>
                  <td style={{ padding: 11 }}>{item.subject_name}</td>
                  <td style={{ padding: 11 }}>{item.education_level}</td>
                  <td style={{ padding: 11, whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => editSubject(item)}
                      style={{ ...buttonStyle, padding: '8px 11px', marginRight: 6 }}
                    >
                      Hariri
                    </button>
                    <button
                      onClick={() => deleteSubject(item)}
                      style={{ ...buttonStyle, padding: '8px 11px', background: '#b42318' }}
                    >
                      Futa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
