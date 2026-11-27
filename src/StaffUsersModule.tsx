import { useEffect, useState, type FormEvent, type CSSProperties } from 'react';
import { supabase } from './supabase';

type StaffRole = 'class_teacher' | 'head_teacher' | 'accountant' | 'teacher' | 'academic';
type SchoolClass = { id: string; class_name: string };
type Subject = { id: string; subject_name: string };
type TeachingAssignment = { id: string; staff_account_id: string; class_id: string; subject_id: string };
type StaffAccount = { id: string; display_name: string; email: string | null; phone: string | null; role: StaffRole; class_id: string | null; teacher_id: string | null; staff_member_id: string | null; is_active: boolean; created_at: string };
type RegisteredTeacher = { id: string; first_name: string; middle_name: string | null; last_name: string; employee_no: string; status: string | null };
type StaffDirectoryMember = { id: string; full_name: string; employee_no: string | null; staff_category: 'teaching' | 'support'; job_title: string; phone: string | null; email: string | null; status: 'Active' | 'Inactive'; teacher_id: string | null };

const roleLabels: Record<StaffRole, string> = {
  class_teacher: 'Mwalimu wa darasa',
  head_teacher: 'Mwalimu Mkuu',
  accountant: 'Mhasibu',
  teacher: 'Mwalimu',
  academic: 'Academic',
};

export default function StaffUsersModule() {
  const [schoolId, setSchoolId] = useState('');
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [registeredTeachers, setRegisteredTeachers] = useState<RegisteredTeacher[]>([]);
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryMember[]>([]);
  const [selectedStaffMemberId, setSelectedStaffMemberId] = useState('');
  const [staffCategory, setStaffCategory] = useState<'teaching' | 'support'>('support');
  const [staffTeacherId, setStaffTeacherId] = useState('');
  const [staffFullName, setStaffFullName] = useState('');
  const [staffEmployeeNo, setStaffEmployeeNo] = useState('');
  const [staffJobTitle, setStaffJobTitle] = useState('Mhasibu');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [directorySaving, setDirectorySaving] = useState(false);
  const [editingDirectoryMember, setEditingDirectoryMember] = useState<StaffDirectoryMember | null>(null);
  const [editDirectoryName, setEditDirectoryName] = useState('');
  const [editDirectoryEmployeeNo, setEditDirectoryEmployeeNo] = useState('');
  const [editDirectoryCategory, setEditDirectoryCategory] = useState<'teaching' | 'support'>('support');
  const [editDirectoryJobTitle, setEditDirectoryJobTitle] = useState('');
  const [editDirectoryPhone, setEditDirectoryPhone] = useState('');
  const [editDirectoryEmail, setEditDirectoryEmail] = useState('');
  const [editDirectoryStatus, setEditDirectoryStatus] = useState<'Active' | 'Inactive'>('Active');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [assignmentStaffId, setAssignmentStaffId] = useState('');
  const [assignmentClassId, setAssignmentClassId] = useState('');
  const [assignmentSubjectIds, setAssignmentSubjectIds] = useState<string[]>([]);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [classTeacherStaffId, setClassTeacherStaffId] = useState('');
  const [classTeacherClassId, setClassTeacherClassId] = useState('');
  const [classTeacherSaving, setClassTeacherSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole>('class_teacher');
  const [classId, setClassId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingAccount, setEditingAccount] = useState<StaffAccount | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<StaffRole>('accountant');
  const [editClassId, setEditClassId] = useState('');
  const [accountActionSaving, setAccountActionSaving] = useState(false);

  async function loadAccounts(id: string) {
    const { data, error } = await supabase!.from('school_staff_accounts')
      .select('id, display_name, email, phone, role, class_id, teacher_id, staff_member_id, is_active, created_at')
      .eq('school_id', id).order('created_at', { ascending: false });
    if (error) throw error;
    setAccounts((data || []) as StaffAccount[]);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        // School Admin accounts are stored in school_members, while staff
        // accounts are stored in school_staff_accounts. Support both identities.
        const { data: staffSchoolData, error: staffSchoolError } =
          await supabase!.rpc('get_my_school_for_staff');
        if (staffSchoolError) throw staffSchoolError;
        const staffSchool = Array.isArray(staffSchoolData)
          ? staffSchoolData[0]
          : staffSchoolData;

        let id = staffSchool?.id || staffSchool?.school_id || '';

        if (!id) {
          const { data: { user }, error: userError } = await supabase!.auth.getUser();
          if (userError) throw userError;
          if (!user) throw new Error('Tafadhali ingia tena kwenye mfumo.');

          const { data: memberships, error: membershipError } = await supabase!
            .from('school_members')
            .select('school_id')
            .eq('user_id', user.id)
            .eq('role', 'school_admin')
            .eq('is_active', true)
            .order('created_at', { ascending: true })
            .limit(1);
          if (membershipError) throw membershipError;
          id = memberships?.[0]?.school_id || '';
        }

        if (!id) throw new Error('Akaunti hii haijaunganishwa na shule kama School Admin au mtumishi.');
        const [classResult, staffResult, subjectResult, assignmentResult, teacherResponse, directoryResult] = await Promise.all([
          supabase!.from('classes').select('id, class_name').eq('school_id', id).order('class_name'),
          supabase!.from('school_staff_accounts').select('id, display_name, email, phone, role, class_id, teacher_id, staff_member_id, is_active, created_at').eq('school_id', id).order('created_at', { ascending: false }),
          supabase!.from('subjects').select('id, subject_name').eq('school_id', id).order('subject_name'),
          supabase!.from('school_staff_teaching_assignments').select('id, staff_account_id, class_id, subject_id').eq('school_id', id),
          supabase!.functions.invoke('list-school-teachers', { body: { school_id: id } }),
          supabase!.from('school_staff_directory').select('id, full_name, employee_no, staff_category, job_title, phone, email, status, teacher_id').eq('school_id', id).order('full_name'),
        ]);
        if (classResult.error) throw classResult.error;
        if (staffResult.error) throw staffResult.error;
        if (subjectResult.error) throw subjectResult.error;
        if (assignmentResult.error) throw assignmentResult.error;
        if (directoryResult.error) throw directoryResult.error;
        if (teacherResponse.error) throw new Error(await getFunctionErrorMessage(teacherResponse.error));
        if (teacherResponse.data?.error) throw new Error(String(teacherResponse.data.error));
        if (!active) return;
        setSchoolId(id);
        setClasses((classResult.data || []) as SchoolClass[]);
        setAccounts((staffResult.data || []) as StaffAccount[]);
        setRegisteredTeachers((teacherResponse.data?.teachers || []) as RegisteredTeacher[]);
        setStaffDirectory((directoryResult.data || []) as StaffDirectoryMember[]);
        setSubjects((subjectResult.data || []) as Subject[]);
        setAssignments((assignmentResult.data || []) as TeachingAssignment[]);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Imeshindikana kupakia watumiaji.');
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function getFunctionErrorMessage(error: unknown): Promise<string> {
    const fallback = error instanceof Error ? error.message : 'Imeshindikana kutengeneza akaunti.';
    if (!error || typeof error !== 'object' || !('context' in error)) return fallback;

    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as Record<string, unknown>;
        const message = payload.error ?? payload.message ?? payload.msg;
        const detail = payload.detail ?? payload.code;
        if (typeof message === 'string' && message.trim()) {
          return typeof detail === 'string' && detail.trim()
            ? `${message} (${detail})`
            : message;
        }
      } catch {
        try {
          const raw = await context.clone().text();
          if (raw.trim()) return raw.slice(0, 500);
        } catch { /* Keep the original error message. */ }
      }
      return `Hitilafu ya seva (HTTP ${context.status}). ${fallback}`;
    }
    return fallback;
  }

  async function createDirectoryMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!schoolId) return;
    const teacher = staffCategory === 'teaching' ? registeredTeachers.find(item => item.id === staffTeacherId) : null;
    if (staffCategory === 'teaching' && !teacher) {
      setError('Chagua mwalimu aliyesajiliwa kwenye orodha ya walimu.');
      return;
    }
    const fullName = teacher
      ? [teacher.first_name, teacher.middle_name, teacher.last_name].filter(Boolean).join(' ')
      : staffFullName.trim();
    if (!fullName || !staffJobTitle.trim()) {
      setError('Jaza jina kamili na nafasi ya kazi.');
      return;
    }
    setDirectorySaving(true);
    setError('');
    setMessage('');
    try {
      const { data, error } = await supabase!.from('school_staff_directory').insert({
        school_id: schoolId,
        full_name: fullName,
        employee_no: teacher?.employee_no || staffEmployeeNo.trim() || null,
        staff_category: staffCategory,
        job_title: staffJobTitle.trim(),
        phone: teacher?.phone || staffPhone.trim() || null,
        email: teacher?.email || staffEmail.trim().toLowerCase() || null,
        teacher_id: teacher?.id || null,
        status: 'Active',
      }).select('id, full_name, employee_no, staff_category, job_title, phone, email, status, teacher_id').single();
      if (error) throw error;
      setStaffDirectory(current => [...current, data as StaffDirectoryMember].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setStaffTeacherId('');
      setStaffFullName('');
      setStaffEmployeeNo('');
      setStaffPhone('');
      setStaffEmail('');
      setStaffJobTitle('Mhasibu');
      setMessage('Mtumishi amesajiliwa kwenye orodha ya watumishi wa shule.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Imeshindikana kusajili mtumishi.');
    } finally {
      setDirectorySaving(false);
    }
  }

  function startEditDirectoryMember(member: StaffDirectoryMember) {
    setEditingDirectoryMember(member);
    setEditDirectoryName(member.full_name);
    setEditDirectoryEmployeeNo(member.employee_no || '');
    setEditDirectoryCategory(member.staff_category);
    setEditDirectoryJobTitle(member.job_title);
    setEditDirectoryPhone(member.phone || '');
    setEditDirectoryEmail(member.email || '');
    setEditDirectoryStatus(member.status);
    setError('');
    setMessage('');
  }

  async function saveDirectoryMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDirectoryMember || !schoolId) return;
    const linkedTeachingAccount = accounts.find(account => account.staff_member_id === editingDirectoryMember.id && account.is_active && (account.role === 'teacher' || account.role === 'class_teacher'));
    if (editDirectoryCategory === 'support' && linkedTeachingAccount) {
      setError('Badili kwanza jukumu la akaunti hii kutoka Mwalimu/Mwalimu wa darasa kabla ya kumhamisha mtumishi kwenda kundi la watumishi wengine.');
      return;
    }
    setDirectorySaving(true);
    setError('');
    setMessage('');
    try {
      const { data, error } = await supabase!.from('school_staff_directory').update({
        full_name: editDirectoryName.trim(),
        employee_no: editDirectoryEmployeeNo.trim() || null,
        staff_category: editDirectoryCategory,
        job_title: editDirectoryJobTitle.trim(),
        phone: editDirectoryPhone.trim() || null,
        email: editDirectoryEmail.trim().toLowerCase() || null,
        status: editDirectoryStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', editingDirectoryMember.id).eq('school_id', schoolId)
        .select('id, full_name, employee_no, staff_category, job_title, phone, email, status, teacher_id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Mtumishi hakupatikana au huna ruhusa ya kuhariri taarifa zake.');
      setStaffDirectory(current => current.map(item => item.id === data.id ? data as StaffDirectoryMember : item).sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setEditingDirectoryMember(null);
      setMessage('Taarifa za mtumishi zimehaririwa kikamilifu.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Imeshindikana kuhariri taarifa za mtumishi.');
    } finally {
      setDirectorySaving(false);
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!schoolId) return;
    const selectedMember = staffDirectory.find(member => member.id === selectedStaffMemberId && member.status === 'Active');
    if (!selectedMember) {
      setError('Chagua mtumishi aliyesajiliwa kwenye orodha ya watumishi wa shule hii.');
      return;
    }
    if ((role === 'teacher' || role === 'class_teacher') && (selectedMember.staff_category !== 'teaching' || !selectedMember.teacher_id)) {
      setError('Jukumu hili linahitaji kuchagua mwalimu aliyesajiliwa kwenye orodha ya walimu.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const { data, error } = await supabase!.functions.invoke('create-school-staff-user', {
        body: { school_id: schoolId, staff_member_id: selectedStaffMemberId, display_name: displayName, email: email.trim(), phone: phone.trim(), password, role, class_id: role === 'class_teacher' ? classId : null },
      });

      if (error) {
        setError(await getFunctionErrorMessage(error));
        return;
      }
      if (data?.error) {
        setError(String(data.error));
        return;
      }

      setMessage('Akaunti imetengenezwa. Mpe mtumiaji namba ya simu au barua pepe na nenosiri uliloweka.');
      setDisplayName('');
      setSelectedStaffMemberId('');
      setEmail('');
      setPhone('');
      setPassword('');
      setClassId('');
      try {
        await loadAccounts(schoolId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Akaunti imetengenezwa lakini orodha haijapakiwa.');
      }
    } catch (e) {
      setError(await getFunctionErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function startEditAccount(account: StaffAccount) {
    setEditingAccount(account);
    setEditDisplayName(account.display_name);
    setEditEmail(account.email || '');
    setEditPhone(account.phone || '');
    setEditRole(account.role);
    setEditClassId(account.class_id || '');
    setError('');
    setMessage('');
  }

  async function saveAccountChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAccount || !schoolId) return;
    setAccountActionSaving(true);
    setError('');
    setMessage('');
    try {
      const { data, error } = await supabase!.functions.invoke('manage-school-staff-user', {
        body: {
          action: 'update',
          school_id: schoolId,
          staff_account_id: editingAccount.id,
          display_name: editDisplayName.trim(),
          email: editEmail.trim(),
          phone: editPhone.trim(),
          role: editRole,
          class_id: editRole === 'class_teacher' ? editClassId : null,
        },
      });
      if (error) throw new Error(await getFunctionErrorMessage(error));
      if (data?.error) throw new Error(String(data.error));
      await loadAccounts(schoolId);
      setEditingAccount(null);
      setMessage('Taarifa za mtumiaji zimehaririwa kikamilifu.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Imeshindikana kuhariri mtumiaji.');
    } finally {
      setAccountActionSaving(false);
    }
  }

  async function deleteStaffAccount(account: StaffAccount) {
    const confirmed = window.confirm(`Una uhakika unataka kufuta akaunti ya ${account.display_name}? Mtumiaji hataweza tena kuingia kwenye mfumo.`);
    if (!confirmed) return;
    setAccountActionSaving(true);
    setError('');
    setMessage('');
    try {
      const { data, error } = await supabase!.functions.invoke('manage-school-staff-user', {
        body: { action: 'delete', school_id: schoolId, staff_account_id: account.id },
      });
      if (error) throw new Error(await getFunctionErrorMessage(error));
      if (data?.error) throw new Error(String(data.error));
      setAccounts(current => current.filter(item => item.id !== account.id));
      setAssignments(current => current.filter(item => item.staff_account_id !== account.id));
      if (editingAccount?.id === account.id) setEditingAccount(null);
      setMessage('Akaunti ya mtumiaji imefutwa kikamilifu.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Imeshindikana kufuta akaunti ya mtumiaji.');
    } finally {
      setAccountActionSaving(false);
    }
  }

  async function saveTeachingAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!schoolId || !assignmentStaffId || !assignmentClassId || assignmentSubjectIds.length === 0) {
      setError('Chagua mwalimu, darasa na angalau somo moja.');
      return;
    }
    if (editingAssignmentId && assignmentSubjectIds.length !== 1) {
      setError('Unapohariri upangaji mmoja, chagua somo moja tu.');
      return;
    }
    setAssignmentSaving(true);
    setError('');
    setMessage('');
    try {
      if (editingAssignmentId) {
        const { data: updatedAssignment, error } = await supabase!.from('school_staff_teaching_assignments')
          .update({
            staff_account_id: assignmentStaffId,
            class_id: assignmentClassId,
            subject_id: assignmentSubjectIds[0],
          })
          .eq('id', editingAssignmentId)
          .eq('school_id', schoolId)
          .select('id, staff_account_id, class_id, subject_id')
          .maybeSingle();
        if (error) throw error;
        if (!updatedAssignment) {
          throw new Error('Mabadiliko hayajahifadhiwa: rekodi haikupatikana au huna ruhusa ya kuibadilisha.');
        }
      } else {
        const alreadyAssigned = new Set(
          assignments
            .filter(a => a.staff_account_id === assignmentStaffId && a.class_id === assignmentClassId)
            .map(a => a.subject_id)
        );
        const newSubjectIds = assignmentSubjectIds.filter(id => !alreadyAssigned.has(id));
        if (newSubjectIds.length > 0) {
          const rows = newSubjectIds.map(subjectId => ({
            school_id: schoolId,
            staff_account_id: assignmentStaffId,
            class_id: assignmentClassId,
            subject_id: subjectId
          }));
          const { error } = await supabase!.from('school_staff_teaching_assignments').insert(rows);
          if (error) throw error;
        }
      }
      const { data, error: loadError } = await supabase!.from('school_staff_teaching_assignments')
        .select('id, staff_account_id, class_id, subject_id').eq('school_id', schoolId);
      if (loadError) throw loadError;
      setAssignments((data || []) as TeachingAssignment[]);
      setMessage(editingAssignmentId ? 'Upangaji umehaririwa kikamilifu.' : 'Masomo yamepangiwa mwalimu kikamilifu.');
      setAssignmentClassId('');
      setAssignmentSubjectIds([]);
      setEditingAssignmentId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Imeshindikana kuhifadhi upangaji.');
    } finally { setAssignmentSaving(false); }
  }

  function startEditTeachingAssignment(a: TeachingAssignment) {
    setEditingAssignmentId(a.id);
    setAssignmentStaffId(a.staff_account_id);
    setAssignmentClassId(a.class_id);
    setAssignmentSubjectIds([a.subject_id]);
    setError('');
    setMessage('Hariri mwalimu, darasa au somo kisha bonyeza Hifadhi mabadiliko.');
  }

  function cancelEditTeachingAssignment() {
    setEditingAssignmentId(null);
    setAssignmentStaffId('');
    setAssignmentClassId('');
    setAssignmentSubjectIds([]);
    setMessage('');
  }

  async function removeTeachingAssignment(id: string) {
    if (!window.confirm('Una uhakika unataka kuondoa upangaji huu?')) return;
    try {
      const { error } = await supabase!.from('school_staff_teaching_assignments').delete().eq('id', id);
      if (error) throw error;
      setAssignments(current => current.filter(item => item.id !== id));
      setMessage('Upangaji umeondolewa.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Imeshindikana kuondoa upangaji.');
    }
  }

  async function assignClassTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classTeacherStaffId || !classTeacherClassId) return;
    setClassTeacherSaving(true);
    setError('');
    setMessage('');
    try {
      const { error } = await supabase!.rpc('assign_school_class_teacher', {
        p_staff_account_id: classTeacherStaffId,
        p_class_id: classTeacherClassId
      });
      if (error) throw error;
      await loadAccounts(schoolId);
      setMessage('Darasa limepangiwa mwalimu kikamilifu.');
      setClassTeacherStaffId('');
      setClassTeacherClassId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Imeshindikana kumpangia mwalimu darasa.');
    } finally {
      setClassTeacherSaving(false);
    }
  }

  const input: CSSProperties = { width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: 9, boxSizing: 'border-box', fontSize: 15 };
  const label: CSSProperties = { display: 'grid', gap: 7, fontWeight: 600, color: '#334155', fontSize: 14 };

  return <div className="staff-users-module" style={{ display: 'grid', gap: 20, color: '#243447', width: '100%', minWidth: 0, maxWidth: '100%' }}>
    <section className="staff-users-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18 }}>
      <h3 style={{ marginTop: 0 }}>Usajili wa Watumishi</h3>
      <p style={{ color: '#64748b' }}>Sajili walimu na watumishi wengine hapa. Orodha hii ni ya ajira; jukumu la kuingia kwenye mfumo linachaguliwa tofauti wakati wa kutengeneza akaunti.</p>
      <form onSubmit={createDirectoryMember} className="staff-users-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(210px,100%),1fr))', gap: 12 }}>
        <label style={label}>Aina ya mtumishi<select style={input} value={staffCategory} onChange={e => { const category = e.target.value as 'teaching' | 'support'; setStaffCategory(category); setError(''); setStaffJobTitle(category === 'teaching' ? 'Mwalimu' : 'Mhasibu'); }}>
          <option value="support">Mtumishi mwingine</option><option value="teaching">Mwalimu aliyesajiliwa</option>
        </select></label>
        {staffCategory === 'teaching' ? <label style={label}>Chagua mwalimu kwenye orodha ya walimu<select style={input} value={staffTeacherId} onChange={e => setStaffTeacherId(e.target.value)} required>
          <option value="">Chagua mwalimu</option>{registeredTeachers.filter(t => (!t.status || t.status.toLowerCase() === 'active') && !staffDirectory.some(d => d.teacher_id === t.id)).map(t => <option key={t.id} value={t.id}>{[t.first_name, t.middle_name, t.last_name].filter(Boolean).join(' ')} ({t.employee_no})</option>)}
        </select></label> : <>
          <label style={label}>Jina kamili<input style={input} value={staffFullName} onChange={e => setStaffFullName(e.target.value)} required /></label>
          <label style={label}>Namba ya utumishi (si lazima)<input style={input} value={staffEmployeeNo} onChange={e => setStaffEmployeeNo(e.target.value)} /></label>
          <label style={label}>Nafasi ya kazi<input style={input} value={staffJobTitle} onChange={e => setStaffJobTitle(e.target.value)} placeholder="Mf. Mhasibu, Karani, Mlinzi" required /></label>
          <label style={label}>Namba ya simu (si lazima)<input style={input} type="tel" value={staffPhone} onChange={e => setStaffPhone(e.target.value)} /></label>
          <label style={label}>Barua pepe (si lazima)<input style={input} type="email" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} /></label>
        </>}
        {staffCategory === 'teaching' && <label style={label}>Nafasi ya kazi<input style={input} value={staffJobTitle} onChange={e => setStaffJobTitle(e.target.value)} required /></label>}
        <div style={{ display: 'flex', alignItems: 'end' }}><button type="submit" disabled={directorySaving || (staffCategory === 'teaching' && !staffTeacherId)} style={{ width: '100%', padding: 13, border: 0, borderRadius: 9, background: '#173b5e', color: '#fff', fontWeight: 700 }}>{directorySaving ? 'Inasajili...' : '＋ Sajili Mtumishi'}</button></div>
      </form>
      {editingDirectoryMember && <form onSubmit={saveDirectoryMember} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(200px,100%),1fr))', gap: 12, padding: 14, marginTop: 14, border: '1px solid #bfdbfe', borderRadius: 12, background: '#f8fbff' }}>
        <h4 style={{ gridColumn: '1 / -1', margin: 0 }}>Hariri mtumishi: {editingDirectoryMember.full_name}</h4>
        <label style={label}>Jina kamili<input style={input} value={editDirectoryName} onChange={e => setEditDirectoryName(e.target.value)} required /></label>
        <label style={label}>Namba ya utumishi<input style={input} value={editDirectoryEmployeeNo} onChange={e => setEditDirectoryEmployeeNo(e.target.value)} /></label>
        <label style={label}>Aina ya mtumishi<select style={input} value={editDirectoryCategory} onChange={e => setEditDirectoryCategory(e.target.value as 'teaching' | 'support')}>
          <option value="teaching">Mwalimu</option><option value="support">Mtumishi mwingine</option>
        </select></label>
        <label style={label}>Nafasi ya kazi<input style={input} value={editDirectoryJobTitle} onChange={e => setEditDirectoryJobTitle(e.target.value)} required /></label>
        <label style={label}>Namba ya simu<input style={input} type="tel" value={editDirectoryPhone} onChange={e => setEditDirectoryPhone(e.target.value)} /></label>
        <label style={label}>Barua pepe<input style={input} type="email" value={editDirectoryEmail} onChange={e => setEditDirectoryEmail(e.target.value)} /></label>
        <label style={label}>Hali<select style={input} value={editDirectoryStatus} onChange={e => setEditDirectoryStatus(e.target.value as 'Active' | 'Inactive')}>
          <option value="Active">Anafanya kazi</option><option value="Inactive">Hafanyi kazi</option>
        </select></label>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
          <button type="submit" disabled={directorySaving || !editDirectoryName.trim() || !editDirectoryJobTitle.trim()} style={{ border: 0, borderRadius: 8, padding: '11px 16px', background: '#173b5e', color: '#fff', fontWeight: 700 }}>{directorySaving ? 'Inahifadhi...' : 'Hifadhi mabadiliko'}</button>
          <button type="button" onClick={() => setEditingDirectoryMember(null)} disabled={directorySaving} style={{ border: 0, borderRadius: 8, padding: '11px 16px', background: '#eef2f6', color: '#334155', fontWeight: 700 }}>Ghairi</button>
        </div>
        {editingDirectoryMember.teacher_id && <p style={{ gridColumn: '1 / -1', margin: 0, color: '#64748b', fontSize: 12 }}>Kubadilisha aina kwenda “Mtumishi mwingine” hakufuti rekodi yake ya awali kwenye orodha ya walimu; kunabadilisha tu nafasi yake kwenye orodha ya watumishi.</p>}
      </form>}
      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
          <thead><tr><th style={{ textAlign: 'left', padding: 9 }}>Jina</th><th style={{ textAlign: 'left', padding: 9 }}>Namba ya utumishi</th><th style={{ textAlign: 'left', padding: 9 }}>Nafasi</th><th style={{ textAlign: 'left', padding: 9 }}>Aina</th><th style={{ textAlign: 'left', padding: 9 }}>Vitendo</th></tr></thead>
          <tbody>{staffDirectory.map(member => <tr key={member.id} style={{ borderTop: '1px solid #e2e8f0' }}>
            <td style={{ padding: 9 }}>{member.full_name}</td><td style={{ padding: 9 }}>{member.employee_no || '—'}</td><td style={{ padding: 9 }}>{member.job_title}</td><td style={{ padding: 9 }}>{member.staff_category === 'teaching' ? 'Mwalimu' : 'Mtumishi'}{member.status === 'Inactive' ? ' (Hafanyi kazi)' : ''}</td><td style={{ padding: 9 }}><button type="button" onClick={() => startEditDirectoryMember(member)} disabled={directorySaving} style={{ border: 0, borderRadius: 8, padding: '8px 10px', background: '#eaf2f8', color: '#173b5e', fontWeight: 700 }}>Hariri</button></td>
          </tr>)}</tbody>
        </table>
        {staffDirectory.length === 0 && <p>Hakuna watumishi waliosajiliwa bado.</p>}
      </div>
    </section>
    <section className="staff-users-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, minWidth: 0, maxWidth: '100%' }}>
      <h2 style={{ marginTop: 0 }}>Usimamizi wa Watumiaji</h2>
      <p style={{ color: '#64748b' }}>School Admin anaweza kutengeneza akaunti za wafanyakazi wa shule yake na kuwapa majukumu.</p>
      {error && <div role="alert" style={{ background: '#fff1f0', color: '#b42318', padding: 12, borderRadius: 9, marginBottom: 12 }}>{error}</div>}
      {message && <div role="status" style={{ background: '#ecfdf3', color: '#16845b', padding: 12, borderRadius: 9, marginBottom: 12 }}>{message}</div>}
      <form className="staff-users-form" onSubmit={createUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(220px,100%),1fr))', gap: 14, minWidth: 0 }}>
        <label style={label}>Mtumishi aliyesajiliwa<select style={input} value={selectedStaffMemberId} onChange={e => { const id = e.target.value; setSelectedStaffMemberId(id); const member = staffDirectory.find(item => item.id === id); if (member) { setDisplayName(member.full_name); setEmail(member.email || ''); setPhone(member.phone || ''); } }} required>
          <option value="">Chagua mtumishi</option>{staffDirectory.filter(member => member.status === 'Active' && ((role !== 'teacher' && role !== 'class_teacher') || (member.staff_category === 'teaching' && !!member.teacher_id))).map(member => <option key={member.id} value={member.id}>{member.full_name} — {member.job_title}{member.employee_no ? ` (${member.employee_no})` : ''}</option>)}
        </select></label>
        <label style={label}>Jina kamili<input style={input} value={displayName} onChange={e => setDisplayName(e.target.value)} required /></label>
        <label style={label}>Barua pepe (si lazima)<input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jina@shule.co.tz" /></label>
        <label style={label}>Namba ya simu (si lazima)<input style={input} type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XXXXXXXX au +2557XXXXXXXX" /></label>
        <label style={label}>Nenosiri la mwanzo (angalau herufi 8)<input style={input} type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></label>
        <label style={label}>Jukumu<select style={input} value={role} onChange={e => { const nextRole = e.target.value as StaffRole; setRole(nextRole); setClassId(''); setError(''); setSelectedStaffMemberId(''); }}>
          <option value="class_teacher">Mwalimu wa darasa</option>
          <option value="head_teacher">Mwalimu Mkuu</option>
          <option value="accountant">Mhasibu</option>
          <option value="teacher">Mwalimu</option>
          <option value="academic">Academic (Mratibu wa Taaluma)</option>
        </select></label>
        {role === 'class_teacher' && <label style={label}>Darasa analosimamia<select style={input} value={classId} onChange={e => { setClassId(e.target.value); setError(''); }} required>
          <option value="">Chagua darasa</option>{classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
        </select></label>}
        <div style={{ display: 'flex', alignItems: 'end' }}><button type="submit" disabled={saving || loading || !selectedStaffMemberId || (role === 'class_teacher' && !classId)} style={{ width: '100%', padding: 13, border: 0, borderRadius: 9, background: '#173b5e', color: '#fff', fontWeight: 700 }}>{saving ? 'Inatengeneza...' : '＋ Tengeneza Akaunti'}</button></div>
      </form>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 0 }}>Unaweza kutumia barua pepe au namba ya simu kuingia, pamoja na nenosiri. Jaza angalau kimoja kati ya hivyo.</p>
    </section>
    <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18 }}>
      <h3 style={{ marginTop: 0 }}>Watumiaji wa shule hii</h3>
      {editingAccount && <form onSubmit={saveAccountChanges} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(210px,100%),1fr))', gap: 12, padding: 14, marginBottom: 16, border: '1px solid #bfdbfe', borderRadius: 12, background: '#f8fbff' }}>
        <h4 style={{ gridColumn: '1 / -1', margin: 0 }}>Hariri taarifa za {editingAccount.display_name}</h4>
        <label style={label}>Jina kamili<input style={input} value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} required /></label>
        <label style={label}>Barua pepe (si lazima)<input style={input} type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} /></label>
        <label style={label}>Namba ya simu (si lazima)<input style={input} type="tel" inputMode="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} /></label>
        <label style={label}>Jukumu<select style={input} value={editRole} onChange={e => setEditRole(e.target.value as StaffRole)}>
          <option value="class_teacher">Mwalimu wa darasa</option><option value="head_teacher">Mwalimu Mkuu</option><option value="accountant">Mhasibu</option><option value="teacher">Mwalimu</option><option value="academic">Academic (Mratibu wa Taaluma)</option>
        </select></label>
        {editRole === 'class_teacher' && <label style={label}>Darasa analosimamia<select style={input} value={editClassId} onChange={e => setEditClassId(e.target.value)} required>
          <option value="">Chagua darasa</option>{classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
        </select></label>}
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="submit" disabled={accountActionSaving || !editDisplayName.trim() || (editRole === 'class_teacher' && !editClassId)} style={{ border: 0, borderRadius: 8, padding: '11px 16px', background: '#173b5e', color: '#fff', fontWeight: 700 }}>{accountActionSaving ? 'Inahifadhi...' : 'Hifadhi mabadiliko'}</button>
          <button type="button" onClick={() => setEditingAccount(null)} disabled={accountActionSaving} style={{ border: 0, borderRadius: 8, padding: '11px 16px', background: '#eef2f6', color: '#334155', fontWeight: 700 }}>Ghairi</button>
        </div>
        <p style={{ gridColumn: '1 / -1', margin: 0, color: '#64748b', fontSize: 12 }}>Kuhariri hapa hakubadilishi nenosiri la kuingia.</p>
      </form>}
      {loading ? <p>Inapakia...</p> : accounts.length === 0 ? <p>Hakuna akaunti za wafanyakazi zilizotengenezwa bado.</p> : <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
          <thead><tr><th style={{ textAlign: 'left', padding: 10 }}>Jina</th><th style={{ textAlign: 'left', padding: 10 }}>Barua pepe / Simu</th><th style={{ textAlign: 'left', padding: 10 }}>Jukumu</th><th style={{ textAlign: 'left', padding: 10 }}>Darasa</th><th style={{ textAlign: 'left', padding: 10 }}>Vitendo</th></tr></thead>
          <tbody>{accounts.map(a => <tr key={a.id} style={{ borderTop: '1px solid #e2e8f0' }}>
            <td style={{ padding: 10 }}>{a.display_name}</td><td style={{ padding: 10 }}>{a.email || a.phone || '—'}</td><td style={{ padding: 10 }}>{roleLabels[a.role]}</td><td style={{ padding: 10 }}>{classes.find(c => c.id === a.class_id)?.class_name || '—'}</td>
            <td style={{ padding: 10, whiteSpace: 'nowrap' }}>
              <button type="button" onClick={() => startEditAccount(a)} disabled={accountActionSaving} style={{ border: 0, borderRadius: 8, padding: '8px 10px', background: '#eaf2f8', color: '#173b5e', fontWeight: 700, marginRight: 6 }}>Hariri</button>
              <button type="button" onClick={() => deleteStaffAccount(a)} disabled={accountActionSaving} style={{ border: 0, borderRadius: 8, padding: '8px 10px', background: '#fff1f0', color: '#b42318', fontWeight: 700 }}>Futa</button>
            </td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
    <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18 }}>
      <h3 style={{ marginTop: 0 }}>Kupanga mwalimu wa darasa</h3>
      <p style={{ color: '#64748b' }}>Chagua mwalimu mwenye jukumu la Mwalimu au Mwalimu wa darasa na umpatie darasa analolisimamia. Jukumu lake la msingi halitabadilika.</p>
      <form className="staff-users-form" onSubmit={assignClassTeacher} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(200px,100%),1fr))', gap: 12, minWidth: 0 }}>
        <label style={label}>Mwalimu wa darasa<select style={input} value={classTeacherStaffId} onChange={e => setClassTeacherStaffId(e.target.value)} required>
          <option value="">Chagua mwalimu</option>{accounts.filter(a => (a.role === 'class_teacher' || a.role === 'teacher') && a.is_active).map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
        </select></label>
        <label style={label}>Darasa<select style={input} value={classTeacherClassId} onChange={e => setClassTeacherClassId(e.target.value)} required>
          <option value="">Chagua darasa</option>{classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
        </select></label>
        <div style={{ display: 'flex', alignItems: 'end' }}><button type="submit" disabled={classTeacherSaving || !classTeacherStaffId || !classTeacherClassId} style={{ width: '100%', padding: 13, border: 0, borderRadius: 9, background: '#173b5e', color: '#fff', fontWeight: 700 }}>{classTeacherSaving ? 'Inahifadhi...' : '＋ Panga darasa'}</button></div>
      </form>
      {accounts.filter(a => (a.role === 'class_teacher' || a.role === 'teacher') && a.is_active).length === 0
        ? <p>Hakuna akaunti hai za walimu. Tengeneza akaunti yenye jukumu la Mwalimu au Mwalimu wa darasa kwanza.</p>
        : <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
            <thead><tr><th style={{ textAlign: 'left', padding: 10 }}>Mwalimu</th><th style={{ textAlign: 'left', padding: 10 }}>Darasa analosimamia</th></tr></thead>
            <tbody>{accounts.filter(a => (a.role === 'class_teacher' || a.role === 'teacher') && a.is_active).map(a => <tr key={a.id} style={{ borderTop: '1px solid #e2e8f0' }}>
              <td style={{ padding: 10 }}>{a.display_name}</td>
              <td style={{ padding: 10 }}>{classes.find(c => c.id === a.class_id)?.class_name || 'Hajapangiwa'}</td>
            </tr>)}</tbody>
          </table>
        </div>}
    </section>
    <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18 }}>
      <h3 style={{ marginTop: 0 }}>Kupanga walimu kwenye madarasa na masomo</h3>
      <p style={{ color: '#64748b' }}>Chagua mwalimu, darasa na somo. Mwalimu ataona taarifa za madarasa na masomo aliyopangiwa tu.</p>
      {error && <div role="alert" style={{ background: '#fff1f0', color: '#b42318', padding: 12, borderRadius: 9, marginBottom: 12, overflowWrap: 'anywhere' }}>{error}</div>}
      {message && <div role="status" style={{ background: '#ecfdf3', color: '#16845b', padding: 12, borderRadius: 9, marginBottom: 12 }}>{message}</div>}
      <form className="staff-users-form" onSubmit={saveTeachingAssignment} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(180px,100%),1fr))', gap: 12, minWidth: 0 }}>
        <label style={label}>Mwalimu<select style={input} value={assignmentStaffId} onChange={e => setAssignmentStaffId(e.target.value)} required>
          <option value="">Chagua mwalimu</option>{accounts.filter(a => a.role === 'teacher' && a.is_active && a.teacher_id).map(a => { const t = registeredTeachers.find(item => item.id === a.teacher_id); const name = t ? [t.first_name, t.middle_name, t.last_name].filter(Boolean).join(' ') : a.display_name; return <option key={a.id} value={a.id}>{name}</option>; })}
        </select></label>
        <label style={label}>Darasa<select style={input} value={assignmentClassId} onChange={e => setAssignmentClassId(e.target.value)} required>
          <option value="">Chagua darasa</option>{classes.map(item => <option key={item.id} value={item.id}>{item.class_name}</option>)}
        </select></label>
        <fieldset className="staff-subject-picker" style={{ border: '1px solid #cbd5e1', borderRadius: 9, padding: 12, minWidth: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, color: '#334155', fontSize: 14, padding: '0 5px' }}>Masomo (chagua moja au zaidi)</legend>
          {subjects.length === 0 ? <p style={{ margin: 0, color: '#64748b' }}>Hakuna masomo yaliyosajiliwa kwenye shule hii.</p> :
            <div className="staff-subject-options">
              {subjects.map(item => <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 4px', fontWeight: 500, minWidth: 0 }}>
                <input type="checkbox" checked={assignmentSubjectIds.includes(item.id)} onChange={e => setAssignmentSubjectIds(current => e.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} style={{ width: 18, height: 18, flex: '0 0 auto' }} />
                <span>{item.subject_name}</span>
              </label>)}
            </div>}
          <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 12 }}>Yamechaguliwa: {assignmentSubjectIds.length}</p>
        </fieldset>
        <div style={{ display: 'flex', alignItems: 'end' }}><button type="submit" disabled={assignmentSaving || !assignmentStaffId || !assignmentClassId || assignmentSubjectIds.length === 0 || (!!editingAssignmentId && assignmentSubjectIds.length !== 1)} style={{ width: '100%', padding: 13, border: 0, borderRadius: 9, background: '#173b5e', color: '#fff', fontWeight: 700 }}>{assignmentSaving ? 'Inahifadhi...' : editingAssignmentId ? 'Hifadhi mabadiliko' : '＋ Panga masomo yaliyochaguliwa'}</button></div>
      </form>
      {accounts.filter(a => a.role === 'teacher' && a.is_active && a.teacher_id).length === 0 && <p style={{ color: '#64748b', fontSize: 13 }}>Hakuna walimu wenye akaunti zilizounganishwa na orodha ya walimu. Unganisha mwalimu wakati wa kutengeneza akaunti yake.</p>}
      {editingAssignmentId && <button type="button" onClick={cancelEditTeachingAssignment} style={{ marginTop: 8, border: 0, borderRadius: 8, padding: '10px 14px', background: '#eef3f7', color: '#173b5e', fontWeight: 700 }}>Ghairi kuhariri</button>}
      {assignments.length === 0 ? <p>Hakuna walimu waliopangiwa masomo bado.</p> : <div style={{ overflowX: 'auto', marginTop: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
          <thead><tr><th style={{ textAlign: 'left', padding: 10 }}>Mwalimu</th><th style={{ textAlign: 'left', padding: 10 }}>Darasa</th><th style={{ textAlign: 'left', padding: 10 }}>Somo</th><th style={{ textAlign: 'left', padding: 10 }}>Kitendo</th></tr></thead>
          <tbody>{assignments.map(a => <tr key={a.id} style={{ borderTop: '1px solid #e2e8f0' }}>
            <td style={{ padding: 10 }}>{accounts.find(x => x.id === a.staff_account_id)?.display_name || '—'}</td>
            <td style={{ padding: 10 }}>{classes.find(x => x.id === a.class_id)?.class_name || '—'}</td>
            <td style={{ padding: 10 }}>{subjects.find(x => x.id === a.subject_id)?.subject_name || '—'}</td>
            <td style={{ padding: 10, whiteSpace: 'nowrap' }}><button type="button" onClick={() => startEditTeachingAssignment(a)} style={{ border: 0, borderRadius: 8, padding: '8px 10px', background: '#eaf2f8', color: '#173b5e', fontWeight: 700, marginRight: 6 }}>Hariri</button><button type="button" onClick={() => removeTeachingAssignment(a.id)} style={{ border: 0, borderRadius: 8, padding: '8px 10px', background: '#fff1f0', color: '#b42318', fontWeight: 700 }}>Ondoa</button></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  </div>;
}
