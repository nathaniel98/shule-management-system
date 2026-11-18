
import ResultsModule from './src/ResultsModule';
import ReportsModule from './src/ReportsModule';
import ClassesModule from './src/ClassesModule';
import FeesModule from './src/FeesModule';
import { useEffect, useState, type FormEvent } from 'react';
import { SchoolModule } from './SchoolModule';
import StudentsModule from './src/StudentsModule';
import EnrollmentModule from './src/EnrollmentModule';
import TeachersModule from './src/TeachersModule';
import StreamsModule from './src/StreamsModule';
import SubjectsModule from './src/SubjectsModule';
import ExamsModule from './src/ExamsModule';
import AcademicYearsModule from './src/AcademicYearsModule';

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
  | 'enrollment'
  | 'teachers'
  | 'classes'
  | 'streams'
  | 'subjects'
  | 'academic-years'
  | 'exams'
  | 'results'
  | 'fees'
  | 'reports'
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
  { id: 'results', label: 'Matokeo', icon: ChartNoAxesCombined },
  { id: 'fees', label: 'Ada na Malipo', icon: Wallet },
  { id: 'reports', label: 'Ripoti', icon: Activity },
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

  async function loadDashboardStats() {
    if (!supabase) {
      setDashboardError('Supabase haijaunganishwa. Kagua mipangilio ya Vercel.');
      setDashboardLoading(false);
      return;
    }

    setDashboardLoading(true);
