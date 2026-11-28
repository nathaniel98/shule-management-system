import { useEffect, useState } from 'react';
import { supabase } from './supabase';

type StaffMember = {
  id: string;
  full_name: string;
  employee_no: string | null;
  staff_category: 'teaching' | 'support';
  job_title: string;
  phone: string | null;
  email: string | null;
  status: 'Active' | 'Inactive';
};

export default function AccountantStaffDirectory() {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data: schoolData, error: schoolError } = await supabase!.rpc('get_my_school_for_staff');
        if (schoolError) throw schoolError;
        const school = Array.isArray(schoolData) ? schoolData[0] : schoolData;
        const schoolId = school?.id || school?.school_id;
        if (!schoolId) throw new Error('Akaunti haijaunganishwa na shule.');
        const { data, error: queryError } = await supabase!
          .from('school_staff_directory')
          .select('id, full_name, employee_no, staff_category, job_title, phone, email, status')
          .eq('school_id', schoolId)
          .order('full_name');
        if (queryError) throw queryError;
        if (!cancelled) setMembers((data || []) as StaffMember[]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Imeshindikana kupakia orodha ya watumishi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="panel module-panel">
      <div className="module-icon">👥</div>
      <h2>Orodha ya Watumishi</h2>
      <p className="muted">Taarifa za watumishi kwa ajili ya kuhakiki malipo. Mhasibu anaweza kuona taarifa hizi bila kuzihariri au kufuta watumishi.</p>
      {error && <div className="notice" role="alert">{error}</div>}
      {loading ? <p>Inapakia orodha ya watumishi...</p> : (
        <>
          <div className="stats-grid" style={{ marginBottom: 16 }}>
            <div className="stat-card"><span>Watumishi wote</span><strong>{members.length}</strong></div>
            <div className="stat-card"><span>Walio kazini</span><strong>{members.filter(m => m.status === 'Active').length}</strong></div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
              <thead><tr>{['Jina','Namba ya utumishi','Nafasi','Aina','Simu','Hali'].map(h => <th key={h} style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr></thead>
              <tbody>
                {members.map(member => <tr key={member.id}>
                  <td style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>{member.full_name}</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>{member.employee_no || '—'}</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>{member.job_title}</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>{member.staff_category === 'teaching' ? 'Mwalimu' : 'Mtumishi mwingine'}</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>{member.phone || '—'}</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>{member.status === 'Active' ? 'Yupo kazini' : 'Hayupo kazini'}</td>
                </tr>)}
                {!members.length && <tr><td colSpan={6} style={{ padding: 18, textAlign: 'center' }}>Hakuna watumishi waliosajiliwa.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
