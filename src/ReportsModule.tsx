
import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

type School = { id: string; school_name: string };

type Exam = {
  id: string;
  school_id: string;
  academic_year_id: string;
  class_id: string;
  stream_id: string | null;
  exam_name: string;
  academic_year: string;
  exam_type: string;
  term: string;
};

type Subject = {
  id: string;
  subject_id: string;
  subject_name: string;
  maximum_marks: number;
};

type Enrollment = {
  id: string;
  student_id: string;
  class_id: string;
  stream_id: string | null;
  academic_year_id: string;
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
};

type ReportRow = {
  enrollment: Enrollment;
  student: Student;
  total: number;
  maximum: number;
  average: number;
  grade: string;
  entered: number;
  absent: number;
  position: number | null;
  marks: Record<string, number | null>;
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: 12,
  border: '1px solid #cbd5e1',
  borderRadius: 9,
  fontSize: 15,
  background: '#fff',
};

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 14,
  padding: 18,
};

function grade(value: number) {
  if (value >= 80) return 'A';
  if (value >= 65) return 'B';
  if (value >= 45) return 'C';
  if (value >= 30) return 'D';
  return 'F';
}

function studentName(student: Student) {
  return [
    student.first_name,
    student.middle_name,
    student.last_name,
  ].filter(Boolean).join(' ');
}

export default function ReportsModule() {
  const [schools, setSchools] = useState<School[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);

  const [schoolId, setSchoolId] = useState('');
  const [examId, setExamId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedExam = exams.find(e => e.id === examId);

  const completedRows = useMemo(
    () => reportRows.filter(r => r.entered === subjects.length && subjects.length > 0),
    [reportRows, subjects]
  );

  const incompleteRows = useMemo(
    () => reportRows.filter(r => r.entered < subjects.length),
    [reportRows, subjects]
  );

  const summary = useMemo(() => {
    const totalStudents = reportRows.length;
    const complete = completedRows.length;
    const incomplete = incompleteRows.length;

    const averages = completedRows.map(r => r.average);
    const classAverage = averages.length
      ? averages.reduce((a, b) => a + b, 0) / averages.length
      : 0;

    const passed = completedRows.filter(r => r.grade !== 'F').length;
    const failed = completedRows.filter(r => r.grade === 'F').length;

    return {
      totalStudents,
      complete,
      incomplete,
      classAverage,
      passed,
      failed,
    };
  }, [reportRows, completedRows, incompleteRows]);

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

      const rows = (data || []) as School[];
      setSchools(rows);

      if (rows.length) {
        setSchoolId(rows[0].id);
        await loadExams(rows[0].id);
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
      .select(
        'id,school_id,academic_year_id,class_id,stream_id,exam_name,academic_year,exam_type,term'
      )
      .eq('school_id', id)
      .order('start_date', { ascending: false });

    if (error) throw error;

    setExams((data || []) as Exam[]);
    setExamId('');
    setSubjects([]);
    setReportRows([]);
  }

  async function changeSchool(id: string) {
    setSchoolId(id);
    setExamId('');
    setSubjects([]);
    setReportRows([]);
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
    setReportRows([]);
    setError('');
    setNotice('');

    if (!id) return;

    setLoading(true);

    try {
      const exam = exams.find(e => e.id === id);
      if (!exam) throw new Error('Mtihani haujapatikana.');

      const { data: subjectRows, error: subjectError } =
        await supabase
          .from('exam_subjects')
          .select('id,subject_id,maximum_marks')
          .eq('exam_id', id);

      if (subjectError) throw subjectError;

      const rawSubjects = subjectRows || [];

      if (!rawSubjects.length) {
        setNotice('Mtihani huu hauna masomo yaliyounganishwa.');
        return;
      }

      const subjectIds = rawSubjects.map(s => s.subject_id);

      const { data: names, error: namesError } = await supabase
        .from('subjects')
        .select('id,subject_name')
        .in('id', subjectIds);

      if (namesError) throw namesError;

      const nameMap: Record<string, string> = {};
      (names || []).forEach(s => {
        nameMap[s.id] = s.subject_name;
      });

      const subjectList: Subject[] = rawSubjects.map(s => ({
        id: s.id,
        subject_id: s.subject_id,
        subject_name: nameMap[s.subject_id] || 'Somo lisilojulikana',
        maximum_marks: Number(s.maximum_marks),
      }));

      setSubjects(subjectList);

      let enrollmentQuery = supabase
        .from('student_enrollments')
        .select('id,student_id,class_id,stream_id,academic_year_id')
        .eq('class_id', exam.class_id)
        .eq('academic_year_id', exam.academic_year_id)
        .eq('status', 'Active');

      if (exam.stream_id) {
        enrollmentQuery = enrollmentQuery.eq('stream_id', exam.stream_id);
      }

      const { data: enrollmentData, error: enrollmentError } =
        await enrollmentQuery;

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
        supabase
          .from('students')
          .select('id,admission_no,first_name,middle_name,last_name')
          .in('id', studentIds),

        supabase
          .from('student_results')
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

      const rows: ReportRow[] = enrollments
        .map(enrollment => {
          const student = studentMap.get(enrollment.student_id);
          if (!student) return null;

          let total = 0;
          let maximum = 0;
          let entered = 0;
          let absent = 0;
          const marks: Record<string, number | null> = {};

          subjectList.forEach(subject => {
            maximum += subject.maximum_marks;

            const result = resultMap.get(
              `${enrollment.id}_${subject.id}`
            );

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

          const average = maximum > 0
            ? (total / maximum) * 100
            : 0;

          return {
            enrollment,
            student,
            total,
            maximum,
            average,
            grade: grade(average),
            entered,
            absent,
            position: null,
            marks,
          };
        })
        .filter(Boolean) as ReportRow[];

      const ranked = [...rows]
        .filter(r => r.entered === subjectList.length)
        .sort((a, b) => b.average - a.average || b.total - a.total);

      let previousAverage: number | null = null;
      let currentPosition = 0;

      ranked.forEach((row, index) => {
        if (previousAverage === null || row.average !== previousAverage) {
          currentPosition = index + 1;
        }
        row.position = currentPosition;
        previousAverage = row.average;
      });

      setReportRows(rows);
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

  return (
    <div style={{
      display: 'grid',
      gap: 18,
      color: '#243447',
      minWidth: 0,
    }}>
      <style>{`
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
          .report-table th, .report-table td {
            padding: 5px !important;
          }
        }
      `}</style>

      <section className="no-print" style={cardStyle}>
        <h2 style={{ marginTop: 0, color: '#173b5e' }}>
          Ripoti za Matokeo ya Mitihani
        </h2>

        <p style={{ color: '#64748b' }}>
          Chagua shule na mtihani ili kuona jumla ya alama,
          wastani, madaraja na nafasi za wanafunzi.
        </p>

        {error && (
          <div style={{
            padding: 12,
            borderRadius: 8,
            background: '#fee2e2',
            color: '#991b1b',
            marginBottom: 12,
            overflowWrap: 'anywhere',
          }}>
            {error}
          </div>
        )}

        {notice && (
          <div style={{
            padding: 12,
            borderRadius: 8,
            background: '#dcfce7',
            color: '#166534',
            marginBottom: 12,
          }}>
            {notice}
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
              onChange={e => void changeSchool(e.target.value)}
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
            <strong>Mtihani</strong>
            <select
              style={inputStyle}
              value={examId}
              onChange={e => void loadReport(e.target.value)}
            >
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

      {loading && (
        <section style={cardStyle}>
          Inapakia taarifa za ripoti...
        </section>
      )}

      {selectedExam && reportRows.length > 0 && (
        <div className="school-report" style={{ display: 'grid', gap: 16 }}>
          <section style={cardStyle}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <div>
                <h2 style={{ margin: 0, color: '#173b5e' }}>
                  Ripoti ya Matokeo
                </h2>
                <p style={{ marginBottom: 0 }}>
                  {selectedExam.exam_name} | {selectedExam.academic_year}
                </p>
                <p style={{ marginTop: 5, color: '#64748b' }}>
                  {selectedExam.exam_type} | {selectedExam.term}
                </p>
              </div>

              <button
                className="no-print"
                onClick={printReport}
                style={{
                  padding: '11px 16px',
                  border: 0,
                  borderRadius: 8,
                  background: '#173b5e',
                  color: '#fff',
                  fontWeight: 700,
                }}
              >
                Chapisha / PDF
              </button>
            </div>
          </section>

          <section style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(135px,1fr))',
            gap: 12,
          }}>
            {[
              ['Wanafunzi', summary.totalStudents],
              ['Wamekamilisha', summary.complete],
              ['Bado', summary.incomplete],
              ['Wastani wa darasa', `${summary.classAverage.toFixed(2)}%`],
              ['Wamefaulu', summary.passed],
              ['Wamefeli', summary.failed],
            ].map(([label, value]) => (
              <div key={String(label)} style={{
                ...cardStyle,
                padding: 14,
              }}>
                <div style={{ color: '#64748b', fontSize: 13 }}>
                  {label}
                </div>
                <strong style={{ fontSize: 22 }}>
                  {value}
                </strong>
              </div>
            ))}
          </section>

          <section style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Muhtasari wa Wanafunzi</h3>

            <div style={{ overflowX: 'auto' }}>
              <table className="report-table" style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: 650,
              }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    {[
                      'Na.',
                      'Admission No.',
                      'Jina la Mwanafunzi',
                      'Jumla',
                      'Wastani %',
                      'Grade',
                      'Nafasi',
                      'Hali',
                    ].map(h => (
                      <th key={h} style={{
                        padding: 10,
                        textAlign: 'left',
                        borderBottom: '1px solid #e2e8f0',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {[...reportRows]
                    .sort((a, b) => {
                      if (a.position === null) return 1;
                      if (b.position === null) return -1;
                      return a.position - b.position;
                    })
                    .map((row, index) => (
                      <tr key={row.enrollment.id}>
                        <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>
                          {index + 1}
                        </td>
                        <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>
                          {row.student.admission_no}
                        </td>
                        <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>
                          {studentName(row.student)}
                        </td>
                        <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>
                          {row.total} / {row.maximum}
                        </td>
                        <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>
                          {row.average.toFixed(2)}
                        </td>
                        <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>
                          {row.grade}
                        </td>
                        <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>
                          {row.position === null ? '-' : row.position}
                        </td>
                        <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>
                          {row.entered === subjects.length
                            ? 'Imekamilika'
                            : `${row.entered}/${subjects.length} masomo`}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Alama kwa Kila Somo</h3>

            <div style={{ overflowX: 'auto' }}>
              <table className="report-table" style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: 650,
              }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ padding: 10, textAlign: 'left' }}>Mwanafunzi</th>
                    {subjects.map(s => (
                      <th key={s.id} style={{ padding: 10, textAlign: 'center' }}>
                        {s.subject_name}
                        <div style={{ fontWeight: 400, fontSize: 11 }}>
                          / {s.maximum_marks}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map(row => (
                    <tr key={row.enrollment.id}>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0' }}>
                        {studentName(row.student)}
                      </td>
                      {subjects.map(s => (
                        <td key={s.id} style={{
                          padding: 10,
                          textAlign: 'center',
                          borderBottom: '1px solid #e2e8f0',
                        }}>
                          {row.marks[s.id] === null
                            ? '—'
                            : row.marks[s.id]}
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
