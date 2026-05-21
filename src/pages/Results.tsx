import { useState, useEffect } from 'react';
import { useSchool } from '../lib/schoolContext';
import { supabase } from '../lib/supabase';
import {
  ClipboardList, ChevronDown, Save, CheckCircle, Eye, Edit3,
  Printer, Trophy, TrendingUp, Users, BookOpen, AlertCircle
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────
interface Student { id: string; full_name: string; roll_number?: string; }
interface Subject { id: string; subject_name: string; }
interface ExamStructure { has_monthly: boolean; has_midterm: boolean; has_annual: boolean; monthly_months: number[]; }
interface GradeSystem { grade_mode: 'letter' | 'percentage'; passing_percentage: number; }
interface GradeRange { min_percentage: number; max_percentage: number; grade_label: string; }
interface ResultRow {
  student_id: string;
  subject_name: string;
  total_marks: number;
  obtained_marks: number | '';
}
interface SavedResult {
  id: string;
  student_id: string;
  subject_name: string;
  total_marks: number;
  obtained_marks: number;
  grade: string;
  pass_fail: string;
}

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' }, { value: 4, label: 'April' },
  { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' },
  { value: 9, label: 'September' }, { value: 10, label: 'October' },
  { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

const GRADES_LIST = Array.from({ length: 12 }, (_, i) => i + 1);
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

// ─── Helpers ─────────────────────────────────────────────────
function getGradeLabel(percentage: number, ranges: GradeRange[]): string {
  const range = ranges.find(r => percentage >= r.min_percentage && percentage <= r.max_percentage);
  return range ? range.grade_label : '-';
}

function calcPercentage(obtained: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((obtained / total) * 100 * 10) / 10;
}

function getOrdinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ─── Main Results Page ────────────────────────────────────────
export default function Results() {
  const { settings } = useSchool();
  const schoolId = settings?.school_id || '';

  // Mode: 'entry' or 'view'
  const [mode, setMode] = useState<'entry' | 'view'>('entry');

  // Filters
  const [selectedGrade, setSelectedGrade] = useState(1);
  const [examType, setExamType] = useState<'monthly' | 'midterm' | 'annual'>('annual');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);

  // Data
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [examStructure, setExamStructure] = useState<ExamStructure | null>(null);
  const [gradeSystem, setGradeSystem] = useState<GradeSystem>({ grade_mode: 'percentage', passing_percentage: 40 });
  const [gradeRanges, setGradeRanges] = useState<GradeRange[]>([]);

  // Entry state
  const [results, setResults] = useState<ResultRow[]>([]);
  const [totalMarksPerSubject, setTotalMarksPerSubject] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [dataLoading, setDataLoading] = useState(false);
  const [alreadySaved, setAlreadySaved] = useState(false);

  // View state
  const [savedResults, setSavedResults] = useState<SavedResult[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Load grade system once
  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      const { data: gs } = await supabase.from('grade_system').select('*').eq('school_id', schoolId).single();
      if (gs) setGradeSystem({ grade_mode: gs.grade_mode, passing_percentage: gs.passing_percentage });
      const { data: gr } = await supabase.from('grade_ranges').select('*').eq('school_id', schoolId).order('min_percentage', { ascending: false });
      if (gr) setGradeRanges(gr);
    };
    load();
  }, [schoolId]);

  // Load students, subjects, exam structure when grade changes
  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      setDataLoading(true);
      const [studRes, subRes, examRes] = await Promise.all([
        supabase.from('students').select('id, full_name, roll_number').eq('school_id', schoolId).eq('current_grade', selectedGrade).order('full_name'),
        supabase.from('class_subjects').select('id, subject_name').eq('school_id', schoolId).eq('class_grade', selectedGrade).order('order_index'),
        supabase.from('exam_structure').select('*').eq('school_id', schoolId).eq('class_grade', selectedGrade).single(),
      ]);
      setStudents(studRes.data || []);
      setSubjects(subRes.data || []);
      setExamStructure(examRes.data || null);

      // Default exam type based on structure
      if (examRes.data) {
        if (examRes.data.has_annual) setExamType('annual');
        else if (examRes.data.has_midterm) setExamType('midterm');
        else if (examRes.data.has_monthly) setExamType('monthly');
      }
      setDataLoading(false);
    };
    load();
  }, [schoolId, selectedGrade]);

  // Load existing results when filters change
  useEffect(() => {
    if (!schoolId || students.length === 0 || subjects.length === 0) return;
    const load = async () => {
      const query = supabase
        .from('student_results')
        .select('*')
        .eq('school_id', schoolId)
        .eq('class_grade', selectedGrade)
        .eq('exam_type', examType)
        .eq('exam_year', selectedYear);
      if (examType === 'monthly') query.eq('exam_month', selectedMonth);
      const { data } = await query;

      if (data && data.length > 0) {
        setAlreadySaved(true);
        // Populate entry rows from saved data
        const rows: ResultRow[] = [];
        const totals: Record<string, number> = {};
        students.forEach(s => {
          subjects.forEach(sub => {
            const saved = data.find(d => d.student_id === s.id && d.subject_name === sub.subject_name);
            rows.push({
              student_id: s.id,
              subject_name: sub.subject_name,
              total_marks: saved?.total_marks || 100,
              obtained_marks: saved?.obtained_marks ?? '',
            });
            if (saved) totals[sub.subject_name] = saved.total_marks;
          });
        });
        setResults(rows);
        setTotalMarksPerSubject(totals);
      } else {
        setAlreadySaved(false);
        // Fresh empty rows
        const rows: ResultRow[] = [];
        students.forEach(s => {
          subjects.forEach(sub => {
            rows.push({ student_id: s.id, subject_name: sub.subject_name, total_marks: 100, obtained_marks: '' });
          });
        });
        setResults(rows);
        setTotalMarksPerSubject({});
      }
    };
    load();
  }, [schoolId, selectedGrade, examType, selectedMonth, selectedYear, students, subjects]);

  // Load view results
  useEffect(() => {
    if (mode !== 'view' || !schoolId) return;
    const load = async () => {
      setViewLoading(true);
      const query = supabase
        .from('student_results')
        .select('*')
        .eq('school_id', schoolId)
        .eq('class_grade', selectedGrade)
        .eq('exam_type', examType)
        .eq('exam_year', selectedYear);
      if (examType === 'monthly') query.eq('exam_month', selectedMonth);
      const { data } = await query;
      setSavedResults(data || []);
      setViewLoading(false);
    };
    load();
  }, [mode, schoolId, selectedGrade, examType, selectedMonth, selectedYear]);

  const updateObtained = (studentId: string, subjectName: string, value: string) => {
    setResults(prev => prev.map(r =>
      r.student_id === studentId && r.subject_name === subjectName
        ? { ...r, obtained_marks: value === '' ? '' : Number(value) }
        : r
    ));
  };

  const updateTotalMarks = (subjectName: string, value: number) => {
    setTotalMarksPerSubject(prev => ({ ...prev, [subjectName]: value }));
    setResults(prev => prev.map(r =>
      r.subject_name === subjectName ? { ...r, total_marks: value } : r
    ));
  };

  const saveResults = async () => {
    setSaveError('');
    const filledResults = results.filter(r => r.obtained_marks !== '');
    if (filledResults.length === 0) { setSaveError('Please enter at least one mark before saving.'); return; }

    // Validate: obtained <= total
    const invalid = filledResults.find(r => Number(r.obtained_marks) > r.total_marks);
    if (invalid) { setSaveError(`Obtained marks cannot exceed total marks for ${invalid.subject_name}.`); return; }

    setSaving(true);
    const toUpsert = filledResults.map(r => {
      const obtained = Number(r.obtained_marks);
      const pct = calcPercentage(obtained, r.total_marks);
      const passFail = pct >= gradeSystem.passing_percentage ? 'pass' : 'fail';
      const grade = gradeSystem.grade_mode === 'letter' ? getGradeLabel(pct, gradeRanges) : `${pct}%`;
      return {
        school_id: schoolId,
        student_id: r.student_id,
        class_grade: selectedGrade,
        exam_type: examType,
        exam_month: examType === 'monthly' ? selectedMonth : null,
        exam_year: selectedYear,
        subject_name: r.subject_name,
        total_marks: r.total_marks,
        obtained_marks: obtained,
        grade,
        pass_fail: passFail,
      };
    });

    const { error } = await supabase
      .from('student_results')
      .upsert(toUpsert, { onConflict: 'school_id,student_id,exam_type,exam_month,exam_year,subject_name' });

    if (!error) {
      setSaveMsg('Results saved successfully!');
      setAlreadySaved(true);
      setTimeout(() => setSaveMsg(''), 4000);
    } else {
      setSaveError('Failed to save. Please try again.');
    }
    setSaving(false);
  };

  // ── Compute student totals for view ──
  const studentTotals = students.map(student => {
    const studentResults = savedResults.filter(r => r.student_id === student.id);
    if (studentResults.length === 0) return null;
    const totalObtained = studentResults.reduce((sum, r) => sum + r.obtained_marks, 0);
    const totalMax = studentResults.reduce((sum, r) => sum + r.total_marks, 0);
    const percentage = calcPercentage(totalObtained, totalMax);
    const passFail = studentResults.every(r => r.pass_fail === 'pass') ? 'pass' : 'fail';
    const grade = gradeSystem.grade_mode === 'letter' ? getGradeLabel(percentage, gradeRanges) : `${percentage}%`;
    return { student, totalObtained, totalMax, percentage, passFail, grade, results: studentResults };
  }).filter(Boolean).sort((a, b) => (b!.percentage - a!.percentage));

  // Assign positions
  const withPositions = studentTotals.map((item, index) => ({ ...item!, position: index + 1 }));

  const examLabel = examType === 'monthly'
    ? `Monthly — ${MONTHS.find(m => m.value === selectedMonth)?.label} ${selectedYear}`
    : examType === 'midterm' ? `Midterm ${selectedYear}` : `Annual ${selectedYear}`;

  const availableExamTypes = examStructure
    ? [
        examStructure.has_monthly && { value: 'monthly', label: 'Monthly' },
        examStructure.has_midterm && { value: 'midterm', label: 'Midterm' },
        examStructure.has_annual && { value: 'annual', label: 'Annual' },
      ].filter(Boolean) as { value: string; label: string }[]
    : [
        { value: 'monthly', label: 'Monthly' },
        { value: 'midterm', label: 'Midterm' },
        { value: 'annual', label: 'Annual' },
      ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Results</h2>
          <p className="text-slate-500 text-sm">Enter and view exam results for each class</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('entry')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${mode === 'entry' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
          >
            <Edit3 className="w-4 h-4" /> Enter Results
          </button>
          <button
            onClick={() => setMode('view')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${mode === 'view' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
          >
            <Eye className="w-4 h-4" /> View Results
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Class */}
          <div>
            <label className="label">Class</label>
            <div className="relative">
              <select value={selectedGrade} onChange={e => setSelectedGrade(Number(e.target.value))}
                className="input pr-8 appearance-none cursor-pointer" style={{ minWidth: '130px' }}>
                {GRADES_LIST.map(g => <option key={g} value={g}>Class {g}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Exam Type */}
          <div>
            <label className="label">Exam Type</label>
            <div className="relative">
              <select value={examType} onChange={e => setExamType(e.target.value as 'monthly' | 'midterm' | 'annual')}
                className="input pr-8 appearance-none cursor-pointer" style={{ minWidth: '130px' }}>
                {availableExamTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Month — only for monthly */}
          {examType === 'monthly' && (
            <div>
              <label className="label">Month</label>
              <div className="relative">
                <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
                  className="input pr-8 appearance-none cursor-pointer" style={{ minWidth: '130px' }}>
                  {(examStructure?.monthly_months?.length
                    ? MONTHS.filter(m => examStructure.monthly_months.includes(m.value))
                    : MONTHS
                  ).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Year */}
          <div>
            <label className="label">Year</label>
            <div className="relative">
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
                className="input pr-8 appearance-none cursor-pointer" style={{ minWidth: '100px' }}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* ── ENTRY MODE ── */}
      {mode === 'entry' && (
        <div className="space-y-4">
          {dataLoading ? (
            <div className="card py-12 text-center text-slate-400">Loading students and subjects...</div>
          ) : students.length === 0 ? (
            <div className="card py-12 text-center">
              <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No students in Class {selectedGrade}</p>
              <p className="text-slate-400 text-sm mt-1">Add students first from the Students page.</p>
            </div>
          ) : subjects.length === 0 ? (
            <div className="card py-12 text-center">
              <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No subjects set for Class {selectedGrade}</p>
              <p className="text-slate-400 text-sm mt-1">Add subjects in Settings → Subjects per Class.</p>
            </div>
          ) : (
            <>
              {/* Already saved notice */}
              {alreadySaved && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <p className="text-sm text-amber-700">Results already saved for this exam. You can edit and save again to update.</p>
                </div>
              )}

              {/* Total marks row */}
              <div className="card">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Set Total Marks Per Subject</p>
                <div className="flex flex-wrap gap-3">
                  {subjects.map(sub => (
                    <div key={sub.id}>
                      <label className="label text-xs">{sub.subject_name}</label>
                      <input
                        type="number" min={1} max={1000}
                        value={totalMarksPerSubject[sub.subject_name] ?? 100}
                        onChange={e => updateTotalMarks(sub.subject_name, Number(e.target.value))}
                        className="input text-center font-semibold"
                        style={{ width: '80px' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Marks entry table */}
              <div className="card overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left p-3 pl-4 font-semibold text-slate-600 sticky left-0 bg-slate-50">#</th>
                      <th className="text-left p-3 font-semibold text-slate-600 sticky left-8 bg-slate-50 min-w-[140px]">Student Name</th>
                      {subjects.map(sub => (
                        <th key={sub.id} className="text-center p-3 font-semibold text-slate-600 min-w-[90px]">
                          <div>{sub.subject_name}</div>
                          <div className="text-xs font-normal text-slate-400">/ {totalMarksPerSubject[sub.subject_name] ?? 100}</div>
                        </th>
                      ))}
                      <th className="text-center p-3 font-semibold text-slate-600 min-w-[80px]">Total</th>
                      <th className="text-center p-3 font-semibold text-slate-600 min-w-[70px]">%</th>
                      {gradeSystem.grade_mode === 'letter' && <th className="text-center p-3 font-semibold text-slate-600">Grade</th>}
                      <th className="text-center p-3 font-semibold text-slate-600">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, idx) => {
                      const studentRows = results.filter(r => r.student_id === student.id);
                      const totalObtained = studentRows.reduce((sum, r) => sum + (r.obtained_marks === '' ? 0 : Number(r.obtained_marks)), 0);
                      const totalMax = studentRows.reduce((sum, r) => sum + (r.total_marks || 100), 0);
                      const hasAllMarks = studentRows.every(r => r.obtained_marks !== '');
                      const pct = hasAllMarks ? calcPercentage(totalObtained, totalMax) : null;
                      const passFail = pct !== null ? (pct >= gradeSystem.passing_percentage ? 'pass' : 'fail') : null;
                      const gradeLabel = pct !== null && gradeSystem.grade_mode === 'letter' ? getGradeLabel(pct, gradeRanges) : null;

                      return (
                        <tr key={student.id} className={`border-b border-slate-50 hover:bg-slate-50/50 ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                          <td className="p-3 pl-4 text-slate-400 text-xs">{idx + 1}</td>
                          <td className="p-3 font-medium text-slate-700">{student.full_name}</td>
                          {subjects.map(sub => {
                            const row = results.find(r => r.student_id === student.id && r.subject_name === sub.subject_name);
                            const total = totalMarksPerSubject[sub.subject_name] ?? 100;
                            const val = row?.obtained_marks ?? '';
                            const isOver = val !== '' && Number(val) > total;
                            return (
                              <td key={sub.id} className="p-2 text-center">
                                <input
                                  type="number" min={0} max={total}
                                  value={val}
                                  onChange={e => updateObtained(student.id, sub.subject_name, e.target.value)}
                                  className={`w-16 text-center rounded-lg border px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 transition-colors ${
                                    isOver ? 'border-red-300 bg-red-50 text-red-600 focus:ring-red-200' :
                                    val !== '' ? 'border-blue-200 bg-blue-50 text-blue-700 focus:ring-blue-200' :
                                    'border-slate-200 bg-white text-slate-700 focus:ring-blue-200'
                                  }`}
                                  placeholder="—"
                                />
                              </td>
                            );
                          })}
                          <td className="p-3 text-center font-semibold text-slate-700">
                            {hasAllMarks ? `${totalObtained}/${totalMax}` : '—'}
                          </td>
                          <td className="p-3 text-center font-semibold">
                            {pct !== null ? <span className={pct >= gradeSystem.passing_percentage ? 'text-emerald-600' : 'text-red-500'}>{pct}%</span> : '—'}
                          </td>
                          {gradeSystem.grade_mode === 'letter' && (
                            <td className="p-3 text-center">
                              {gradeLabel ? <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">{gradeLabel}</span> : '—'}
                            </td>
                          )}
                          <td className="p-3 text-center">
                            {passFail === 'pass' && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold">PASS</span>}
                            {passFail === 'fail' && <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-lg text-xs font-bold">FAIL</span>}
                            {passFail === null && '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Save bar */}
              {saveError && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {saveError}</p>}
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={saveResults} disabled={saving} className="btn-primary">
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : alreadySaved ? 'Update Results' : 'Save Results'}
                </button>
                {saveMsg && (
                  <span className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> {saveMsg}
                  </span>
                )}
                <button onClick={() => setMode('view')} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
                  <Eye className="w-4 h-4" /> View Saved Results
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── VIEW MODE ── */}
      {mode === 'view' && (
        <div className="space-y-4">
          {viewLoading ? (
            <div className="card py-12 text-center text-slate-400">Loading results...</div>
          ) : savedResults.length === 0 ? (
            <div className="card py-12 text-center">
              <ClipboardList className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No results found</p>
              <p className="text-slate-400 text-sm mt-1">No results saved for Class {selectedGrade} — {examLabel}.</p>
              <button onClick={() => setMode('entry')} className="mt-4 btn-primary">
                <Edit3 className="w-4 h-4" /> Enter Results
              </button>
            </div>
          ) : selectedStudent ? (
            // ── Individual Student View ──
            <div className="space-y-4">
              <button onClick={() => setSelectedStudent(null)} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
                ← Back to Class Results
              </button>

              {/* Student header */}
              <div className="card">
                {(() => {
                  const sData = withPositions.find(s => s.student.id === selectedStudent.id);
                  if (!sData) return null;
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                          <h3 className="text-lg font-bold text-slate-800">{selectedStudent.full_name}</h3>
                          <p className="text-sm text-slate-500">Class {selectedGrade} — {examLabel}</p>
                        </div>
                        <div className="flex gap-3">
                          <div className="text-center px-4 py-2 bg-blue-50 rounded-xl">
                            <p className="text-xs text-slate-400">Position</p>
                            <p className="text-lg font-bold text-blue-600">{getOrdinal(sData.position)}</p>
                          </div>
                          <div className="text-center px-4 py-2 bg-emerald-50 rounded-xl">
                            <p className="text-xs text-slate-400">Percentage</p>
                            <p className="text-lg font-bold text-emerald-600">{sData.percentage}%</p>
                          </div>
                          {gradeSystem.grade_mode === 'letter' && (
                            <div className="text-center px-4 py-2 bg-purple-50 rounded-xl">
                              <p className="text-xs text-slate-400">Grade</p>
                              <p className="text-lg font-bold text-purple-600">{sData.grade}</p>
                            </div>
                          )}
                          <div className={`text-center px-4 py-2 rounded-xl ${sData.passFail === 'pass' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                            <p className="text-xs text-slate-400">Result</p>
                            <p className={`text-lg font-bold ${sData.passFail === 'pass' ? 'text-emerald-600' : 'text-red-600'}`}>
                              {sData.passFail === 'pass' ? 'PASS' : 'FAIL'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Subject-wise marks */}
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="text-left p-3 font-semibold text-slate-600">Subject</th>
                            <th className="text-center p-3 font-semibold text-slate-600">Obtained</th>
                            <th className="text-center p-3 font-semibold text-slate-600">Total</th>
                            <th className="text-center p-3 font-semibold text-slate-600">%</th>
                            {gradeSystem.grade_mode === 'letter' && <th className="text-center p-3 font-semibold text-slate-600">Grade</th>}
                            <th className="text-center p-3 font-semibold text-slate-600">Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sData.results.map(r => {
                            const pct = calcPercentage(r.obtained_marks, r.total_marks);
                            return (
                              <tr key={r.id} className="border-b border-slate-50">
                                <td className="p-3 font-medium text-slate-700">{r.subject_name}</td>
                                <td className="p-3 text-center font-semibold text-slate-700">{r.obtained_marks}</td>
                                <td className="p-3 text-center text-slate-500">{r.total_marks}</td>
                                <td className="p-3 text-center font-semibold">
                                  <span className={pct >= gradeSystem.passing_percentage ? 'text-emerald-600' : 'text-red-500'}>{pct}%</span>
                                </td>
                                {gradeSystem.grade_mode === 'letter' && (
                                  <td className="p-3 text-center">
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">{r.grade}</span>
                                  </td>
                                )}
                                <td className="p-3 text-center">
                                  {r.pass_fail === 'pass'
                                    ? <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold">PASS</span>
                                    : <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-lg text-xs font-bold">FAIL</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 border-t-2 border-slate-200">
                            <td className="p-3 font-bold text-slate-700">Total</td>
                            <td className="p-3 text-center font-bold text-slate-700">{sData.totalObtained}</td>
                            <td className="p-3 text-center font-bold text-slate-700">{sData.totalMax}</td>
                            <td className="p-3 text-center font-bold">
                              <span className={sData.percentage >= gradeSystem.passing_percentage ? 'text-emerald-600' : 'text-red-500'}>{sData.percentage}%</span>
                            </td>
                            {gradeSystem.grade_mode === 'letter' && (
                              <td className="p-3 text-center">
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-bold">{sData.grade}</span>
                              </td>
                            )}
                            <td className="p-3 text-center">
                              {sData.passFail === 'pass'
                                ? <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold">PASS</span>
                                : <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-lg text-sm font-bold">FAIL</span>}
                            </td>
                          </tr>
                        </tfoot>
                      </table>

                      {/* Print button */}
                      <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
                        <Printer className="w-4 h-4" /> Print Report Card
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            // ── Class Marksheet View ──
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Students', value: withPositions.length, icon: Users, color: 'blue' },
                  { label: 'Passed', value: withPositions.filter(s => s.passFail === 'pass').length, icon: CheckCircle, color: 'emerald' },
                  { label: 'Failed', value: withPositions.filter(s => s.passFail === 'fail').length, icon: AlertCircle, color: 'red' },
                  { label: 'Class Average', value: withPositions.length > 0 ? `${Math.round(withPositions.reduce((sum, s) => sum + s.percentage, 0) / withPositions.length)}%` : '—', icon: TrendingUp, color: 'purple' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="card py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 text-${color}-500`} />
                      <p className="text-xs text-slate-400">{label}</p>
                    </div>
                    <p className={`text-xl font-bold text-${color}-600`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Class marksheet table */}
              <div className="card overflow-x-auto p-0">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">Class {selectedGrade} — {examLabel}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Click any student to see their full report card</p>
                  </div>
                  <button onClick={() => window.print()}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors">
                    <Printer className="w-3.5 h-3.5" /> Print
                  </button>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-center p-3 font-semibold text-slate-600 w-10"><Trophy className="w-4 h-4 mx-auto text-yellow-500" /></th>
                      <th className="text-left p-3 font-semibold text-slate-600">Student Name</th>
                      {subjects.map(sub => (
                        <th key={sub.id} className="text-center p-3 font-semibold text-slate-600 min-w-[80px]">{sub.subject_name}</th>
                      ))}
                      <th className="text-center p-3 font-semibold text-slate-600">Total</th>
                      <th className="text-center p-3 font-semibold text-slate-600">%</th>
                      {gradeSystem.grade_mode === 'letter' && <th className="text-center p-3 font-semibold text-slate-600">Grade</th>}
                      <th className="text-center p-3 font-semibold text-slate-600">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withPositions.map((item) => (
                      <tr key={item.student.id}
                        onClick={() => setSelectedStudent(item.student)}
                        className="border-b border-slate-50 hover:bg-blue-50/50 cursor-pointer transition-colors">
                        <td className="p-3 text-center">
                          {item.position <= 3 ? (
                            <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center mx-auto ${
                              item.position === 1 ? 'bg-yellow-100 text-yellow-700' :
                              item.position === 2 ? 'bg-slate-100 text-slate-600' :
                              'bg-orange-100 text-orange-600'
                            }`}>{item.position}</span>
                          ) : (
                            <span className="text-xs text-slate-400">{item.position}</span>
                          )}
                        </td>
                        <td className="p-3 font-medium text-slate-700">{item.student.full_name}</td>
                        {subjects.map(sub => {
                          const r = item.results.find(res => res.subject_name === sub.subject_name);
                          return (
                            <td key={sub.id} className="p-3 text-center text-slate-600">
                              {r ? r.obtained_marks : '—'}
                            </td>
                          );
                        })}
                        <td className="p-3 text-center font-semibold text-slate-700">{item.totalObtained}/{item.totalMax}</td>
                        <td className="p-3 text-center font-semibold">
                          <span className={item.percentage >= gradeSystem.passing_percentage ? 'text-emerald-600' : 'text-red-500'}>{item.percentage}%</span>
                        </td>
                        {gradeSystem.grade_mode === 'letter' && (
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">{item.grade}</span>
                          </td>
                        )}
                        <td className="p-3 text-center">
                          {item.passFail === 'pass'
                            ? <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold">PASS</span>
                            : <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-lg text-xs font-bold">FAIL</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
