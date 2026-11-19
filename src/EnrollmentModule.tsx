
import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

type School = { id: string; school_name: string };
type SchoolClass = {
  id: string;
  school_id: string;
  class_name: string;
  education_level: string;
};
type Stream = { id: string; class_id: string; stream_name: string };
type AcademicYear = {
  id: string;
  school_id: string;
  year_name: string;
  is_current: boolean;
};
type Student = {
  id: string;
  school_id: string;
  admission_no: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  status: string | null;
};
type Enrollment = {
  id: string;
  student_id: string;
  class_id: string;
  stream_id: string | null;
  academic_year_id: string;
  accommodation_type: string;
  enrollment_date: string | null;
  status: string | null;
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 12,
  border: '1px solid #cbd5e1',
  borderRadius: 9,
  fontSize: 15,
  background: '#fff',
  boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  padding: '11px 16px',
  border: 0,
  borderRadius: 8,
  background: '#173b5e',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 15,
  padding: 20,
};

export default function EnrollmentModule() {
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [accommodationType, setAccommodationType] = useState('Day');

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [editing, setEditing] = useState<Enrollment | null>(null);
  const [editClassId, setEditClassId] = useState('');
  const [editStreamId, setEditStreamId] = useState('');
  const [editAccommodation, setEditAccommodation] = useState('Day');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const currentYear =
    years.find(y => y.school_id === schoolId && y.is_current) ||
    years.find(y => y.school_id === schoolId);

  const availableClasses = useMemo(
    () => classes.filter(c => c.school_id === schoolId),
    [classes, schoolId]
  );

  const availableStreams = useMemo(
    () => streams.filter(s => s.class_id === classId),
    [streams, classId]
  );

  const editStreams = useMemo(
    () => streams.filter(s => s.class_id === editClassId),
    [streams, editClassId]
  );

  const enrolledIds = useMemo(
    () => new Set(
      enrollments
        .filter(e => !e.status || e.status === 'Active')
        .map(e => e.student_id)
    ),
    [enrollments]
  );

  const availableStudents = useMemo(
    () => students.filter(s => !enrolledIds.has(s.id)),
    [students, enrolledIds]
  );

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();

    return availableStudents.filter(s =>
      [
        s.first_name,
        s.middle_name,
        s.last_name,
        s.admission_no,
      ].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [availableStudents, search]);

  const enrolledStudents = useMemo(
    () => students.filter(s => enrolledIds.has(s.id)),
    [students, enrolledIds]
  );

  async function loadInitial() {
    setLoading(true);
    setError('');

    try {
      const [schoolResult, classResult, streamResult, yearResult] =
        await Promise.all([
          supabase.from('schools')
            .select('id,school_name')
            .order('school_name'),

          supabase.from('classes')
            .select('id,school_id,class_name,education_level')
            .order('sort_order'),

          supabase.from('streams')
            .select('id,class_id,stream_name')
            .order('stream_name'),

          supabase.from('academic_years')
            .select('id,school_id,year_name,is_current')
            .order('year_name', { ascending: false }),
        ]);

      if (schoolResult.error) throw schoolResult.error;
      if (classResult.error) throw classResult.error;
      if (streamResult.error) throw streamResult.error;
      if (yearResult.error) throw yearResult.error;

      const schoolRows = (schoolResult.data || []) as School[];

      setSchools(schoolRows);
      setClasses((classResult.data || []) as SchoolClass[]);
      setStreams((streamResult.data || []) as Stream[]);
      setYears((yearResult.data || []) as AcademicYear[]);

      if (schoolRows.length) setSchoolId(schoolRows[0].id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInitial();
  }, []);

  async function loadClassData(
    selectedSchoolId = schoolId,
    selectedClassId = classId
  ) {
    if (!selectedSchoolId || !selectedClassId) {
      setStudents([]);
      setEnrollments([]);
      return;
    }

    const selectedYear =
      years.find(y =>
        y.school_id === selectedSchoolId && y.is_current
      ) ||
      years.find(y => y.school_id === selectedSchoolId);

    if (!selectedYear) {
      setError('Shule hii haina mwaka wa masomo uliosajiliwa.');
      return;
    }

    setLoading(true);
    setError('');
    setSelectedIds([]);

    try {
      const [studentResult, enrollmentResult] = await Promise.all([
        supabase.from('students')
          .select(
            'id,school_id,admission_no,first_name,middle_name,last_name,status'
          )
          .eq('school_id', selectedSchoolId)
          .order('first_name'),

        supabase.from('student_enrollments')
          .select(
            'id,student_id,class_id,stream_id,academic_year_id,accommodation_type,enrollment_date,status'
          )
          .eq('class_id', selectedClassId)
          .eq('academic_year_id', selectedYear.id),
      ]);

      if (studentResult.error) throw studentResult.error;
      if (enrollmentResult.error) throw enrollmentResult.error;

      setStudents((studentResult.data || []) as Student[]);
      setEnrollments((enrollmentResult.data || []) as Enrollment[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function changeSchool(id: string) {
    setSchoolId(id);
    setClassId('');
    setStreamId('');
    setStudents([]);
    setEnrollments([]);
    setSelectedIds([]);
    setEditing(null);
    setError('');
    setMessage('');
  }

  function changeClass(id: string) {
    setClassId(id);
    setStreamId('');
    setSelectedIds([]);
    setEditing(null);
    setMessage('');
    void loadClassData(schoolId, id);
  }

  function toggleStudent(id: string, checked: boolean) {
    setSelectedIds(previous =>
      checked
        ? [...new Set([...previous, id])]
        : previous.filter(x => x !== id)
    );
  }

  function selectAllVisible(checked: boolean) {
    const visible = filteredStudents.map(s => s.id);

    setSelectedIds(previous =>
      checked
        ? [...new Set([...previous, ...visible])]
        : previous.filter(id => !visible.includes(id))
    );
  }

  async function enrollStudents() {
    if (!schoolId || !classId || !currentYear) {
      setError('Chagua shule, darasa na mwaka wa masomo.');
      return;
    }

    if (!selectedIds.length) {
      setError('Chagua angalau mwanafunzi mmoja.');
      return;
    }

    if (!['Day', 'Boarding'].includes(accommodationType)) {
      setError('Chagua aina sahihi ya malazi.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const selectedClass = classes.find(c => c.id === classId);

      if (!selectedClass || selectedClass.school_id !== schoolId) {
        throw new Error('Darasa ulilochagua si la shule hii.');
      }

      const { data: selectedStudents, error: studentError } =
        await supabase.from('students')
          .select('id,school_id')
          .in('id', selectedIds);

      if (studentError) throw studentError;

      if (
        (selectedStudents || []).length !== selectedIds.length ||
        (selectedStudents || []).some(s => s.school_id !== schoolId)
      ) {
        throw new Error(
          'Mwanafunzi na darasa lazima viwe vya shule moja.'
        );
      }

      const { data: existing, error: checkError } =
        await supabase.from('student_enrollments')
          .select('student_id')
          .eq('class_id', classId)
          .eq('academic_year_id', currentYear.id)
          .in('student_id', selectedIds);

      if (checkError) throw checkError;

      const existingIds = new Set(
        (existing || []).map(row => row.student_id)
      );

      const newIds = selectedIds.filter(id => !existingIds.has(id));

      if (!newIds.length) {
        setMessage('Wanafunzi wote tayari wamesajiliwa kwenye darasa hili.');
        setSelectedIds([]);
        await loadClassData();
        return;
      }

      const payload = newIds.map(studentId => ({
        student_id: studentId,
        class_id: classId,
        stream_id: streamId || null,
        academic_year_id: currentYear.id,
        accommodation_type: accommodationType,
        enrollment_date: new Date().toISOString().slice(0, 10),
        status: 'Active',
      }));

      const { error: insertError } = await supabase
        .from('student_enrollments')
        .insert(payload);

      if (insertError) throw insertError;

      setMessage(
        `${newIds.length} mwanafunzi wameunganishwa na darasa.`
      );
      setSelectedIds([]);
      await loadClassData();
    } catch (e) {
      setError(`Imeshindikana: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(enrollment: Enrollment) {
    setEditing(enrollment);
    setEditClassId(enrollment.class_id);
    setEditStreamId(enrollment.stream_id || '');
    setEditAccommodation(enrollment.accommodation_type || 'Day');
    setError('');
    setMessage('');
  }

  async function saveEdit() {
    if (!editing) return;

    if (!editClassId) {
      setError('Chagua darasa.');
      return;
    }

    if (!['Day', 'Boarding'].includes(editAccommodation)) {
      setError('Chagua aina sahihi ya malazi.');
      return;
    }

    const targetClass = classes.find(c => c.id === editClassId);

    if (!targetClass || targetClass.school_id !== schoolId) {
      setError('Darasa ulilochagua si la shule hii.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const { data: duplicate, error: duplicateError } =
        await supabase.from('student_enrollments')
          .select('id')
          .eq('student_id', editing.student_id)
          .eq('class_id', editClassId)
          .eq('academic_year_id', editing.academic_year_id)
          .neq('id', editing.id);

      if (duplicateError) throw duplicateError;

      if (duplicate && duplicate.length > 0) {
        throw new Error(
          'Mwanafunzi huyu tayari amesajiliwa kwenye darasa hilo kwa mwaka huu.'
        );
      }

      const { error: updateError } = await supabase
        .from('student_enrollments')
        .update({
          class_id: editClassId,
          stream_id: editStreamId || null,
          accommodation_type: editAccommodation,
        })
        .eq('id', editing.id);

      if (updateError) throw updateError;

      setEditing(null);
      setMessage('Taarifa za usajili zimehaririwa kikamilifu.');
      await loadClassData();
    } catch (e) {
      setError(`Imeshindikana kuhariri: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function removeEnrollment(enrollment: Enrollment) {
    const student = students.find(s => s.id === enrollment.student_id);
    const name = student
      ? `${student.first_name} ${student.last_name}`
      : 'mwanafunzi huyu';

    if (!window.confirm(
      `Una uhakika unataka kumwondoa ${name} kwenye darasa hili?`
    )) return;

    setError('');
    setMessage('');
    setSaving(true);

    try {
      const { data, error } = await supabase
        .from('student_enrollments')
        .delete()
        .eq('id', enrollment.id)
        .select('id')
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          'Hakuna rekodi iliyofutwa. Huenda akaunti haina ruhusa ya DELETE (RLS), au usajili huu haupo tena.'
        );
      }

      setMessage('Mwanafunzi ameondolewa darasani kikamilifu.');
      await loadClassData();
    } catch (e) {
      setError(`Imeshindikana kuondoa darasani: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  function studentName(s: Student) {
    return [
      s.first_name,
      s.middle_name,
      s.last_name,
    ].filter(Boolean).join(' ');
  }

  return (
    <div style={{
      display: 'grid',
      gap: 20,
      color: '#243447',
      width: '100%',
      minWidth: 0,
    }}>
      <section style={cardStyle}>
        <h2 style={{ marginTop: 0, color: '#173b5e' }}>
          Usajili wa Wanafunzi Madarasani
        </h2>

        <p style={{ color: '#64748b' }}>
          Unganisha wanafunzi waliosajiliwa na madarasa yao.
          Huhitaji kusajili taarifa za mwanafunzi tena.
        </p>

        {error && (
          <div style={{
            background: '#fee2e2',
            color: '#991b1b',
            padding: 12,
            borderRadius: 8,
            marginBottom: 14,
            overflowWrap: 'anywhere',
          }}>
            {error}
          </div>
        )}

        {message && (
          <div style={{
            background: '#dcfce7',
            color: '#166534',
            padding: 12,
            borderRadius: 8,
            marginBottom: 14,
          }}>
            {message}
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
          gap: 14,
        }}>
          <label>
            <strong>Shule</strong>
            <select
              style={inputStyle}
              value={schoolId}
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

          <label>
            <strong>Darasa</strong>
            <select
              style={inputStyle}
              value={classId}
              onChange={e => changeClass(e.target.value)}
              disabled={!schoolId}
            >
              <option value="">Chagua darasa</option>
              {availableClasses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.class_name} ({c.education_level})
                </option>
              ))}
            </select>
          </label>

          <label>
            <strong>Mkondo</strong>
            <select
              style={inputStyle}
              value={streamId}
              onChange={e => setStreamId(e.target.value)}
              disabled={!classId}
            >
              <option value="">Bila mkondo / wote</option>
              {availableStreams.map(s => (
                <option key={s.id} value={s.id}>
                  {s.stream_name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <strong>Aina ya Malazi</strong>
            <select
              style={inputStyle}
              value={accommodationType}
              onChange={e => setAccommodationType(e.target.value)}
            >
              <option value="Day">Kutwa (Day)</option>
              <option value="Boarding">Bweni (Boarding)</option>
            </select>
          </label>
        </div>

        {schoolId && (
          <p style={{ color: '#475569', marginBottom: 0 }}>
            Mwaka wa masomo:{' '}
            <strong>{currentYear?.year_name || 'Haujapatikana'}</strong>
          </p>
        )}
      </section>

      {classId && (
        <>
          <section style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>
              Ongeza Wanafunzi Darasani
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))',
              gap: 12,
              marginBottom: 16,
            }}>
              <div>
                <strong>{students.length}</strong>
                <div style={{ color: '#64748b' }}>Wanafunzi wa shule</div>
              </div>
              <div>
                <strong>{enrolledStudents.length}</strong>
                <div style={{ color: '#64748b' }}>Waliopo darasani</div>
              </div>
              <div>
                <strong>{availableStudents.length}</strong>
                <div style={{ color: '#64748b' }}>Bado hawajaunganishwa</div>
              </div>
            </div>

            <input
              style={{ ...inputStyle, marginBottom: 14 }}
              placeholder="Tafuta kwa jina au namba ya usajili..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            {loading ? (
              <p>Inapakia wanafunzi...</p>
            ) : filteredStudents.length === 0 ? (
              <p style={{ color: '#64748b' }}>
                Hakuna wanafunzi wapya wa kuongezwa kwenye darasa hili.
              </p>
            ) : (
              <>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  marginBottom: 12,
                  fontWeight: 700,
                }}>
                  <input
                    type="checkbox"
                    checked={
                      filteredStudents.length > 0 &&
                      filteredStudents.every(s => selectedIds.includes(s.id))
                    }
                    onChange={e => selectAllVisible(e.target.checked)}
                  />
                  Chagua wote wanaoonekana
                </label>

                <div style={{
                  display: 'grid',
                  gap: 9,
                  maxHeight: 430,
                  overflowY: 'auto',
                }}>
                  {filteredStudents.map(student => (
                    <label
                      key={student.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: 12,
                        border: '1px solid #e2e8f0',
                        borderRadius: 9,
                        background: selectedIds.includes(student.id)
                          ? '#eff6ff'
                          : '#fff',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(student.id)}
                        onChange={e =>
                          toggleStudent(student.id, e.target.checked)
                        }
                      />
                      <span style={{ minWidth: 0 }}>
                        <strong>{studentName(student)}</strong>
                        <span style={{
                          display: 'block',
                          color: '#64748b',
                          fontSize: 13,
                        }}>
                          {student.admission_no}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  style={{ ...buttonStyle, marginTop: 17 }}
                  disabled={
                    saving || selectedIds.length === 0 || !currentYear
                  }
                  onClick={() => void enrollStudents()}
                >
                  {saving
                    ? 'Inasajili...'
                    : `Sajili Darasani (${selectedIds.length})`}
                </button>
              </>
            )}
          </section>

          <section style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>
              Wanafunzi Waliopo Darasani ({enrolledStudents.length})
            </h3>

            {enrolledStudents.length === 0 ? (
              <p style={{ color: '#64748b' }}>
                Hakuna mwanafunzi aliyeunganishwa na darasa hili bado.
              </p>
            ) : (
              <div style={{
                display: 'flex',
                gap: 12,
                overflowX: 'auto',
                overflowY: 'hidden',
                paddingBottom: 10,
                width: '100%',
                maxWidth: '100%',
                WebkitOverflowScrolling: 'touch',
                scrollSnapType: 'x proximity',
              }}>
                {enrollments
                  .filter(e => !e.status || e.status === 'Active')
                  .map(enrollment => {
                    const student = students.find(
                      s => s.id === enrollment.student_id
                    );

                    if (!student) return null;

                    return (
                      <div
                        key={enrollment.id}
                        style={{
                          display: 'grid',
                          alignContent: 'start',
                          gap: 10,
                          border: '1px solid #e2e8f0',
                          borderRadius: 9,
                          padding: 12,
                          flex: '0 0 280px',
                          minWidth: 260,
                          maxWidth: '85vw',
                          boxSizing: 'border-box',
                          scrollSnapAlign: 'start',
                        }}
                      >
                        <div>
                          <strong>{studentName(student)}</strong>
                          <div style={{
                            color: '#64748b',
                            fontSize: 13,
                          }}>
                            {student.admission_no}
                          </div>
                          <div style={{
                            color: '#64748b',
                            fontSize: 13,
                          }}>
                            Malazi: {enrollment.accommodation_type === 'Boarding'
                              ? 'Bweni'
                              : 'Kutwa'}
                          </div>
                        </div>

                        {editing?.id === enrollment.id ? (
                          <div style={{
                            display: 'grid',
                            gap: 10,
                            background: '#f8fafc',
                            padding: 12,
                            borderRadius: 8,
                          }}>
                            <label>
                              <strong>Darasa</strong>
                              <select
                                style={inputStyle}
                                value={editClassId}
                                onChange={e => {
                                  setEditClassId(e.target.value);
                                  setEditStreamId('');
                                }}
                              >
                                {availableClasses.map(c => (
                                  <option key={c.id} value={c.id}>
                                    {c.class_name}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label>
                              <strong>Mkondo</strong>
                              <select
                                style={inputStyle}
                                value={editStreamId}
                                onChange={e => setEditStreamId(e.target.value)}
                              >
                                <option value="">Bila mkondo</option>
                                {editStreams.map(s => (
                                  <option key={s.id} value={s.id}>
                                    {s.stream_name}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label>
                              <strong>Aina ya Malazi</strong>
                              <select
                                style={inputStyle}
                                value={editAccommodation}
                                onChange={e =>
                                  setEditAccommodation(e.target.value)
                                }
                              >
                                <option value="Day">Kutwa (Day)</option>
                                <option value="Boarding">Bweni (Boarding)</option>
                              </select>
                            </label>

                            <div style={{
                              display: 'flex',
                              gap: 8,
                              flexWrap: 'wrap',
                            }}>
                              <button
                                type="button"
                                style={buttonStyle}
                                disabled={saving}
                                onClick={() => void saveEdit()}
                              >
                                {saving ? 'Inahifadhi...' : 'Hifadhi Mabadiliko'}
                              </button>

                              <button
                                type="button"
                                style={{
                                  ...buttonStyle,
                                  background: '#64748b',
                                }}
                                onClick={() => setEditing(null)}
                              >
                                Ghairi
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            display: 'flex',
                            gap: 8,
                            flexWrap: 'wrap',
                          }}>
                            <button
                              type="button"
                              style={buttonStyle}
                              onClick={() => startEdit(enrollment)}
                            >
                              Hariri
                            </button>

                            <button
                              type="button"
                              style={{
                                ...buttonStyle,
                                background: '#fee2e2',
                                color: '#b91c1c',
                              }}
                              onClick={() => void removeEnrollment(enrollment)}
                            >
                              Ondoa Darasani
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </section>
        </>
      )}

      {!classId && (
        <div style={{
          background: '#eff6ff',
          color: '#1e40af',
          padding: 15,
          borderRadius: 10,
        }}>
          Chagua shule na darasa ili kuanza kuunganisha wanafunzi.
        </div>
      )}
    </div>
  );
}
