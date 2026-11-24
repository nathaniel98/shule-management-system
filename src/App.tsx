import ClassesModule from './ClassesModule';
import FeesModule from './FeesModule';
import { useEffect, useState, type FormEvent } from 'react';
import { SchoolModule } from '../SchoolModule';
import StudentsModule from './StudentsModule';
import EnrollmentModule from './EnrollmentModule';
import TeachersModule from './TeachersModule';
import StreamsModule from './StreamsModule';
import SubjectsModule from './SubjectsModule';
import ExamsModule from './ExamsModule';
import ResultsModule from './ResultsModule';
import ReportsModule from './ReportsModule';
import SchoolSettingsModule from './SchoolSettingsModule';
import StaffUsersModule from './StaffUsersModule';
import AcademicYearsModule from './AcademicYearsModule';

import {
  Activity,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  School,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X
} from 'lucide-react';

import { isSupabaseConfigured, supabase } from './supabase';

type StaffRole = 'class_teacher' | 'head_teacher' | 'accountant' | 'teacher';

type Section =
  | 'dashboard'
  | 'schools'
  | 'students'
  | 'enrollment'
  | 'teachers'
  | 'classes'
  | 'streams'
  | 'subjects'
  | 'academic-years'
  | 'exams'
  | 'results'
  | 'reports'
  | 'fees'
  | 'settings'
  | 'users';

const nav: { id: Section; label: string; icon: any }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'schools', label: 'Shule', icon: School },
  { id: 'students', label: 'Wanafunzi', icon: GraduationCap },
  { id: 'enrollment', label: 'Usajili wa Madarasa', icon: Users },
  { id: 'teachers', label: 'Walimu', icon: Users },
  { id: 'classes', label: 'Madarasa', icon: Building2 },
  { id: 'streams', label: 'Mikondo', icon: Users },
  { id: 'subjects', label: 'Masomo', icon: BookOpen },
  { id: 'academic-years', label: 'Miaka ya Masomo', icon: CalendarDays },
  { id: 'exams', label: 'Mitihani', icon: ClipboardList },
  { id: 'results', label: 'Matokeo', icon: ClipboardList },
  { id: 'reports', label: 'Ripoti', icon: Activity },
  { id: 'fees', label: 'Ada na Malipo', icon: Wallet },
  { id: 'settings', label: 'Mipangilio', icon: Settings },
  { id: 'users', label: 'Watumiaji', icon: ShieldCheck }
];

function App() {
  const [section, setSection] = useState<Section>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<any>(null);
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [notice, setNotice] = useState('');

  const [dashboardCounts, setDashboardCounts] = useState({
    schools: 0,
    students: 0,
    teachers: 0,
    classes: 0
  });

  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [activeSchoolName, setActiveSchoolName] = useState('Shule yangu');
  const [schoolAccessLoading, setSchoolAccessLoading] = useState(false);

  async function loadDashboardStats() {
    if (!supabase) {
      setDashboardError('Supabase haijaunganishwa. Kagua mipangilio ya Vercel.');
      setDashboardLoading(false);
      return;
    }

    setDashboardLoading(true);
    setDashboardError('');

    try {
      const [
        schoolsCount,
        studentsCount,
        teachersCount,
        classesCount,
        recentSchools,
        recentStudents,
        recentTeachers
      ] = await Promise.all([
        supabase.from('schools').select('id', { count: 'exact', head: true }),
        supabase.from('students').select('id', { count: 'exact', head: true }),
        supabase.from('teachers').select('id', { count: 'exact', head: true }),
        supabase.from('classes').select('id', { count: 'exact', head: true }),

        supabase.from('schools')
          .select('id, school_name, created_at')
          .order('created_at', { ascending: false })
          .limit(5),

        supabase.from('students')
          .select('id, admission_no, first_name, middle_name, last_name, created_at')
          .order('created_at', { ascending: false })
          .limit(5),

        supabase.from('teachers')
          .select('id, employee_no, first_name, middle_name, last_name, created_at')
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      const results = [
        schoolsCount,
        studentsCount,
        teachersCount,
        classesCount
      ];

      const labels = [
        'Shule',
        'Wanafunzi',
        'Walimu',
        'Madarasa'
      ];

      const failedIndex = results.findIndex(
        result => Boolean(result.error)
      );

      const activityError =
        recentSchools.error ||
        recentStudents.error ||
        recentTeachers.error;

      if (failedIndex !== -1) {
        const failedResult = results[failedIndex];

        const message =
          failedResult.error?.message ||
          'Hitilafu haijafafanuliwa.';

        setDashboardError(
          `Imeshindikana kusoma idadi ya ${labels[failedIndex].toLowerCase()}: ${message}. Kagua ruhusa za SELECT/RLS za jedwali hilo.`
        );

        return;
      }

      setDashboardCounts({
        schools: schoolsCount.count ?? 0,
        students: studentsCount.count ?? 0,
        teachers: teachersCount.count ?? 0,
        classes: classesCount.count ?? 0
      });

      if (activityError) {
        console.error(
          'Dashboard activity query error:',
          activityError.message
        );

        setRecentActivities([]);
      } else {
        const activities = [
          ...(recentSchools.data || []).map((row: any) => ({
            id: `school-${row.id}`,
            category: 'Shule',
            title: row.school_name || 'Shule mpya',
            detail: 'Shule imesajiliwa',
            created_at: row.created_at
          })),

          ...(recentStudents.data || []).map((row: any) => ({
            id: `student-${row.id}`,
            category: 'Mwanafunzi',
            title: [
              row.first_name,
              row.middle_name,
              row.last_name
            ].filter(Boolean).join(' ') || 'Mwanafunzi mpya',
            detail: `Namba ya usajili: ${row.admission_no || 'Haijawekwa'}`,
            created_at: row.created_at
          })),

          ...(recentTeachers.data || []).map((row: any) => ({
            id: `teacher-${row.id}`,
            category: 'Mwalimu',
            title: [
              row.first_name,
              row.middle_name,
              row.last_name
            ].filter(Boolean).join(' ') || 'Mwalimu mpya',
            detail: `Namba ya ajira: ${row.employee_no || 'Haijawekwa'}`,
            created_at: row.created_at
          }))
        ];

        setRecentActivities(
          activities
            .filter(item => item.created_at)
            .sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            )
            .slice(0, 8)
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Hitilafu ya muunganisho.';

      setDashboardError(
        `Imeshindikana kupakia takwimu: ${message}`
      );
    } finally {
      setDashboardLoading(false);
    }
  }

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) void loadDashboardStats();
  }, [session]);

  useEffect(() => {
    let active = true;
    async function loadStaffRole() {
      if (!session?.user?.id || !supabase) {
        setStaffRole(null);
        return;
      }
      const userEmail = (session.user.email || '').toLowerCase();
      if (userEmail === 'goodlucknoel19@gmail.com') {
        setStaffRole(null);
        return;
      }
      setRoleLoading(true);
      const { data, error } = await supabase
        .from('school_staff_accounts')
        .select('role, is_active')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.error('Could not load staff role:', error.message);
        setStaffRole(null);
      } else if (data?.is_active) {
        setStaffRole(data.role as StaffRole);
      } else {
        setStaffRole(null);
      }
      setRoleLoading(false);
    }
    void loadStaffRole();
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    async function loadMySchool() {
      if (!session?.user?.id || !supabase) return;
      setSchoolAccessLoading(true);

      // The platform owner account represents the whole database,
      // not an individual school membership.
      if ((session.user.email || '').toLowerCase() === 'goodlucknoel19@gmail.com') {
        if (!cancelled) {
          setActiveSchoolName('Shule Management Database');
          setSchoolAccessLoading(false);
        }
        return;
      }

      const { data, error } = await supabase.rpc('get_my_school_for_staff');
      if (!cancelled) {
        if (error) {
          console.error('Could not load assigned school:', error.message);
          setActiveSchoolName('Hitilafu ya kusoma shule');
        } else {
          const assignedSchool = Array.isArray(data) ? data[0] : data;
          setActiveSchoolName(assignedSchool?.school_name || 'Shule haijaunganishwa');
        }
        setSchoolAccessLoading(false);
      }
    }
    void loadMySchool();
    return () => { cancelled = true; };
  }, [session]);

  async function signIn(e: FormEvent) {
    e.preventDefault();

    if (!supabase) {
      setNotice(
        'Database bado haijaunganishwa. Weka VITE_SUPABASE_URL na VITE_SUPABASE_ANON_KEY kwenye Vercel.'
      );
      return;
    }

    setAuthLoading(true);
    setNotice('');

    const identifier = email.trim();
    let signInError: string | null = null;

    // Email login goes directly to Supabase Auth. This avoids an unnecessary
    // Edge Function hop for Super Admin and School Admin email addresses.
    if (identifier.includes('@')) {
      const { error } = await supabase.auth.signInWithPassword({
        email: identifier.toLowerCase(),
        password
      });
      signInError = error?.message || null;
    } else {
      // Usernames are resolved securely by the server-side login function.
      const { data: loginData, error: invokeError } = await supabase.functions.invoke('school-admin-login', {
        body: { identifier, password }
      });

      if (invokeError) {
        signInError = invokeError.message;
      } else if (loginData?.access_token && loginData?.refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token: loginData.access_token,
          refresh_token: loginData.refresh_token
        });
        signInError = error?.message || null;
      } else {
        signInError = loginData?.error || 'Jibu la kuingia halijakamilika. Jaribu tena.';
      }
    }

    setAuthLoading(false);
    if (signInError) setNotice(signInError);
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setSession(null);
    setSection('dashboard');
  }

  const stats = [
    {
      label: 'Shule zilizosajiliwa',
      value: dashboardLoading
        ? '...'
        : dashboardError
          ? '—'
          : dashboardCounts.schools.toLocaleString(),
      icon: School,
      sub: 'Jumla ya shule zilizosajiliwa'
    },
    {
      label: 'Wanafunzi',
      value: dashboardLoading
        ? '...'
        : dashboardError
          ? '—'
          : dashboardCounts.students.toLocaleString(),
      icon: GraduationCap,
      sub: 'Jumla ya wanafunzi'
    },
    {
      label: 'Walimu',
      value: dashboardLoading
        ? '...'
        : dashboardError
          ? '—'
          : dashboardCounts.teachers.toLocaleString(),
      icon: Users,
      sub: 'Walimu waliosajiliwa'
    },
    {
      label: 'Madarasa',
      value: dashboardLoading
        ? '...'
        : dashboardError
          ? '—'
          : dashboardCounts.classes.toLocaleString(),
      icon: Building2,
      sub: 'Madarasa yaliyosajiliwa'
    }
  ];

  const isSuperAdmin = (session?.user?.email || '').toLowerCase() === 'goodlucknoel19@gmail.com';
  const roleSections: Record<StaffRole, Section[]> = {
    head_teacher: ['dashboard', 'students', 'enrollment', 'teachers', 'classes', 'streams', 'subjects', 'academic-years', 'exams', 'results', 'reports'],
    accountant: ['dashboard', 'students', 'teachers', 'classes', 'exams', 'results', 'reports', 'fees'],
    class_teacher: ['dashboard', 'students', 'results'],
    teacher: ['dashboard', 'classes', 'subjects', 'exams', 'results']
  };
  const allowedSections = isSuperAdmin
    ? nav.map(item => item.id).filter(id => id !== 'users')
    : staffRole
      ? roleSections[staffRole]
      : nav.map(item => item.id).filter(id => id !== 'schools');
  const visibleNav = nav.filter(item => allowedSections.includes(item.id));
  const current = nav.find(n => n.id === section) || nav[0];

  // Restrict navigation and direct section state to the user's assigned role.
  useEffect(() => {
    if (!session || roleLoading) return;
    if (!allowedSections.includes(section)) setSection('dashboard');
  }, [session, roleLoading, staffRole, section, isSuperAdmin]);

  // School registration is a platform-owner function, never a school user function.

  if (!session) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="brand-mark">
            <School size={30} />
          </div>

          <p className="eyebrow">SHULE MANAGEMENT SUITE</p>
          <h1>Karibu kwenye mfumo</h1>

          <p className="muted">
            Ingia kusimamia shughuli za shule yako.
          </p>

          <form onSubmit={signIn}>
            <label>Username au barua pepe</label>

            <input
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Username au jina@shule.co.tz"
autoComplete="username"
              required
            />

            <label>Nenosiri</label>

            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Ingiza nenosiri"
              required
            />

            <button className="primary full" disabled={authLoading}>
              {authLoading ? 'Inaingia...' : 'Ingia kwenye mfumo'}
            </button>
          </form>

          {notice && <div className="notice">{notice}</div>}

          <div className="login-foot">
            {isSupabaseConfigured
              ? 'Imeandaliwa kwa usalama kupitia Supabase'
              : 'Muunganisho wa database unasubiri usanidi'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${mobileOpen ? 'open' : ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100dvh',
          maxHeight: '100dvh',
          overflow: 'hidden'
        }}
      >
        <div className="brand" style={{ flexShrink: 0 }}>
          <div className="brand-mark small">
            <School size={23} />
          </div>

          <div>
            <b>Shule Suite</b>
            <span>School Management</span>
          </div>

          <button
            className="icon-btn close-mobile"
            onClick={() => setMobileOpen(false)}
          >
            <X />
          </button>
        </div>

        <div className="school-switch" style={{ flexShrink: 0 }}>
          <div className="school-avatar">{activeSchoolName.charAt(0).toUpperCase()}</div>

          <div style={{ minWidth: 0 }}>
            <b>{schoolAccessLoading ? 'Inapakia shule...' : activeSchoolName}</b>
            <span>Usimamizi wa shule</span>
          </div>
        </div>

        <p className="nav-caption" style={{ flexShrink: 0 }}>
          MENU KUU
        </p>

        <nav
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            overscrollBehaviorY: 'contain',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: '16px'
          }}
        >
          {visibleNav.map(n => (
            <button
              key={n.id}
              className={`nav-item ${section === n.id ? 'active' : ''}`}
              onClick={() => {
                setSection(n.id);
                setMobileOpen(false);
              }}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        <div
          className="sidebar-bottom"
          style={{
            flexShrink: 0,
            background: '#fff'
          }}
        >
          <div className="help">
            <CircleHelp size={18} />
            <span>Kituo cha msaada</span>
          </div>

          <div className="user-row">
            <div className="user-avatar">
              {session.user.email?.[0]?.toUpperCase() || 'A'}
            </div>

            <div className="user-info">
              <b>{session.user.email}</b>
              <span>{isSuperAdmin ? 'Super Admin' : staffRole ? ({ class_teacher: 'Mwalimu wa darasa', head_teacher: 'Mwalimu Mkuu', accountant: 'Mhasibu', teacher: 'Mwalimu' } as Record<StaffRole, string>)[staffRole] : 'School Admin'}</span>
            </div>

            <button
              className="icon-btn"
              onClick={signOut}
              title="Toka"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </button>

          <div className="crumb">
            Mfumo wa Usimamizi <span>/</span> <b>{current.label}</b>
          </div>

          <div className="top-actions">
            <span className="status">
              <i /> Mfumo wa shule
            </span>

            <div className="user-avatar">
              {session.user.email?.[0]?.toUpperCase() || 'A'}
            </div>
          </div>
        </header>

        <div className="content">
          <div className="welcome">
            <div>
              <p className="eyebrow">MUHTASARI WA SHULE</p>

              <h1>
                {section === 'dashboard' ? 'Dashboard' : current.label}
              </h1>

              <p className="muted">
                Karibu tena. Huu ni muhtasari wa usimamizi wa shule yako.
              </p>
            </div>

            <button className="secondary">
              <CalendarDays size={17} />
              Mwaka wa masomo
              <ChevronDown size={15} />
            </button>
          </div>

          {section === 'dashboard' ? (
            <>
              {dashboardError && (
                <div className="notice" role="alert" style={{ marginBottom: 16 }}>
                  {dashboardError}
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void loadDashboardStats()}
                  >
                    Jaribu tena
                  </button>
                </div>
              )}

              <div className="stats-grid">
                {stats.map(s => (
                  <div className="stat-card" key={s.label}>
                    <div className="stat-top">
                      <span>{s.label}</span>

                      <div className="stat-icon">
                        <s.icon size={19} />
                      </div>
                    </div>

                    <strong>{s.value}</strong>
                    <small>{s.sub}</small>
                  </div>
                ))}
              </div>

              <div className="grid-two">
                
              </div>
            </>
          ) : section === 'schools' && isSuperAdmin ? (
            <SchoolModule />
          ) : section === 'students' ? (
            <StudentsModule />
          ) : section === 'enrollment' ? (
            <EnrollmentModule />
          ) : section === 'teachers' ? (
            <TeachersModule />
          ) : section === 'classes' ? (
            <ClassesModule />
          ) : section === 'streams' ? (
            <StreamsModule />
          ) : section === 'subjects' ? (
            <SubjectsModule />
          ) : section === 'academic-years' ? (
            <AcademicYearsModule />
          ) : section === 'exams' ? (
            <ExamsModule />
          ) : section === 'results' ? (
            <ResultsModule />
          ) : section === 'reports' ? (
            <ReportsModule onEditResults={() => setSection('results')} />
          ) : section === 'fees' ? (
            <FeesModule />
          ) : section === 'settings' ? (
            <SchoolSettingsModule isSuperAdmin={isSuperAdmin} />
          ) : section === 'users' && !isSuperAdmin ? (
            <StaffUsersModule />
          ) : (
            <section className="panel module-panel">
              <div className="module-icon">
                <current.icon size={25} />
              </div>

              <h2>{current.label}</h2>

              <p>
                Sehemu hii imeandaliwa. Itaunganishwa na jedwali
                husika la Supabase baada ya kuthibitisha ruhusa
                za database na mtiririko wa kazi.
              </p>

              <div className="module-meta">
                <span className="pill">Inasubiri kuunganishwa</span>

                <span>
                  Hakuna data itakayobadilishwa bila uthibitisho.
                </span>
              </div>
            </section>
          )}

          <footer>
            © 2026 Shule Management Suite
            <span>Imejengwa kwa ajili ya usimamizi wa shule</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
