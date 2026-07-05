// src/pages/ParentDashboard.tsx
import { useEffect, useState } from "react";
import {
  User, LogOut, CalendarCheck, Wallet, Award, Bell, MessageSquare, Loader2, ChevronDown,
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
}

type Tab = "attendance" | "fees" | "results" | "notices" | "messages";

const TABS: { id: Tab; label: string; icon: typeof CalendarCheck }[] = [
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "fees", label: "Fee History", icon: Wallet },
  { id: "results", label: "Results", icon: Award },
  { id: "notices", label: "Notices", icon: Bell },
  { id: "messages", label: "Messages", icon: MessageSquare },
];

export default function ParentDashboard({ onLogout }: { onLogout: () => Promise<void> }) {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("attendance");

  const [stats, setStats] = useState({
    attendancePct: null as number | null,
    feesPaidCount: 0,
    feesTotalCount: 0,
    feesPending: 0,
    noticesUnread: 0,
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

    const [{ data: attendance }, { data: fees }, { data: notices }, { data: reads }] = await Promise.all([
      parentSupabase.from("attendance_records").select("status").eq("student_id", studentId),
      parentSupabase.from("fee_records").select("status, total_amount, amount_paid").eq("student_id", studentId),
      parentSupabase.from("announcements").select("id").eq("is_active", true).eq("parent_visible", true),
      parentId
        ? parentSupabase.from("parent_notice_reads").select("notice_id").eq("parent_id", parentId)
        : Promise.resolve({ data: [] }),
    ]);

    const totalDays = attendance?.length ?? 0;
    const presentDays = attendance?.filter((a: any) => a.status === "present").length ?? 0;
    const attendancePct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : null;

    const feesTotalCount = fees?.length ?? 0;
    const feesPaidCount = fees?.filter((f: any) => f.status?.toLowerCase() === "paid").length ?? 0;
    const feesPending = fees?.reduce((sum: number, f: any) => {
      if (f.status?.toLowerCase() !== "paid") return sum + ((f.total_amount ?? 0) - (f.amount_paid ?? 0));
      return sum;
    }, 0) ?? 0;

    const readSet = new Set((reads || []).map((r: any) => r.notice_id));
    const noticesUnread = (notices || []).filter((n: any) => !readSet.has(n.id)).length;

    setStats({ attendancePct, feesPaidCount, feesTotalCount, feesPending, noticesUnread });
  }

  const selectedStudent = students.find((s) => s.id === selectedId) ?? null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (!selectedStudent) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-sm">
          <p className="text-slate-600 text-sm mb-4">
            No student is linked to this account yet. Please contact the school office.
          </p>
          <button onClick={onLogout} className="text-sm font-medium text-blue-600 hover:underline">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-slate-800 text-sm">Campus Core — Parent Portal</span>
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Profile card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800">{selectedStudent.full_name}</p>
              <p className="text-xs text-slate-500">
                {selectedStudent.roll_number && `Roll No: ${selectedStudent.roll_number}`}
                {selectedStudent.current_grade &&
                  ` · Class: ${selectedStudent.current_grade}${selectedStudent.current_section ?? ""}`}
              </p>
            </div>
            {selectedStudent.status && (
              <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${
                selectedStudent.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
              }`}>
                {selectedStudent.status}
              </span>
            )}
          </div>

          {students.length > 1 && (
            <div className="mt-3 relative">
              <select
                value={selectedId ?? ""}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full appearance-none text-sm border border-slate-200 rounded-lg px-3 py-2 pr-8 bg-slate-50 text-slate-700"
              >
                {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Attendance" value={stats.attendancePct !== null ? `${stats.attendancePct}%` : "—"} />
          <StatCard label="Fees Paid" value={`${stats.feesPaidCount}/${stats.feesTotalCount}`} />
          <StatCard label="Pending" value={`Rs ${stats.feesPending.toLocaleString()}`} />
          <StatCard
            label="Notices"
            value={stats.noticesUnread > 0 ? `${stats.noticesUnread} New` : "—"}
            highlight={stats.noticesUnread > 0}
          />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.id === "notices" && stats.noticesUnread > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500 ml-0.5" />
                )}
              </button>
            ))}
          </div>

          {activeTab === "attendance" && <ParentAttendanceTab studentId={selectedStudent.id} />}
          {activeTab === "fees" && <ParentFeeTab studentId={selectedStudent.id} />}
          {activeTab === "results" && (
            <ParentResultsTab
              studentId={selectedStudent.id}
              studentName={selectedStudent.full_name}
              rollNumber={selectedStudent.roll_number}
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
          {activeTab === "messages" && !selectedStudent.school_id && (
            <div className="p-8 text-center text-sm text-slate-400">School information not available.</div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3.5 text-center ${highlight ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
      <p className={`text-lg font-bold ${highlight ? 'text-red-600' : 'text-slate-800'}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}