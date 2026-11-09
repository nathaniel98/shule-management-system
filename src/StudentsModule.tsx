
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from './supabase';

type School = {
  id: string;
  school_name: string;
  school_code?: string;
};

type Student = {
  id: string;
  school_id: string;
  admission_no: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  gender?: string | null;
  date_of_birth?: string | null;
  photo_url?: string | null;
  phone?: string | null;
  address?: string | null;
  admission_date?: string | null;
  status?: string | null;
  photo_display?: string | null;
};

const BUCKET = 'student-photos';

const emptyForm = {
  admission_no: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  gender: '',
  date_of_birth: '',
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
  const [form, setForm] = useState(emptyForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  async function getPhotoUrl(path?: string | null) {
    if (!path) return null;

    // Backward compatibility for previously saved full URLs.
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600);

    if (error) {
      console.error('Photo URL error:', error.message);
      return null;
    }

    return data.signedUrl;
  }

  async function loadStudents(id = schoolId) {
    if (!id) {
      setStudents([]);
      return;
    }

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = (data || []) as Student[];

    const withPhotos = await Promise.all(
      rows.map(async student => ({
        ...student,
        photo_display: await getPhotoUrl(student.photo_url)
      }))
    );

    setStudents(withPhotos);
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

          const { data: studentData, error: studentError } =
            await supabase
              .from('students')
              .select('*')
              .eq('school_id', rows[0].id)
              .order('created_at', { ascending: false });

          if (studentError) throw studentError;

          const studentRows = (studentData || []) as Student[];

          const withPhotos = await Promise.all(
            studentRows.map(async student => ({
              ...student,
              photo_display: await getPhotoUrl(student.photo_url)
            }))
          );

          if (active) setStudents(withPhotos);
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
    setPhotoFile(null);
    setPhotoPreview('');
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

  function choosePhoto(file?: File) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Chagua picha yenye mfumo wa JPG, PNG au picha nyingine.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Picha isiwe kubwa kuliko MB 5.');
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError('');
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
      phone: student.phone || '',
      address: student.address || '',
      admission_date: student.admission_date || '',
      status: student.status || 'Active'
    });

    setPhotoFile(null);
    setPhotoPreview(student.photo_display || '');
    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setPhotoFile(null);
    setPhotoPreview('');
    setError('');
    setMessage('');
  }

  async function uploadPhoto(): Promise<string | null> {
    if (!photoFile) return null;

    const extension =
      photoFile.name.split('.').pop()?.toLowerCase() || 'jpg';

    const filePath =
      `${schoolId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, photoFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: photoFile.type
      });

    if (error) throw error;

    return filePath;
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

    let uploadedPath: string | null = null;

    try {
      if (photoFile) {
        uploadedPath = await uploadPhoto();
      }

      const payload: Record<string, unknown> = {
        school_id: schoolId,
        admission_no: form.admission_no.trim(),
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim() || null,
        last_name: form.last_name.trim(),
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        admission_date: form.admission_date || null,
        status: form.status
      };

      if (uploadedPath) {
        payload.photo_url = uploadedPath;
      } else if (!editingId) {
        payload.photo_url = null;
      }

      let result;

      if (editingId) {
        result = await supabase
          .from('students')
          .update(payload)
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
      setPhotoFile(null);
      setPhotoPreview('');

      await loadStudents(schoolId);
    } catch (e) {
      const err = e as { message?: string; code?: string };

      // Remove newly uploaded file if the database save failed.
      if (uploadedPath) {
        await supabase.storage
          .from(BUCKET)
          .remove([uploadedPath]);
      }

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
      `Una uhakika unataka kumfuta ${fullName} (${student.admission_no})? Kitendo hiki hakiwezi kurejeshwa.`
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

      // Remove the student's stored photo after deleting the record.
      if (
        student.photo_url &&
        !student.photo_url.startsWith('http://') &&
        !student.photo_url.startsWith('https://')
      ) {
        const { error: photoError } = await supabase.storage
          .from(BUCKET)
          .remove([student.photo_url]);

        if (photoError) {
          console.error('Photo deletion error:', photoError.message);
        }
      }

      setStudents(current =>
        current.filter(item => item.id !== student.id)
      );

      if (editingId === student.id) {
        cancelEdit();
      }

      setMessage(`${fullName} amefutwa kikamilifu.`);
    } catch (e) {
      const err = e as { message?: string };
      setError(err.message || 'Imeshindikana kufuta mwanafunzi.');
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
    const name = [
      student.first_name,
      student.middle_name,
      student.last_name,
      student.admission_no,
      student.phone
    ].filter(Boolean).join(' ').toLowerCase();

    return name.includes(search.toLowerCase());
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
          Sajili wanafunzi na uhifadhi taarifa pamoja na picha zao.
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
                Picha ya mwanafunzi
                <input
                  style={inputStyle}
                  type="file"
                  accept="image/*"
                  onChange={e => choosePhoto(e.target.files?.[0])}
                />
                <span style={{
                  color: '#64748b',
                  fontSize: 12,
                  fontWeight: 400
                }}>
                  Ruhusa: JPG, PNG na picha nyingine. Upeo MB 5.
                </span>
              </label>

              {photoPreview && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <img
                    src={photoPreview}
                    alt="Picha ya mwanafunzi"
                    style={{
                      width: 90,
                      height: 90,
                      objectFit: 'cover',
                      borderRadius: 12,
                      border: '1px solid #cbd5e1'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoPreview('');
                    }}
                    style={{
                      ...buttonStyle,
                      background: '#64748b'
                    }}
                  >
                    Ondoa picha
                  </button>
                </div>
              )}

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
                  <td style={{
                    padding: 10,
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    {student.photo_display ? (
                      <img
                        src={student.photo_display}
                        alt="Picha"
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 8,
                          objectFit: 'cover'
                        }}
                      />
                    ) : '—'}
                  </td>

                  <td style={{
                    padding: 10,
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    {student.admission_no}
                  </td>

                  <td style={{
                    padding: 10,
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    {[
                      student.first_name,
                      student.middle_name,
                      student.last_name
                    ].filter(Boolean).join(' ')}
                  </td>

                  <td style={{
                    padding: 10,
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    {student.gender === 'Male'
                      ? 'Mwanaume'
                      : student.gender === 'Female'
                        ? 'Mwanamke'
                        : '—'}
                  </td>

                  <td style={{
                    padding: 10,
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    {student.phone || '—'}
                  </td>

                  <td style={{
                    padding: 10,
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    {student.admission_date || '—'}
                  </td>

                  <td style={{
                    padding: 10,
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    {student.status || '—'}
                  </td>

                  <td style={{
                    padding: 10,
                    borderBottom: '1px solid #e2e8f0',
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
