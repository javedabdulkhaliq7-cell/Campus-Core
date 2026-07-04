import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, CheckCircle, Lock, RefreshCw, Eye, Edit3, ChevronDown, Printer } from 'lucide-react';

interface TeacherInfo {
  class_id: string | null;
  class_name: string | null;
  class_grade: number | null;
  school_id: string;
  full_name: string;
}
interface Props {
  teacherInfo: TeacherInfo;
  canPrint?: boolean;
}
interface Student { id: string; full_name: string; roll_number: string; }
interface Subject { id: string; subject_name: string; }
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
  exam_type: string;
  exam_month: number | null;
  exam_year: number;
}

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' },   { value: 4, label: 'April' },
  { value: 5, label: 'May' },     { value: 6, label: 'June' },
  { value: 7, label: 'July' },    { value: 8, label: 'August' },
  { value: 9, label: 'September' },{ value: 10, label: 'October' },
  { value: 11, label: 'November' },{ value: 12, label: 'December' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

function calcPercentage(obtained: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((obtained / total) * 100 * 10) / 10;
}

function calcGrade(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

export default function TeacherResults({ teacherInfo, canPrint = false }: Props) {
  const now = new Date();
  const [mode, setMode]                       = useState<'entry' | 'view'>('entry');
  const [examType, setExamType]               = useState<'monthly' | 'midterm' | 'annual'>('monthly');
  const [selectedMonth, setSelectedMonth]     = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear]       = useState(now.getFullYear());
  const [students, setStudents]               = useState<Student[]>([]);
  const [subjects, setSubjects]               = useState<Subject[]>([]);
  const [results, setResults]                 = useState<ResultRow[]>([]);
  const [savedResults, setSavedResults]       = useState<SavedResult[]>([]);
  const [totalMarksPerSubject, setTotalMarksPerSubject] = useState<Record<string, number>>({});
  const [isLocked, setIsLocked]               = useState(false);
  const [alreadySaved, setAlreadySaved]       = useState(false);
  const [loading, setLoading]                 = useState(true);
  const [saving, setSaving]                   = useState(false);
  const [saveMsg, setSaveMsg]                 = useState('');
  const [saveError, setSaveError]             = useState('');
  const [examStructure, setExamStructure]     = useState<{
    has_monthly: boolean; has_midterm: boolean; has_annual: boolean; monthly_months: number[];
  } | null>(null);

  // ── Load students + subjects + exam structure once ────────
  useEffect(() => { fetchBase(); }, [teacherInfo.class_id]);

  async function fetchBase() {
    if (!teacherInfo.class_id || !teacherInfo.class_grade) return;
    setLoading(true);
    try {
      const [{ data: studs }, { data: subs }, { data: examStr }, { data: lockData }] = await Promise.all([
        supabase.from('students')
          .select('id, full_name, roll_number')
          .eq('class_id', teacherInfo.class_id)
          .eq('is_active', true)
          .order('roll_number'),
        supabase.from('class_subjects')
          .select('id, subject_name, order_index')
          .eq('class_grade', teacherInfo.class_grade)
          .eq('school_id', teacherInfo.school_id)
          .order('order_index', { ascending: true }),
        supabase.from('exam_structure')
          .select('has_monthly, has_midterm, has_annual, monthly_months, is_locked')
          .eq('school_id', teacherInfo.school_id)
          .eq('class_grade', teacherInfo.class_grade)
          .maybeSingle(),
        supabase.from('exam_structure')
          .select('is_locked')
          .eq('school_id', teacherInfo.school_id)
          .eq('class_grade', teacherInfo.class_grade)
          .maybeSingle(),
      ]);
      setStudents(studs || []);
      setSubjects(subs || []);
      setExamStructure(examStr || null);
      setIsLocked(lockData?.is_locked || false);
    } finally {
      setLoading(false);
    }
  }

  // ── Load results for entry mode ───────────────────────────
  useEffect(() => {
    if (!teacherInfo.school_id || students.length === 0 || subjects.length === 0) return;
    const load = async () => {
      const query = supabase
        .from('student_results')
        .select('*')
        .eq('school_id', teacherInfo.school_id)
        .eq('class_grade', teacherInfo.class_grade)
        .eq('exam_type', examType)
        .eq('exam_year', selectedYear);
      if (examType === 'monthly') query.eq('exam_month', selectedMonth);
      const { data } = await query;

      if (data && data.length > 0) {
        setAlreadySaved(true);
        const rows: ResultRow[] = [];
        const totals: Record<string, number> = {};
        students.forEach(s => {
          subjects.forEach(sub => {
            const saved = data.find(d => d.student_id === s.id && d.subject_name === sub.subject_name);
            rows.push({
              student_id:    s.id,
              subject_name:  sub.subject_name,
              total_marks:   saved?.total_marks || 100,
              obtained_marks: saved?.obtained_marks ?? '',
            });
            if (saved) totals[sub.subject_name] = saved.total_marks;
          });
        });
        setResults(rows);
        setTotalMarksPerSubject(totals);
      } else {
        setAlreadySaved(false);
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
  }, [teacherInfo.school_id, examType, selectedMonth, selectedYear, students, subjects]);

  // ── Load results for view mode ────────────────────────────
  useEffect(() => {
    if (mode !== 'view' || !teacherInfo.school_id) return;
    const load = async () => {
      const query = supabase
        .from('student_results')
        .select('*')
        .eq('school_id', teacherInfo.school_id)
        .eq('class_grade', teacherInfo.class_grade)
        .eq('exam_type', examType)
        .eq('exam_year', selectedYear);
      if (examType === 'monthly') query.eq('exam_month', selectedMonth);
      const { data } = await query;
      setSavedResults(data || []);
    };
    load();
  }, [mode, teacherInfo.school_id, examType, selectedMonth, selectedYear]);

  function updateObtained(studentId: string, subjectName: string, value: string) {
    setResults(prev => prev.map(r =>
      r.student_id === studentId && r.subject_name === subjectName
        ? { ...r, obtained_marks: value === '' ? '' : Number(value) }
        : r
    ));
  }

  function updateTotalMarks(subjectName: string, value: number) {
    setTotalMarksPerSubject(prev => ({ ...prev, [subjectName]: value }));
    setResults(prev => prev.map(r =>
      r.subject_name === subjectName ? { ...r, total_marks: value } : r
    ));
  }

  async function saveResults() {
    setSaveError('');
    const filledResults = results.filter(r => r.obtained_marks !== '');
    if (filledResults.length === 0) {
      setSaveError('Please enter at least one mark before saving.');
      return;
    }
    const invalid = filledResults.find(r => Number(r.obtained_marks) > r.total_marks);
    if (invalid) {
      setSaveError(`Obtained marks cannot exceed total marks for ${invalid.subject_name}.`);
      return;
    }
    setSaving(true);
    const toUpsert = filledResults.map(r => {
      const obtained = Number(r.obtained_marks);
      const pct      = calcPercentage(obtained, r.total_marks);
      const passFail = pct >= 50 ? 'pass' : 'fail';
      const grade    = calcGrade(pct);
      return {
        school_id:     teacherInfo.school_id,
        student_id:    r.student_id,
        class_grade:   teacherInfo.class_grade,
        exam_type:     examType,
        exam_month:    examType === 'monthly' ? selectedMonth : null,
        exam_year:     selectedYear,
        subject_name:  r.subject_name,
        total_marks:   r.total_marks,
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
      setSaveError('Failed to save: ' + error.message);
    }
    setSaving(false);
  }

  // ── View mode: compute student totals ────────────────────
  const studentTotals = students.map(student => {
    const stuResults = savedResults.filter(r => r.student_id === student.id);
    if (stuResults.length === 0) return null;
    const seen = new Set<string>();
    const deduped = stuResults.filter(r => { if (seen.has(r.subject_name)) return false; seen.add(r.subject_name); return true; });
    const totalObtained = deduped.reduce((s, r) => s + r.obtained_marks, 0);
    const totalMax      = deduped.reduce((s, r) => s + r.total_marks, 0);
    const percentage    = calcPercentage(totalObtained, totalMax);
    const passFail      = deduped.every(r => r.pass_fail === 'pass') ? 'pass' : 'fail';
    const grade         = calcGrade(percentage);
    return { student, totalObtained, totalMax, percentage, passFail, grade, results: deduped };
  }).filter(Boolean).sort((a, b) => b!.percentage - a!.percentage);

  const withPositions = studentTotals.map((item, i) => ({ ...item!, position: i + 1 }));

  const examLabel = examType === 'monthly'
    ? `Monthly — ${MONTHS.find(m => m.value === selectedMonth)?.label} ${selectedYear}`
    : examType === 'midterm' ? `Midterm ${selectedYear}` : `Annual ${selectedYear}`;

  const availableExamTypes = examStructure
    ? [
        examStructure.has_monthly && { value: 'monthly', label: 'Monthly' },
        examStructure.has_midterm && { value: 'midterm', label: 'Midterm' },
        examStructure.has_annual  && { value: 'annual',  label: 'Annual' },
      ].filter(Boolean) as { value: string; label: string }[]
    : [
        { value: 'monthly', label: 'Monthly' },
        { value: 'midterm', label: 'Midterm' },
        { value: 'annual',  label: 'Annual' },
      ];

  // ── Print results ─────────────────────────────────────────
  function handlePrint() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const subjectHeaders = subjects.map(s => `<th style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-size:11px;">${s.subject_name}</th>`).join('');

    const rows = withPositions.map(item => {
      const subjectCells = subjects.map(sub => {
        const r = item.results.find(res => res.subject_name === sub.subject_name);
        return `<td style="border:1px solid #ddd;padding:6px 10px;text-align:center;">${r ? r.obtained_marks : '—'}</td>`;
      }).join('');
      return `
        <tr>
          <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;">${item.position}</td>
          <td style="border:1px solid #ddd;padding:6px 10px;font-weight:600;">${item.student.full_name}</td>
          <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;">${item.student.roll_number}</td>
          ${subjectCells}
          <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">${item.totalObtained}/${item.totalMax}</td>
          <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">${item.percentage}%</td>
          <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:700;">${item.grade}</td>
          <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:700;color:${item.passFail === 'pass' ? '#059669' : '#dc2626'}">
            ${item.passFail === 'pass' ? 'PASS' : 'FAIL'}
          </td>
        </tr>`;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Results — ${teacherInfo.class_name} — ${examLabel}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
          h2 { margin: 0 0 4px; font-size: 18px; }
          p  { margin: 0 0 16px; font-size: 13px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #f8fafc; border: 1px solid #ddd; padding: 8px 10px; text-align: left; font-size: 11px; }
          @media print { @page { margin: 15mm; } }
        </style>
      </head>
      <body>
        <h2>${teacherInfo.class_name} — ${examLabel}</h2>
        <p>Teacher: ${teacherInfo.full_name} &nbsp;|&nbsp; Printed on: ${new Date().toLocaleDateString('en-PK')}</p>
        <table>
          <thead>
            <tr>
              <th style="border:1px solid #ddd;padding:8px 10px;text-align:center;">#</th>
              <th style="border:1px solid #ddd;padding:8px 10px;">Student Name</th>
              <th style="border:1px solid #ddd;padding:8px 10px;text-align:center;">Roll #</th>
              ${subjectHeaders}
              <th style="border:1px solid #ddd;padding:8px 10px;text-align:center;">Total</th>
              <th style="border:1px solid #ddd;padding:8px 10px;text-align:center;">%</th>
              <th style="border:1px solid #ddd;padding:8px 10px;text-align:center;">Grade</th>
              <th style="border:1px solid #ddd;padding:8px 10px;text-align:center;">Result</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  }

  if (loading) return <div className="text-center py-16 text-slate-400">Loading results...</div>;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Results</h2>
          <p className="text-slate-500 text-sm">{teacherInfo.class_name}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMode('entry')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${mode === 'entry' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
            <Edit3 className="w-4 h-4" /> Enter Results
          </button>
          <button onClick={() => setMode('view')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${mode === 'view' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
            <Eye className="w-4 h-4" /> View Results
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Exam Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Exam Type</label>
            <div className="relative">
              <select value={examType} onChange={e => setExamType(e.target.value as 'monthly' | 'midterm' | 'annual')}
                className="border border-slate-200 rounded-xl px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer" style={{ minWidth: 130 }}>
                {availableExamTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Month */}
          {examType === 'monthly' && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Month</label>
              <div className="relative">
                <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
                  className="border border-slate-200 rounded-xl px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer" style={{ minWidth: 130 }}>
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
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Year</label>
            <div className="relative">
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
                className="border border-slate-200 rounded-xl px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer" style={{ minWidth: 100 }}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <button onClick={fetchBase} className="p-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lock notice */}
      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0" />
          Results are locked by admin. Contact your admin to make changes.
        </div>
      )}

      {/* Already saved notice */}
      {alreadySaved && mode === 'entry' && !isLocked && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
          ✏️ Results already saved for this exam — you can update them below.
        </div>
      )}

      {/* ── ENTRY MODE ── */}
      {mode === 'entry' && (
        <>
          {subjects.length === 0 ? (
            <div className="text-center py-12 text-slate-400">No subjects found for Grade {teacherInfo.class_grade}.</div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 text-slate-400">No active students in this class.</div>
          ) : (
            <div className="card p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left p-3 font-semibold text-slate-600 sticky left-0 bg-slate-50 min-w-[160px]">Student</th>
                    {subjects.map(sub => (
                      <th key={sub.id} className="text-center p-3 font-semibold text-slate-600 min-w-[110px]">
                        <div>{sub.subject_name}</div>
                        {!isLocked && (
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <span className="text-xs text-slate-400 font-normal">Total:</span>
                            <input
                              type="number"
                              min={1}
                              value={totalMarksPerSubject[sub.subject_name] ?? 100}
                              onChange={e => updateTotalMarks(sub.subject_name, Number(e.target.value))}
                              className="w-14 text-center border border-slate-200 rounded-lg py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        )}
                        {isLocked && (
                          <div className="text-xs text-slate-400 font-normal">/{totalMarksPerSubject[sub.subject_name] ?? 100}</div>
                        )}
                      </th>
                    ))}
                    <th className="text-center p-3 font-semibold text-slate-600 min-w-[80px]">Total</th>
                    <th className="text-center p-3 font-semibold text-slate-600 min-w-[60px]">%</th>
                    <th className="text-center p-3 font-semibold text-slate-600 min-w-[60px]">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => {
                    const stuResults = results.filter(r => r.student_id === s.id);
                    const totalObtained = stuResults.reduce((sum, r) => sum + (r.obtained_marks === '' ? 0 : Number(r.obtained_marks)), 0);
                    const totalMax      = stuResults.reduce((sum, r) => sum + (r.total_marks || 100), 0);
                    const pct           = calcPercentage(totalObtained, totalMax);
                    const grade         = calcGrade(pct);
                    return (
                      <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="p-3 sticky left-0 bg-white">
                          <p className="font-medium text-slate-800">{s.full_name}</p>
                          <p className="text-xs text-slate-400">Roll # {s.roll_number}</p>
                        </td>
                        {subjects.map(sub => {
                          const row = results.find(r => r.student_id === s.id && r.subject_name === sub.subject_name);
                          return (
                            <td key={sub.id} className="p-2 text-center">
                              <input
                                type="number"
                                min={0}
                                max={row?.total_marks ?? 100}
                                disabled={isLocked}
                                value={row?.obtained_marks ?? ''}
                                onChange={e => updateObtained(s.id, sub.subject_name, e.target.value)}
                                className="w-16 text-center border border-slate-200 rounded-lg py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                                placeholder="—"
                              />
                            </td>
                          );
                        })}
                        <td className="p-3 text-center font-semibold text-slate-700">{totalObtained}/{totalMax}</td>
                        <td className="p-3 text-center font-semibold">
                          <span className={pct >= 50 ? 'text-emerald-600' : 'text-red-500'}>{pct}%</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${pct >= 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {grade}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Error / Save */}
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">❌ {saveError}</div>
          )}

          {!isLocked && students.length > 0 && subjects.length > 0 && (
            <div className="flex items-center gap-3">
              <button onClick={saveResults} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-semibold transition-colors shadow-sm">
                {saving ? <><Save className="w-4 h-4 animate-pulse" /> Saving...</> : <><Save className="w-4 h-4" /> {alreadySaved ? 'Update Results' : 'Save Results'}</>}
              </button>
              {saveMsg && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <CheckCircle className="w-4 h-4" /> {saveMsg}
                </span>
              )}
            </div>
          )}
        </>
      )}

      {/* ── VIEW MODE ── */}
      {mode === 'view' && (
        <div className="space-y-4">
          {withPositions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">No results found for {examLabel}.</div>
          ) : (
            <div className="card p-0 overflow-x-auto">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">{teacherInfo.class_name} — {examLabel}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{withPositions.length} students</p>
                </div>
                {canPrint && withPositions.length > 0 && (
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-colors"
                  >
                    <Printer className="w-4 h-4" /> Print Results
                  </button>
                )}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-center p-3 font-semibold text-slate-600 w-10">#</th>
                    <th className="text-left p-3 font-semibold text-slate-600">Student</th>
                    {subjects.map(sub => (
                      <th key={sub.id} className="text-center p-3 font-semibold text-slate-600 min-w-[80px]">{sub.subject_name}</th>
                    ))}
                    <th className="text-center p-3 font-semibold text-slate-600">Total</th>
                    <th className="text-center p-3 font-semibold text-slate-600">%</th>
                    <th className="text-center p-3 font-semibold text-slate-600">Grade</th>
                    <th className="text-center p-3 font-semibold text-slate-600">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {withPositions.map(item => (
                    <tr key={item.student.id} className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors">
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
                        <span className={item.percentage >= 50 ? 'text-emerald-600' : 'text-red-500'}>{item.percentage}%</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">{item.grade}</span>
                      </td>
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
          )}
        </div>
      )}
    </div>
  );
}