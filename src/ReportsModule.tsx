import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

type School = { id: string; school_name: string; email?: string | null; phone?: string | null; address?: string | null };
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
  classPosition: number | null;
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
    .filter(Boolean)
    .join(' ');
}

export default function ReportsModule({ onEditResults }: { onEditResults: () => void }) {
  const [schools, setSchools] = useState<School[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [examId, setExamId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [schoolLogoUrl, setSchoolLogoUrl] = useState('');
  const [schoolLetterheadUrl, setSchoolLetterheadUrl] = useState('');

  const selectedExam = exams.find(e => e.id === examId);
  const selectedSchool = schools.find(s => s.id === schoolId);

  const completed = useMemo(
    () => rows.filter(
      r => subjects.length > 0 && r.entered === subjects.length
    ),
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
        .select('id,school_name,email,phone,address')
        .order('school_name');

      if (error) throw error;

      const list = (data || []) as School[];
      setSchools(list);

      if (list.length) {
        setSchoolId(list[0].id);
        await Promise.all([loadExams(list[0].id), loadSchoolBranding(list[0].id)]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSchoolBranding(id: string) {
    if (!id) {
      setSchoolLogoUrl('');
      setSchoolLetterheadUrl('');
      return;
    }
    const { data, error } = await supabase
      .from('school_branding')
      .select('logo_path,letterhead_path')
      .eq('school_id', id)
      .maybeSingle();
    if (error) {
      console.error('School branding could not be loaded:', error.message);
      setSchoolLogoUrl('');
      setSchoolLetterheadUrl('');
      return;
    }
    const storage = supabase.storage.from('school-branding');
    setSchoolLogoUrl(data?.logo_path ? storage.getPublicUrl(data.logo_path).data.publicUrl : '');
    setSchoolLetterheadUrl(data?.letterhead_path ? storage.getPublicUrl(data.letterhead_path).data.publicUrl : '');
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
      await Promise.all([loadExams(id), loadSchoolBranding(id)]);
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
      (names || []).forEach(s => {
        nameMap[s.id] = s.subject_name;
      });

      const subjectList: Subject[] = subjectRows.map(s => ({
        id: s.id,
        subject_id: s.subject_id,
        subject_name: nameMap[s.subject_id] || 'Somo lisilojulikana',
        maximum_marks: Number(s.maximum_marks),
      }));

      setSubjects(subjectList);

      // Pata wanafunzi wa darasa zima, si mkondo mmoja tu.
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('student_enrollments')
        .select('id,student_id,class_id,stream_id,academic_year_id')
        .eq('class_id', exam.class_id)
        .eq('academic_year_id', exam.academic_year_id)
        .eq('status', 'Active');

      if (enrollmentError) throw enrollmentError;

      const enrollments = (enrollmentData || []) as Enrollment[];

      if (!enrollments.length) {
        setNotice('Hakuna wanafunzi waliosajiliwa kwenye darasa hili.');
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

      const reportRows = enrollments
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
            classPosition: null,
            marks,
          } as ReportRow;
        })
        .filter((r): r is ReportRow => r !== null);

      const completedRows = reportRows.filter(
        r => r.entered === subjectList.length
      );

      // Nafasi ya darasa lote: mikondo yote A, B, C.
      const classRanked = [...completedRows].sort(
        (a, b) => b.average - a.average || b.total - a.total
      );

      let previousClass: number | null = null;
      let classPosition = 0;

      classRanked.forEach((r, index) => {
        if (previousClass === null || r.average !== previousClass) {
          classPosition = index + 1;
        }
        r.classPosition = classPosition;
        previousClass = r.average;
      });

      // Nafasi ya mkondo wa mwanafunzi.
      const streamRanked = [...completedRows]
        .filter(r => r.enrollment.stream_id === exam.stream_id)
        .sort((a, b) => b.average - a.average || b.total - a.total);

      let previousStream: number | null = null;
      let streamPosition = 0;

      streamRanked.forEach((r, index) => {
        if (previousStream === null || r.average !== previousStream) {
          streamPosition = index + 1;
        }
        r.position = streamPosition;
        previousStream = r.average;
      });

      // Ripoti ionyeshe wanafunzi wenye angalau alama moja
      // zilizohifadhiwa kwenye mtihani huu. Wanafunzi wasio na
      // rekodi kwenye student_results wasionekane kwenye ripoti.
      const rowsWithResults = reportRows.filter(row => row.entered > 0);

      setRows(rowsWithResults);
      setNotice(
        rowsWithResults.length
          ? 'Ripoti imeandaliwa kikamilifu.'
          : 'Hakuna matokeo yaliyohifadhiwa kwa mtihani huu.'
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteStudentReportResults(enrollmentId: string, name: string) {
    if (!supabase || !examId || !subjects.length) return;
    if (!window.confirm(`Una uhakika unataka kufuta matokeo yote ya ${name} kwenye mtihani huu?`)) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const subjectIds = subjects.map(subject => subject.id);
      const { error } = await supabase
        .from('student_results')
        .delete()
        .eq('enrollment_id', enrollmentId)
        .in('exam_subject_id', subjectIds);
      if (error) throw error;

      // Verify in a separate SELECT instead of relying on DELETE RETURNING.
      const { data: remainingRows, error: verifyError } = await supabase
        .from('student_results')
        .select('id')
        .eq('enrollment_id', enrollmentId)
        .in('exam_subject_id', subjectIds);
      if (verifyError) throw verifyError;
      if (remainingRows && remainingRows.length > 0) {
        throw new Error('Matokeo bado yapo. Sera ya RLS ya DELETE imezuia kufuta rekodi hizi.');
      }
      setNotice(`Matokeo ya ${name} yamefutwa kwenye mtihani huu.`);
      await loadReport(examId);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  function printAllReports() {
    setPrintingId(null);
    window.setTimeout(() => window.print(), 300);
  }

  function printOneReport(enrollmentId: string) {
    setPrintingId(enrollmentId);
    window.setTimeout(() => window.print(), 300);
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
    <div
      className="reports-root"
      style={{
        display: 'grid',
        gap: 16,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        overflowX: 'hidden',
        color: '#243447',
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        .reports-root,
        .reports-root * {
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
          scrollbar-width: thin;
        }

        /* Keep every student-summary field on one line; swipe horizontally on phones. */
        .reports-root .report-table {
          width: max-content !important;
          min-width: 1050px;
          table-layout: auto;
        }

        .reports-root .report-table th,
        .reports-root .report-table td {
          white-space: nowrap;
          overflow-wrap: normal !important;
          word-break: normal;
          vertical-align: middle;
        }

        .reports-root .report-table th:nth-child(3),
        .reports-root .report-table td:nth-child(3) {
          min-width: 220px;
        }

        .reports-root .subject-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 14px;
          width: 100%;
          min-width: 0;
          background: #fff;
        }

        .reports-root .subject-marks-wrap {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
          padding-bottom: 5px;
        }

        .reports-root .subject-marks {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 135px), 1fr));
          gap: 9px;
          min-width: 0;
        }

        .reports-root .subject-mark-item {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .student-print-only {
          display: none;
        }

        @media(max-width:640px) {
          .reports-root .report-filters {
            grid-template-columns: minmax(0, 1fr);
          }

          .reports-root .report-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          /* Two readable rows of subject tiles; swipe horizontally for more subjects. */
          .reports-root .subject-marks {
            display: grid;
            grid-auto-flow: column;
            grid-template-rows: repeat(2, auto);
            grid-auto-columns: minmax(138px, 155px);
            grid-template-columns: none;
            width: max-content;
            min-width: 0;
            gap: 8px;
            align-items: stretch;
          }

          .reports-root .subject-mark-item {
            width: 100%;
            min-width: 138px;
            padding: 9px !important;
          }

          .reports-root .subject-mark-item .subject-mark-name {
            font-size: 13px;
            line-height: 1.3;
            min-height: 34px;
            overflow-wrap: anywhere;
          }

          .reports-root .subject-mark-item .subject-mark-score {
            font-size: 17px !important;
            line-height: 1.3;
          }
        }

        @media print {
          @page {
            size: A4;
            margin: 0;
          }

          body * {
            visibility: hidden !important;
          }

          .student-print-only,
          .student-print-only * {
            visibility: visible !important;
          }

          .student-print-only {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            background: #fff;
            color: #172b3d;
          }

          .student-print-page {
            display: block;
            position: relative;
            width: 210mm;
            min-height: 297mm;
            padding: 10mm 15mm;
            overflow: hidden;
            background: #fff;
            box-sizing: border-box;
            break-inside: avoid;
            page-break-inside: avoid;
            break-after: auto;
            page-break-after: auto;
          }

          .student-print-page.has-letterhead {
            padding: 48mm 18mm 24mm;
          }

          .student-print-letterhead-bg {
            position: absolute;
            inset: 0;
            z-index: 0;
            display: block;
            width: 210mm;
            height: 297mm;
            object-fit: fill;
          }

          .student-print-page > *:not(.student-print-letterhead-bg) {
            position: relative;
            z-index: 1;
          }

          /* Add a new page only between reports, never after the final report. */
          .student-print-page:not(:last-child) {
            break-after: page;
            page-break-after: always;
          }

          .student-print-heading {
            text-align: center;
            border-bottom: 2px solid #173b5e;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }

          .student-print-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
            font-size: 12px;
          }

          .student-print-table th,
          .student-print-table td {
            border: 1px solid #94a3b8;
            padding: 7px;
            text-align: left;
          }

          .student-print-table th {
            background: #eaf0f6 !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .student-print-summary {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 14px;
          }

          .student-print-box {
            border: 1px solid #cbd5e1;
            border-radius: 5px;
            padding: 9px;
          }

          .student-print-box h2 {
            margin: 6px 0 0;
            font-size: 19px;
          }

          .student-print-signatures {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-top: 20px;
            font-size: 11px;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <section className="no-print" style={card}>
        <h2 style={{ marginTop: 0 }}>
          Ripoti za Matokeo ya Mitihani
        </h2>

        <p style={{ color: '#64748b' }}>
          Chagua shule na mtihani ili kuona matokeo ya wanafunzi.
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
            overflowWrap: 'anywhere',
          }}>
            {notice}
          </div>
        )}

        <div className="report-filters">
          <label>
            <strong>Shule</strong>
            <select
              style={field}
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
              style={field}
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
        <section style={card}>Inapakia taarifa za ripoti...</section>
      )}

      {selectedExam && rows.length > 0 && (
        <div className="school-report" style={{
          display: 'grid',
          gap: 16,
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
        }}>
          <section className="no-print" style={card}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <div>
                <h2 style={{ margin: 0 }}>Ripoti ya Matokeo</h2>
                <p>{selectedExam.exam_name} | {selectedExam.academic_year}</p>
                <p>{selectedExam.exam_type} | {selectedExam.term}</p>
              </div>

              <button
                onClick={printAllReports}
                style={{
                  padding: '12px 17px',
                  border: 0,
                  borderRadius: 8,
                  background: '#173b5e',
                  color: '#fff',
                  fontWeight: 700,
                }}
              >
                Chapisha Ripoti Zote / PDF
              </button>
            </div>
          </section>

          <section className="report-summary no-print">
            {[
              ['Wanafunzi', summary.total],
              ['Wamekamilisha', summary.complete],
              ['Bado', summary.incomplete],
              ['Wastani wa darasa', `${summary.average.toFixed(2)}%`],
              ['Wamefaulu', summary.passed],
              ['Wamefeli', summary.failed],
            ].map(([label, value]) => (
              <div key={String(label)} style={{ ...card, padding: 14 }}>
                <div style={{ color: '#64748b', fontSize: 13 }}>
                  {label}
                </div>
                <strong style={{ fontSize: 23 }}>{value}</strong>
              </div>
            ))}
          </section>

          <section className="no-print" style={card}>
            <h3 style={{ marginTop: 0 }}>Muhtasari wa Wanafunzi</h3>

            <div className="report-table-wrap" style={tableWrap}>
              <table className="report-table" style={tableStyle}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    {[
                      'Na.',
                      'Admission No.',
                      'Jina la Mwanafunzi',
                      'Jumla',
                      'Wastani %',
                      'Grade',
                      'Nafasi Mkondo',
                      'Nafasi Darasa',
                      'Hali',
                    ].map(h => (
                      <th key={h} style={cell}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...rows]
                    .sort((a, b) => {
                      if (a.classPosition === null) return 1;
                      if (b.classPosition === null) return -1;
                      return a.classPosition - b.classPosition;
                    })
                    .map((r, i) => (
                      <tr key={r.enrollment.id}>
                        <td style={cell}>{i + 1}</td>
                        <td style={cell}>{r.student.admission_no}</td>
                        <td style={cell}>{studentName(r.student)}</td>
                        <td style={cell}>{r.total} / {r.maximum}</td>
                        <td style={cell}>{r.average.toFixed(2)}</td>
                        <td style={cell}>{r.grade}</td>
                        <td style={cell}>{r.position ?? '-'}</td>
                        <td style={cell}>{r.classPosition ?? '-'}</td>
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

          <section className="no-print" style={card}>
            <h3 style={{ marginTop: 0 }}>Alama kwa Kila Somo</h3>
            <p style={{ color: '#64748b', marginTop: 0 }}>
              Jedwali linaonyesha alama za kila mwanafunzi kwa kila somo.
              Telezesha kushoto au kulia kuona masomo na taarifa zote.
            </p>

            <div className="report-table-wrap" style={tableWrap} role="region" aria-label="Jedwali la alama za wanafunzi kwa kila somo" tabIndex={0}>
              <table className="report-table" style={{ ...tableStyle, minWidth: Math.max(850, 260 + subjects.length * 135) }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={cell}>Na.</th>
                    <th style={cell}>Jina la Mwanafunzi</th>
                    {subjects.map(subject => (
                      <th key={subject.id} style={cell}>{subject.subject_name}</th>
                    ))}
                    <th style={cell}>Jumla</th>
                    <th style={cell}>Wastani %</th>
                    <th style={cell}>Grade</th>
                    <th style={cell}>Vitendo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, index) => (
                    <tr key={r.enrollment.id}>
                      <td style={cell}>{index + 1}</td>
                      <td style={{ ...cell, minWidth: 210, whiteSpace: 'nowrap' }}>
                        {studentName(r.student)}
                      </td>
                      {subjects.map(subject => (
                        <td key={subject.id} style={{ ...cell, textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {r.marks[subject.id] === null || r.marks[subject.id] === undefined
                            ? '—'
                            : `${r.marks[subject.id]} / ${subject.maximum_marks} (${grade((Number(r.marks[subject.id]) / subject.maximum_marks) * 100)})`}
                        </td>
                      ))}
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>{r.total} / {r.maximum}</td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>{r.average.toFixed(2)}%</td>
                      <td style={cell}>{r.grade}</td>
                      <td style={cell}>
                        <div style={{ display: 'flex', gap: 7, flexWrap: 'nowrap' }}>
                          <button
                            onClick={onEditResults}
                            style={{ padding: '9px 11px', border: 0, borderRadius: 7, background: '#2563eb', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}
                          >
                            Hariri
                          </button>
                          <button
                            onClick={() => void deleteStudentReportResults(r.enrollment.id, studentName(r.student))}
                            style={{ padding: '9px 11px', border: 0, borderRadius: 7, background: '#b42318', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}
                          >
                            Futa
                          </button>
                          <button
                            onClick={() => printOneReport(r.enrollment.id)}
                            style={{ padding: '9px 11px', border: 0, borderRadius: 7, background: '#173b5e', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}
                          >
                            Chapisha
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="no-print" style={card}>
            <h3 style={{ marginTop: 0 }}>Muhtasari wa Kila Somo</h3>
            <p style={{ color: '#64748b', marginTop: 0 }}>
              Wastani, alama ya juu, alama ya chini na idadi ya wanafunzi walioingiziwa alama kwa kila somo.
            </p>
            <div className="report-table-wrap" style={tableWrap} role="region" aria-label="Jedwali la muhtasari wa kila somo" tabIndex={0}>
              <table className="report-table" style={{ ...tableStyle, minWidth: 760 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={cell}>Na.</th>
                    <th style={cell}>Jina la Somo</th>
                    <th style={cell}>Alama za Juu</th>
                    <th style={cell}>Walioingiziwa</th>
                    <th style={cell}>Wastani</th>
                    <th style={cell}>Alama ya Juu Iliyopatikana</th>
                    <th style={cell}>Alama ya Chini</th>
                    <th style={cell}>Grade ya Wastani</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((subject, index) => {
                    const numericMarks = rows
                      .map(row => row.marks[subject.id])
                      .filter((mark): mark is number => mark !== null && mark !== undefined)
                      .filter(Number.isFinite);
                    const averageMark = numericMarks.length
                      ? numericMarks.reduce((sum, mark) => sum + mark, 0) / numericMarks.length
                      : null;
                    const highestMark = numericMarks.length ? Math.max(...numericMarks) : null;
                    const lowestMark = numericMarks.length ? Math.min(...numericMarks) : null;

                    return (
                      <tr key={subject.id}>
                        <td style={cell}>{index + 1}</td>
                        <td style={{ ...cell, whiteSpace: 'nowrap' }}>{subject.subject_name}</td>
                        <td style={cell}>{subject.maximum_marks}</td>
                        <td style={cell}>{numericMarks.length} / {rows.length}</td>
                        <td style={cell}>{averageMark === null ? '—' : averageMark.toFixed(2)}</td>
                        <td style={cell}>{highestMark === null ? '—' : highestMark}</td>
                        <td style={cell}>{lowestMark === null ? '—' : lowestMark}</td>
                        <td style={cell}>
                          {averageMark === null
                            ? '—'
                            : grade((averageMark / subject.maximum_marks) * 100)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="student-print-only">
            {rows
              .filter(r => printingId === null || r.enrollment.id === printingId)
              .map(r => (
                <section key={r.enrollment.id} className={`student-print-page${printingId !== null ? ' single-report' : ''}${schoolLetterheadUrl ? ' has-letterhead' : ''}`}>
                  {schoolLetterheadUrl && <img className="student-print-letterhead-bg" src={schoolLetterheadUrl} alt="" />}
                  <header className="student-print-heading">
                    {schoolLetterheadUrl ? null : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 8 }}>
                        {schoolLogoUrl && <img src={schoolLogoUrl} alt="Logo ya shule" style={{ width: 76, height: 76, objectFit: 'contain' }} />}
                        <div>
                          <h1 style={{ margin: 0, color: '#173b5e' }}>{selectedSchool?.school_name || 'SHULE'}</h1>
                          {(selectedSchool?.address || selectedSchool?.phone || selectedSchool?.email) && (
                            <p style={{ margin: '4px 0', fontSize: 11 }}>
                              {[selectedSchool?.address, selectedSchool?.phone, selectedSchool?.email].filter(Boolean).join(' | ')}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    <h2 style={{ margin: '10px 0 5px' }}>RIPOTI YA MATOKEO YA MWANAFUNZI</h2>
                    <p style={{ margin: 4 }}>{selectedExam.exam_name} | {selectedExam.academic_year}</p>
                    <p style={{ margin: 4 }}>{selectedExam.exam_type} | {selectedExam.term}</p>
                  </header>

                  <h2 style={{ color: '#173b5e' }}>
                    {studentName(r.student)}
                  </h2>

                  <p>
                    <strong>Admission Number:</strong> {r.student.admission_no}
                  </p>

                  <h3>Matokeo kwa Kila Somo</h3>

                  <table className="student-print-table">
                    <thead>
                      <tr>
                        <th>Na.</th>
                        <th>Somo</th>
                        <th>Alama</th>
                        <th>Alama za Juu</th>
                        <th>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map((s, index) => (
                        <tr key={s.id}>
                          <td>{index + 1}</td>
                          <td>{s.subject_name}</td>
                          <td>
                            {r.marks[s.id] === null ? '—' : r.marks[s.id]}
                          </td>
                          <td>{s.maximum_marks}</td>
                          <td>
                            {r.marks[s.id] === null
                              ? '—'
                              : grade((Number(r.marks[s.id]) / s.maximum_marks) * 100)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="student-print-summary">
                    <div className="student-print-box">
                      <strong>Jumla ya Alama</strong>
                      <h2>{r.total} / {r.maximum}</h2>
                    </div>
                    <div className="student-print-box">
                      <strong>Wastani</strong>
                      <h2>{r.average.toFixed(2)}%</h2>
                    </div>
                    <div className="student-print-box">
                      <strong>Grade ya Jumla</strong>
                      <h2>{r.grade}</h2>
                    </div>
                    <div className="student-print-box">
                      <strong>Nafasi kwenye Mkondo</strong>
                      <h2>{r.position ?? '—'}</h2>
                    </div>
                    <div className="student-print-box">
                      <strong>Nafasi kwenye Darasa Zima</strong>
                      <h2>{r.classPosition ?? '—'}</h2>
                    </div>
                  </div>

                  <p style={{ marginTop: 12 }}>
                    <strong>Masomo yaliyokamilika:</strong> {r.entered} / {subjects.length}
                  </p>

                  <div style={{ marginTop: 16 }}>
                    <strong>Maoni ya Mwalimu wa Darasa:</strong>
                    <p>________________________________________________________</p>
                    <p>________________________________________________________</p>
                  </div>

                  <div className="student-print-signatures">
                    <div>
                      ______________________
                      <br />Saini ya Mwalimu wa Darasa
                    </div>
                    <div>
                      ______________________
                      <br />Saini ya Mkuu wa Shule
                    </div>
                    <div>
                      ______________________
                      <br />Tarehe
                    </div>
                  </div>
                </section>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
