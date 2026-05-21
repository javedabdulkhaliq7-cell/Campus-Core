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

export default function Dashboard() {
  const { schoolName } = useSchool(); // only for display name
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

  // Directly fetch the school_id from school_members using the logged-in user
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
      if (error) {
        console.error('Failed to fetch school_id:', error);
        return;
      }
      if (data) setSchoolId(data.school_id);
    };
    fetchSchoolId();
  }, []);

  async function fetchStats() {
    if (!schoolId) {
      // Wait until we have the school ID
      return;
    }

    setLoading(true);
    try {
      // Students for this school only
      const studentsRes = await supabase
        .from('students')
        .select('id, is_active')
        .eq('school_id', schoolId);

      // Attendance for today, school-filtered
      const attendanceRes = await supabase
        .from('attendance_records')
        .select('status')
        .eq('attendance_date', todayStr)
        .eq('school_id', schoolId);

      // Fee records for current month/year, school-filtered
      const feesRes = await supabase
        .from('fee_records')
        .select('total_amount, amount_paid, status, payment_date, student_id')
        .eq('fee_year', currentYear)
        .eq('fee_month', currentMonth)
        .eq('school_id', schoolId);

      // Classes for this school
      const classesRes = await supabase
        .from('classes')
        .select('id')
        .eq('academic_year', currentYear)
        .eq('school_id', schoolId);

      const students = studentsRes.data || [];
      const attendance = attendanceRes.data || [];
      const fees = feesRes.data || [];
      const classes = classesRes.data || [];

      const activeStudents = students.filter(s => s.is_active).length;
      const present = attendance.filter(a => a.status?.toLowerCase() === 'present').length;
      const absent = attendance.filter(a => a.status?.toLowerCase() === 'absent').length;
      const totalMarked = attendance.length;

      const collected = fees.filter(f => f.status === 'Paid').reduce((s, f) => s + f.total_amount, 0);
      const pending = fees.filter(f => f.status !== 'Paid').reduce((s, f) => s + (f.total_amount - f.amount_paid), 0);
      const defaulters = fees.filter(f => f.status !== 'Paid').length;

      setStats({
        totalStudents: students.length,
        activeStudents,
        todayPresent: present,
        todayAbsent: absent,
        todayAttendanceRate: totalMarked > 0 ? Math.round((present / totalMarked) * 100) : 0,
        monthlyFeeCollected: collected,
        monthlyFeePending: pending,
        feeCollectionRate: (collected + pending) > 0 ? Math.round((collected / (collected + pending)) * 100) : 0,
        totalClasses: classes.length,
        defaulterCount: defaulters,
      });

      // Recent fee payments (only for this school)
      const recentPaid = fees.filter(f => f.status === 'Paid' && f.payment_date).slice(0, 5);
      if (recentPaid.length > 0) {
        const studentIds = recentPaid.map(f => f.student_id);
        const { data: studentNames } = await supabase
          .from('students')
          .select('id, full_name')
          .in('id', studentIds)
          .eq('school_id', schoolId);
        const nameMap = Object.fromEntries((studentNames || []).map(s => [s.id, s.full_name]));
        setRecentFees(recentPaid.map(f => ({
          name: nameMap[f.student_id] || 'Unknown',
          amount: f.total_amount,
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

  useEffect(() => {
    if (schoolId) {
      fetchStats();
    }
  }, [schoolId]);

  const statCards = [
    { label: 'Total Students', value: stats.activeStudents, sub: `${stats.totalStudents} enrolled total`, icon: Users, light: 'bg-blue-50', text: 'text-blue-600' },
    { label: "Today's Attendance", value: `${stats.todayAttendanceRate}%`, sub: `${stats.todayPresent} present, ${stats.todayAbsent} absent`, icon: CalendarCheck, light: 'bg-emerald-50', text: 'text-emerald-600' },
    { label: `${MONTHS[currentMonth - 1]} Fee Collected`, value: `Rs. ${stats.monthlyFeeCollected.toLocaleString()}`, sub: `${stats.feeCollectionRate}% collection rate`, icon: CreditCard, light: 'bg-amber-50', text: 'text-amber-600' },
    { label: 'Fee Defaulters', value: stats.defaulterCount, sub: `Rs. ${stats.monthlyFeePending.toLocaleString()} pending`, icon: AlertCircle, light: 'bg-red-50', text: 'text-red-600' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card xl:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Today's Summary</h3>
            <span className="badge badge-blue">Live</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
              <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-600" /><span className="text-sm font-medium text-emerald-800">Present</span></div>
              <span className="text-lg font-bold text-emerald-700">{stats.todayPresent}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
              <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-600" /><span className="text-sm font-medium text-red-800">Absent</span></div>
              <span className="text-lg font-bold text-red-700">{stats.todayAbsent}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
              <div className="flex items-center gap-2"><Users className="w-4 h-4 text-blue-600" /><span className="text-sm font-medium text-blue-800">Students</span></div>
              <span className="text-lg font-bold text-blue-700">{stats.activeStudents}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-slate-600" /><span className="text-sm font-medium text-slate-700">Classes</span></div>
              <span className="text-lg font-bold text-slate-700">{stats.totalClasses}</span>
            </div>
          </div>
        </div>

        <div className="card xl:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">{MONTHS[currentMonth - 1]} Fee Status</h3>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mb-4">
            <div className="flex items-end justify-between mb-2">
              <span className="text-sm text-slate-500">Collection</span>
              <span className="text-lg font-bold text-slate-800">{stats.feeCollectionRate}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3">
              <div className="bg-gradient-to-r from-blue-500 to-emerald-500 h-3 rounded-full transition-all duration-700" style={{ width: `${stats.feeCollectionRate}%` }} />
            </div>
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center py-2 border-b border-slate-100"><span className="text-sm text-slate-600">Collected</span><span className="font-semibold text-emerald-600">Rs. {stats.monthlyFeeCollected.toLocaleString()}</span></div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100"><span className="text-sm text-slate-600">Pending</span><span className="font-semibold text-red-500">Rs. {stats.monthlyFeePending.toLocaleString()}</span></div>
            <div className="flex justify-between items-center py-2"><span className="text-sm text-slate-600">Defaulters</span><span className="font-semibold text-amber-600">{stats.defaulterCount} students</span></div>
          </div>
        </div>

        <div className="card xl:col-span-1">
          <h3 className="font-semibold text-slate-800 mb-4">Quick Actions</h3>
          <div className="space-y-2.5">
            {[
              { label: 'Mark Attendance', sub: "Record today's attendance", icon: CalendarCheck, color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Collect Fee', sub: 'Record fee payment', icon: CreditCard, color: 'text-blue-600 bg-blue-50' },
              { label: 'Add Student', sub: 'Enroll new student', icon: Users, color: 'text-amber-600 bg-amber-50' },
              { label: 'View Reports', sub: 'Analytics & summaries', icon: TrendingUp, color: 'text-slate-600 bg-slate-50' },
            ].map(({ label, sub, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer group">
                <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}><Icon className="w-4 h-4" /></div>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-700">{label}</p><p className="text-xs text-slate-400">{sub}</p></div>
                <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {recentFees.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-slate-800 mb-4">Recent Fee Payments</h3>
          <div className="space-y-2">
            {recentFees.map((f, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 text-xs font-bold">{f.name.charAt(0)}</div>
                  <div><p className="text-sm font-medium text-slate-700">{f.name}</p><p className="text-xs text-slate-400">{f.date ? new Date(f.date).toLocaleDateString('en-PK') : ''}</p></div>
                </div>
                <span className="font-semibold text-emerald-600">Rs. {f.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}