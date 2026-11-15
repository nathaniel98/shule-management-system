
import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

type School = { id: string; school_name: string };
type Exam = {
  id: string; school_id: string; academic_year_id: string;
  class_id: string; stream_id: string | null; exam_name: string;
  academic_year: string; exam_type: string; term: string;
};
type Subject = {
  id: string; subject_id: string; subject_name: string;
  maximum_marks: number;
};
type Enrollment = {
  id: string; student_id: string; class_id: string;
  stream_id: string | null; academic_year_id: string;
};
type Student = {
  id: string; admission_no: string; first_name: string;
  middle_name: string | null; last_name: string;
};
type Result = {
  id: string; exam_subject_id: string; enrollment_id: string;
  marks_obtained: number | null; is_absent: boolean;
};
type ReportRow = {
  enrollment: Enrollment; student: Student; total: number;
  maximum: number; average: number; grade: string;
  entered: number; absent: number; position: number | null;
  marks: Record<string, number | null>;
};

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 14,
  padding: 'clamp(12px, 3vw, 20px)',
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
};

const field: React.CSSProperties = {
  display: 'block',
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  padding: 12,
  border: '1px solid #cbd5e1',
  borderRadius: 9,
  fontSize: 15,
  background: '#fff',
  marginTop: 7,
};

function grade(value: number) {
  if (value >= 80) return 'A';
  if (value >= 65) return 'B';
  if (value >= 45) return 'C';
  if (value >= 30) return 'D';
  return 'F';
}

function studentName(s: Student) {
  return [s.first_name, s.middle_name, s.last_name]
    .filter(Boolean).join(' ');
}

export default function ReportsModule() {
  const [schools, setSchools] = useState<School[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [examId, setExamId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedExam = exams.find(e => e.id === examId);

  const completed = useMemo(
    () => rows.filter(r => subjects.length > 0 && r.entered === subjects.length),
    [rows, subjects]
  );

  const incomplete = useMemo(
    () => rows.filter(r => r.entered < subjects.length),
    [rows, subjects]
  );

  const summary = useMemo(() => {
    const average = completed.length
      ? completed.reduce((sum, r) => sum + r.average, 0) / completed.length
      : 0;

    return {
      total: rows.length,
      complete: completed.length,
      incomplete: incomplete.length,
      average,
      passed: completed.filter(r => r.grade !== 'F').length,
      failed: completed.filter(r => r.grade === 'F').length,
    };
  }, [rows, completed, incomplete]);

  useEffect(() => {
    void loadSchools();
  }, []);

  async function loadSchools() {
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('schools')
        .select('id,school_name')
        .order('school_name');

      if (error) throw error;

      const list = (data || []) as School[];
      setSchools(list);

      if (list.length) {
        setSchoolId(list[0].id);
        await loadExams(list[0].id);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadExams(id: string) {
    if (!id) return;

    const { data, error } = await supabase
      .from('exams')
      .select('id,school_id,academic_year_id,class_id,stream_id,exam_name,academic_year,exam_type,term')
      .eq('school_id', id)
      .order('start_date', { ascending: false });

    if (error) throw error;

    setExams((data || []) as Exam[]);
    setExamId('');
    setSubjects([]);
    setRows([]);
  }

  async function changeSchool(id: string) {
    setSchoolId(id);
    setExamId('');
    setSubjects([]);
    setRows([]);
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

  async function loadReport(id: string) {
    setExamId(id);
    setSubjects([]);
    setRows([]);
    setError('');
    setNotice('');

    if (!id) return;

    setLoading(true);

    try {
      const exam = exams.find(e => e.id === id);
      if (!exam) throw new Error('Mtihani haujapatikana.');

      const { data: subjectRows, error: subjectError } = await supabase
        .from('exam_subjects')
        .select('id,subject_id,maximum_marks')
        .eq('exam_id', id);

      if (subjectError) throw subjectError;

      if (!subjectRows?.length) {
        setNotice('Mtihani huu hauna masomo yaliyounganishwa.');
        return;
      }

      const subjectIds = subjectRows.map(s => s.subject_id);

      const { data: names, error: namesError } = await supabase
        .from('subjects')
        .select('id,subject_name')
        .in('id', subjectIds);

      if (namesError) throw namesError;

      const nameMap: Record<string, string> = {};
      (names || []).forEach(s => { nameMap[s.id] = s.subject_name; });

      const subjectList: Subject[] = subjectRows.map(s => ({
        id: s.id,
        subject_id: s.subject_id,
        subject_name: nameMap[s.subject_id] || 'Somo lisilojulikana',
        maximum_marks: Number(s.maximum_marks),
      }));

      setSubjects(subjectList);

      let query = supabase
        .from('student_enrollments')
        .select('id,student_id,class_id,stream_id,academic_year_id')
        .eq('class_id', exam.class_id)
        .eq('academic_year_id', exam.academic_year_id)
        .eq('status', 'Active');

      if (exam.stream_id) query = query.eq('stream_id', exam.stream_id);

      const { data: enrollmentData, error: enrollmentError } = await query;
      if (enrollmentError) throw enrollmentError;

      const enrollments = (enrollmentData || []) as Enrollment[];

      if (!enrollments.length) {
        setNotice('Hakuna wanafunzi waliosajiliwa kwenye darasa la mtihani huu.');
        return;
      }

      const studentIds = enrollments.map(e => e.student_id);
      const enrollmentIds = enrollments.map(e => e.id);
      const examSubjectIds = subjectList.map(s => s.id);

      const [studentResult, resultResult] = await Promise.all([
        supabase.from('students')
          .select('id,admission_no,first_name,middle_name,last_name')
          .in('id', studentIds),
        supabase.from('student_results')
          .select('id,exam_subject_id,enrollment_id,marks_obtained,is_absent')
          .in('exam_subject_id', examSubjectIds)
          .in('enrollment_id', enrollmentIds),
      ]);

      if (studentResult.error) throw studentResult.error;
      if (resultResult.error) throw resultResult.error;

      const studentMap = new Map(
        ((studentResult.data || []) as Student[]).map(s => [s.id, s])
      );

      const resultMap = new Map<string, Result>();
      ((resultResult.data || []) as Result[]).forEach(r => {
        resultMap.set(`${r.enrollment_id}_${r.exam_subject_id}`, r);
      });

      const reportRows = enrollments.map(enrollment => {
        const student = studentMap.get(enrollment.student_id);
        if (!student) return null;

        let total = 0;
        let maximum = 0;
        let entered = 0;
        let absent = 0;
        const marks: Record<string, number | null> = {};

        subjectList.forEach(subject => {
          maximum += subject.maximum_marks;
          const result = resultMap.get(`${enrollment.id}_${subject.id}`);

          if (!result) {
            marks[subject.id] = null;
            return;
          }

          entered++;

          if (result.is_absent) {
            absent++;
            marks[subject.id] = null;
            return;
          }

          const mark = Number(result.marks_obtained || 0);
          marks[subject.id] = mark;
          total += mark;
        });

        const average = maximum > 0 ? (total / maximum) * 100 : 0;

        return {
          enrollment, student, total, maximum, average,
          grade: grade(average), entered, absent,
          position: null, marks,
        } as ReportRow;
      }).filter((r): r is ReportRow => r !== null);

      const ranked = [...reportRows]
        .filter(r => r.entered === subjectList.length)
        .sort((a, b) => b.average - a.average || b.total - a.total);

      let previous: number | null = null;
      let position = 0;

      ranked.forEach((r, index) => {
        if (previous === null || r.average !== previous) position = index + 1;
        r.position = position;
        previous = r.average;
      });

      setRows(reportRows);
      setNotice('Ripoti imeandaliwa kikamilifu.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function printReport() {
    window.print();
  }

  const tableWrap: React.CSSProperties = {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflowX: 'auto',
    overflowY: 'hidden',
    WebkitOverflowScrolling: 'touch',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    minWidth: 650,
    borderCollapse: 'collapse',
  };

  const cell: React.CSSProperties = {
    padding: 10,
    textAlign: 'left',
    borderBottom: '1px solid #e2e8f0',
    overflowWrap: 'anywhere',
  };

  return (
    <div className="reports-root" style={{
      display: 'grid',
      gap: 16,
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      overflowX: 'hidden',
      color: '#243447',
      boxSizing: 'border-box',
    }}>
      <style>{`
        .reports-root, .reports-root * {
          box-sizing: border-box;
        }
        .reports-root h2 {
          color: #173b5e;
          font-size: clamp(21px, 5vw, 30px);
          line-height: 1.25;
          overflow-wrap: anywhere;
        }
        .reports-root p {
          overflow-wrap: anywhere;
        }
        .reports-root .report-filters {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          width: 100%;
          min-width: 0;
        }
        .reports-root .report-filters label {
          display: block;
          min-width: 0;
          width: 100%;
        }
        .reports-root .report-summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          min-width: 0;
        }
        .reports-root .report-table-wrap {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
        }
        @media(max-width:640px) {
          .reports-root .report-filters {
            grid-template-columns: minmax(0, 1fr);
          }
          .reports-root .report-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media print {
          body * { visibility: hidden; }
          .school-report, .school-report * { visibility: visible; }
          .school-report {
            position: absolute;
            inset: 0;
            width: 100%;
            padding: 10px;
          }
          .no-print { display: none !important; }
          .report-table { font-size: 10px !important; }
          .report-table th, .report-table td { padding: 5px !important; }
        }
      `}</style>

      <section className="no-print" style={card}>
        <h2 style={{ marginTop: 0 }}>Ripoti za Matokeo ya Mitihani</h2>
        <p style={{ color: '#64748b' }}>
          Chagua shule na mtihani ili kuona jumla ya alama,
          wastani, madaraja na nafasi za wanafunzi.
        </p>

        {error && <div style={{
          padding: 12, borderRadius: 8, background: '#fee2e2',
          color: '#991b1b', marginBottom: 12, overflowWrap: 'anywhere',
        }}>{error}</div>}

        {notice && <div style={{
          padding: 12, borderRadius: 8, background: '#dcfce7',
          color: '#166534', marginBottom: 12, overflowWrap: 'anywhere',
        }}>{notice}</div>}

        <div className="report-filters">
          <label>
            <strong>Shule</strong>
            <select style={field} value={schoolId}
              onChange={e => void changeSchool(e.target.value)}>
              <option value="">Chagua shule</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.school_name}</option>)}
            </select>
          </label>

          <label>
            <strong>Mtihani</strong>
            <select style={field} value={examId}
              onChange={e => void loadReport(e.target.value)}>
              <option value="">Chagua mtihani</option>
              {exams.map(e => (
                <option key={e.id} value={e.id}>
                  {e.exam_name} {e.academic_year ? `- ${e.academic_year}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {loading && <section style={card}>Inapakia taarifa za ripoti...</section>}

      {selectedExam && rows.length > 0 && (
        <div className="school-report" style={{
          display: 'grid',
          gap: 16,
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
        }}>
          <section style={card}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 12,
              minWidth: 0,
            }}>
              <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                <h2 style={{ margin: 0 }}>Ripoti ya Matokeo</h2>
                <p style={{ marginBottom: 0 }}>
                  {selectedExam.exam_name} | {selectedExam.academic_year}
                </p>
                <p style={{ marginTop: 5, color: '#64748b' }}>
                  {selectedExam.exam_type} | {selectedExam.term}
                </p>
              </div>

              <button className="no-print" onClick={printReport}
                style={{
                  padding: '11px 16px', border: 0, borderRadius: 8,
                  background: '#173b5e', color: '#fff', fontWeight: 700,
                  maxWidth: '100%',
                }}>
                Chapisha / PDF
              </button>
            </div>
          </section>

          <section className="report-summary">
            {[
              ['Wanafunzi', summary.total],
              ['Wamekamilisha', summary.complete],
              ['Bado', summary.incomplete],
              ['Wastani wa darasa', `${summary.average.toFixed(2)}%`],
              ['Wamefaulu', summary.passed],
              ['Wamefeli', summary.failed],
            ].map(([label, value]) => (
              <div key={String(label)} style={{ ...card, padding: 14 }}>
                <div style={{ color: '#64748b', fontSize: 13 }}>{label}</div>
                <strong style={{
                  display: 'block', fontSize: 'clamp(19px, 5vw, 25px)',
                  overflowWrap: 'anywhere',
                }}>{value}</strong>
              </div>
            ))}
          </section>

          <section style={card}>
            <h3 style={{ marginTop: 0 }}>Muhtasari wa Wanafunzi</h3>
            <div className="report-table-wrap" style={tableWrap}>
              <table className="report-table" style={tableStyle}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    {['Na.', 'Admission No.', 'Jina la Mwanafunzi',
                      'Jumla', 'Wastani %', 'Grade', 'Nafasi', 'Hali'].map(h => (
                      <th key={h} style={cell}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...rows].sort((a, b) => {
                    if (a.position === null) return 1;
                    if (b.position === null) return -1;
                    return a.position - b.position;
                  }).map((r, i) => (
                    <tr key={r.enrollment.id}>
                      <td style={cell}>{i + 1}</td>
                      <td style={cell}>{r.student.admission_no}</td>
                      <td style={cell}>{studentName(r.student)}</td>
                      <td style={cell}>{r.total} / {r.maximum}</td>
                      <td style={cell}>{r.average.toFixed(2)}</td>
                      <td style={cell}>{r.grade}</td>
                      <td style={cell}>{r.position ?? '-'}</td>
                      <td style={cell}>
                        {r.entered === subjects.length
                          ? 'Imekamilika'
                          : `${r.entered}/${subjects.length} masomo`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={card}>
            <h3 style={{ marginTop: 0 }}>Alama kwa Kila Somo</h3>
            <div className="report-table-wrap" style={tableWrap}>
              <table className="report-table" style={tableStyle}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={cell}>Mwanafunzi</th>
                    {subjects.map(s => (
                      <th key={s.id} style={{ ...cell, textAlign: 'center' }}>
                        {s.subject_name}
                        <div style={{ fontWeight: 400, fontSize: 11 }}>
                          / {s.maximum_marks}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.enrollment.id}>
                      <td style={cell}>{studentName(r.student)}</td>
                      {subjects.map(s => (
                        <td key={s.id} style={{ ...cell, textAlign: 'center' }}>
                          {r.marks[s.id] === null ? '—' : r.marks[s.id]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ color: '#64748b', fontSize: 12 }}>
              Alama ya “—” ina maana kuwa matokeo ya somo hilo hayajaingizwa
              au mwanafunzi hakuwepo.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
