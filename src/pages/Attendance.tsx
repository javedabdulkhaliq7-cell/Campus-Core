import { useEffect, useState } from 'react';
import { supabase, Student, GRADES, SECTIONS } from '../lib/supabase';
import { useSchool } from '../lib/schoolContext';
import { Save, RefreshCw, ChevronDown, Calendar, Users, Filter } from 'lucide-react';

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Leave';

interface AttendanceEntry { student: Student; status: AttendanceStatus; remarks: string; }

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; btn: string }> = {
  Present: { label: 'P', btn: 'bg-emerald-500 hover:bg-emerald-600 text-white' },
  Absent: { label: 'A', btn: 'bg-red-500 hover:bg-red-600 text-white' },
  Late: { label: 'L', btn: 'bg-amber-500 hover:bg-amber-600 text-white' },
  Leave: { label: 'LV', btn: 'bg-slate-400 hover:bg-slate-500 text-white' },
};

export default function Attendance() {
  const { schoolId, loading: schoolLoading } = useSchool();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedGrade, setSelectedGrade] = useState('1');
  const [selectedSection, setSelectedSection] = useState('A');
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceEntry>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function loadStudentsAndAttendance() {
    setLoading(true); setSaved(false);
    const { data: studs } = await supabase.from('students').select('*').eq('school_id', schoolId).eq('current_grade', parseInt(selectedGrade)).eq('current_section', selectedSection).eq('is_active', true).order('roll_number');
    if (!studs?.length) { setStudents([]); setAttendance({}); setLoading(false); return; }
    setStudents(studs);
    const { data: existing } = await supabase.from('attendance_records').select('*').eq('school_id', schoolId).eq('attendance_date', selectedDate).in('student_id', studs.map(s => s.id));
    const existingMap = Object.fromEntries((existing || []).map(r => [r.student_id, r]));
    const newAtt: Record<string, AttendanceEntry> = {};
    studs.forEach(s => { newAtt[s.id] = { student: s, status: (existingMap[s.id]?.status as AttendanceStatus) || 'Present', remarks: existingMap[s.id]?.remarks || '' }; });
    setAttendance(newAtt); setLoading(false);
  }

  useEffect(() => { if (schoolId) loadStudentsAndAttendance(); }, [selectedDate, selectedGrade, selectedSection, schoolId]);

  function setStatus(sid: string, status: AttendanceStatus) { setAttendance(prev => ({ ...prev, [sid]: { ...prev[sid], status } })); setSaved(false); }
  function markAll(status: AttendanceStatus) { const u = { ...attendance }; Object.keys(u).forEach(id => { u[id] = { ...u[id], status }; }); setAttendance(u); setSaved(false); }

  async function saveAttendance() {
    setSaving(true);
    const records = Object.entries(attendance).map(([sid, e]) => ({ student_id: sid, school_id: schoolId, attendance_date: selectedDate, status: e.status, remarks: e.remarks, marked_by: 'Principal' }));
    let saveError = null;
    for (const r of records) {
      const { error } = await supabase.from('attendance_records').upsert(r, { onConflict: 'school_id,student_id,attendance_date' });
      if (error) { saveError = error; break; }
    }
    setSaving(false);
    if (saveError) { alert('Failed to save attendance: ' + saveError.message); return; }
    setSaved(true);
  }

  const counts = Object.values(attendance).reduce((acc, e) => { acc[e.status] = (acc[e.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold text-slate-800">Daily Attendance</h2><p className="text-slate-500 text-sm">Mark attendance for each class</p></div>
        <button onClick={saveAttendance} disabled={saving || students.length === 0} className="btn-success"><Save className="w-4 h-4" />{saving ? 'Saving...' : saved ? 'Saved!' : 'Save Attendance'}</button>
      </div>

      <div className="card p-4"><div className="flex flex-wrap gap-3 items-end">
        <div><label className="label">Date</label><div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="date" className="input pl-9 w-44" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} /></div></div>
        <div><label className="label">Class</label><div className="relative"><select className="input pr-8 w-36 appearance-none" value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}>{GRADES.map(g => <option key={g} value={g}>Class {g}</option>)}</select><ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" /></div></div>
        <div><label className="label">Section</label><div className="relative"><select className="input pr-8 w-28 appearance-none" value={selectedSection} onChange={e => setSelectedSection(e.target.value)}>{SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}</select><ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" /></div></div>
        <button onClick={loadStudentsAndAttendance} className="btn-secondary"><RefreshCw className="w-4 h-4" />Refresh</button>
        <div className="flex-1" />
        {students.length > 0 && <div className="flex items-center gap-2"><span className="text-xs text-slate-500 font-medium">Mark All:</span>{(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map(s => (<button key={s} onClick={() => markAll(s)} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${STATUS_CONFIG[s].btn}`}>{STATUS_CONFIG[s].label}</button>))}</div>}
      </div></div>

      {students.length > 0 && (<div className="flex gap-3 flex-wrap">{(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map(s => (<div key={s} className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl px-4 py-2 shadow-sm"><div className={`w-2.5 h-2.5 rounded-full ${s === 'Present' ? 'bg-emerald-500' : s === 'Absent' ? 'bg-red-500' : s === 'Late' ? 'bg-amber-500' : 'bg-slate-400'}`} /><span className="text-sm font-medium text-slate-700">{s}</span><span className="text-sm font-bold text-slate-900">{counts[s] || 0}</span></div>))}<div className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl px-4 py-2 shadow-sm"><Users className="w-3.5 h-3.5 text-slate-400" /><span className="text-sm font-medium text-slate-700">Total</span><span className="text-sm font-bold text-slate-900">{students.length}</span></div></div>)}

      <div className="card p-0 overflow-hidden">
        {loading ? <div className="py-16 text-center text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /><p>Loading students...</p></div> :
        students.length === 0 ? <div className="py-16 text-center text-slate-400"><Filter className="w-6 h-6 mx-auto mb-2 opacity-40" /><p className="font-medium">No students found</p></div> :
        (<div className="overflow-x-auto"><table className="w-full"><thead><tr><th className="table-header text-left w-12">#</th><th className="table-header text-left">Student Name</th><th className="table-header text-left hidden sm:table-cell">Roll No.</th><th className="table-header text-center">Attendance</th><th className="table-header text-left hidden md:table-cell">Remarks</th></tr></thead><tbody>
          {students.map((student, idx) => { const entry = attendance[student.id]; if (!entry) return null; return (
            <tr key={student.id} className="table-row"><td className="table-cell text-slate-400 text-xs">{idx + 1}</td>
              <td className="table-cell"><div className="flex items-center gap-2.5"><div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">{student.full_name.charAt(0)}</div><div><p className="font-medium text-slate-800 text-sm">{student.full_name}</p><p className="text-xs text-slate-400">{student.father_name}</p></div></div></td>
              <td className="table-cell hidden sm:table-cell text-xs text-slate-500 font-mono">{student.roll_number}</td>
              <td className="table-cell"><div className="flex items-center justify-center gap-1.5">{(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map(s => (<button key={s} onClick={() => setStatus(student.id, s)} className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${entry.status === s ? STATUS_CONFIG[s].btn + ' shadow-md scale-110' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>{STATUS_CONFIG[s].label}</button>))}</div></td>
              <td className="table-cell hidden md:table-cell"><input className="input text-xs py-1.5 w-32" placeholder="Remark..." value={entry.remarks} onChange={e => setAttendance(prev => ({ ...prev, [student.id]: { ...prev[student.id], remarks: e.target.value } }))} /></td>
            </tr>); })}
        </tbody></table></div>)}
      </div>

      {students.length > 0 && <div className="flex justify-end"><button onClick={saveAttendance} disabled={saving} className="btn-success"><Save className="w-4 h-4" />{saving ? 'Saving...' : saved ? 'Saved!' : `Save ${students.length} Records`}</button></div>}
    </div>
  );
}
