import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from './supabase';

type School = {
  id: string;
  school_name: string;
  school_code?: string | null;
};

type Student = {
  id: string;
  school_id: string;
  admission_no: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  gender: string | null;
  date_of_birth: string | null;
  photo_url: string | null;
  phone: string | null;
  address: string | null;
  admission_date: string | null;
  status: string | null;
  created_at: string;
};

type StudentForm = {
  admission_no: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  photo_url: string;
  phone: string;
  address: string;
  admission_date: string;
  status: string;
};

const emptyForm: StudentForm = {
  admission_no: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  gender: '',
  date_of_birth: '',
  photo_url: '',
  phone: '',
  address: '',
  admission_date: '',
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

export default function StudentsModule() {
  const [schools, setSchools] = useState<School[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  async function loadStudents(id: string) {
    if (!id) {
      setStudents([]);
      return;
    }

    const { data, error } = await supabase
      .from('students')
      .select(`
        id,
        school_id,
        admission_no,
        first_name,
        middle_name,
        last_name,
        gender,
        date_of_birth,
        photo_url,
        phone,
        address,
        admission_date,
        status,
        created_at
      `)
      .eq('school_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    setStudents((data || []) as Student[]);
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

        if (rows.length > 0) {
          setSchoolId(rows[0].id);

          const { data: studentData, error: studentError } =
            await supabase
              .from('students')
              .select(`
                id,
                school_id,
                admission_no,
                first_name,
                middle_name,
                last_name,
                gender,
                date_of_birth,
                photo_url,
                phone,
                address,
                admission_date,
                status,
                created_at
              `)
              .eq('school_id', rows[0].id)
              .order('created_at', { ascending: false });

          if (studentError) throw studentError;

          if (active) {
            setStudents((studentData || []) as Student[]);
          }
        }
      } catch (e) {
        if (active) {
          setError(
            e instanceof Error
              ? e.message
              : 'Imeshindikana kupakia taarifa.'
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
    setError('');
    setMessage('');

    try {
      setLoading(true);
      await loadStudents(id);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Imeshindikana kupakia wanafunzi.'
      );
    } finally {
      setLoading(false);
    }
  }

  function startEdit(student: Student) {
    setEditingId(student.id);

    setForm({
      admission_no: student.admission_no || '',
      first_name: student.first_name || '',
      middle_name: student.middle_name || '',
      last_name: student.last_name || '',
      gender: student.gender || '',
      date_of_birth: student.date_of_birth || '',
      photo_url: student.photo_url || '',
      phone: student.phone || '',
      address: student.address || '',
      admission_date: student.admission_date || '',
      status: student.status || 'Active'
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

  async function saveStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!schoolId) {
      setError('Chagua shule kwanza.');
      return;
    }

    if (
      !form.admission_no.trim() ||
      !form.first_name.trim() ||
      !form.last_name.trim()
    ) {
      setError(
        'Jaza namba ya usajili, jina la kwanza na jina la mwisho.'
      );
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const payload: Record<string, string | null> = {
      school_id: schoolId,
      admission_no: form.admission_no.trim(),
      first_name: form.first_name.trim(),
      middle_name: form.middle_name.trim() || null,
      last_name: form.last_name.trim(),
      date_of_birth: form.date_of_birth || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      admission_date: form.admission_date || null,
      status: form.status
    };

    // Hifadhi taarifa hizi pale tu zinapojazwa.
    if (form.gender.trim()) {
      payload.gender = form.gender;
    }

    if (form.photo_url.trim()) {
      payload.photo_url = form.photo_url.trim();
    }

    try {
      let result;

      if (editingId) {
        const { school_id: _schoolId, ...updatePayload } = payload;

        result = await supabase
          .from('students')
          .update(updatePayload)
          .eq('id', editingId)
          .eq('school_id', schoolId);
      } else {
        result = await supabase
          .from('students')
          .insert(payload);
      }

      if (result.error) throw result.error;

      setMessage(
        editingId
          ? 'Taarifa za mwanafunzi zimehaririwa kikamilifu.'
          : 'Mwanafunzi amesajiliwa kikamilifu.'
      );

      setEditingId(null);
      setForm(emptyForm);

      await loadStudents(schoolId);
    } catch (e) {
      const err = e as { message?: string; code?: string };

      setError(
        err.code === '23505'
          ? 'Namba hii ya usajili tayari imetumika.'
          : err.message || 'Imeshindikana kuhifadhi taarifa.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteStudent(student: Student) {
    const fullName = [
      student.first_name,
      student.middle_name,
      student.last_name
    ].filter(Boolean).join(' ');

    const confirmed = window.confirm(
      `Una uhakika unataka kumfuta ${fullName} (${student.admission_no})?`
    );

    if (!confirmed) return;

    setDeletingId(student.id);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', student.id)
        .eq('school_id', schoolId);

      if (error) throw error;

      setStudents(current =>
        current.filter(item => item.id !== student.id)
      );

      if (editingId === student.id) {
        setEditingId(null);
        setForm(emptyForm);
      }

      setMessage(`${fullName} amefutwa kikamilifu.`);
    } catch (e) {
      const err = e as { message?: string };

      setError(
        err.message || 'Imeshindikana kufuta mwanafunzi.'
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function refreshStudents() {
    try {
      setError('');
      await loadStudents(schoolId);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Imeshindikana kuonyesha wanafunzi.'
      );
    }
  }

  const filteredStudents = students.filter(student => {
    const fullName = [
      student.first_name,
      student.middle_name,
      student.last_name
    ].filter(Boolean).join(' ');

    const value = search.toLowerCase();

    return (
      fullName.toLowerCase().includes(value) ||
      student.admission_no.toLowerCase().includes(value) ||
      (student.phone || '').toLowerCase().includes(value)
    );
  });

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
            ? 'Hariri Taarifa za Mwanafunzi'
            : 'Usajili wa Wanafunzi'}
        </h2>

        <p style={{ color: '#64748b' }}>
          Sajili na simamia taarifa za wanafunzi.
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

        {schools.length === 0 && !loading ? (
          <p>Hakuna shule iliyosajiliwa. Sajili shule kwanza.</p>
        ) : (
          <>
            <label style={{ ...labelStyle, marginBottom: 16 }}>
              Chagua shule
              <select
                style={inputStyle}
                value={schoolId}
                onChange={e => changeSchool(e.target.value)}
                disabled={!!editingId}
              >
                {schools.map(school => (
                  <option key={school.id} value={school.id}>
                    {school.school_name}
                    {school.school_code
                      ? ` (${school.school_code})`
                      : ''}
                  </option>
                ))}
              </select>
            </label>

            <form
              onSubmit={saveStudent}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
                gap: 14
              }}
            >
              <label style={labelStyle}>
                Namba ya usajili *
                <input
                  style={inputStyle}
                  required
                  value={form.admission_no}
                  onChange={e =>
                    setForm({ ...form, admission_no: e.target.value })
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
                Jinsia
                <select
                  style={inputStyle}
                  value={form.gender}
                  onChange={e =>
                    setForm({ ...form, gender: e.target.value })
                  }
                >
                  <option value="">Chagua jinsia</option>
                  <option value="Male">Mwanaume</option>
                  <option value="Female">Mwanamke</option>
                </select>
              </label>

              <label style={labelStyle}>
                Tarehe ya kuzaliwa
                <input
                  style={inputStyle}
                  type="date"
                  value={form.date_of_birth}
                  onChange={e =>
                    setForm({ ...form, date_of_birth: e.target.value })
                  }
                />
              </label>

              <label style={labelStyle}>
                Tarehe ya kujiunga
                <input
                  style={inputStyle}
                  type="date"
                  value={form.admission_date}
                  onChange={e =>
                    setForm({ ...form, admission_date: e.target.value })
                  }
                />
              </label>

              <label style={labelStyle}>
                Namba ya simu
                <input
                  style={inputStyle}
                  type="tel"
                  value={form.phone}
                  onChange={e =>
                    setForm({ ...form, phone: e.target.value })
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
                Kiungo cha picha (Photo URL)
                <input
                  style={inputStyle}
                  type="url"
                  placeholder="https://..."
                  value={form.photo_url}
                  onChange={e =>
                    setForm({ ...form, photo_url: e.target.value })
                  }
                />
              </label>

              <label style={labelStyle}>
                Hali ya mwanafunzi
                <select
                  style={inputStyle}
                  value={form.status}
                  onChange={e =>
                    setForm({ ...form, status: e.target.value })
                  }
                >
                  <option value="Active">Anaendelea</option>
                  <option value="Inactive">Hajasoma kwa sasa</option>
                  <option value="Transferred">Amehamia</option>
                  <option value="Graduated">Amemaliza</option>
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
                      : 'Sajili Mwanafunzi'}
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
          <h2>Wanafunzi ({filteredStudents.length})</h2>

          <button
            type="button"
            style={{
              ...buttonStyle,
              background: '#eaf1f7',
              color: '#173b5e'
            }}
            onClick={refreshStudents}
          >
            Onyesha upya
          </button>
        </div>

        <input
          style={{ ...inputStyle, marginBottom: 16 }}
          placeholder="Tafuta kwa jina, namba ya usajili au simu..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {loading ? (
          <p>Inapakia...</p>
        ) : filteredStudents.length === 0 ? (
          <p>Hakuna wanafunzi waliopatikana.</p>
        ) : (
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: 850
          }}>
            <thead>
              <tr>
                {[
                  'Picha',
                  'Namba',
                  'Jina kamili',
                  'Jinsia',
                  'Simu',
                  'Tarehe ya kujiunga',
                  'Hali',
                  'Vitendo'
                ].map(item => (
                  <th
                    key={item}
                    style={{
                      textAlign: 'left',
                      padding: 10,
                      borderBottom: '1px solid #e2e8f0'
                    }}
                  >
                    {item}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredStudents.map(student => (
                <tr key={student.id}>
                  <td style={{ padding: 10 }}>
                    {student.photo_url ? (
                      <img
                        src={student.photo_url}
                        alt="Picha ya mwanafunzi"
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : '—'}
                  </td>

                  <td style={{ padding: 10 }}>
                    {student.admission_no}
                  </td>

                  <td style={{ padding: 10 }}>
                    {[
                      student.first_name,
                      student.middle_name,
                      student.last_name
                    ].filter(Boolean).join(' ')}
                  </td>

                  <td style={{ padding: 10 }}>
                    {student.gender === 'Male'
                      ? 'Mwanaume'
                      : student.gender === 'Female'
                        ? 'Mwanamke'
                        : '—'}
                  </td>

                  <td style={{ padding: 10 }}>
                    {student.phone || '—'}
                  </td>

                  <td style={{ padding: 10 }}>
                    {student.admission_date || '—'}
                  </td>

                  <td style={{ padding: 10 }}>
                    {student.status || '—'}
                  </td>

                  <td style={{
                    padding: 10,
                    whiteSpace: 'nowrap'
                  }}>
                    <button
                      type="button"
                      onClick={() => startEdit(student)}
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
                      onClick={() => deleteStudent(student)}
                      disabled={deletingId === student.id}
                      style={{
                        ...buttonStyle,
                        padding: '8px 12px',
                        background: '#b42318'
                      }}
                    >
                      {deletingId === student.id
                        ? 'Inafuta...'
                        : 'Delete'}
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
