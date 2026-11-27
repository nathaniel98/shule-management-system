import { useEffect, useState } from 'react';
import { BookOpen, GraduationCap, Users } from 'lucide-react';
import { supabase } from './supabase';

type ClassInfo = { id: string; class_name: string };
type Student = {
  id: string;
  admission_no: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  gender: string | null;
};

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: 18,
  minWidth: 0
};

export default function ClassTeacherDashboard({ classId }: { classId: string | null }) {
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadClassDashboard() {
      setLoading(true);
      setError('');
      setClassInfo(null);
      setStudents([]);

      if (!classId) {
        setLoading(false);
        return;
      }

      try {
        // The signed-in staff member can only read the class assigned to
        // their own class_teacher account. RLS independently enforces this.
        const { data: classRow, error: classError } = await supabase!
          .from('classes')
          .select('id, class_name')
          .eq('id', classId)
          .single();

        if (classError) throw classError;

        const { data: enrollments, error: enrollmentError } = await supabase!
          .from('student_enrollments')
          .select('student_id')
          .eq('class_id', classId)
          .eq('status', 'Active');

        if (enrollmentError) throw enrollmentError;

        const studentIds = [...new Set((enrollments || []).map((row: any) => row.student_id))];
        let studentRows: Student[] = [];

        if (studentIds.length > 0) {
          const { data, error: studentsError } = await supabase!
            .from('students')
            .select('id, admission_no, first_name, middle_name, last_name, gender')
            .in('id', studentIds)
            .order('first_name');

          if (studentsError) throw studentsError;
          studentRows = (data || []) as Student[];
        }

        if (!active) return;
        setClassInfo(classRow as ClassInfo);
        setStudents(studentRows);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Imeshindikana kupakia taarifa za darasa.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadClassDashboard();
    return () => { active = false; };
  }, [classId]);

  const boys = students.filter(s => ['m', 'male', 'mvulana', 'me'].includes((s.gender || '').trim().toLowerCase())).length;
  const girls = students.filter(s => ['f', 'female', 'msichana', 'ke'].includes((s.gender || '').trim().toLowerCase())).length;

  if (!classId) {
    return (
      <section style={cardStyle}>
        <h2 style={{ marginTop: 0, color: '#173b5e' }}>Darasa langu</h2>
        <p style={{ color: '#64748b', marginBottom: 0 }}>
          Akaunti hii bado haijapangiwa darasa. Tafadhali wasiliana na School Admin akupangie darasa kupitia sehemu ya Watumiaji.
        </p>
      </section>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ ...cardStyle, background: '#f8fbff' }}>
        <p style={{ margin: 0, color: '#64748b', fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>DASHBOARD YA MWALIMU WA DARASA</p>
        <h2 style={{ margin: '8px 0', color: '#173b5e' }}>{loading ? 'Inapakia darasa...' : classInfo?.class_name || 'Darasa langu'}</h2>
        <p style={{ margin: 0, color: '#64748b' }}>Hapa unaona taarifa za darasa ulilopangiwa pekee.</p>
      </section>

      {error && <div role="alert" style={{ background: '#fff1f0', color: '#b42318', padding: 14, borderRadius: 10 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14 }}>
        <section style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
            <span>Wanafunzi wa darasa</span><GraduationCap size={20} />
          </div>
          <strong style={{ display: 'block', fontSize: 30, color: '#173b5e', marginTop: 12 }}>{loading ? '...' : students.length}</strong>
          <small style={{ color: '#64748b' }}>Waliosajiliwa kwa mwaka wa sasa</small>
        </section>
        <section style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
            <span>Wavulana</span><Users size={20} />
          </div>
          <strong style={{ display: 'block', fontSize: 30, color: '#173b5e', marginTop: 12 }}>{loading ? '...' : boys}</strong>
          <small style={{ color: '#64748b' }}>Kwa taarifa za jinsia zilizopo</small>
        </section>
        <section style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
            <span>Wasichana</span><Users size={20} />
          </div>
          <strong style={{ display: 'block', fontSize: 30, color: '#173b5e', marginTop: 12 }}>{loading ? '...' : girls}</strong>
          <small style={{ color: '#64748b' }}>Kwa taarifa za jinsia zilizopo</small>
        </section>
      </div>

      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <BookOpen size={20} color="#173b5e" />
          <h3 style={{ margin: 0, color: '#173b5e' }}>Orodha ya wanafunzi wa darasa</h3>
        </div>
        {loading ? <p>Inapakia wanafunzi...</p> : students.length === 0 ? (
          <p style={{ color: '#64748b' }}>Hakuna wanafunzi hai waliosajiliwa katika darasa hili kwa mwaka wa masomo wa sasa.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 440, borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={{ textAlign: 'left', padding: 10 }}>Na.</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Namba ya usajili</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Jina kamili</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Jinsia</th>
              </tr></thead>
              <tbody>{students.map((student, index) => (
                <tr key={student.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td style={{ padding: 10 }}>{index + 1}</td>
                  <td style={{ padding: 10 }}>{student.admission_no || '—'}</td>
                  <td style={{ padding: 10 }}>{[student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ')}</td>
                  <td style={{ padding: 10 }}>{student.gender || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
