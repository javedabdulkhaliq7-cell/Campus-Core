import { useEffect, useState } from 'react';
import { supabase, MONTHS, GRADES, CURRENT_YEAR, DECADE_YEARS } from '../lib/supabase';
import { useSchool } from '../lib/schoolContext';
import { BarChart3, TrendingUp, CalendarCheck, ChevronDown, RefreshCw, Users, CreditCard } from 'lucide-react';

export default function Reports() {
  const { schoolName } = useSchool();
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [monthlyData, setMonthlyData] = useState<Array<{ month: number; collected: number; pending: number }>>([]);
  const [gradeStats, setGradeStats] = useState<Array<{ grade: number; students: number; paid: number; unpaid: number; collected: number; attendanceRate: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'fees' | 'attendance' | 'overview'>('overview');

  async function fetchReports() {
    setLoading(true);
    const { data: feeRecords } = await supabase.from('fee_records').select('fee_month, fee_year, total_amount, amount_paid, status, student_id').eq('fee_year', selectedYear);
    const { data: students } = await supabase.from('students').select('id, current_grade, is_active').eq('is_active', true);
    const monthlyMap: Record<number, { collected: number; pending: number }> = {};
    for (let m = 1; m <= 12; m++) monthlyMap[m] = { collected: 0, pending: 0 };
    (feeRecords || []).forEach(r => { const m = monthlyMap[r.fee_month]; if (m) { if (r.status === 'Paid') m.collected += r.amount_paid; else m.pending += r.total_amount - r.amount_paid; } });
    setMonthlyData(Object.entries(monthlyMap).map(([m, d]) => ({ month: parseInt(m), ...d })));

    const gradeFeeMap: Record<number, { paid: number; unpaid: number; collected: number }> = {};
    const gradeStudentMap: Record<number, number> = {};
    (students || []).forEach(s => { gradeStudentMap[s.current_grade] = (gradeStudentMap[s.current_grade] || 0) + 1; });
    (feeRecords || []).forEach(r => { const s = (students || []).find(st => st.id === r.student_id); if (!s) return; const g = s.current_grade; if (!gradeFeeMap[g]) gradeFeeMap[g] = { paid: 0, unpaid: 0, collected: 0 }; if (r.status === 'Paid') { gradeFeeMap[g].paid++; gradeFeeMap[g].collected += r.amount_paid; } else { gradeFeeMap[g].unpaid++; } });

    const { data: attendance } = await supabase.from('attendance_records').select('student_id, status').gte('attendance_date', `${selectedYear}-01-01`).lte('attendance_date', `${selectedYear}-12-31`);
    const attMap: Record<string, { present: number; total: number }> = {};
    (attendance || []).forEach(a => { if (!attMap[a.student_id]) attMap[a.student_id] = { present: 0, total: 0 }; attMap[a.student_id].total++; if (a.status === 'Present') attMap[a.student_id].present++; });

    setGradeStats(GRADES.map(g => { const gs = (students || []).filter(s => s.current_grade === g); let tA = 0, tP = 0; gs.forEach(s => { const a = attMap[s.id]; if (a) { tA += a.total; tP += a.present; } }); return { grade: g, students: gradeStudentMap[g] || 0, paid: gradeFeeMap[g]?.paid || 0, unpaid: gradeFeeMap[g]?.unpaid || 0, collected: gradeFeeMap[g]?.collected || 0, attendanceRate: tA > 0 ? Math.round((tP / tA) * 100) : 0 }; }));
    setLoading(false);
  }

  useEffect(() => { fetchReports(); }, [selectedYear]);

  const maxC = Math.max(...monthlyData.map(m => m.collected), 1);
  const totalCollected = monthlyData.reduce((s, m) => s + m.collected, 0);
  const totalPending = monthlyData.reduce((s, m) => s + m.pending, 0);
  const totalStudents = gradeStats.reduce((s, g) => s + g.students, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold text-slate-800">Reports & Analytics</h2><p className="text-slate-500 text-sm">{schoolName} — {selectedYear}</p></div>
        <div className="flex items-center gap-3"><div className="relative"><select className="input pr-8 appearance-none w-28" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>{DECADE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select><ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" /></div><button onClick={fetchReports} className="btn-secondary"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[{ l: 'Total Students', v: totalStudents, i: Users, c: 'text-blue-600', b: 'bg-blue-50' }, { l: 'Fee Collected', v: `Rs. ${totalCollected.toLocaleString()}`, i: CreditCard, c: 'text-emerald-600', b: 'bg-emerald-50' }, { l: 'Pending Dues', v: `Rs. ${totalPending.toLocaleString()}`, i: TrendingUp, c: 'text-red-600', b: 'bg-red-50' }, { l: 'Classes', v: GRADES.length, i: BarChart3, c: 'text-amber-600', b: 'bg-amber-50' }].map(({ l, v, i: I, c, b }) => (
          <div key={l} className={`${b} rounded-2xl p-4 border border-slate-100`}><div className="flex items-center justify-between mb-2"><p className="text-xs font-semibold text-slate-500 uppercase">{l}</p><I className={`w-4 h-4 ${c}`} /></div><p className={`text-xl font-bold ${c}`}>{v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">{(['overview', 'fees', 'attendance'] as const).map(t => (<button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t}</button>))}</div>

      {(activeTab === 'fees' || activeTab === 'overview') && (<div className="card"><div className="flex items-center justify-between mb-5"><h3 className="font-semibold text-slate-800">Monthly Fee Collection — {selectedYear}</h3></div>
        <div className="flex items-end gap-2 h-44">{monthlyData.map(m => (<div key={m.month} className="flex-1 flex flex-col items-center gap-1"><div className="w-full flex flex-col gap-0.5" style={{ height: '140px', justifyContent: 'flex-end' }}>{m.collected > 0 && <div className="w-full bg-blue-500 rounded-t-md transition-all duration-500 hover:bg-blue-600 cursor-default relative group" style={{ height: `${(m.collected / maxC) * 120}px`, minHeight: 4 }}><div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">Rs. {m.collected.toLocaleString()}</div></div>}{m.pending > 0 && <div className="w-full bg-red-200 rounded-t-md" style={{ height: `${Math.min(20, (m.pending / maxC) * 120)}px`, minHeight: 2 }} />}</div><span className="text-xs text-slate-500">{MONTHS[m.month - 1].slice(0, 3)}</span></div>))}</div>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100"><div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-500" /><span className="text-xs text-slate-500">Collected</span></div><div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-200" /><span className="text-xs text-slate-500">Pending</span></div></div>
      </div>)}

      {(activeTab === 'overview' || activeTab === 'attendance') && (<div className="card p-0 overflow-hidden"><div className="p-5 border-b border-slate-100 flex items-center justify-between"><h3 className="font-semibold text-slate-800">Class-wise Summary</h3><CalendarCheck className="w-4 h-4 text-slate-400" /></div>
        <div className="overflow-x-auto"><table className="w-full"><thead><tr><th className="table-header text-left">Class</th><th className="table-header text-right">Students</th><th className="table-header text-right hidden sm:table-cell">Paid</th><th className="table-header text-right hidden sm:table-cell">Unpaid</th><th className="table-header text-right hidden md:table-cell">Collected</th><th className="table-header text-center">Attendance</th></tr></thead><tbody>
          {gradeStats.filter(g => g.students > 0).map(g => (<tr key={g.grade} className="table-row"><td className="table-cell font-medium text-slate-800">Class {g.grade}</td><td className="table-cell text-right text-slate-600">{g.students}</td><td className="table-cell text-right hidden sm:table-cell text-emerald-600 font-medium">{g.paid}</td><td className="table-cell text-right hidden sm:table-cell text-red-500">{g.unpaid}</td><td className="table-cell text-right hidden md:table-cell font-semibold text-slate-700">Rs. {g.collected.toLocaleString()}</td><td className="table-cell"><div className="flex items-center justify-center gap-2"><div className="flex-1 max-w-20 bg-slate-100 rounded-full h-2"><div className={`h-2 rounded-full transition-all ${g.attendanceRate >= 80 ? 'bg-emerald-500' : g.attendanceRate >= 60 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${g.attendanceRate}%` }} /></div><span className={`text-xs font-medium ${g.attendanceRate >= 80 ? 'text-emerald-600' : g.attendanceRate >= 60 ? 'text-amber-600' : 'text-red-500'}`}>{g.attendanceRate > 0 ? `${g.attendanceRate}%` : '—'}</span></div></td></tr>))}
        </tbody></table></div>
      </div>)}
    </div>
  );
}
