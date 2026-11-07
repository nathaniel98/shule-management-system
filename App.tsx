
import ClassesModule from './src/ClassesModule';
import { useEffect, useState } from 'react';
import { SchoolModule } from './SchoolModule';
import StudentsModule from './src/StudentsModule';
import TeachersModule from './src/TeachersModule';
import StreamsModule from './src/StreamsModule';
import {
  Activity,
  BookOpen,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
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
  | 'teachers'
  | 'classes'
  | 'streams'
  | 'subjects'
  | 'exams'
  | 'results'
  | 'fees'
  | 'reports'
  | 'settings';

const nav: { id: Section; label: string; icon: any }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'schools', label: 'Shule', icon: School },
  { id: 'students', label: 'Wanafunzi', icon: GraduationCap },
  { id: 'teachers', label: 'Walimu', icon: Users },
  { id: 'classes', label: 'Madarasa', icon: Building2 },
  { id: 'streams', label: 'Mikondo', icon: Users },
  { id: 'subjects', label: 'Masomo', icon: BookOpen },
  { id: 'exams', label: 'Mitihani', icon: ClipboardList },
  { id: 'results', label: 'Matokeo', icon: ChartNoAxesCombined },
  { id: 'fees', label: 'Ada na Malipo', icon: Wallet },
  { id: 'reports', label: 'Ripoti', icon: Activity },
  { id: 'settings', label: 'Mipangilio', icon: Settings }
];

const stats = [
  {
    label: 'Shule zilizosajiliwa',
    value: '—',
    icon: School,
    sub: 'Taarifa zitaonekana baada ya ruhusa za DB'
  },
  {
    label: 'Wanafunzi',
    value: '—',
    icon: GraduationCap,
    sub: 'Jumla ya wanafunzi'
  },
  {
    label: 'Walimu',
    value: '—',
    icon: Users,
    sub: 'Walimu waliosajiliwa'
  },
  {
    label: 'Madarasa',
    value: '—',
    icon: Building2,
    sub: 'Madarasa yanayotumika'
  }
];

function App() {
  const [section, setSection] = useState<Section>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [notice, setNotice] = useState('');

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

  async function signIn(e: React.FormEvent) {
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
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="brand">
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

        <div className="school-switch">
          <div className="school-avatar">S</div>
          <div>
            <b>Shule yangu</b>
            <span>Usimamizi wa shule</span>
          </div>
          <ChevronDown size={16} />
        </div>

        <p className="nav-caption">MENU KUU</p>

        <nav>
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

        <div className="sidebar-bottom">
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

                  <div className="empty-state">
                    <div className="empty-icon">
                      <ClipboardList size={25} />
                    </div>
                    <b>Hakuna taarifa za kuonyesha bado</b>
                    <span>
                      Baada ya kuunganisha ruhusa za database,
                      takwimu zitaonekana hapa.
                    </span>
                  </div>
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
                    <span>Ruhusa za kusoma/kuandika</span>
                    <b className="pending">Zinasubiri ukaguzi</b>
                  </div>

                  <div className="secure-note">
                    Taarifa za shule zitalindwa kwa sera za RLS
                    na ruhusa za kila jukumu.
                  </div>
                </section>
              </div>
            </>
          ) : section === 'schools' ? (
            <SchoolModule />
          ) : section === 'students' ? (
            <StudentsModule />
          ) : section === 'teachers' ? (
            <TeachersModule />
          ) : section === 'classes' ? (
            <ClassesModule />
          ) : section === 'streams' ? (
            <StreamsModule />
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
