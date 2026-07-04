import { useEffect, useState } from 'react';
import { supabase, MONTHS } from '../lib/supabase';
import { AlertCircle, MessageSquare, CheckCircle, X } from 'lucide-react';

interface TeacherInfo { class_id: string | null; class_name: string | null; school_id: string; }
interface Props { teacherInfo: TeacherInfo; }

interface Defaulter {
  student_id: string;
  full_name: string;
  roll_number: string;
  fee_month: number;
  fee_year: number;
  total_amount: number;
  amount_paid: number;
  status: string;
  lastNotified?: string;
  lastNote?: string;
}

export default function TeacherDefaulters({ teacherInfo }: Props) {
  const now = new Date();
  const [month, setMonth]             = useState(now.getMonth() + 1);
  const [year, setYear]               = useState(now.getFullYear());
  const [defaulters, setDefaulters]   = useState<Defaulter[]>([]);
  const [loading, setLoading]         = useState(true);
  const [noteStudent, setNoteStudent] = useState<Defaulter | null>(null);
  const [note, setNote]               = useState('');
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState<string | null>(null);
  const [teacherId, setTeacherId]     = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setTeacherId(data.user?.id || null));
  }, []);

  useEffect(() => { fetchDefaulters(); }, [month, year, teacherInfo.class_id]);

  async function fetchDefaulters() {
    if (!teacherInfo.class_id) return;
    setLoading(true);
    try {
      // Get students in class
      const { data: students } = await supabase
        .from('students')
        .select('id, full_name, roll_number')
        .eq('class_id', teacherInfo.class_id)
        .eq('is_active', true);

      if (!students?.length) { setDefaulters([]); setLoading(false); return; }

      const ids = students.map(s => s.id);
      const studentMap = Object.fromEntries(students.map(s => [s.id, s]));

      // Get fee records for selected month/year with unpaid/partial
      const { data: fees } = await supabase
        .from('fee_records')
        .select('student_id, fee_month, fee_year, total_amount, amount_paid, status')
        .eq('fee_month', month)
        .eq('fee_year', year)
        .in('status', ['Unpaid', 'Partial'])
        .in('student_id', ids);

      if (!fees?.length) { setDefaulters([]); setLoading(false); return; }

      // Get latest notifications for each student
      const { data: notifications } = await supabase
        .from('fee_notifications')
        .select('student_id, note, notified_at')
        .in('student_id', ids)
        .order('notified_at', { ascending: false });

      const notifMap: Record<string, { note: string; notified_at: string }> = {};
      (notifications || []).forEach(n => {
        if (!notifMap[n.student_id]) notifMap[n.student_id] = n;
      });

      const result: Defaulter[] = fees.map(f => ({
        student_id:   f.student_id,
        full_name:    studentMap[f.student_id]?.full_name || '—',
        roll_number:  studentMap[f.student_id]?.roll_number || '—',
        fee_month:    f.fee_month,
        fee_year:     f.fee_year,
        total_amount: f.total_amount || 0,
        amount_paid:  f.amount_paid || 0,
        status:       f.status,
        lastNotified: notifMap[f.student_id]?.notified_at,
        lastNote:     notifMap[f.student_id]?.note,
      }));

      setDefaulters(result);
    } finally {
      setLoading(false);
    }
  }

  async function submitNote() {
    if (!noteStudent || !note.trim() || !teacherId) return;
    setSaving(true);
    await supabase.from('fee_notifications').insert({
      school_id:  teacherInfo.school_id,
      student_id: noteStudent.student_id,
      teacher_id: teacherId,
      note:       note.trim(),
    });
    setSaved(noteStudent.student_id);
    setNoteStudent(null);
    setNote('');
    setSaving(false);
    fetchDefaulters();
    setTimeout(() => setSaved(null), 3000);
  }

  const pending = (d: Defaulter) => Math.max(0, d.total_amount - d.amount_paid);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Fee Defaulters</h2>
          <p className="text-slate-500 text-sm">{teacherInfo.class_name}</p>
        </div>
        <div className="flex gap-2">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card bg-red-50 border-red-100">
          <p className="text-xs text-red-600 font-semibold uppercase">Defaulters</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{defaulters.length}</p>
        </div>
        <div className="card bg-amber-50 border-amber-100">
          <p className="text-xs text-amber-600 font-semibold uppercase">Total Pending</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">Rs. {defaulters.reduce((s, d) => s + pending(d), 0).toLocaleString()}</p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading defaulters...</div>
      ) : defaulters.length === 0 ? (
        <div className="card text-center py-10">
          <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
          <p className="font-semibold text-slate-700">No defaulters this month!</p>
          <p className="text-sm text-slate-400 mt-1">All students have paid their fees.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {defaulters.map(d => (
            <div key={d.student_id} className="card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold text-sm flex-shrink-0">
                    {d.full_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{d.full_name}</p>
                    <p className="text-xs text-slate-400">Roll # {d.roll_number}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${d.status === 'Partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                  {d.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-slate-400">Total</p>
                  <p className="font-semibold text-slate-700">Rs. {d.total_amount.toLocaleString()}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-2">
                  <p className="text-emerald-600">Paid</p>
                  <p className="font-semibold text-emerald-700">Rs. {d.amount_paid.toLocaleString()}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2">
                  <p className="text-red-500">Pending</p>
                  <p className="font-semibold text-red-700">Rs. {pending(d).toLocaleString()}</p>
                </div>
              </div>

              {/* Last notification */}
              {d.lastNote && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
                  <span className="font-semibold">Last note:</span> {d.lastNote}
                  <span className="text-blue-400 ml-1">· {d.lastNotified ? new Date(d.lastNotified).toLocaleDateString('en-PK') : ''}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setNoteStudent(d); setNote(''); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Mark Notified
                </button>
                {saved === d.student_id && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                    <CheckCircle className="w-3.5 h-3.5" /> Note saved
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Note Modal */}
      {noteStudent && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Mark as Notified</h3>
              <button onClick={() => setNoteStudent(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 text-sm">
              <p className="font-semibold text-slate-800">{noteStudent.full_name}</p>
              <p className="text-slate-500">Pending: Rs. {pending(noteStudent).toLocaleString()}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Add a note <span className="text-slate-400 font-normal">(what did you tell them?)</span>
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
                placeholder="e.g. Spoke to parent — will submit fee by Friday"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setNoteStudent(null)}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={submitNote} disabled={!note.trim() || saving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? 'Saving...' : <><AlertCircle className="w-4 h-4" /> Save Note</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
