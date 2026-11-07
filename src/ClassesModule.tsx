
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from './supabase';

type School = {
  id: string;
  school_name: string;
  school_code?: string | null;
};

type SchoolClass = {
  id: string;
  school_id: string | null;
  class_name: string;
  education_level: string;
  sort_order: number | null;
};

const emptyForm = {
  class_name: '',
  education_level: 'Primary',
  sort_order: ''
};

const input: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: 12,
  border: '1px solid #cbd5e1',
  borderRadius: 9,
  fontSize: 15
};

const button: React.CSSProperties = {
  padding: '10px 14px',
  border: 0,
  borderRadius: 9,
  background: '#173b5e',
  color: 'white',
  fontWeight: 700
};

const educationLevels = [
  'Primary',
  'Ordinary Secondary',
  'Advanced Secondary'
];

export default function ClassesModule() {
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('All');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadClasses(id: string) {
    if (!id) {
      setClasses([]);
      return;
    }

    const { data, error } = await supabase
      .from('classes')
      .select('id,school_id,class_name,education_level,sort_order')
      .eq('school_id', id)
      .order('sort_order', {
        ascending: true,
        nullsFirst: false
      });

    if (error) throw error;

    setClasses((data || []) as SchoolClass[]);
  }

  useEffect(() => {
    let active = true;

    async function initialise() {
      try {
        const { data, error } = await supabase
          .from('schools')
          .select('id,school_name,school_code')
          .order('school_name');

        if (error) throw error;
        if (!active) return;

        const rows = (data || []) as School[];

        setSchools(rows);

        if (rows.length > 0) {
          setSchoolId(rows[0].id);

          const result = await supabase
            .from('classes')
            .select('id,school_id,class_name,education_level,sort_order')
            .eq('school_id', rows[0].id)
            .order('sort_order', {
              ascending: true,
              nullsFirst: false
            });

          if (result.error) throw result.error;

          if (active) {
            setClasses((result.data || []) as SchoolClass[]);
          }
        }
      } catch (e) {
        if (active) {
          setError((e as Error).message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    initialise();

    return () => {
      active = false;
    };
  }, []);

  async function changeSchool(id: string) {
    setSchoolId(id);
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setNotice('');

    try {
      setLoading(true);
      await loadClasses(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function editClass(item: SchoolClass) {
    setEditingId(item.id);

    setForm({
      class_name: item.class_name,
      education_level: item.education_level,
      sort_order:
        item.sort_order == null
          ? ''
          : String(item.sort_order)
    });

    setError('');
    setNotice('');
  }

  async function saveClass(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!schoolId || !form.class_name.trim()) {
      setError('Chagua shule na jaza jina la darasa.');
      return;
    }

    if (!educationLevels.includes(form.education_level)) {
      setError('Chagua ngazi sahihi ya elimu.');
      return;
    }

    const order =
      form.sort_order.trim() === ''
        ? null
        : Number(form.sort_order);

    if (
      order !== null &&
      (!Number.isInteger(order) || order < 0)
    ) {
      setError('Mpangilio lazima uwe namba kamili isiyo hasi.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    const payload = {
      school_id: schoolId,
      class_name: form.class_name.trim(),
      education_level: form.education_level,
      sort_order: order
    };

    try {
      const result = editingId
        ? await supabase
            .from('classes')
            .update(payload)
            .eq('id', editingId)
            .eq('school_id', schoolId)
        : await supabase
            .from('classes')
            .insert(payload);

      if (result.error) throw result.error;

      setNotice(
        editingId
          ? 'Darasa limehaririwa.'
          : 'Darasa limeongezwa.'
      );

      setEditingId(null);
      setForm(emptyForm);

      await loadClasses(schoolId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteClass(item: SchoolClass) {
    if (
      !window.confirm(
        `Una uhakika unataka kufuta ${item.class_name}?`
      )
    ) {
      return;
    }

    try {
      setError('');
      setNotice('');

      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', item.id)
        .eq('school_id', schoolId);

      if (error) throw error;

      setClasses(current =>
        current.filter(row => row.id !== item.id)
      );

      setNotice('Darasa limefutwa.');

      if (editingId === item.id) {
        setEditingId(null);
        setForm(emptyForm);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const levels = Array.from(
    new Set(classes.map(item => item.education_level))
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();

    return classes.filter(item =>
      (!q || item.class_name.toLowerCase().includes(q)) &&
      (level === 'All' || item.education_level === level)
    );
  }, [classes, search, level]);

  return (
    <div
      style={{
        display: 'grid',
        gap: 22,
        color: '#243447'
      }}
    >
      <section
        style={{
          background: 'white',
          padding: 20,
          border: '1px solid #e2e8f0',
          borderRadius: 18
        }}
      >
        <h2>
          {editingId ? 'Hariri Darasa' : 'Usajili wa Madarasa'}
        </h2>

        {error && (
          <p style={{ color: '#b42318' }}>{error}</p>
        )}

        {notice && (
          <p style={{ color: '#16845b' }}>{notice}</p>
        )}

        <label>
          Chagua shule
          <select
            style={input}
            value={schoolId}
            disabled={!!editingId}
            onChange={e => changeSchool(e.target.value)}
          >
            <option value="">Chagua shule</option>

            {schools.map(s => (
              <option key={s.id} value={s.id}>
                {s.school_name}
              </option>
            ))}
          </select>
        </label>

        <form
          onSubmit={saveClass}
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit,minmax(190px,1fr))',
            gap: 14,
            marginTop: 18
          }}
        >
          <label>
            Jina la darasa *
            <input
              style={input}
              required
              placeholder="Mfano: Darasa la I"
              value={form.class_name}
              onChange={e =>
                setForm({
                  ...form,
                  class_name: e.target.value
                })
              }
            />
          </label>

          <label>
            Ngazi ya elimu *
            <select
              style={input}
              required
              value={form.education_level}
              onChange={e =>
                setForm({
                  ...form,
                  education_level: e.target.value
                })
              }
            >
              <option value="Primary">Primary</option>
              <option value="Ordinary Secondary">
                Ordinary Secondary
              </option>
              <option value="Advanced Secondary">
                Advanced Secondary
              </option>
            </select>
          </label>

          <label>
            Mpangilio
            <input
              style={input}
              type="number"
              min="0"
              step="1"
              value={form.sort_order}
              onChange={e =>
                setForm({
                  ...form,
                  sort_order: e.target.value
                })
              }
            />
          </label>

          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'end',
              flexWrap: 'wrap'
            }}
          >
            <button
              style={button}
              disabled={saving || !schoolId}
            >
              {saving
                ? 'Inahifadhi...'
                : editingId
                  ? 'Hifadhi Mabadiliko'
                  : 'Sajili Darasa'}
            </button>

            {editingId && (
              <button
                type="button"
                style={{
                  ...button,
                  background: '#64748b'
                }}
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                  setError('');
                  setNotice('');
                }}
              >
                Ghairi
              </button>
            )}
          </div>
        </form>
      </section>

      <section
        style={{
          background: 'white',
          padding: 20,
          border: '1px solid #e2e8f0',
          borderRadius: 18,
          overflowX: 'auto'
        }}
      >
        <h2>Madarasa ({visible.length})</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit,minmax(190px,1fr))',
            gap: 10
          }}
        >
          <input
            style={input}
            placeholder="Tafuta darasa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <select
            style={input}
            value={level}
            onChange={e => setLevel(e.target.value)}
          >
            <option value="All">Ngazi zote</option>

            {levels.map(x => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p>Inapakia...</p>
        ) : visible.length === 0 ? (
          <p>Hakuna madarasa yaliyopatikana.</p>
        ) : (
          <table
            style={{
              width: '100%',
              minWidth: 500,
              borderCollapse: 'collapse',
              marginTop: 16
            }}
          >
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 10 }}>
                  Mpangilio
                </th>
                <th style={{ textAlign: 'left', padding: 10 }}>
                  Darasa
                </th>
                <th style={{ textAlign: 'left', padding: 10 }}>
                  Ngazi ya elimu
                </th>
                <th style={{ textAlign: 'left', padding: 10 }}>
                  Vitendo
                </th>
              </tr>
            </thead>

            <tbody>
              {visible.map(item => (
                <tr key={item.id}>
                  <td style={{ padding: 10 }}>
                    {item.sort_order ?? '—'}
                  </td>

                  <td style={{ padding: 10 }}>
                    {item.class_name}
                  </td>

                  <td style={{ padding: 10 }}>
                    {item.education_level}
                  </td>

                  <td
                    style={{
                      padding: 10,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <button
                      style={button}
                      onClick={() => editClass(item)}
                    >
                      Edit
                    </button>

                    {' '}

                    <button
                      style={{
                        ...button,
                        background: '#b42318'
                      }}
                      onClick={() => deleteClass(item)}
                    >
                      Delete
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
