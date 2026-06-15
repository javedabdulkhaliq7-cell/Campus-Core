import { useEffect, useState } from 'react';
import { supabase, Student, CURRENT_YEAR } from '../lib/supabase';
import { useSchool } from '../lib/schoolContext';
import { Plus, Search, Eye, X, Save, ChevronDown, Upload, Loader, Edit2, Trash2 } from 'lucide-react';

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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [generatingRollNumber, setGeneratingRollNumber] = useState(false);

  const emptyForm: Partial<Student> = {
    full_name: '', father_name: '', roll_number: '', parent_phone: '',
    phone: '', address: '', date_of_birth: '',
    gender: 'Male', current_grade: 1, current_section: 'A',
    enrollment_year: CURRENT_YEAR, is_active: true,
    class_id: '',
    photo_url: undefined,
  };

  // ── Function to get next roll number from database ───────────
  async function getNextRollNumber(grade: number, section: string): Promise<string | null> {
    if (!schoolId) return null;
    setGeneratingRollNumber(true);
    try {
      const { data, error } = await supabase
        .rpc('get_next_roll_number', {
          p_school_id: schoolId,
          p_grade: grade,
          p_section: section
        });
      if (error) {
        console.error('Error getting roll number:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('Failed to get roll number:', err);
      return null;
    } finally {
      setGeneratingRollNumber(false);
    }
  }

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

  // ── When a class is selected, also update grade/section and generate roll number ───
  async function handleClassSelect(classId: string) {
    const selected = classes.find(c => c.id === classId);
    if (!selected) {
      setEditStudent(prev => ({ ...prev, class_id: '' }));
      return;
    }
    // Extract grade number from class name e.g. "Class 10" → 10
    const gradeMatch = selected.name.match(/\d+/);
    const grade = gradeMatch ? parseInt(gradeMatch[0]) : editStudent?.current_grade || 1;
    const section = selected.section || 'A';

    // Generate new roll number if this is a new student (no id) or grade/section changed
    const oldGrade = editStudent?.current_grade;
    const oldSection = editStudent?.current_section;
    const isNewStudent = !editStudent?.id;
    const gradeOrSectionChanged = (oldGrade !== grade || oldSection !== section);
    
    let newRollNumber = editStudent?.roll_number || '';
    
    if (isNewStudent || gradeOrSectionChanged) {
      const generatedRoll = await getNextRollNumber(grade, section);
      if (generatedRoll) {
        newRollNumber = generatedRoll;
      }
    }

    setEditStudent(prev => ({
      ...prev,
      class_id: classId,
      current_grade: grade,
      current_section: section,
      roll_number: newRollNumber,
    }));
  }

  // ── Manual roll number change with duplicate check ─────────
  async function handleRollNumberChange(rollNumber: string) {
    if (!rollNumber.trim()) {
      setEditStudent(prev => ({ ...prev, roll_number: rollNumber }));
      return;
    }
    
    // Check for duplicate roll number (excluding current student)
    const duplicate = students.find(s => 
      s.roll_number === rollNumber && s.id !== editStudent?.id
    );
    
    if (duplicate) {
      alert(`Roll number "${rollNumber}" already exists for student: ${duplicate.full_name}. Please use a different roll number.`);
      return;
    }
    
    setEditStudent(prev => ({ ...prev, roll_number: rollNumber }));
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

  // ── Upload student photo ──────────────────────────────────
  async function uploadStudentPhoto(file: File) {
    if (!editStudent) return;
    setUploadingPhoto(true);
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `students/${fileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('student-photos')
      .upload(filePath, file);
    
    if (uploadError) {
      alert('Failed to upload photo: ' + uploadError.message);
      setUploadingPhoto(false);
      return;
    }
    
    const { data: urlData } = supabase.storage.from('student-photos').getPublicUrl(filePath);
    const photoUrl = urlData.publicUrl;
    
    setEditStudent({ ...editStudent, photo_url: photoUrl });
    setPhotoPreview(photoUrl);
    setUploadingPhoto(false);
  }

  // ── Delete student permanently ─────────────────────────────
  async function deleteStudentPermanently(studentId: string, studentName: string) {
    if (!confirm(`⚠️ Are you sure you want to PERMANENTLY delete "${studentName}"?\n\nThis will remove all their:\n- Fee records\n- Attendance records\n- Exam results\n- Documents\n- And the student profile itself\n\nThis action CANNOT be undone.`)) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Delete student documents from storage first
      const { data: docs } = await supabase
        .from('student_documents')
        .select('file_url')
        .eq('student_id', studentId);
      
      if (docs && docs.length > 0) {
        for (const doc of docs) {
          const filePath = doc.file_url.split('/').pop();
          if (filePath) {
            await supabase.storage.from('student-documents').remove([filePath]);
          }
        }
      }
      
      // Delete student photo from storage
      const { data: student } = await supabase
        .from('students')
        .select('photo_url')
        .eq('id', studentId)
        .single();
      
      if (student?.photo_url) {
        const photoPath = student.photo_url.split('/').pop();
        if (photoPath) {
          await supabase.storage.from('student-photos').remove([photoPath]);
        }
      }
      
      // Delete from student_documents table
      await supabase.from('student_documents').delete().eq('student_id', studentId);
      
      // Delete from fee_records
      await supabase.from('fee_records').delete().eq('student_id', studentId);
      
      // Delete from attendance_records
      await supabase.from('attendance_records').delete().eq('student_id', studentId);
      
      // Delete from student_results
      await supabase.from('student_results').delete().eq('student_id', studentId);
      
      // Finally, delete the student
      const { error } = await supabase.from('students').delete().eq('id', studentId);
      
      if (error) throw error;
      
      alert(`✅ "${studentName}" has been permanently deleted.`);
      fetchData();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

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

    // Final duplicate check before saving
    const duplicate = students.find(s => 
      s.roll_number === editStudent.roll_number && s.id !== editStudent.id
    );
    if (duplicate) {
      alert(`Roll number "${editStudent.roll_number}" already exists. Please use a different roll number.`);
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
    setPhotoPreview(null);
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
          onClick={() => { setEditStudent(emptyForm); setPhotoPreview(null); setShowModal(true); }}
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
              ) : (
                filtered.map(s => (
                  <tr key={s.id} className="table-row">
                    <td className="table-cell font-mono text-xs text-slate-500">{s.roll_number}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        {s.photo_url ? (
                          <img src={s.photo_url} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                            {s.full_name.charAt(0)}
                          </div>
                        )}
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
                        <button onClick={() => { setEditStudent(s); setPhotoPreview(s.photo_url || null); setShowModal(true); }} className="p-1.5 hover:bg-blue-50 rounded-lg" title="Edit">
                          <Edit2 className="w-4 h-4 text-blue-500" />
                        </button>
                        <button onClick={() => deleteStudentPermanently(s.id, s.full_name)} className="p-1.5 hover:bg-red-50 rounded-lg" title="Delete Permanently">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal with Photo Upload */}
      {showModal && editStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white">
              <h3 className="font-semibold text-slate-800">
                {editStudent.id ? 'Edit Student' : 'Add New Student'}
              </h3>
              <button onClick={() => { setShowModal(false); setEditStudent(null); setPhotoPreview(null); }} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Photo Upload Section */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                  {photoPreview ? (
                    <img src={photoPreview} className="w-full h-full object-cover" />
                  ) : editStudent.photo_url ? (
                    <img src={editStudent.photo_url} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-2xl text-slate-400">📷</div>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Student Photo</label>
                  <div className="flex items-center gap-2">
                    <label className="btn-secondary cursor-pointer inline-flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadStudentPhoto(file);
                        }}
                        disabled={uploadingPhoto}
                      />
                    </label>
                    {uploadingPhoto && <Loader className="w-4 h-4 animate-spin text-slate-500" />}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Max 2MB. JPG, PNG, WebP, SVG only.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Full Name *</label>
                  <input className="input" value={editStudent.full_name || ''} onChange={e => setEditStudent({ ...editStudent, full_name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Father's Name *</label>
                  <input className="input" value={editStudent.father_name || ''} onChange={e => setEditStudent({ ...editStudent, father_name: e.target.value })} />
                </div>
                
                {/* Roll Number with auto-generation indicator */}
                <div>
                  <label className="label">
                    Roll Number *
                    {generatingRollNumber && <Loader className="w-3 h-3 animate-spin inline ml-1" />}
                  </label>
                  <input 
                    className="input" 
                    value={editStudent.roll_number || ''} 
                    onChange={e => handleRollNumberChange(e.target.value)}
                    placeholder="Auto-generated when class selected"
                  />
                  <p className="text-xs text-slate-400 mt-1">Format: 5A-001 (Class-Section-Sequence)</p>
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

                {/* CLASS SELECTOR */}
                <div className="col-span-2">
                  <label className="label">
                    Assign to Class *
                    <span className="text-red-500 ml-1 text-xs font-normal">(required for attendance & roll number)</span>
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
                <div className="col-span-2">
                  <label className="label">Address *</label>
                  <input className="input" value={editStudent.address || ''} onChange={e => setEditStudent({ ...editStudent, address: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 sticky bottom-0 bg-white">
              <button onClick={() => { setShowModal(false); setEditStudent(null); setPhotoPreview(null); }} className="btn-secondary">Cancel</button>
              <button onClick={saveStudent} disabled={saving} className="btn-primary">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Student Modal */}
      {viewStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Student Profile</h3>
              <button onClick={() => setViewStudent(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-4 mb-5 pb-5 border-b border-slate-100">
                {viewStudent.photo_url ? (
                  <img src={viewStudent.photo_url} className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-700 text-2xl font-bold">
                    {viewStudent.full_name.charAt(0)}
                  </div>
                )}
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