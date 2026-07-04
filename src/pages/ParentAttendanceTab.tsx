// src/components/ParentAttendanceTab.tsx
import { useEffect, useState } from 'react';
import { parentSupabase } from '../lib/parentSupabaseClient';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  attendance_date: string;
  status: string;
  remarks: string | null;
}

interface Props {
  studentId: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  present:  { label: 'Present', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  absent:   { label: 'Absent',  color: 'bg-red-100 text-red-600',         dot: 'bg-red-500' },
  late:     { label: 'Late',    color: 'bg-yellow-100 text-yellow-700',   dot: 'bg-yellow-400' },
  leave:    { label: 'Leave',   color: 'bg-blue-100 text-blue-600',       dot: 'bg-blue-400' },
  off:      { label: 'Off',     color: 'bg-slate-100 text-slate-400',     dot: 'bg-slate-300' },
};

function getStatusCfg(status: string) {
  return STATUS_CONFIG[status?.toLowerCase()] ?? { label: status, color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300' };
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function ParentAttendanceTab({ studentId }: Props) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    parentSupabase
      .from('attendance_records')
      .select('id, attendance_date, status, remarks')
      .eq('student_id', studentId)
      .order('attendance_date', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('Attendance fetch error:', error);
        else setRecords(data || []);
        setLoading(false);
      });
  }, [studentId]);

  // Build a map of date string → record for quick lookup
  const recordMap = new Map<string, AttendanceRecord>();
  records.forEach(r => recordMap.set(r.attendance_date, r));

  // Stats for current month
  const monthRecords = records.filter(r => {
    const d = new Date(r.attendance_date);
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  });
  const present  = monthRecords.filter(r => r.status?.toLowerCase() === 'present').length;
  const absent   = monthRecords.filter(r => r.status?.toLowerCase() === 'absent').length;
  const late     = monthRecords.filter(r => r.status?.toLowerCase() === 'late').length;
  const total    = monthRecords.filter(r => !['off'].includes(r.status?.toLowerCase())).length;
  const pct      = total > 0 ? Math.round((present / total) * 100) : null;

  // Calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  );

  if (records.length === 0) return (
    <div className="text-center py-12 text-slate-400 text-sm">No attendance records found.</div>
  );

  return (
    <div className="space-y-4 p-4">
      {/* Month Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
          <div className="text-xl font-bold text-emerald-700">{present}</div>
          <div className="text-xs text-emerald-600 mt-0.5">Present</div>
        </div>
        <div className="bg-red-50 rounded-xl p-2.5 text-center">
          <div className="text-xl font-bold text-red-600">{absent}</div>
          <div className="text-xs text-red-500 mt-0.5">Absent</div>
        </div>
        <div className="bg-yellow-50 rounded-xl p-2.5 text-center">
          <div className="text-xl font-bold text-yellow-600">{late}</div>
          <div className="text-xs text-yellow-600 mt-0.5">Late</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-2.5 text-center">
          <div className="text-xl font-bold text-slate-600">{pct !== null ? `${pct}%` : '—'}</div>
          <div className="text-xs text-slate-500 mt-0.5">Rate</div>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
        {/* Nav */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="font-semibold text-slate-800 text-sm">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            onClick={nextMonth}
            disabled={viewYear === today.getFullYear() && viewMonth === today.getMonth()}
            className="p-1 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-50">
          {DAYS.map(d => (
            <div key={d} className="text-center text-xs text-slate-400 font-medium py-2">{d}</div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7">
          {/* Empty cells for first day offset */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const record = recordMap.get(dateStr);
            const isToday = dateStr === today.toISOString().split('T')[0];
            const cfg = record ? getStatusCfg(record.status) : null;

            return (
              <div
                key={day}
                className={`aspect-square flex flex-col items-center justify-center text-xs relative
                  ${isToday ? 'ring-2 ring-inset ring-blue-400' : ''}
                  ${cfg ? cfg.color : 'text-slate-400'}
                `}
              >
                <span className={`font-medium ${isToday ? 'font-bold' : ''}`}>{day}</span>
                {cfg && (
                  <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${cfg.dot}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-1">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </div>
        ))}
      </div>

      {/* Recent history list — last 10 non-off records */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">Recent</p>
        {records
          .filter(r => r.status?.toLowerCase() !== 'off')
          .slice(0, 10)
          .map(r => {
            const cfg = getStatusCfg(r.status);
            const d = new Date(r.attendance_date);
            return (
              <div key={r.id} className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-4 py-2.5">
                <div>
                  <div className="text-sm font-medium text-slate-700">
                    {d.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </div>
                  {r.remarks && <div className="text-xs text-slate-400 mt-0.5">{r.remarks}</div>}
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.color}`}>
                  {cfg.label}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}