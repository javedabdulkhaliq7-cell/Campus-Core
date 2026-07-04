import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, User, X } from 'lucide-react';

interface TeacherInfo {
  class_id: string | null;
  class_name: string | null;
  school_id: string;
}

interface Student {
  id: string;
  full_name: string;
  father_name: string;
  roll_number: string;
  is_active: boolean;
  date_of_birth: string | null;
  gender: string | null;
  photo_url: string | null;
}

interface Props { teacherInfo: TeacherInfo; }

export default function TeacherStudents({ teacherInfo }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState<Student | null>(null);

  useEffect(() => { fetchStudents(); }, [teacherInfo.class_id]);

  async function fetchStudents() {
    if (!teacherInfo.class_id) return;
    setLoading(true);
    const { data } = await supabase
      .from('students')
      .select('id, full_name, father_name, roll_number, is_active, date_of_birth, gender, photo_url')
      .eq('class_id', teacherInfo.class_id)
      .order('roll_number', { ascending: true });
    setStudents(data || []);
    setLoading(false);
  }

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.roll_number?.toString().includes(search)
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Students</h2>
          <p className="text-slate-500 text-sm">{teacherInfo.class_name} · {students.length} students</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or roll number..."
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading students...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No students found.</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Roll #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Father's Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-600">{s.roll_number}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{s.full_name}</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{s.father_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelected(s)}
                      className="text-xs text-emerald-600 hover:underline font-medium"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Student Profile Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-lg">Student Profile</h3>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              {selected.photo_url ? (
                <img src={selected.photo_url} alt={selected.full_name} className="w-16 h-16 rounded-full object-cover border-2 border-emerald-200" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <User className="w-8 h-8 text-emerald-600" />
                </div>
              )}
              <div>
                <p className="font-bold text-slate-800 text-lg">{selected.full_name}</p>
                <p className="text-sm text-slate-500">Roll # {selected.roll_number}</p>
              </div>
            </div>

            <div className="space-y-2.5 text-sm">
              {[
                { label: "Father's Name", value: selected.father_name },
                { label: 'Class',         value: teacherInfo.class_name },
                { label: 'Gender',        value: selected.gender || '—' },
                { label: 'Date of Birth', value: selected.date_of_birth ? new Date(selected.date_of_birth).toLocaleDateString('en-PK') : '—' },
                { label: 'Status',        value: selected.is_active ? 'Active' : 'Inactive' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium text-slate-800">{value}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-400 text-center">View only — contact admin to make changes</p>
          </div>
        </div>
      )}
    </div>
  );
}
