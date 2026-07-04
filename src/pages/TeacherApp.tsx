import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useSchool } from '../lib/schoolContext';
import TeacherSidebar, { TeacherPage } from '../components/TeacherSidebar';
import TeacherDashboard from './TeacherDashboard';
import TeacherStudents from './TeacherStudents';
import TeacherAttendance from './TeacherAttendance';
import TeacherResults from './TeacherResults';
import TeacherDefaulters from './TeacherDefaulters';
import CertificateGenerator from './CertificateGenerator';
import StudentProfiles from './StudentProfiles';
import Announcements from './Announcements';
import Reports from './Reports';
import Fees from './Fees';
import { Menu, X, School } from 'lucide-react';

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

interface TeacherInfo {
  full_name: string;
  school_id: string;
  permissions: TeacherPermissions;
  class_id: string | null;
  class_name: string | null;
  class_grade: number | null;
}

const DEFAULT_PERMISSIONS: TeacherPermissions = {
  tabs: {
    dashboard: true,
    students: true,
    attendance: true,
    results: true,
    defaulters: true,
  },
  extra: {
    print_results:    false,
    certificates:     false,
    student_profiles: false,
    announcements:    false,
    reports:          false,
    fee_management:   false,
  },
};

const PAGE_TITLES: Record<TeacherPage, string> = {
  dashboard:        'My Class Dashboard',
  students:         'My Students',
  attendance:       'Attendance',
  results:          'Exam Results',
  defaulters:       'Fee Defaulters',
  certificates:     'Certificate Generator',
  student_profiles: 'Student Profiles',
  announcements:    'Notices & Announcements',
  reports:          'Reports & Analytics',
  fee_management:   'Fee Management',
};

interface TeacherAppProps {
  user: { email?: string } | null;
  onLogout: () => void;
}

export default function TeacherApp({ user, onLogout }: TeacherAppProps) {
  const { schoolName, schoolLogo } = useSchool();
  const [currentPage, setCurrentPage] = useState<TeacherPage>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeacherInfo();
  }, []);

  async function fetchTeacherInfo() {
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      // Get teacher's school_members record
      const { data: member } = await supabase
        .from('school_members')
        .select('full_name, school_id, permissions')
        .eq('user_id', authUser.id)
        .single();

      if (!member) return;

      // Get teacher's assigned class
      const { data: classData } = await supabase
        .from('classes')
        .select('id, name, grade')
        .eq('teacher_user_id', authUser.id)
        .eq('school_id', member.school_id)
        .maybeSingle();

      setTeacherInfo({
        full_name:   member.full_name || user?.email?.split('@')[0] || 'Teacher',
        school_id:   member.school_id,
        permissions: member.permissions || DEFAULT_PERMISSIONS,
        class_id:    classData?.id || null,
        class_name:  classData?.name || null,
        class_grade: classData?.grade || null,
      });
    } finally {
      setLoading(false);
    }
  }

  function navigate(page: TeacherPage) {
    setCurrentPage(page);
    setSidebarOpen(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <School className="w-6 h-6 text-emerald-600 animate-pulse" />
          </div>
          <p className="text-slate-600 font-medium">Loading Teacher Portal...</p>
        </div>
      </div>
    );
  }

  // No class assigned yet
  if (!teacherInfo?.class_id) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 max-w-md w-full p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <School className="w-7 h-7 text-blue-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">No Class Assigned</h2>
          <p className="text-slate-500 text-sm">
            You have not been assigned to a class yet. Please contact your school admin.
          </p>
          <button
            onClick={onLogout}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const permissions = teacherInfo.permissions || DEFAULT_PERMISSIONS;
  const extra = permissions.extra || DEFAULT_PERMISSIONS.extra;

  // All possible teacher pages (tabs + extra)
  const allTabPages: TeacherPage[] = ['dashboard', 'students', 'attendance', 'results', 'defaulters'];
  const allExtraPages: TeacherPage[] = ['certificates', 'student_profiles', 'announcements', 'reports', 'fee_management'];

  // Redirect to first available tab if current page is not permitted
  const isTabAllowed  = (p: TeacherPage) => allTabPages.includes(p)   ? permissions.tabs[p as keyof typeof permissions.tabs]   : false;
  const isExtraAllowed = (p: TeacherPage) => allExtraPages.includes(p) ? extra[p as keyof typeof extra] : false;
  const isPageAllowed  = (p: TeacherPage) => isTabAllowed(p) || isExtraAllowed(p);

  const firstAllowed = ([...allTabPages, ...allExtraPages] as TeacherPage[])
    .find(p => isPageAllowed(p)) || 'dashboard';
  const safePage = isPageAllowed(currentPage) ? currentPage : firstAllowed;

  const pages: Record<TeacherPage, JSX.Element> = {
    dashboard:        <TeacherDashboard teacherInfo={teacherInfo} onNavigate={navigate} />,
    students:         <TeacherStudents  teacherInfo={teacherInfo} />,
    attendance:       <TeacherAttendance teacherInfo={teacherInfo} />,
    results:          <TeacherResults   teacherInfo={teacherInfo} canPrint={extra.print_results} />,
    defaulters:       <TeacherDefaulters teacherInfo={teacherInfo} />,
    certificates:     <CertificateGenerator />,
    student_profiles: <StudentProfiles />,
    announcements:    <Announcements />,
    reports:          <Reports />,
    fee_management:   <Fees />,
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <TeacherSidebar
        currentPage={safePage}
        onNavigate={navigate}
        isOpen={sidebarOpen}
        schoolName={schoolName}
        schoolLogo={schoolLogo}
        teacherName={teacherInfo.full_name}
        permissions={permissions}
        onLogout={onLogout}
      />

      <div className="flex-1 lg:ml-64 min-w-0 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 lg:px-6 py-3.5 flex items-center gap-4">
          <button
            className="lg:hidden p-1.5 hover:bg-slate-100 rounded-lg"
            onClick={() => setSidebarOpen(o => !o)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Mobile school name */}
          <div className="lg:hidden flex items-center gap-2">
            {schoolLogo ? (
              <img src={schoolLogo} alt="Logo" className="w-7 h-7 rounded-lg object-cover" />
            ) : (
              <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center">
                <School className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <span className="font-bold text-slate-800 text-sm">{schoolName}</span>
          </div>

          <h1 className="hidden lg:block font-semibold text-slate-700 text-sm">
            {PAGE_TITLES[safePage]}
          </h1>

          <div className="ml-auto flex items-center gap-3">
            {/* Class badge */}
            {teacherInfo.class_name && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                📚 {teacherInfo.class_name}
              </span>
            )}
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-700">
                {teacherInfo.full_name}
              </span>
              <span className="text-xs text-slate-400">Teacher</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
              {teacherInfo.full_name.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-6 flex-1">
          {pages[safePage]}
        </main>
      </div>
    </div>
  );
}