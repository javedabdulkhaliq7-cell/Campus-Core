import {
  LayoutDashboard, Users, CalendarCheck, BarChart3, CreditCard,
  ChevronRight, School, LogOut, FileText, Bell, PieChart, Wallet,
} from 'lucide-react';
import { APP_NAME } from '../lib/supabase';

export type TeacherPage =
  | 'dashboard' | 'students' | 'attendance' | 'results' | 'defaulters'
  | 'certificates' | 'student_profiles' | 'announcements' | 'reports' | 'fee_management';

interface TeacherPermissions {
  tabs: {
    dashboard: boolean;
    students: boolean;
    attendance: boolean;
    results: boolean;
    defaulters: boolean;
  };
  extra: {
    print_results:    boolean;
    certificates:     boolean;
    student_profiles: boolean;
    announcements:    boolean;
    reports:          boolean;
    fee_management:   boolean;
  };
}

interface TeacherSidebarProps {
  currentPage: TeacherPage;
  onNavigate: (page: TeacherPage) => void;
  isOpen: boolean;
  schoolName: string;
  schoolLogo?: string | null;
  teacherName?: string;
  permissions: TeacherPermissions;
  onLogout: () => void;
}

const TAB_ITEMS = [
  { id: 'dashboard'  as TeacherPage, label: 'Dashboard',      icon: LayoutDashboard, permKey: 'dashboard'  },
  { id: 'students'   as TeacherPage, label: 'Students',        icon: Users,           permKey: 'students'   },
  { id: 'attendance' as TeacherPage, label: 'Attendance',      icon: CalendarCheck,   permKey: 'attendance' },
  { id: 'results'    as TeacherPage, label: 'Results',         icon: BarChart3,       permKey: 'results'    },
  { id: 'defaulters' as TeacherPage, label: 'Fee Defaulters',  icon: CreditCard,      permKey: 'defaulters' },
];

const EXTRA_ITEMS = [
  { id: 'certificates'     as TeacherPage, label: 'Certificates',    icon: FileText,   permKey: 'certificates'     },
  { id: 'student_profiles' as TeacherPage, label: 'Student Profiles',icon: Users,      permKey: 'student_profiles' },
  { id: 'announcements'    as TeacherPage, label: 'Notices',          icon: Bell,       permKey: 'announcements'    },
  { id: 'reports'          as TeacherPage, label: 'Reports',          icon: PieChart,   permKey: 'reports'          },
  { id: 'fee_management'   as TeacherPage, label: 'Fee Management',   icon: Wallet,     permKey: 'fee_management'   },
];

export default function TeacherSidebar({
  currentPage, onNavigate, isOpen, schoolName, schoolLogo,
  teacherName, permissions, onLogout,
}: TeacherSidebarProps) {

  const visibleTabs  = TAB_ITEMS.filter(item => permissions.tabs[item.permKey as keyof typeof permissions.tabs]);
  const visibleExtra = EXTRA_ITEMS.filter(item => permissions.extra?.[item.permKey as keyof typeof permissions.extra]);
  const hasExtra = visibleExtra.length > 0;

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" />}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-100 z-30 flex flex-col transition-transform duration-300 shadow-xl lg:shadow-none lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* School Header */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md overflow-hidden bg-white">
              {schoolLogo ? (
                <img src={schoolLogo} alt="School Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                  <School className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-sm leading-tight">{schoolName}</h1>
              <p className="text-xs text-slate-400 leading-tight">{APP_NAME}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-thin">

          {/* Teacher tabs */}
          <p className="px-4 pt-3 pb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-widest">My Portal</p>
          {visibleTabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => onNavigate(id)}
              className={`sidebar-link w-full ${currentPage === id ? 'active' : 'text-slate-600'}`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {currentPage === id && <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
            </button>
          ))}

          {/* Extra admin features */}
          {hasExtra && (
            <>
              <p className="px-4 pt-5 pb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-widest">Admin Access</p>
              {visibleExtra.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => onNavigate(id)}
                  className={`sidebar-link w-full ${currentPage === id ? 'active' : 'text-slate-600'}`}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{label}</span>
                  {currentPage === id && <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
                </button>
              ))}
            </>
          )}
        </nav>

        {/* Teacher Info + Logout */}
        <div className="p-4 border-t border-slate-100 space-y-2">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-emerald-50">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
              {teacherName?.charAt(0).toUpperCase() || 'T'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{teacherName || 'Teacher'}</p>
              <p className="text-xs text-slate-400">Class Teacher</p>
            </div>
          </div>
          <button onClick={onLogout}
            className="sidebar-link w-full text-slate-600 hover:text-red-600 hover:bg-red-50">
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}