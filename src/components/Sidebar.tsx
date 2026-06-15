import {
  LayoutDashboard, Users, CreditCard, CalendarCheck,
  BarChart3, GraduationCap, Bell, Settings, ChevronRight,
  School, UserCircle, FileText,
} from 'lucide-react';
import { APP_NAME } from '../lib/supabase';

type Page = 'dashboard' | 'students' | 'profiles' | 'fees' | 'attendance' | 'results' | 'reports' | 'classes' | 'announcements' | 'settings' | 'certificates';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  isOpen: boolean;
  schoolName: string;
  schoolLogo?: string | null;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'profiles', label: 'Student Profiles', icon: UserCircle },
  { id: 'fees', label: 'Fee Management', icon: CreditCard },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { id: 'results', label: 'Results', icon: BarChart3 },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'classes', label: 'Classes', icon: GraduationCap },
  { id: 'announcements', label: 'Notices', icon: Bell },
  { id: 'certificates', label: 'Certificates', icon: FileText },
] as const;

export default function Sidebar({ currentPage, onNavigate, isOpen, schoolName, schoolLogo }: SidebarProps) {
  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" />}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-100 z-30 flex flex-col transition-transform duration-300 shadow-xl lg:shadow-none lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md overflow-hidden bg-white">
              {schoolLogo ? (
                <img src={schoolLogo} alt="School Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
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

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-thin">
          <p className="px-4 pt-3 pb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-widest">Main Menu</p>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => onNavigate(id as Page)}
              className={`sidebar-link w-full ${currentPage === id ? 'active' : 'text-slate-600'}`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {currentPage === id && <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
            </button>
          ))}

          <p className="px-4 pt-5 pb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-widest">System</p>
          <button onClick={() => onNavigate('settings')}
            className={`sidebar-link w-full ${currentPage === 'settings' ? 'active' : 'text-slate-600'}`}>
            <Settings className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">Settings</span>
            {currentPage === 'settings' && <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-blue-50">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">PR</div>
            <div>
              <p className="text-xs font-semibold text-slate-700">Principal</p>
              <p className="text-xs text-slate-400">Admin</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}