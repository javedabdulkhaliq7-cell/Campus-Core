import { useEffect, useState } from 'react';
import { supabase, Student, CURRENT_YEAR } from '../lib/supabase';
import { useSchool } from '../lib/schoolContext';
import { Plus, Search, Eye, UserX, UserCheck, X, Save, ChevronDown } from 'lucide-react';

// ── Class type from classes table ─────────────────────────────
interface ClassRecord {
  id: string;
  name: string;
  section: string | null;
}

export default function Students() {
  const { schoolId, loading: schoolLoading } = useSchool();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [showModal, setShowModal] = useState(false);
  const [viewStudent, setViewStudent] = useState<Student | null>(null);
  const [editStudent, setEditStudent] = useState<Partial<Student> | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm: Partial<Student> = {
    full_name: '', father_name: '', roll_number: '', parent_phone: '',
    phone: '', address: '', date_of_birth: '',
    gender: 'Male', current_grade: 1, current_section: 'A',
    enrollment_year: CURRENT_YEAR, is_active: true,
    class_id: '',
  };

  // ── Load students ─────────────────────────────────────────
  async function fetchData() {
    setLoading(true);
    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', schoolId)
      .order('full_name');
    setStudents(data || []);
    setLoading(false);
  }

  // ── Load classes for this school ──────────────────────────
  async function fetchClasses() {
    const { data } = await supabase
      .from('classes')
      .select('id, name, section')
      .eq('school_id', schoolId)
      .order('name');
    setClasses(data || []);
  }

  useEffect(() => {
    if (schoolId) {
      fetchData();
      fetchClasses();
    } else if (!schoolLoading) {
      setLoading(false);
    }
  }, [schoolId, schoolLoading]);

  // ── When a class is selected, also update grade/section ───
  function handleClassSelect(classId: string) {
    const selected = classes.find(c => c.id === classId);
    if (!selected) {
      setEditStudent(prev => ({ ...prev, class_id: '' }));
      return;
    }
    // Extract grade number from class name e.g. "Class 10" → 10
    const gradeMatch = selected.name.match(/\d+/);
    const grade = gradeMatch ? parseInt(gradeMatch[0]) : editStudent?.current_grade || 1;
    const section = selected.section || 'A';

    setEditStudent(prev => ({
      ...prev,
      class_id: classId,
      current_grade: grade,
      current_section: section,
    }));
  }

  // ── Get display label for a class ─────────────────────────
  function classLabel(c: ClassRecord) {
    return c.section ? `${c.name} (${c.section})` : c.name;
  }

  // ── Filter students ───────────────────────────────────────
  const filtered = students.filter(s => {
    const matchSearch = !search ||
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(search.toLowerCase()) ||
      s.father_name.toLowerCase().includes(search.toLowerCase());
    const matchClass = !filterClass || s.class_id === filterClass;
    const matchStatus = filterStatus === 'all' ||
      (filterStatus === 'active' ? s.is_active : !s.is_active);
    return matchSearch && matchClass && matchStatus;
  });

  // ── Save student ──────────────────────────────────────────
  async function saveStudent() {
    if (!editStudent || !schoolId) return;

    // Validate required fields
    const requiredFields: Array<[keyof Student, string]> = [
      ['full_name', 'Full Name'],
      ['father_name', "Father's Name"],
      ['roll_number', 'Roll Number'],
      ['date_of_birth', 'Date of Birth'],
      ['address', 'Address'],
      ['phone', 'Student Phone'],
      ['parent_phone', 'Parent Phone'],
    ];

    for (const [field, label] of requiredFields) {
      if (!editStudent[field]) {
        alert(`Please fill in: ${label}`);
        return;
      }
    }

    // Class is required — must always be assigned
    if (!editStudent.class_id) {
      alert('Please select a Class. Every student must be assigned to a class.');
      return;
    }

    setSaving(true);
    const { id, created_at, ...rest } = editStudent as Student;
    const record = { ...rest, school_id: schoolId };

    let error;
    if (editStudent.id) {
      ({ error } = await supabase.from('students').update(record).eq('id', editStudent.id));
    } else {
      ({ error } = await supabase.from('students').insert(record));
    }

    setSaving(false);
    if (error) { alert('Failed to save: ' + error.message); return; }
    setShowModal(false);
    setEditStudent(null);
    fetchData();
  }

  async function toggleStatus(student: Student) {
    const { error } = await supabase
      .from('students')
      .update({ is_active: !student.is_active })
      .eq('id', student.id);
    if (error) { alert('Failed to update status: ' + error.message); return; }
    fetchData();
  }

  // ── Get class label for a student ─────────────────────────
  function studentClassLabel(student: Student) {
    if (student.class_id) {
      const cls = classes.find(c => c.id === student.class_id);
      if (cls) return classLabel(cls);
    }
    // Fallback to grade/section if class_id not linked
    return `Class ${student.current_grade}-${student.current_section}`;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Students</h2>
          <p className="text-slate-500 text-sm">{filtered.length} students found</p>
        </div>
        <button
          onClick={() => { setEditStudent(emptyForm); setShowModal(true); }}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" /> Add Student
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search by name, roll number..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {/* Filter by class */}
          <div className="relative">
            <select
              className="input pr-8 appearance-none"
              value={filterClass}
              onChange={e => setFilterClass(e.target.value)}
            >
              <option value="">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{classLabel(c)}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              className="input pr-8 appearance-none"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header text-left">Roll No.</th>
                <th className="table-header text-left">Student Name</th>
                <th className="table-header text-left">Father's Name</th>
                <th className="table-header text-left">Class</th>
                <th className="table-header text-left hidden sm:table-cell">Phone</th>
                <th className="table-header text-left">Status</th>
                <th className="table-header text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="table-cell text-center py-12 text-slate-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="table-cell text-center py-12 text-slate-400">No students found</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="table-row">
                  <td className="table-cell font-mono text-xs text-slate-500">{s.roll_number}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                        {s.full_name.charAt(0)}
                      </div>
                      <span className="font-medium text-slate-800">{s.full_name}</span>
                    </div>
                  </td>
                  <td className="table-cell text-slate-600">{s.father_name}</td>
                  <td className="table-cell">
                    <span className={`badge ${s.class_id ? 'badge-blue' : 'badge-red'}`}>
                      {studentClassLabel(s)}
                    </span>
                  </td>
                  <td className="table-cell text-slate-600 hidden sm:table-cell">{s.parent_phone}</td>
                  <td className="table-cell">
                    <span className={`badge ${s.is_active ? 'badge-green' : 'badge-red'}`}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setViewStudent(s)} className="p-1.5 hover:bg-slate-100 rounded-lg" title="View">
                        <Eye className="w-4 h-4 text-slate-500" />
                      </button>
                      <button onClick={() => { setEditStudent(s); setShowModal(true); }} className="p-1.5 hover:bg-blue-50 rounded-lg" title="Edit">
                        <Plus className="w-4 h-4 text-blue-500" />
                      </button>
                      <button onClick={() => toggleStatus(s)} className="p-1.5 hover:bg-slate-100 rounded-lg" title="Toggle">
                        {s.is_active
                          ? <UserX className="w-4 h-4 text-red-400" />
                          : <UserCheck className="w-4 h-4 text-emerald-500" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && editStudent && (
        <div className="modal-backdrop">
          <div className="modal-box animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">
                {editStudent.id ? 'Edit Student' : 'Add New Student'}
              </h3>
              <button onClick={() => { setShowModal(false); setEditStudent(null); }} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Full Name *</label>
                  <input className="input" value={editStudent.full_name || ''} onChange={e => setEditStudent({ ...editStudent, full_name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Father's Name *</label>
                  <input className="input" value={editStudent.father_name || ''} onChange={e => setEditStudent({ ...editStudent, father_name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Roll Number *</label>
                  <input className="input" value={editStudent.roll_number || ''} onChange={e => setEditStudent({ ...editStudent, roll_number: e.target.value })} />
                </div>
                <div>
                  <label className="label">B-Form / CNIC</label>
                  <input className="input" value={editStudent.cnic_or_b_form || ''} onChange={e => setEditStudent({ ...editStudent, cnic_or_b_form: e.target.value })} placeholder="Optional" />
                </div>
                <div>
                  <label className="label">Date of Birth *</label>
                  <input type="date" className="input" value={editStudent.date_of_birth || ''} onChange={e => setEditStudent({ ...editStudent, date_of_birth: e.target.value })} />
                </div>
                <div>
                  <label className="label">Gender *</label>
                  <select className="input" value={editStudent.gender || 'Male'} onChange={e => setEditStudent({ ...editStudent, gender: e.target.value })}>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>

                {/* CLASS SELECTOR — replaces separate grade/section dropdowns */}
                <div className="col-span-2">
                  <label className="label">
                    Assign to Class *
                    <span className="text-red-500 ml-1 text-xs font-normal">(required for attendance)</span>
                  </label>
                  {classes.length === 0 ? (
                    <div className="input bg-amber-50 border-amber-200 text-amber-700 text-sm">
                      ⚠ No classes found. Go to the Classes page and add classes first.
                    </div>
                  ) : (
                    <select
                      className={`input ${!editStudent.class_id ? 'border-red-300 bg-red-50' : ''}`}
                      value={editStudent.class_id || ''}
                      onChange={e => handleClassSelect(e.target.value)}
                    >
                      <option value="">— Select a class —</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{classLabel(c)}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="label">Enrollment Year *</label>
                  <input type="number" className="input" value={editStudent.enrollment_year || CURRENT_YEAR} onChange={e => setEditStudent({ ...editStudent, enrollment_year: parseInt(e.target.value) })} />
                </div>
                <div>
                  <label className="label">Student Phone *</label>
                  <input className="input" value={editStudent.phone || ''} onChange={e => setEditStudent({ ...editStudent, phone: e.target.value })} />
                </div>
                <div>
                  <label className="label">Parent Phone *</label>
                  <input className="input" value={editStudent.parent_phone || ''} onChange={e => setEditStudent({ ...editStudent, parent_phone: e.target.value })} />
                </div>
                <div>
                  <label className="label">Address *</label>
                  <input className="input" value={editStudent.address || ''} onChange={e => setEditStudent({ ...editStudent, address: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100">
              <button onClick={() => { setShowModal(false); setEditStudent(null); }} className="btn-secondary">Cancel</button>
              <button onClick={saveStudent} disabled={saving} className="btn-primary">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Student Modal — unchanged */}
      {viewStudent && (
        <div className="modal-backdrop">
          <div className="modal-box animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Student Profile</h3>
              <button onClick={() => setViewStudent(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-4 mb-5 pb-5 border-b border-slate-100">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-700 text-2xl font-bold">
                  {viewStudent.full_name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-800">{viewStudent.full_name}</h4>
                  <p className="text-slate-500 text-sm">{viewStudent.father_name} (Father)</p>
                  <div className="flex gap-2 mt-1.5">
                    <span className="badge badge-blue">{studentClassLabel(viewStudent)}</span>
                    <span className={`badge ${viewStudent.is_active ? 'badge-green' : 'badge-red'}`}>
                      {viewStudent.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Roll Number', viewStudent.roll_number],
                  ['Gender', viewStudent.gender],
                  ['Parent Phone', viewStudent.parent_phone],
                  ['Student Phone', viewStudent.phone],
                  ['DOB', viewStudent.date_of_birth],
                  ['Enrollment', viewStudent.enrollment_year],
                  ['B-Form', viewStudent.cnic_or_b_form || 'N/A'],
                  ['Address', viewStudent.address],
                ].map(([l, v]) => (
                  <div key={l as string}>
                    <p className="text-xs text-slate-400">{l}</p>
                    <p className="text-sm font-medium text-slate-700">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
