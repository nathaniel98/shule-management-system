
import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

type School = { id: string; school_name: string };
type Exam = {
  id: string;
  school_id: string;
  academic_year_id: string;
  class_id: string;
  exam_name: string;
  exam_type: string;
  term: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  status: string;
  stream_id: string | null;
};

type ExamSubject = {
  id: string;
  exam_id: string;
  subject_id: string;
  maximum_marks: number;
  subject_name?: string;
};

type Enrollment = {
  id: string;
  student_id: string;
  class_id: string;
  stream_id: string | null;
  status: string;
};

type Student = {
  id: string;
  admission_no: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
};

type Result = {
  id: string;
  exam_subject_id: string;
  enrollment_id: string;
  marks_obtained: number | null;
  is_absent: boolean;
  remarks: string | null;
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

export default function ResultsModule() {
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [examSubjects, setExamSubjects] = useState<ExamSubject[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<Result[]>([]);

  const [examId, setExamId] = useState('');
  const [examSubjectId, setExamSubjectId] = useState('');
  const [search, setSearch] = useState('');
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [absent, setAbsent] = useState<Record<string, boolean>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedExam = exams.find(e => e.id === examId);
  const selectedSubject = examSubjects.find(s => s.id === examSubjectId);

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
          await loadExams(rows[0].id);
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

  async function loadExams(id: string) {
    if (!supabase || !id) return;

    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .eq('school_id', id)
      .order('start_date', { ascending: false });

    if (error) throw error;
    setExams((data || []) as Exam[]);
    setExamId('');
    setExamSubjectId('');
    setExamSubjects([]);
    setEnrollments([]);
    setStudents([]);
    setResults([]);
  }

  async function changeSchool(id: string) {
    setSchoolId(id);
    setError('');
    setNotice('');
    setLoading(true);

    try {
      await loadExams(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function selectExam(id: string) {
    setExamId(id);
    setExamSubjectId('');
    setExamSubjects([]);
    setEnrollments([]);
    setStudents([]);
    setResults([]);
    setMarks({});
    setAbsent({});
    setRemarks({});
    setError('');
    setNotice('');

    if (!supabase || !id) return;

    setLoading(true);

    try {
      const exam = exams.find(e => e.id === id);
      if (!exam) return;

      const { data: subjectRows, error: subjectError } = await supabase
        .from('exam_subjects')
        .select('id,exam_id,subject_id,maximum_marks')
        .eq('exam_id', id);

      if (subjectError) throw subjectError;

      const rawSubjects = subjectRows || [];
      const subjectIds = rawSubjects.map(s => s.subject_id);

      let subjectNames: Record<string, string> = {};

      if (subjectIds.length) {
        const { data: names, error: namesError } = await supabase
          .from('subjects')
          .select('id,subject_name')
          .in('id', subjectIds);

        if (namesError) throw namesError;

        (names || []).forEach(s => {
          subjectNames[s.id] = s.subject_name;
        });
      }

      setExamSubjects(rawSubjects.map(s => ({
        ...s,
        subject_name: subjectNames[s.subject_id] || 'Somo lisilojulikana'
      })) as ExamSubject[]);

      const { data: enrollmentRows, error: enrollmentError } = await supabase
        .from('student_enrollments')
        .select('id,student_id,class_id,stream_id,status')
        .eq('class_id', exam.class_id);

      if (enrollmentError) throw enrollmentError;

      const activeEnrollments = (enrollmentRows || []).filter(
        (row: Enrollment) => !row.status || row.status.toLowerCase() === 'active'
      );

      setEnrollments(activeEnrollments as Enrollment[]);

      const studentIds = activeEnrollments.map(
        (row: Enrollment) => row.student_id
      );

      if (studentIds.length) {
        const { data: studentRows, error: studentError } = await supabase
          .from('students')
          .select('id,admission_no,first_name,middle_name,last_name')
          .in('id', studentIds)
          .order('first_name');

        if (studentError) throw studentError;
        setStudents((studentRows || []) as Student[]);
      }

    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function selectSubject(id: string) {
    setExamSubjectId(id);
    setResults([]);
    setMarks({});
    setAbsent({});
    setRemarks({});
    setError('');
    setNotice('');

    if (!supabase || !id) return;

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('student_results')
        .select('id,exam_subject_id,enrollment_id,marks_obtained,is_absent,remarks')
        .eq('exam_subject_id', id);

      if (error) throw error;

      const rows = (data || []) as Result[];
      setResults(rows);

      const markValues: Record<string, string> = {};
      const absentValues: Record<string, boolean> = {};
      const remarkValues: Record<string, string> = {};

      rows.forEach(row => {
        markValues[row.enrollment_id] =
          row.marks_obtained === null ? '' : String(row.marks_obtained);
        absentValues[row.enrollment_id] = row.is_absent;
        remarkValues[row.enrollment_id] = row.remarks || '';
      });

      setMarks(markValues);
      setAbsent(absentValues);
      setRemarks(remarkValues);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function saveResults() {
    if (!supabase || !examSubjectId || !selectedSubject) {
      setError('Chagua mtihani na somo kwanza.');
      return;
    }

    if (!enrollments.length) {
      setError('Hakuna wanafunzi waliosajiliwa kwenye darasa hili.');
      return;
    }

    const maximum = Number(selectedSubject.maximum_marks);

    for (const enrollment of enrollments) {
      if (absent[enrollment.id]) continue;

      const value = marks[enrollment.id];

      if (value === undefined || value.trim() === '') {
        setError('Jaza alama za wanafunzi wote au weka alama ya Hayupo.');
        return;
      }

      const number = Number(value);

      if (!Number.isFinite(number) || number < 0 || number > maximum) {
        setError(`Alama ziwe kati ya 0 na ${maximum}.`);
        return;
      }
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const payload = enrollments.map(enrollment => ({
        exam_subject_id: examSubjectId,
        enrollment_id: enrollment.id,
        marks_obtained: absent[enrollment.id]
          ? null
          : Number(marks[enrollment.id]),
        is_absent: Boolean(absent[enrollment.id]),
        remarks: remarks[enrollment.id]?.trim() || null
      }));

      const { error } = await supabase
        .from('student_results')
        .upsert(payload, {
          onConflict: 'exam_subject_id,enrollment_id'
        });

      if (error) throw error;

      setNotice('Matokeo yamehifadhiwa kikamilifu.');
      await selectSubject(examSubjectId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteResult(enrollmentId: string) {
    if (!supabase || !examSubjectId) return;

    if (!window.confirm('Una uhakika unataka kufuta alama za mwanafunzi huyu?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('student_results')
        .delete()
        .eq('exam_subject_id', examSubjectId)
        .eq('enrollment_id', enrollmentId);

      if (error) throw error;

      setResults(current => current.filter(
        r => r.enrollment_id !== enrollmentId
      ));

      setMarks(current => ({ ...current, [enrollmentId]: '' }));
      setAbsent(current => ({ ...current, [enrollmentId]: false }));
      setRemarks(current => ({ ...current, [enrollmentId]: '' }));
      setNotice('Matokeo ya mwanafunzi yamefutwa.');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function studentName(student: Student) {
    return [
      student.first_name,
      student.middle_name,
      student.last_name
    ].filter(Boolean).join(' ');
  }

  function grade(mark: number, maximum: number) {
    const percentage = maximum > 0 ? (mark / maximum) * 100 : 0;

    if (percentage >= 80) return 'A';
    if (percentage >= 65) return 'B';
    if (percentage >= 45) return 'C';
    if (percentage >= 30) return 'D';
    return 'F';
  }

  const visibleStudents = useMemo(() => {
    const q = search.trim().toLowerCase();

    return students.filter(student => {
      const name = studentName(student).toLowerCase();
      return !q ||
        name.includes(q) ||
        student.admission_no.toLowerCase().includes(q);
    });
  }, [students, search]);

  const enteredCount = enrollments.filter(e =>
    marks[e.id] !== undefined && marks[e.id] !== ''
  ).length + enrollments.filter(e => absent[e.id]).length;

  const average = useMemo(() => {
    const values = enrollments
      .filter(e => !absent[e.id] && marks[e.id] !== undefined && marks[e.id] !== '')
      .map(e => Number(marks[e.id]))
      .filter(n => Number.isFinite(n));

    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }, [enrollments, marks, absent]);

  return (
    <div className="results-module">
      <style>{`
        .results-module {
          display: grid;
          gap: 18px;
          width: 100%;
          min-width: 0;
          color: #243447;
        }

        .results-card {
          background: white;
          padding: 20px;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          min-width: 0;
        }

        .results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit,minmax(190px,1fr));
          gap: 14px;
        }

        .results-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }

        .results-table th,
        .results-table td {
          padding: 11px;
          border-bottom: 1px solid #e2e8f0;
          text-align: left;
          vertical-align: middle;
        }

        .results-table th {
          background: #f8fafc;
        }

        .results-table input {
          width: 85px;
          box-sizing: border-box;
          padding: 9px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
        }

        .results-mobile {
          display: none;
        }

        .results-student-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 13px;
          margin-top: 12px;
          display: grid;
          gap: 11px;
        }

        .results-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        @media(max-width:650px) {
          .results-card {
            padding: 14px;
          }

          .results-card h2 {
            font-size: 20px;
          }

          .results-desktop {
            display: none;
          }

          .results-mobile {
            display: block;
          }
        }
      `}</style>

      <section className="results-card">
        <h2>Usimamizi wa Matokeo</h2>
        <p>Chagua mtihani na somo ili kuingiza au kurekebisha alama.</p>

        {error && <p style={{ color: '#b42318' }}>{error}</p>}
        {notice && <p style={{ color: '#16845b', fontWeight: 700 }}>{notice}</p>}

        <div className="results-grid">
          <label>
            Shule
            <select
              style={inputStyle}
              value={schoolId}
              onChange={e => changeSchool(e.target.value)}
            >
              <option value="">Chagua shule</option>
              {schools.map(s => (
                <option key={s.id} value={s.id}>{s.school_name}</option>
              ))}
            </select>
          </label>

          <label>
            Mtihani
            <select
              style={inputStyle}
              value={examId}
              onChange={e => selectExam(e.target.value)}
            >
              <option value="">Chagua mtihani</option>
              {exams.map(e => (
                <option key={e.id} value={e.id}>
                  {e.exam_name} {e.academic_year ? `- ${e.academic_year}` : ''}
                </option>
              ))}
            </select>
          </label>

          <label>
            Somo
            <select
              style={inputStyle}
              value={examSubjectId}
              disabled={!examId}
              onChange={e => selectSubject(e.target.value)}
            >
              <option value="">Chagua somo</option>
              {examSubjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.subject_name} (Jumla: {s.maximum_marks})
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedExam && (
          <div style={{
            marginTop: 15,
            padding: 13,
            background: '#f1f5f9',
            borderRadius: 10
          }}>
            <strong>{selectedExam.exam_name}</strong>
            <p style={{ margin: '6px 0' }}>
              Mwaka: {selectedExam.academic_year || '-'} |
              Aina: {selectedExam.exam_type || '-'} |
              Muhula: {selectedExam.term || '-'}
            </p>
          </div>
        )}
      </section>

      {examSubjectId && selectedSubject && (
        <section className="results-card">
          <h2>Ingiza Alama za Wanafunzi</h2>

          <div className="results-grid">
            <div>
              <strong>Wanafunzi: {enrollments.length}</strong>
            </div>
            <div>
              <strong>Walioingiziwa: {enteredCount}</strong>
            </div>
            <div>
              <strong>Wastani wa alama: {average.toFixed(2)}</strong>
            </div>
          </div>

          <input
            style={{ ...inputStyle, marginTop: 15 }}
            placeholder="Tafuta mwanafunzi kwa jina au admission number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {loading ? <p>Inapakia...</p> :
            visibleStudents.length === 0 ? (
              <p>Hakuna wanafunzi waliopatikana.</p>
            ) : (
              <>
                <div className="results-desktop">
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th>Na.</th>
                        <th>Admission No.</th>
                        <th>Jina la mwanafunzi</th>
                        <th>Alama / {selectedSubject.maximum_marks}</th>
                        <th>Grade</th>
                        <th>Hayupo</th>
                        <th>Maoni</th>
                        <th>Vitendo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleStudents.map((student, index) => {
                        const enrollment = enrollments.find(
                          e => e.student_id === student.id
                        );
                        if (!enrollment) return null;

                        const value = marks[enrollment.id] || '';
                        const isAbsent = Boolean(absent[enrollment.id]);
                        const saved = results.some(
                          r => r.enrollment_id === enrollment.id
                        );

                        return (
                          <tr key={student.id}>
                            <td>{index + 1}</td>
                            <td>{student.admission_no}</td>
                            <td>{studentName(student)}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max={selectedSubject.maximum_marks}
                                disabled={isAbsent}
                                value={value}
                                onChange={e => setMarks(current => ({
                                  ...current,
                                  [enrollment.id]: e.target.value
                                }))}
                              />
                            </td>
                            <td>
                              {value !== '' && !isAbsent
                                ? grade(Number(value), Number(selectedSubject.maximum_marks))
                                : isAbsent ? 'ABS' : '-'}
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                checked={isAbsent}
                                onChange={e => setAbsent(current => ({
                                  ...current,
                                  [enrollment.id]: e.target.checked
                                }))}
                              />
                            </td>
                            <td>
                              <input
                                style={{ width: 120 }}
                                value={remarks[enrollment.id] || ''}
                                onChange={e => setRemarks(current => ({
                                  ...current,
                                  [enrollment.id]: e.target.value
                                }))}
                              />
                            </td>
                            <td>
                              {saved && (
                                <button
                                  style={{ ...buttonStyle, background: '#b42318' }}
                                  onClick={() => deleteResult(enrollment.id)}
                                >
                                  Futa
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="results-mobile">
                  {visibleStudents.map((student, index) => {
                    const enrollment = enrollments.find(
                      e => e.student_id === student.id
                    );
                    if (!enrollment) return null;

                    const value = marks[enrollment.id] || '';
                    const isAbsent = Boolean(absent[enrollment.id]);
                    const saved = results.some(
                      r => r.enrollment_id === enrollment.id
                    );

                    return (
                      <div className="results-student-card" key={student.id}>
                        <strong>{index + 1}. {studentName(student)}</strong>
                        <span>Admission: {student.admission_no}</span>

                        <label>
                          Alama / {selectedSubject.maximum_marks}
                          <input
                            type="number"
                            min="0"
                            max={selectedSubject.maximum_marks}
                            disabled={isAbsent}
                            value={value}
                            onChange={e => setMarks(current => ({
                              ...current,
                              [enrollment.id]: e.target.value
                            }))}
                          />
                        </label>

                        <label>
                          <input
                            type="checkbox"
                            checked={isAbsent}
                            onChange={e => setAbsent(current => ({
                              ...current,
                              [enrollment.id]: e.target.checked
                            }))}
                          />
                          Mwanafunzi hayupo
                        </label>

                        <label>
                          Maoni
                          <input
                            style={{ ...inputStyle, width: '100%' }}
                            value={remarks[enrollment.id] || ''}
                            onChange={e => setRemarks(current => ({
                              ...current,
                              [enrollment.id]: e.target.value
                            }))}
                          />
                        </label>

                        <div>
                          <strong>Grade: </strong>
                          {isAbsent ? 'ABS' : value !== ''
                            ? grade(Number(value), Number(selectedSubject.maximum_marks))
                            : '-'}
                        </div>

                        {saved && (
                          <button
                            style={{ ...buttonStyle, background: '#b42318' }}
                            onClick={() => deleteResult(enrollment.id)}
                          >
                            Futa matokeo
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="results-actions" style={{ marginTop: 18 }}>
                  <button
                    style={buttonStyle}
                    disabled={saving || loading}
                    onClick={saveResults}
                  >
                    {saving ? 'Inahifadhi...' : 'Hifadhi Matokeo'}
                  </button>
                </div>
              </>
            )}
        </section>
      )}

      {!loading && examId && examSubjects.length === 0 && (
        <section className="results-card">
          Hakuna masomo yaliyounganishwa na mtihani huu.
        </section>
      )}

      {!loading && exams.length === 0 && (
        <section className="results-card">
          Hakuna mitihani iliyosajiliwa kwenye shule hii.
        </section>
      )}
    </div>
  );
}
