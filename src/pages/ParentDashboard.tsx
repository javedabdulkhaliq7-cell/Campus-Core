// src/pages/ParentDashboard.tsx
import { useEffect, useState } from "react";
import {
  LogOut, Home, CalendarCheck, Wallet, Award, Bell, MessageSquare, Loader2,
  ChevronDown, TrendingUp, AlertCircle, CheckCircle2, Clock,
} from "lucide-react";
import { parentSupabase } from "../lib/parentSupabaseClient";
import ParentAttendanceTab from "../pages/ParentAttendanceTab";
import ParentFeeTab from "../pages/ParentFeeTab";
import ParentResultsTab from "../pages/ParentResultsTab";
import ParentNoticesTab from "../pages/ParentNoticesTab";
import ParentMessagesTab from "../pages/ParentMessagesTab";

interface StudentRow {
  id: string;
  full_name: string;
  roll_number?: string;
  current_grade?: string;
  current_section?: string;
  father_phone?: string;
  status?: string;
  school_id?: string;
  photo_url?: string | null;
}

interface Stats {
  attendancePct: number | null;
  presentDays: number;
  absentDays: number;
  feesPaidCount: number;
  feesTotalCount: number;
  feesPending: number;
  noticesUnread: number;
  unreadMessages: number;
  lastStatus: string | null;
  latestNotice: { title: string; type: string } | null;
}

type Tab = "home" | "attendance" | "fees" | "results" | "notices" | "messages";

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "home",       label: "Home",       icon: Home },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "fees",       label: "Fees",       icon: Wallet },
  { id: "results",    label: "Results",    icon: Award },
  { id: "notices",    label: "Notices",    icon: Bell },
  { id: "messages",   label: "Messages",   icon: MessageSquare },
];

export default function ParentDashboard({ onLogout }: { onLogout: () => Promise<void> }) {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [stats, setStats] = useState<Stats>({
    attendancePct: null, presentDays: 0, absentDays: 0,
    feesPaidCount: 0, feesTotalCount: 0, feesPending: 0,
    noticesUnread: 0, unreadMessages: 0, lastStatus: null, latestNotice: null,
  });

  useEffect(() => { loadStudents(); }, []);
  useEffect(() => { if (selectedId) loadStats(selectedId); }, [selectedId]);

  async function loadStudents() {
    setLoading(true);
    const { data, error } = await parentSupabase.from("students").select("*");
    if (!error && data && data.length > 0) {
      setStudents(data as StudentRow[]);
      setSelectedId(data[0].id);
    }
    setLoading(false);
  }

  async function loadStats(studentId: string) {
    const { data: { user } } = await parentSupabase.auth.getUser();
    const parentId = user?.id;
    const student = students.find(s => s.id === studentId);
    const schoolId = student?.school_id;

    const [
      { data: attendance },
      { data: fees },
      { data: notices },
      { data: reads },
      { data: msgs },
      { data: latestNotices },
    ] = await Promise.all([
      parentSupabase.from("attendance_records").select("status").eq("student_id", studentId),
      parentSupabase.from("fee_records").select("status, total_amount, amount_paid").eq("student_id", studentId),
      parentSupabase.from("announcements").select("id").eq("is_active", true).eq("parent_visible", true),
      parentId ? parentSupabase.from("parent_notice_reads").select("notice_id").eq("parent_id", parentId) : Promise.resolve({ data: [] }),
      parentId ? parentSupabase.from("parent_teacher_messages").select("id").eq("receiver_id", parentId).eq("is_read", false) : Promise.resolve({ data: [] }),
      schoolId ? parentSupabase.from("announcements").select("title, type").eq("is_active", true).eq("parent_visible", true).eq("school_id", schoolId).order("created_at", { ascending: false }).limit(1) : Promise.resolve({ data: [] }),
    ]);

    const totalDays = attendance?.length ?? 0;
    const presentDays = attendance?.filter((a: any) => a.status === "present").length ?? 0;
    const absentDays = attendance?.filter((a: any) => a.status === "absent").length ?? 0;
    const attendancePct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : null;
    const lastStatus = attendance?.[0]?.status ?? null;

    const feesTotalCount = fees?.length ?? 0;
    const feesPaidCount = fees?.filter((f: any) => f.status?.toLowerCase() === "paid").length ?? 0;
    const feesPending = fees?.reduce((sum: number, f: any) => {
      if (f.status?.toLowerCase() !== "paid") return sum + ((f.total_amount ?? 0) - (f.amount_paid ?? 0));
      return sum;
    }, 0) ?? 0;

    const readSet = new Set((reads || []).map((r: any) => r.notice_id));
    const noticesUnread = (notices || []).filter((n: any) => !readSet.has(n.id)).length;
    const unreadMessages = msgs?.length ?? 0;
    const latestNotice = (latestNotices as any)?.[0] ?? null;

    setStats({ attendancePct, presentDays, absentDays, feesPaidCount, feesTotalCount, feesPending, noticesUnread, unreadMessages, lastStatus, latestNotice });
  }

  const selectedStudent = students.find(s => s.id === selectedId) ?? null;
  const totalUnread = stats.noticesUnread + stats.unreadMessages;

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
    </div>
  );

  if (!selectedStudent) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-sm">
        <p className="text-slate-600 text-sm mb-4">No student linked yet. Contact the school office.</p>
        <button onClick={onLogout} className="text-sm font-medium text-blue-600 hover:underline">Sign out</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">CC</span>
          </div>
          <span className="font-bold text-slate-800 text-sm">Campus Core</span>
        </div>
        <div className="flex items-center gap-2">
          {students.length > 1 && (
            <div className="relative">
              <select
                value={selectedId ?? ""}
                onChange={e => setSelectedId(e.target.value)}
                className="appearance-none text-xs border border-slate-200 rounded-lg pl-2.5 pr-6 py-1.5 bg-slate-50 text-slate-700 font-medium"
              >
                {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-2 pointer-events-none" />
            </div>
          )}
          <button onClick={onLogout} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <LogOut className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {activeTab === "home" && (
          <HomeTab student={selectedStudent} stats={stats} onNavigate={setActiveTab} />
        )}
        {activeTab === "attendance" && (
          <div className="p-4"><ParentAttendanceTab studentId={selectedStudent.id} /></div>
        )}
        {activeTab === "fees" && (
          <div className="p-4"><ParentFeeTab studentId={selectedStudent.id} /></div>
        )}
        {activeTab === "results" && (
          <ParentResultsTab
            studentId={selectedStudent.id}
            studentName={selectedStudent.full_name}
            rollNumber={selectedStudent.roll_number}
            photoUrl={selectedStudent.photo_url}
            classGrade={selectedStudent.current_grade}
          />
        )}
        {activeTab === "notices" && (
          <ParentNoticesTab schoolId={selectedStudent.school_id ?? ''} />
        )}
        {activeTab === "messages" && selectedStudent.school_id && (
          <ParentMessagesTab
            studentId={selectedStudent.id}
            studentName={selectedStudent.full_name}
            schoolId={selectedStudent.school_id}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-10 safe-area-pb">
        <div className="flex items-center justify-around px-2 py-1">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const badge = tab.id === "notices" ? stats.noticesUnread :
                          tab.id === "messages" ? stats.unreadMessages : 0;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center gap-0.5 px-3 py-2 relative"
              >
                <div className={`w-6 h-6 flex items-center justify-center relative ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <tab.icon className="w-5 h-5" />
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-medium ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {tab.label}
                </span>
                {isActive && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-emerald-600" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// ── Home Tab ─────────────────────────────────────────────────────
function HomeTab({ student, stats, onNavigate }: {
  student: StudentRow;
  stats: Stats;
  onNavigate: (tab: Tab) => void;
}) {
  const initials = student.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const attendanceColor = stats.attendancePct === null ? 'text-slate-400' :
    stats.attendancePct >= 80 ? 'text-emerald-600' :
    stats.attendancePct >= 60 ? 'text-yellow-600' : 'text-red-500';

  return (
    <div className="space-y-4 p-4">
      {/* Student Hero Card */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-4">
          {/* Photo */}
          <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 border-2 border-white/30 shadow-md">
            {student.photo_url ? (
              <img src={student.photo_url} alt={student.full_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-emerald-500 flex items-center justify-center">
                <span className="text-white text-xl font-bold">{initials}</span>
              </div>
            )}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg leading-tight">{student.full_name}</p>
            <p className="text-emerald-100 text-sm mt-0.5">
              {student.roll_number && `Roll No: ${student.roll_number}`}
            </p>
            <p className="text-emerald-100 text-sm">
              {student.current_grade && `Class ${student.current_grade}${student.current_section ?? ''}`}
            </p>
            <div className="mt-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                student.status?.toLowerCase() === 'active'
                  ? 'bg-white/20 text-white'
                  : 'bg-red-400/30 text-red-100'
              }`}>
                {student.status ?? 'Active'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Ring + Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        {/* Attendance Ring */}
        <button
          onClick={() => onNavigate('attendance')}
          className="col-span-1 bg-white rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm border border-slate-100 active:scale-95 transition-transform"
        >
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg width="64" height="64" className="absolute inset-0 -rotate-90">
              <circle cx="32" cy="32" r="26" fill="none" stroke="#E2E8F0" strokeWidth="5" />
              <circle
                cx="32" cy="32" r="26" fill="none"
                stroke={stats.attendancePct !== null ? (stats.attendancePct >= 80 ? '#10B981' : stats.attendancePct >= 60 ? '#F59E0B' : '#EF4444') : '#E2E8F0'}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 26}`}
                strokeDashoffset={stats.attendancePct !== null ? (2 * Math.PI * 26) - (stats.attendancePct / 100) * (2 * Math.PI * 26) : 2 * Math.PI * 26}
              />
            </svg>
            <p className={`text-xs font-bold relative z-10 ${attendanceColor}`}>
              {stats.attendancePct !== null ? `${stats.attendancePct}%` : '—'}
            </p>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">Attendance</p>
        </button>

        {/* Fee + Today's status */}
        <div className="col-span-2 grid grid-rows-2 gap-3">
          <button
            onClick={() => onNavigate('fees')}
            className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm border border-slate-100 active:scale-95 transition-transform"
          >
            <div>
              <p className="text-xs text-slate-500 font-medium">Fees Paid</p>
              <p className="text-lg font-bold text-slate-800">{stats.feesPaidCount}/{stats.feesTotalCount}</p>
            </div>
            {stats.feesPending > 0 ? (
              <div className="text-right">
                <p className="text-xs text-red-500 font-medium">Due</p>
                <p className="text-sm font-bold text-red-600">Rs {stats.feesPending.toLocaleString()}</p>
              </div>
            ) : (
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            )}
          </button>

          <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm border border-slate-100">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
              stats.lastStatus === 'present' ? 'bg-emerald-100' :
              stats.lastStatus === 'absent' ? 'bg-red-100' :
              stats.lastStatus === 'late' ? 'bg-yellow-100' : 'bg-slate-100'
            }`}>
              {stats.lastStatus === 'present' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
               stats.lastStatus === 'absent' ? <AlertCircle className="w-4 h-4 text-red-500" /> :
               stats.lastStatus === 'late' ? <Clock className="w-4 h-4 text-yellow-600" /> :
               <TrendingUp className="w-4 h-4 text-slate-400" />}
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Last Attendance</p>
              <p className="text-sm font-bold text-slate-800 capitalize">{stats.lastStatus ?? '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* This month summary */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">This Month</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-bold text-emerald-600">{stats.presentDays}</p>
            <p className="text-xs text-slate-500 mt-0.5">Present</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-500">{stats.absentDays}</p>
            <p className="text-xs text-slate-500 mt-0.5">Absent</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-700">{stats.presentDays + stats.absentDays}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total Days</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        {/* Latest Notice */}
        <button
          onClick={() => onNavigate('notices')}
          className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-left active:scale-95 transition-transform relative"
        >
          {stats.noticesUnread > 0 && (
            <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {stats.noticesUnread}
            </span>
          )}
          <Bell className="w-5 h-5 text-amber-500 mb-2" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notices</p>
          {stats.latestNotice ? (
            <p className="text-sm font-medium text-slate-800 mt-1 line-clamp-2">{stats.latestNotice.title}</p>
          ) : (
            <p className="text-sm text-slate-400 mt-1">No new notices</p>
          )}
        </button>

        {/* Messages */}
        <button
          onClick={() => onNavigate('messages')}
          className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-left active:scale-95 transition-transform relative"
        >
          {stats.unreadMessages > 0 && (
            <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {stats.unreadMessages}
            </span>
          )}
          <MessageSquare className="w-5 h-5 text-emerald-600 mb-2" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Messages</p>
          <p className="text-sm text-slate-400 mt-1">
            {stats.unreadMessages > 0 ? `${stats.unreadMessages} unread` : 'Chat with school'}
          </p>
        </button>
      </div>

      {/* Results shortcut */}
      <button
        onClick={() => onNavigate('results')}
        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-4 flex items-center justify-between text-white shadow-sm active:scale-95 transition-transform"
      >
        <div>
          <p className="text-xs text-blue-200 font-medium uppercase tracking-wide">Exam Results</p>
          <p className="text-sm font-semibold mt-0.5">View published results & certificates</p>
        </div>
        <Award className="w-8 h-8 text-blue-300 flex-shrink-0" />
      </button>
    </div>
  );
}