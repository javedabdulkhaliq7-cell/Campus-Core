import { useEffect, useState } from 'react';
import { supabase, MONTHS } from '../lib/supabase';
import { useSchool } from '../lib/schoolContext';
import {
  Users, CreditCard, CalendarCheck, TrendingUp,
  AlertCircle, CheckCircle, BookOpen, ArrowUpRight, RefreshCw
} from 'lucide-react';

interface Stats {
  totalStudents: number;
  activeStudents: number;
  todayPresent: number;
  todayAbsent: number;
  todayAttendanceRate: number;
  monthlyFeeCollected: number;
  monthlyFeePending: number;
  feeCollectionRate: number;
  totalClasses: number;
  defaulterCount: number;
}

interface FeeRec {
  student_id: string;
  status: string;
  amount_paid: number;
  total_amount: number;
  payment_date: string;
}

interface FeeStruct {
  grade: number;
  monthly_tuition: number;
  lab_fee: number;
  sports_fee: number;
  other_fee: number;
}

interface StudentRow {
  id: string;
  is_active: boolean;
  current_grade: number;
}

export default function Dashboard({ navigateTo }: { navigateTo?: (page: string) => void }) {
  const { schoolName } = useSchool();
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0, activeStudents: 0, todayPresent: 0, todayAbsent: 0,
    todayAttendanceRate: 0, monthlyFeeCollected: 0, monthlyFeePending: 0,
    feeCollectionRate: 0, totalClasses: 0, defaulterCount: 0,
  });
  const [recentFees, setRecentFees] = useState<Array<{ name: string; amount: number; date: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const isAfter5th = today.getDate() > 5;

  const [schoolId, setSchoolId] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchoolId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('school_members')
        .select('school_id')
        .eq('user_id', user.id)
        .single();
      if (error) { console.error('Failed to fetch school_id:', error); return; }
      if (data) setSchoolId(data.school_id);
    };
    fetchSchoolId();
  }, []);

  async function fetchStats() {
    if (!schoolId) return;
    setLoading(true);
    try {
      // 1. All students (need current_grade for fee structure lookup)
      const { data: studentsRaw } = await supabase
        .from('students')
        .select('id, is_active, current_grade')
        .eq('school_id', schoolId);

      // 2. Today's attendance
      const { data: attendanceRaw } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('attendance_date', todayStr)
        .eq('school_id', schoolId);

      // 3. Fee records for this month
      const { data: feesRaw } = await supabase
        .from('fee_records')
        .select('total_amount, amount_paid, status, payment_date, student_id')
        .eq('fee_year', currentYear)
        .eq('fee_month', currentMonth)
        .eq('school_id', schoolId);

      // 4. Fee structures to calculate pending for students with no record
      const { data: structsRaw } = await supabase
        .from('fee_structures')
        .select('grade, monthly_tuition, lab_fee, sports_fee, other_fee')
        .eq('school_id', schoolId)
        .eq('academic_year', currentYear);

      // 5. Distinct grades for class count
      const { data: classRows } = await supabase
        .from('class_subjects')
        .select('class_grade')
        .eq('school_id', schoolId);

      const allStudents: StudentRow[] = studentsRaw || [];
      const allAttendance = attendanceRaw || [];
      const allFees: FeeRec[] = feesRaw || [];
      const allStructs: FeeStruct[] = structsRaw || [];

      const activeStudents = allStudents.filter(s => s.is_active);

      const present = allAttendance.filter(a => (a as { status: string }).status?.toLowerCase() === 'present').length;
      const absent = allAttendance.filter(a => (a as { status: string }).status?.toLowerCase() === 'absent').length;
      const totalMarked = allAttendance.length;

      // Maps for O(1) lookup
      const feeMap = new Map<string, FeeRec>(allFees.map(f => [f.student_id, f]));
      const structMap = new Map<number, FeeStruct>(allStructs.map(s => [s.grade, s]));

      let collected = 0;
      let pending = 0;
      let defaulters = 0;

      for (const student of activeStudents) {
        const rec = feeMap.get(student.id);
        const struct = structMap.get(student.current_grade);
        const structTotal = struct
          ? struct.monthly_tuition + struct.lab_fee + struct.sports_fee + (struct.other_fee || 0)
          : 0;

        if (!rec) {
          // No fee record — counts as defaulter only after 5th of month
          if (isAfter5th) {
            defaulters++;
            pending += structTotal;
          }
        } else if (rec.status === 'Paid') {
          collected += rec.amount_paid || 0;
        } else if (rec.status === 'Partial') {
          collected += rec.amount_paid || 0;
          pending += Math.max(0, (rec.total_amount || structTotal) - (rec.amount_paid || 0));
          defaulters++;
        } else if (rec.status === 'Unpaid') {
          pending += rec.total_amount || structTotal;
          defaulters++;
        }
      }

      const totalBilled = collected + pending;

      setStats({
        totalStudents: allStudents.length,
        activeStudents: activeStudents.length,
        todayPresent: present,
        todayAbsent: absent,
        todayAttendanceRate: totalMarked > 0 ? Math.round((present / totalMarked) * 100) : 0,
        monthlyFeeCollected: collected,
        monthlyFeePending: pending,
        feeCollectionRate: totalBilled > 0 ? Math.round((collected / totalBilled) * 100) : 0,
        totalClasses: new Set((classRows || []).map(r => (r as { class_grade: number }).class_grade)).size,
        defaulterCount: defaulters,
      });

      // Recent fee payments — sorted by payment_date desc
      const recentPaid = allFees
        .filter(f => (f.status === 'Paid' || f.status === 'Partial') && f.payment_date)
        .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
        .slice(0, 5);

      if (recentPaid.length > 0) {
        const studentIds = recentPaid.map(f => f.student_id);
        const { data: studentNames } = await supabase
          .from('students')
          .select('id, full_name')
          .in('id', studentIds)
          .eq('school_id', schoolId);
        const nameMap = new Map((studentNames || []).map((s: { id: string; full_name: string }) => [s.id, s.full_name]));
        setRecentFees(recentPaid.map(f => ({
          name: nameMap.get(f.student_id) || 'Unknown',
          amount: f.amount_paid || 0,
          date: f.payment_date || '',
          status: f.status,
        })));
      } else {
        setRecentFees([]);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (schoolId) fetchStats(); }, [schoolId]);

  const statCards = [
    {
      label: 'Total Students', value: stats.activeStudents,
      sub: `${stats.totalStudents} enrolled total`,
      icon: Users, light: 'bg-blue-50', text: 'text-blue-600',
    },
    {
      label: "Today's Attendance", value: `${stats.todayAttendanceRate}%`,
      sub: `${stats.todayPresent} present, ${stats.todayAbsent} absent`,
      icon: CalendarCheck, light: 'bg-emerald-50', text: 'text-emerald-600',
    },
    {
      label: `${MONTHS[currentMonth - 1]} Collected`, value: `Rs. ${stats.monthlyFeeCollected.toLocaleString()}`,
      sub: `Rs. ${stats.monthlyFeePending.toLocaleString()} remaining`,
      icon: CreditCard, light: 'bg-amber-50', text: 'text-amber-600',
    },
    {
      label: 'Fee Defaulters', value: stats.defaulterCount,
      sub: isAfter5th ? `${stats.feeCollectionRate}% collection rate` : 'Counted after 5th',
      icon: AlertCircle, light: 'bg-red-50', text: 'text-red-600',
    },
  ];

  const quickActions = [
    { label: 'Mark Attendance', sub: "Record today's attendance", icon: CalendarCheck, color: 'text-emerald-600 bg-emerald-50', page: 'attendance' },
    { label: 'Collect Fee', sub: 'Record fee payment', icon: CreditCard, color: 'text-blue-600 bg-blue-50', page: 'fees' },
    { label: 'Add Student', sub: 'Enroll new student', icon: Users, color: 'text-amber-600 bg-amber-50', page: 'students' },
    { label: 'View Reports', sub: 'Analytics & summaries', icon: TrendingUp, color: 'text-slate-600 bg-slate-50', page: 'reports' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{schoolName} Dashboard</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {today.toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={fetchStats} className="btn-secondary" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(({ label, value, sub, icon: Icon, light, text }) => (
          <div key={label} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
                <p className="text-xs text-slate-500 mt-1">{sub}</p>
              </div>
              <div className={`${light} p-2.5 rounded-xl`}>
                <Icon className={`w-5 h-5 ${text}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Three-column section */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

        {/* Today's Summary */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Today's Summary</h3>
            <span className="badge badge-blue">Live</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-800">Present</span>
              </div>
              <span className="text-lg font-bold text-emerald-700">{stats.todayPresent}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">Absent</span>
              </div>
              <span className="text-lg font-bold text-red-700">{stats.todayAbsent}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Active Students</span>
              </div>
              <span className="text-lg font-bold text-blue-700">{stats.activeStudents}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">Classes</span>
              </div>
              <span className="text-lg font-bold text-slate-700">{stats.totalClasses}</span>
            </div>
          </div>
        </div>

        {/* Fee Status */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">{MONTHS[currentMonth - 1]} Fee Status</h3>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mb-4">
            <div className="flex items-end justify-between mb-2">
              <span className="text-sm text-slate-500">Collection Rate</span>
              <span className="text-lg font-bold text-slate-800">{stats.feeCollectionRate}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-emerald-500 h-3 rounded-full transition-all duration-700"
                style={{ width: `${stats.feeCollectionRate}%` }}
              />
            </div>
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Collected</span>
              <span className="font-semibold text-emerald-600">Rs. {stats.monthlyFeeCollected.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Remaining</span>
              <span className="font-semibold text-red-500">Rs. {stats.monthlyFeePending.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-slate-600">Defaulters</span>
              <span className="font-semibold text-amber-600">
                {isAfter5th ? `${stats.defaulterCount} students` : 'Counted after 5th'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card md:col-span-2 xl:col-span-1">
          <h3 className="font-semibold text-slate-800 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
            {quickActions.map(({ label, sub, icon: Icon, color, page }) => (
              <button
                key={label}
                onClick={() => navigateTo?.(page)}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer group text-left w-full"
              >
                <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{label}</p>
                  <p className="text-xs text-slate-400 truncate">{sub}</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Fee Payments */}
      {recentFees.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-slate-800 mb-4">Recent Fee Payments</h3>
          <div className="space-y-2">
            {recentFees.map((f, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 text-xs font-bold">
                    {f.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{f.name}</p>
                    <p className="text-xs text-slate-400">{f.date ? new Date(f.date).toLocaleDateString('en-PK') : ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-emerald-600">Rs. {f.amount.toLocaleString()}</p>
                  {f.status === 'Partial' && <p className="text-xs text-amber-500">Partial</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}