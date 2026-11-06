
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from './supabase';

type School = {
  id: string;
  school_name: string;
  school_code?: string | null;
};

type Teacher = {
  id: string;
  school_id: string;
  employee_no: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  photo_url?: string | null;
  employment_date?: string | null;
  status?: string | null;
  created_at?: string | null;
};

const emptyForm = {
  employee_no: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  phone: '',
  email: '',
  address: '',
  photo_url: '',
  employment_date: '',
  status: 'Active'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  border: '1px solid #cbd5e1',
  borderRadius: 9,
  fontSize: 15,
  background: '#fff',
  color: '#1e293b'
};

const labelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 7,
  fontWeight: 600,
  color: '#334155',
  fontSize: 14
};

const buttonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 9,
  padding: '10px 14px',
  background: '#173b5e',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer'
};

export default function TeachersModule() {
  const [schools, setSchools] = useState<School[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadTeachers(id = schoolId) {
    if (!id) {
      setTeachers([]);
      return;
    }

    const { data, error } = await supabase
      .from('teachers')
      .select('*')
      .eq('school_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setTeachers((data || []) as Teacher[]);
  }

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      try {
        setLoading(true);
        setError('');

        const { data, error } = await supabase
          .from('schools')
          .select('id, school_name, school_code')
          .order('school_name');

        if (error) throw error;
        if (!active) return;

        const rows = (data || []) as School[];
        setSchools(rows);

        if (rows.length) {
          setSchoolId(rows[0].id);

          const result = await supabase
            .from('teachers')
            .select('*')
            .eq('school_id', rows[0].id)
            .order('created_at', { ascending: false });

          if (result.error) throw result.error;
          if (active) setTeachers((result.data || []) as Teacher[]);
        }
      } catch (e) {
        if (active) {
          setError(
            e instanceof Error
              ? e.message
              : 'Imeshindikana kupakia walimu.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadInitialData();

    return () => {
      active = false;
    };
  }, []);

  async function changeSchool(id: string) {
    setSchoolId(id);
    setEditingId(null);
    setForm(emptyForm);
    setSearch('');
    setError('');
    setMessage('');

    try {
      setLoading(true);
      await loadTeachers(id);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Imeshindikana kupakia walimu.'
      );
    } finally {
      setLoading(false);
    }
  }

  function startEdit(t: Teacher) {
    setEditingId(t.id);

    setForm({
      employee_no: t.employee_no || '',
      first_name: t.first_name || '',
      middle_name: t.middle_name || '',
      last_name: t.last_name || '',
      phone: t.phone || '',
      email: t.email || '',
      address: t.address || '',
      photo_url: t.photo_url || '',
      employment_date: t.employment_date || '',
      status: t.status || 'Active'
    });

    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setMessage('');
  }

  async function saveTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!schoolId) {
      setError('Sajili shule kwanza au chagua shule.');
      return;
    }

    if (
      !form.employee_no.trim() ||
      !form.first_name.trim() ||
      !form.last_name.trim()
    ) {
      setError(
        'Jaza namba ya ajira, jina la kwanza na jina la mwisho.'
      );
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const payload = {
      school_id: schoolId,
      employee_no: form.employee_no.trim(),
      first_name: form.first_name.trim(),
      middle_name: form.middle_name.trim() || null,
      last_name: form.last_name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      photo_url: form.photo_url.trim() || null,
      employment_date: form.employment_date || null,
      status: form.status
    };

    try {
      const result = editingId
        ? await supabase
            .from('teachers')
            .update(payload)
            .eq('id', editingId)
            .eq('school_id', schoolId)
        : await supabase
            .from('teachers')
            .insert(payload);

      if (result.error) throw result.error;

      setMessage(
        editingId
          ? 'Taarifa za mwalimu zimehaririwa kikamilifu.'
          : 'Mwalimu amesajiliwa kikamilifu.'
      );

      setEditingId(null);
      setForm(emptyForm);
      await loadTeachers(schoolId);
    } catch (e) {
      const err = e as { message?: string; code?: string };

      setError(
        err.code === '23505'
          ? 'Namba hii ya ajira tayari imetumika.'
          : err.message || 'Imeshindikana kuhifadhi taarifa.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteTeacher(t: Teacher) {
    const name = [
      t.first_name,
      t.middle_name,
      t.last_name
    ].filter(Boolean).join(' ');

    const confirmed = window.confirm(
      `Una uhakika unataka kumfuta ${name} (${t.employee_no})? Kitendo hiki hakiwezi kurejeshwa.`
    );

    if (!confirmed) return;

    setDeletingId(t.id);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase
        .from('teachers')
        .delete()
        .eq('id', t.id)
        .eq('school_id', schoolId);

      if (error) throw error;

      setTeachers(current =>
        current.filter(item => item.id !== t.id)
      );

      if (editingId === t.id) {
        setEditingId(null);
        setForm(emptyForm);
      }

      setMessage(`${name} amefutwa kikamilifu.`);
    } catch (e) {
      const err = e as { message?: string };

      setError(
        err.message || 'Imeshindikana kufuta mwalimu.'
      );
    } finally {
      setDeletingId(null);
    }
  }

  const visibleTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return teachers.filter(t => {
      const matchesSearch =
        !q ||
        [
          t.employee_no,
          t.first_name,
          t.middle_name,
          t.last_name,
          t.phone,
          t.email
        ].some(value =>
          (value || '').toLowerCase().includes(q)
        );

      const matchesStatus =
        statusFilter === 'All' ||
        (t.status || 'Active') === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [teachers, search, statusFilter]);

  async function refresh() {
    try {
      setError('');
      await loadTeachers(schoolId);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Imeshindikana kuonyesha walimu.'
      );
    }
  }

  return (
    <div style={{ display: 'grid', gap: 22, color: '#243447' }}>
      <section style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 18,
        padding: 20
      }}>
        <h2 style={{ marginTop: 0 }}>
          {editingId
            ? 'Hariri Taarifa za Mwalimu'
            : 'Usajili wa Walimu'}
        </h2>

        <p style={{ color: '#64748b' }}>
          Sajili walimu na uhifadhi taarifa kwenye Supabase.
        </p>

        {error && (
          <div role="alert" style={{
            background: '#fff1f0',
            color: '#b42318',
            padding: 12,
            borderRadius: 9,
            marginBottom: 14
          }}>
            {error}
          </div>
        )}

        {message && (
          <div role="status" style={{
            background: '#ecfdf3',
            color: '#16845b',
            padding: 12,
            borderRadius: 9,
            marginBottom: 14
          }}>
            {message}
          </div>
        )}

        {!schools.length && !loading ? (
          <p>Hakuna shule iliyosajiliwa. Sajili shule kwanza.</p>
        ) : (
          <>
            <label style={{ ...labelStyle, marginBottom: 16 }}>
              Chagua shule
              <select
                style={inputStyle}
                value={schoolId}
                disabled={!!editingId}
                onChange={e => changeSchool(e.target.value)}
              >
                {schools.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.school_name}
                    {s.school_code ? ` (${s.school_code})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <form
              onSubmit={saveTeacher}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
                gap: 14
              }}
            >
              <label style={labelStyle}>
                Namba ya ajira *
                <input
                  style={inputStyle}
                  required
                  value={form.employee_no}
                  onChange={e =>
                    setForm({ ...form, employee_no: e.target.value })
                  }
                />
              </label>

              <label style={labelStyle}>
                Jina la kwanza *
                <input
                  style={inputStyle}
                  required
                  value={form.first_name}
                  onChange={e =>
                    setForm({ ...form, first_name: e.target.value })
                  }
                />
              </label>

              <label style={labelStyle}>
                Jina la kati
                <input
                  style={inputStyle}
                  value={form.middle_name}
                  onChange={e =>
                    setForm({ ...form, middle_name: e.target.value })
                  }
                />
              </label>

              <label style={labelStyle}>
                Jina la mwisho *
                <input
                  style={inputStyle}
                  required
                  value={form.last_name}
                  onChange={e =>
                    setForm({ ...form, last_name: e.target.value })
                  }
                />
              </label>

              <label style={labelStyle}>
                Namba ya simu
                <input
                  style={inputStyle}
                  value={form.phone}
                  onChange={e =>
                    setForm({ ...form, phone: e.target.value })
                  }
                />
              </label>

              <label style={labelStyle}>
                Barua pepe
                <input
                  style={inputStyle}
                  type="email"
                  value={form.email}
                  onChange={e =>
                    setForm({ ...form, email: e.target.value })
                  }
                />
              </label>

              <label style={labelStyle}>
                Anwani
                <input
                  style={inputStyle}
                  value={form.address}
                  onChange={e =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </label>

              <label style={labelStyle}>
                Kiungo cha picha (URL)
                <input
                  style={inputStyle}
                  value={form.photo_url}
                  onChange={e =>
                    setForm({ ...form, photo_url: e.target.value })
                  }
                />
              </label>

              <label style={labelStyle}>
                Tarehe ya kuajiriwa
                <input
                  style={inputStyle}
                  type="date"
                  value={form.employment_date}
                  onChange={e =>
                    setForm({ ...form, employment_date: e.target.value })
                  }
                />
              </label>

              <label style={labelStyle}>
                Hali ya mwalimu
                <select
                  style={inputStyle}
                  value={form.status}
                  onChange={e =>
                    setForm({ ...form, status: e.target.value })
                  }
                >
                  <option value="Active">Anaendelea</option>
                  <option value="Inactive">Hafanyi kazi kwa sasa</option>
                  <option value="Transferred">Amehamia</option>
                  <option value="Retired">Amestaafu</option>
                </select>
              </label>

              <div style={{
                display: 'flex',
                alignItems: 'end',
                gap: 8,
                flexWrap: 'wrap'
              }}>
                <button
                  style={buttonStyle}
                  type="submit"
                  disabled={saving || !schoolId}
                >
                  {saving
                    ? 'Inahifadhi...'
                    : editingId
                      ? 'Hifadhi Mabadiliko'
                      : 'Sajili Mwalimu'}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    style={{
                      ...buttonStyle,
                      background: '#64748b'
                    }}
                  >
                    Ghairi
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </section>

      <section style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 18,
        padding: 20,
        overflowX: 'auto'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <h2>Walimu ({visibleTeachers.length})</h2>

          <button
            type="button"
            style={{
              ...buttonStyle,
              background: '#eaf1f7',
              color: '#173b5e'
            }}
            onClick={refresh}
          >
            Onyesha upya
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
          gap: 10,
          margin: '12px 0 18px'
        }}>
          <input
            style={inputStyle}
            placeholder="Tafuta jina, namba ya ajira, simu..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <select
            style={inputStyle}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="All">Hali zote</option>
            <option value="Active">Anaendelea</option>
            <option value="Inactive">Hafanyi kazi kwa sasa</option>
            <option value="Transferred">Amehamia</option>
            <option value="Retired">Amestaafu</option>
          </select>
        </div>

        {loading ? (
          <p>Inapakia...</p>
        ) : !visibleTeachers.length ? (
          <p>
            {teachers.length
              ? 'Hakuna mwalimu anayelingana na utafutaji wako.'
              : 'Hakuna walimu waliosajiliwa katika shule hii.'}
          </p>
        ) : (
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: 760
          }}>
            <thead>
              <tr>
                {[
                  'Namba ya ajira',
                  'Jina kamili',
                  'Simu',
                  'Barua pepe',
                  'Tarehe ya kuajiriwa',
                  'Hali',
                  'Vitendo'
                ].map(x => (
                  <th
                    key={x}
                    style={{
                      textAlign: 'left',
                      padding: 10,
                      borderBottom: '1px solid #e2e8f0'
                    }}
                  >
                    {x}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {visibleTeachers.map(t => (
                <tr key={t.id}>
                  <td style={{
                    padding: 10,
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    {t.employee_no}
                  </td>

                  <td style={{
                    padding: 10,
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    {[t.first_name, t.middle_name, t.last_name]
                      .filter(Boolean).join(' ')}
                  </td>

                  <td style={{
                    padding: 10,
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    {t.phone || '—'}
                  </td>

                  <td style={{
                    padding: 10,
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    {t.email || '—'}
                  </td>

                  <td style={{
                    padding: 10,
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    {t.employment_date || '—'}
                  </td>

                  <td style={{
                    padding: 10,
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    {t.status || '—'}
                  </td>

                  <td style={{
                    padding: 10,
                    borderBottom: '1px solid #e2e8f0',
                    whiteSpace: 'nowrap'
                  }}>
                    <button
                      type="button"
                      onClick={() => startEdit(t)}
                      style={{
                        ...buttonStyle,
                        padding: '8px 12px',
                        marginRight: 7
                      }}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteTeacher(t)}
                      disabled={deletingId === t.id}
                      style={{
                        ...buttonStyle,
                        padding: '8px 12px',
                        background: '#b42318'
                      }}
                    >
                      {deletingId === t.id ? 'Inafuta...' : 'Delete'}
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
