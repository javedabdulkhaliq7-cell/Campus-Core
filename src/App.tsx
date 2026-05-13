import { useEffect, useState } from 'react';
import { supabase, APP_NAME } from './lib/supabase';
import { SchoolProvider, useSchool } from './lib/schoolContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Fees from './pages/Fees';
import Attendance from './pages/Attendance';
import Reports from './pages/Reports';
import Classes from './pages/Classes';
import Announcements from './pages/Announcements';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { Menu, X, School, LogOut } from 'lucide-react';

type Page = 'dashboard' | 'students' | 'fees' | 'attendance' | 'reports' | 'classes' | 'announcements' | 'settings';

const PAGE_TITLES: Record<Page, string> = {
  dashboard: 'Principal Dashboard',
  students: 'Student Management',
  fees: 'Fee Management',
  attendance: 'Daily Attendance',
  reports: 'Reports & Analytics',
  classes: 'Classes & Fees',
  announcements: 'Notices',
  settings: 'Settings',
};

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const { schoolName, loading: schoolLoading } = useSchool();

  useEffect(() => {
    supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setUser(session?.user ?? null);
      setLoading(false);
    });
  }, []);

  function navigate(page: Page) {
    setCurrentPage(page);
    setSidebarOpen(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setUser(null);
  }

  if (loading || schoolLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <School className="w-6 h-6 text-blue-600 animate-pulse" />
          </div>
          <p className="text-slate-600 font-medium">Loading {APP_NAME}...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  const pages: Record<Page, JSX.Element> = {
    dashboard: <Dashboard />,
    students: <Students />,
    fees: <Fees />,
    attendance: <Attendance />,
    reports: <Reports />,
    classes: <Classes />,
    announcements: <Announcements />,
    settings: <Settings />,
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar currentPage={currentPage} onNavigate={navigate} isOpen={sidebarOpen} schoolName={schoolName} />

      <div className="flex-1 lg:ml-64 min-w-0">
        <header className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 lg:px-6 py-3.5 flex items-center gap-4">
          <button
            className="lg:hidden p-1.5 hover:bg-slate-100 rounded-lg"
            onClick={() => setSidebarOpen(o => !o)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="lg:hidden flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <School className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-slate-800 text-sm">{schoolName}</span>
          </div>

          <h1 className="hidden lg:block font-semibold text-slate-700 text-sm">{PAGE_TITLES[currentPage]}</h1>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-700">Principal</span>
              <span className="text-xs text-slate-400">
                {user?.email?.split('@')[0] || 'Admin'}
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
              {user?.email?.charAt(0).toUpperCase() || 'PR'}
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-red-600"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="p-4 lg:p-6">
          {pages[currentPage]}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SchoolProvider>
      <AppContent />
    </SchoolProvider>
  );
}
