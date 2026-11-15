
import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

type School = {
  id: string;
  school_name: string;
};

type SchoolClass = {
  id: string;
  school_id: string;
  class_name: string;
  education_level: string;
};

type Stream = {
  id: string;
  class_id: string;
  stream_name: string;
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

export default function EnrollmentModule() {
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const availableClasses = useMemo(
    () => classes.filter(c => c.school_id === schoolId),
    [classes, schoolId]
  );

  const availableStreams = useMemo(
    () => streams.filter(s => s.class_id === classId),
    [streams, classId]
  );

  const enrolledIds = useMemo(
    () => new Set(
      enrollments
        .filter(e => !e.status || e.status.toLowerCase() === 'active')
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

    return availableStudents.filter(s => {
      const name = [
        s.first_name,
        s.middle_name,
        s.last_name,
        s.admission_no,
      ].filter(Boolean).join(' ').toLowerCase();

      return !q || name.includes(q);
    });
  }, [availableStudents, search]);

  const enrolledStudents = useMemo(
    () => students.filter(s => enrolledIds.has(s.id)),
    [students, enrolledIds]
  );

  async function loadInitial() {
    if (!supabase) {
      setError('Supabase haijaunganishwa.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [schoolResult, classResult, streamResult] = await Promise.all([
        supabase.from('schools')
          .select('id,school_name')
          .order('school_name'),

        supabase.from('classes')
          .select('id,school_id,class_name,education_level')
          .order('sort_order'),

        supabase.from('streams')
          .select('id,class_id,stream_name')
          .order('stream_name'),
      ]);

      if (schoolResult.error) throw schoolResult.error;
      if (classResult.error) throw classResult.error;
      if (streamResult.error) throw streamResult.error;

      const schoolRows = (schoolResult.data || []) as School[];

      setSchools(schoolRows);
      setClasses((classResult.data || []) as SchoolClass[]);
      setStreams((streamResult.data || []) as Stream[]);

      if (schoolRows.length) {
        setSchoolId(schoolRows[0].id);
      }
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
    if (!supabase || !selectedSchoolId || !selectedClassId) {
      setStudents([]);
      setEnrollments([]);
      return;
    }

    setLoading(true);
    setError('');
    setSelectedIds([]);

    try {
      const [studentResult, enrollmentResult] = await Promise.all([
        supabase.from('students')
          .select('id,school_id,admission_no,first_name,middle_name,last_name,status')
          .eq('school_id', selectedSchoolId)
          .order('first_name'),

        supabase.from('student_enrollments')
          .select('id,student_id,class_id,stream_id,status')
          .eq('class_id', selectedClassId),
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
    setError('');
    setMessage('');
  }

  function changeClass(id: string) {
    setClassId(id);
    setStreamId('');
    setSelectedIds([]);
    setMessage('');
    void loadClassData(schoolId, id);
  }

  function toggleStudent(id: string, checked: boolean) {
    setSelectedIds(previous =>
      checked
        ? [...previous, id]
        : previous.filter(item => item !== id)
    );
  }

  function selectAllVisible(checked: boolean) {
    if (checked) {
      setSelectedIds(previous => [
        ...new Set([
          ...previous,
          ...filteredStudents.map(s => s.id),
        ]),
      ]);
    } else {
      const visibleIds = new Set(filteredStudents.map(s => s.id));
      setSelectedIds(previous =>
        previous.filter(id => !visibleIds.has(id))
      );
    }
  }

  async function enrollStudents() {
    if (!supabase || !schoolId || !classId) {
      setError('Chagua shule na darasa kwanza.');
      return;
    }

    if (!selectedIds.length) {
      setError('Chagua angalau mwanafunzi mmoja.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      // Hakikisha wanafunzi hawajaunganishwa tayari na darasa hili.
      const { data: existing, error: checkError } = await supabase
        .from('student_enrollments')
        .select('student_id')
        .eq('class_id', classId)
        .in('student_id', selectedIds);

      if (checkError) throw checkError;

      const existingIds = new Set(
        (existing || []).map(row => row.student_id)
      );

      const newIds = selectedIds.filter(id => !existingIds.has(id));

      if (!newIds.length) {
        setMessage('Wanafunzi wote uliochagua tayari wapo kwenye darasa hili.');
        setSelectedIds([]);
        await loadClassData();
        return;
      }

      const payload = newIds.map(studentId => ({
        student_id: studentId,
        class_id: classId,
        stream_id: streamId || null,
        status: 'Active',
      }));

      const { error: insertError } = await supabase
        .from('student_enrollments')
        .insert(payload);

      if (insertError) throw insertError;

      setMessage(
        `${newIds.length} mwanafunzi wameunganishwa na darasa kikamilifu.`
      );

      setSelectedIds([]);
      await loadClassData();
    } catch (e) {
      setError(
        `Imeshindikana kusajili wanafunzi: ${(e as Error).message}`
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeEnrollment(enrollment: Enrollment) {
    if (!supabase) return;

    const student = students.find(
      s => s.id === enrollment.student_id
    );

    const name = student
      ? `${student.first_name} ${student.last_name}`
      : 'mwanafunzi huyu';

    if (!window.confirm(
      `Una uhakika unataka kumwondoa ${name} kwenye darasa hili?`
    )) return;

    setError('');
    setMessage('');

    const { error } = await supabase
      .from('student_enrollments')
      .delete()
      .eq('id', enrollment.id);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage('Mwanafunzi ameondolewa kwenye darasa.');
    await loadClassData();
  }

  function studentName(student: Student) {
    return [
      student.first_name,
      student.middle_name,
      student.last_name,
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
      <section style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 15,
        padding: 20,
      }}>
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
        </div>
      </section>

      {classId && (
        <>
          <section style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 15,
            padding: 20,
          }}>
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
                        onChange={e => toggleStudent(
                          student.id,
                          e.target.checked
                        )}
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
                  disabled={saving || selectedIds.length === 0}
                  onClick={() => void enrollStudents()}
                >
                  {saving
                    ? 'Inasajili...'
                    : `Sajili Darasani (${selectedIds.length})`}
                </button>
              </>
            )}
          </section>

          <section style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 15,
            padding: 20,
          }}>
            <h3 style={{ marginTop: 0 }}>
              Wanafunzi Waliopo Darasani ({enrolledStudents.length})
            </h3>

            {enrolledStudents.length === 0 ? (
              <p style={{ color: '#64748b' }}>
                Hakuna mwanafunzi aliyeunganishwa na darasa hili bado.
              </p>
            ) : (
              <div style={{
                display: 'grid',
                gap: 10,
              }}>
                {enrollments
                  .filter(e =>
                    !e.status || e.status.toLowerCase() === 'active'
                  )
                  .map(enrollment => {
                    const student = students.find(
                      s => s.id === enrollment.student_id
                    );

                    if (!student) return null;

                    return (
                      <div
                        key={enrollment.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 12,
                          flexWrap: 'wrap',
                          border: '1px solid #e2e8f0',
                          borderRadius: 9,
                          padding: 12,
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
                        </div>

                        <button
                          type="button"
                          onClick={() => void removeEnrollment(enrollment)}
                          style={{
                            ...buttonStyle,
                            background: '#fee2e2',
                            color: '#b91c1c',
                          }}
                        >
                          Ondoa Darasani
                        </button>
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
