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
  | 'settings';

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
  { id: 'settings', label: 'Mipangilio', icon: Settings }
];

function App() {
  const [section, setSection] = useState<Section>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<any>(null);
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

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    setAuthLoading(false);

    if (error) setNotice(error.message);
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

  const current = nav.find(n => n.id === section)!;

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
            <label>Barua pepe</label>

            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jina@shule.co.tz"
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
          <div className="school-avatar">S</div>

          <div>
            <b>Shule yangu</b>
            <span>Usimamizi wa shule</span>
          </div>

          <ChevronDown size={16} />
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
          {nav.map(n => (
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
              <span>Mtumiaji wa mfumo</span>
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
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Muhtasari wa shughuli</h2>
                      <p>Shughuli muhimu za shule</p>
                    </div>

                    <span className="pill">Leo</span>
                  </div>

                  {dashboardLoading ? (
                    <div className="empty-state">
                      <div className="empty-icon">
                        <ClipboardList size={25} />
                      </div>
                      <b>Inapakia shughuli za hivi karibuni...</b>
                    </div>
                  ) : dashboardError ? (
                    <div className="empty-state">
                      <div className="empty-icon">
                        <ClipboardList size={25} />
                      </div>
                      <b>Shughuli hazijaweza kupakiwa</b>
                      <span>{dashboardError}</span>

                      <button
                        type="button"
                        className="secondary"
                        onClick={() => void loadDashboardStats()}
                        style={{ marginTop: 12 }}
                      >
                        Jaribu tena
                      </button>
                    </div>
                  ) : recentActivities.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">
                        <ClipboardList size={25} />
                      </div>
                      <b>Bado hakuna shughuli za usajili</b>
                      <span>
                        Usajili mpya wa shule, wanafunzi na walimu utaonekana hapa.
                      </span>

                      <button
                        type="button"
                        className="secondary"
                        onClick={() => void loadDashboardStats()}
                        style={{ marginTop: 12 }}
                      >
                        Onyesha upya shughuli
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 0 }}>
                      {recentActivities.map((item, index) => (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 12,
                            padding: '13px 0',
                            borderBottom:
                              index === recentActivities.length - 1
                                ? 'none'
                                : '1px solid #e5e7eb'
                          }}
                        >
                          <div className="stat-icon" style={{ flexShrink: 0 }}>
                            <Activity size={18} />
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <b style={{ display: 'block', color: '#243b53' }}>
                              {item.title}
                            </b>

                            <span
                              style={{
                                display: 'block',
                                color: '#64748b',
                                fontSize: 13,
                                marginTop: 3
                              }}
                            >
                              {item.category} · {item.detail}
                            </span>

                            <time
                              dateTime={item.created_at}
                              style={{
                                display: 'block',
                                color: '#94a3b8',
                                fontSize: 12,
                                marginTop: 4
                              }}
                            >
                              {new Date(item.created_at).toLocaleString('sw-TZ', {
                                dateStyle: 'medium',
                                timeStyle: 'short'
                              })}
                            </time>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        className="secondary"
                        onClick={() => void loadDashboardStats()}
                        style={{ marginTop: 12 }}
                      >
                        Onyesha upya shughuli
                      </button>
                    </div>
                  )}
                </section>

                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Hali ya mfumo</h2>
                      <p>Muunganisho na usalama</p>
                    </div>

                    <ShieldCheck size={20} color="#16845b" />
                  </div>

                  <div className="check-row">
                    <span>Supabase project</span>

                    <b className="good">
                      {isSupabaseConfigured ? 'Imewekwa' : 'Inasubiri'}
                    </b>
                  </div>

                  <div className="check-row">
                    <span>Uthibitishaji wa mtumiaji</span>
                    <b className="good">Umeingia</b>
                  </div>

                  <div className="check-row">
                    <span>Ruhusa za kusoma takwimu</span>

                    <b className={dashboardError ? 'pending' : 'good'}>
                      {dashboardLoading
                        ? 'Inakaguliwa'
                        : dashboardError
                          ? 'Kuna hitilafu'
                          : 'Zinafanya kazi'}
                    </b>
                  </div>

                  <div className="secure-note">
                    Huu ni ukaguzi wa kusoma takwimu pekee. Ruhusa za kuandika
                    na sera zote za RLS zinahitaji ukaguzi tofauti.
                  </div>
                </section>
              </div>
            </>
          ) : section === 'schools' ? (
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
