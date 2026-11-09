
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    <div className="subjects-module">
      <style>{`
        .subjects-module {
          display: grid;
          gap: 20px;
          color: #243447;
          width: 100%;
          min-width: 0;
        }

        .subjects-card {
          background: white;
          padding: 20px;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          min-width: 0;
        }

        .subjects-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 14px;
          table-layout: auto;
        }

        .subjects-table th,
        .subjects-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
        }

        .subjects-table th {
          background: #f8fafc;
          font-weight: 700;
        }

        .subject-name-cell {
          overflow-wrap: anywhere;
          word-break: normal;
        }

        .subject-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .subject-action-btn {
          padding: 9px 13px;
          border: 0;
          border-radius: 9px;
          color: white;
          font-weight: 700;
          cursor: pointer;
          min-height: 40px;
        }

        .subject-edit {
          background: #173b5e;
        }

        .subject-delete {
          background: #b42318;
        }

        @media (max-width: 600px) {
          .subjects-card {
            padding: 15px;
            border-radius: 15px;
          }

          .subjects-card h2 {
            font-size: 21px;
            line-height: 1.35;
          }

          .subjects-table,
          .subjects-table tbody {
            display: block;
            width: 100%;
          }

          .subjects-table thead {
            display: none;
          }

          .subjects-table tr {
            display: block;
            width: 100%;
            box-sizing: border-box;
            margin: 12px 0;
            padding: 10px 12px;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            background: #fff;
          }

          .subjects-table td {
            display: grid;
            grid-template-columns: 105px minmax(0, 1fr);
            gap: 10px;
            align-items: start;
            width: 100%;
            box-sizing: border-box;
            padding: 10px 0;
            border-bottom: 1px solid #edf0f4;
            overflow-wrap: anywhere;
            white-space: normal;
          }

          .subjects-table td:last-child {
            border-bottom: 0;
          }

          .subjects-table td::before {
            content: attr(data-label);
            font-weight: 700;
            color: #475569;
          }

          .subjects-table td.subject-actions-cell {
            display: block;
          }

          .subjects-table td.subject-actions-cell::before {
            display: block;
            margin-bottom: 9px;
          }

          .subject-actions {
            display: flex;
            width: 100%;
            gap: 10px;
          }

          .subject-action-btn {
            flex: 1;
            min-width: 0;
            padding: 11px 8px;
            font-size: 14px;
          }
        }
      `}</style>

      <section className="subjects-card">
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

      <section className="subjects-card">
        <h2>Masomo Yaliyosajiliwa ({visible.length})</h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,190px),1fr))',
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
          <table className="subjects-table">
            <thead>
              <tr>
                <th>Na.</th>
                <th>Code</th>
                <th>Jina la somo</th>
                <th>Ngazi</th>
                <th>Vitendo</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item, index) => (
                <tr key={item.id}>
                  <td data-label="Na.">{index + 1}</td>
                  <td data-label="Code">{item.subject_code}</td>
                  <td data-label="Jina la somo" className="subject-name-cell">
                    {item.subject_name}
                  </td>
                  <td data-label="Ngazi">{item.education_level}</td>
                  <td data-label="Vitendo" className="subject-actions-cell">
                    <div className="subject-actions">
                      <button
                        onClick={() => editSubject(item)}
                        className="subject-action-btn subject-edit"
                      >
                        Hariri
                      </button>
                      <button
                        onClick={() => deleteSubject(item)}
                        className="subject-action-btn subject-delete"
                      >
                        Futa
                      </button>
                    </div>
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
