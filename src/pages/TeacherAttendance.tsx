import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CalendarCheck, Save, CheckCircle, RefreshCw } from 'lucide-react';

interface TeacherInfo { class_id: string | null; class_name: string | null; school_id: string; full_name: string; }
interface Props { teacherInfo: TeacherInfo; }
interface Student { id: string; full_name: string; roll_number: string; }
type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Leave';

const STATUS_OPTIONS: AttendanceStatus[] = ['Present', 'Absent', 'Late', 'Leave'];
const STATUS_COLORS: Record<AttendanceStatus, string> = {
  Present: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  Absent:  'bg-red-100 text-red-700 border-red-300',
  Late:    'bg-amber-100 text-amber-700 border-amber-300',
  Leave:   'bg-blue-100 text-blue-700 border-blue-300',
};

export default function TeacherAttendance({ teacherInfo }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [students, setStudents]         = useState<Student[]>([]);
  const [attendance, setAttendance]     = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const isPast = selectedDate < today;

  useEffect(() => { fetchStudents(); }, [teacherInfo.class_id]);

  // Re-fetch attendance whenever date OR students change
  useEffect(() => {
    if (students.length > 0) fetchAttendance();
  }, [selectedDate, students]);

  async function fetchStudents() {
    if (!teacherInfo.class_id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('id, full_name, roll_number')
      .eq('class_id', teacherInfo.class_id)
      .eq('is_active', true)
      .order('roll_number');
    if (error) console.error('fetchStudents:', error.message);
    setStudents(data || []);
    setLoading(false);
  }

  async function fetchAttendance() {
    if (!students.length) return;
    const ids = students.map(s => s.id);
    const { data, error } = await supabase
      .from('attendance_records')
      .select('student_id, status')
      .eq('attendance_date', selectedDate)
      .in('student_id', ids);
    if (error) console.error('fetchAttendance:', error.message);

    // Reset to empty first so stale data doesn't carry over between dates
    const map: Record<string, AttendanceStatus> = {};
    (data || []).forEach(r => { map[r.student_id] = r.status as AttendanceStatus; });
    setAttendance(map);
  }

  function setStatus(studentId: string, status: AttendanceStatus) {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  }

  function markAll(status: AttendanceStatus) {
    const map: Record<string, AttendanceStatus> = {};
    students.forEach(s => { map[s.id] = status; });
    setAttendance(map);
  }

  async function saveAttendance() {
    if (isPast) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      // Build records — every student gets a record
      const records = students.map(s => ({
        student_id:      s.id,
        school_id:       teacherInfo.school_id,
        attendance_date: selectedDate,
        status:          attendance[s.id] || 'Absent',
        marked_by:       teacherInfo.full_name,
      }));

      // Delete existing records for this date first, then insert fresh
      // This avoids upsert conflict issues
      const ids = students.map(s => s.id);
      await supabase
        .from('attendance_records')
        .delete()
        .eq('attendance_date', selectedDate)
        .in('student_id', ids);

      const { error: insertError } = await supabase
        .from('attendance_records')
        .insert(records);

      if (insertError) {
        setError('Failed to save: ' + insertError.message);
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      // Refresh to confirm saved data
      fetchAttendance();
    } finally {
      setSaving(false);
    }
  }

  const counts = {
    Present: Object.values(attendance).filter(v => v === 'Present').length,
    Absent:  Object.values(attendance).filter(v => v === 'Absent').length,
    Late:    Object.values(attendance).filter(v => v === 'Late').length,
    Leave:   Object.values(attendance).filter(v => v === 'Leave').length,
  };

  const markedCount = Object.keys(attendance).length;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Attendance</h2>
          <p className="text-slate-500 text-sm">{teacherInfo.class_name} · {students.length} students</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAttendance} className="btn-secondary p-2">
            <RefreshCw className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={selectedDate}
            max={today}
            onChange={e => { setSelectedDate(e.target.value); }}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          ❌ {error}
        </div>
      )}

      {/* Past date notice */}
      {isPast && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          ⚠️ Viewing past attendance — editing is not allowed for previous dates.
        </div>
      )}

      {/* Progress */}
      {!isPast && students.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-sm text-blue-700 flex items-center justify-between">
          <span>{markedCount} of {students.length} marked</span>
          {markedCount < students.length && (
            <span className="text-blue-500 text-xs">{students.length - markedCount} remaining</span>
          )}
        </div>
      )}

      {/* Summary counts */}
      <div className="grid grid-cols-4 gap-2">
        {(Object.entries(counts) as [AttendanceStatus, number][]).map(([status, count]) => (
          <div key={status} className={`rounded-xl p-3 text-center border ${STATUS_COLORS[status]}`}>
            <p className="text-lg font-bold">{count}</p>
            <p className="text-xs font-medium">{status}</p>
          </div>
        ))}
      </div>

      {/* Bulk actions */}
      {!isPast && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-slate-500">Mark all:</span>
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => markAll(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${STATUS_COLORS[s]}`}
            >
              All {s}
            </button>
          ))}
        </div>
      )}

      {/* Student table */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading students...</div>
      ) : students.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No active students found in this class.</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Student</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {students.map((s, i) => (
                <tr key={s.id} className={`hover:bg-slate-50 transition-colors ${attendance[s.id] ? '' : 'bg-yellow-50/30'}`}>
                  <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{s.full_name}</p>
                    <p className="text-xs text-slate-400">Roll # {s.roll_number}</p>
                  </td>
                  <td className="px-4 py-3">
                    {isPast ? (
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${attendance[s.id] ? STATUS_COLORS[attendance[s.id]] : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                        {attendance[s.id] || 'Not marked'}
                      </span>
                    ) : (
                      <div className="flex gap-1 flex-wrap">
                        {STATUS_OPTIONS.map(opt => (
                          <button
                            key={opt}
                            onClick={() => setStatus(s.id, opt)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                              attendance[s.id] === opt
                                ? STATUS_COLORS[opt] + ' ring-2 ring-offset-1 ring-current'
                                : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Save button */}
      {!isPast && (
        <div className="flex items-center gap-3 sticky bottom-4">
          <button
            onClick={saveAttendance}
            disabled={saving || students.length === 0}
            className="btn-primary flex items-center gap-2 disabled:opacity-60 shadow-lg"
          >
            {saving
              ? <><Save className="w-4 h-4 animate-pulse" /> Saving...</>
              : <><CalendarCheck className="w-4 h-4" /> Save Attendance ({markedCount}/{students.length})</>
            }
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              <CheckCircle className="w-4 h-4" /> Saved to database ✅
            </span>
          )}
        </div>
      )}
    </div>
  );
}