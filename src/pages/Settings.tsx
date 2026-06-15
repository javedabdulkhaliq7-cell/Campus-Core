import { useState, useEffect, useRef, useCallback } from 'react';
import { useSchool } from '../lib/schoolContext';
import { APP_NAME, supabase } from '../lib/supabase';
import { Save, School, Shield, Database, CheckCircle, CalendarOff, Plus, Trash2, BookOpen, ChevronDown, ClipboardList, Star, Upload, X } from 'lucide-react';
import SchoolSettingsLogoUpload from './SchoolSettingsLogoUpload';
// ─── Types ────────────────────────────────────────────────────
interface Holiday {
  id: string;
  date: string;
  reason: string;
}

interface Subject {
  id: string;
  class_grade: number;
  subject_name: string;
  order_index: number;
}

interface ExamStructure {
  id?: string;
  has_monthly: boolean;
  has_midterm: boolean;
  has_annual: boolean;
  monthly_months: number[];
}

interface GradeSystem {
  id?: string;
  grade_mode: 'letter' | 'percentage';
  passing_percentage: number;
}

interface GradeRange {
  id?: string;
  min_percentage: number;
  max_percentage: number;
  grade_label: string;
}

const OFF_DAY_OPTIONS = [
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const DEFAULT_GRADE_RANGES: GradeRange[] = [
  { min_percentage: 90, max_percentage: 100, grade_label: 'A+' },
  { min_percentage: 80, max_percentage: 89, grade_label: 'A' },
  { min_percentage: 70, max_percentage: 79, grade_label: 'B' },
  { min_percentage: 60, max_percentage: 69, grade_label: 'C' },
  { min_percentage: 50, max_percentage: 59, grade_label: 'D' },
  { min_percentage: 0, max_percentage: 49, grade_label: 'F' },
];

// ─── Attendance Settings Section ──────────────────────────────
function AttendanceSettingsSection({ schoolId }: { schoolId: string }) {
  const [weeklyOffDays, setWeeklyOffDays] = useState<number[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayReason, setNewHolidayReason] = useState('');
  const [savingOff, setSavingOff] = useState(false);
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [offMsg, setOffMsg] = useState('');
  const [holidayMsg, setHolidayMsg] = useState('');
  const [holidayError, setHolidayError] = useState('');

  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      const { data: settingsData } = await supabase
        .from('school_settings')
        .select('weekly_off_days')
        .eq('school_id', schoolId)
        .single();
      if (settingsData?.weekly_off_days) setWeeklyOffDays(settingsData.weekly_off_days);
      const { data: holidayData } = await supabase
        .from('school_holidays')
        .select('id, date, reason')
        .eq('school_id', schoolId)
        .order('date', { ascending: true });
      if (holidayData) setHolidays(holidayData);
    };
    load();
  }, [schoolId]);

  const toggleOffDay = (day: number) => {
    setWeeklyOffDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const saveWeeklyOff = async () => {
    setSavingOff(true);
    await supabase.from('school_settings').update({ weekly_off_days: weeklyOffDays }).eq('school_id', schoolId);
    setOffMsg('Saved!');
    setTimeout(() => setOffMsg(''), 3000);
    setSavingOff(false);
  };

  const addHoliday = async () => {
    setHolidayError('');
    if (!newHolidayDate) { setHolidayError('Please select a date.'); return; }
    if (!newHolidayReason.trim()) { setHolidayError('Please enter a reason.'); return; }
    if (holidays.some(h => h.date === newHolidayDate)) { setHolidayError('A holiday already exists for this date.'); return; }
    setSavingHoliday(true);
    const { data, error } = await supabase
      .from('school_holidays')
      .insert({ school_id: schoolId, date: newHolidayDate, reason: newHolidayReason.trim() })
      .select().single();
    if (!error && data) {
      setHolidays(prev => [...prev, data].sort((a, b) => a.date > b.date ? 1 : -1));
      setNewHolidayDate(''); setNewHolidayReason('');
      setHolidayMsg('Holiday added.');
      setTimeout(() => setHolidayMsg(''), 3000);
    } else { setHolidayError('Failed to add. Please try again.'); }
    setSavingHoliday(false);
  };

  const deleteHoliday = async (id: string) => {
    setDeletingId(id);
    await supabase.from('school_holidays').delete().eq('id', id);
    setHolidays(prev => prev.filter(h => h.id !== id));
    setDeletingId(null);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PK', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <>
      <div className="card space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <CalendarOff className="w-4 h-4 text-orange-500" />
          <h3 className="font-semibold text-slate-800">Weekly Off Days</h3>
        </div>
        <p className="text-sm text-slate-400">Select which days are weekly holidays. Attendance cannot be marked on these days.</p>
        <div className="flex gap-3 flex-wrap">
          {OFF_DAY_OPTIONS.map(({ value, label }) => {
            const isOn = weeklyOffDays.includes(value);
            return (
              <button key={value} onClick={() => toggleOffDay(value)}
                className={`px-5 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${isOn ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={saveWeeklyOff} disabled={savingOff} className="btn-primary">
            <Save className="w-4 h-4" />{savingOff ? 'Saving...' : 'Save'}
          </button>
          {offMsg && <span className="text-sm text-emerald-600 font-medium flex items-center gap-1"><CheckCircle className="w-4 h-4" /> {offMsg}</span>}
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <CalendarOff className="w-4 h-4 text-red-500" />
          <h3 className="font-semibold text-slate-800">School Holidays</h3>
        </div>
        <p className="text-sm text-slate-400">Add specific holiday dates like Independence Day, Eid, etc.</p>
        <div className="flex gap-2 flex-wrap">
          <input type="date" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)} className="input" style={{ maxWidth: '180px' }} />
          <input type="text" value={newHolidayReason} onChange={e => setNewHolidayReason(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addHoliday()} placeholder="Reason e.g. Independence Day" className="input flex-1" style={{ minWidth: '200px' }} />
          <button onClick={addHoliday} disabled={savingHoliday} className="btn-primary">
            <Plus className="w-4 h-4" />{savingHoliday ? 'Adding...' : 'Add'}
          </button>
        </div>
        {holidayError && <p className="text-xs text-red-500">{holidayError}</p>}
        {holidayMsg && <p className="text-xs text-emerald-600 font-medium">✓ {holidayMsg}</p>}
        {holidays.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">No holidays added yet.</div>
        ) : (
          <div className="space-y-2 mt-2">
            {holidays.map(holiday => (
              <div key={holiday.id} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-100 rounded-xl">
                <div>
                  <span className="text-sm font-semibold text-slate-700">{formatDate(holiday.date)}</span>
                  <span className="mx-2 text-slate-300">—</span>
                  <span className="text-sm text-slate-600">{holiday.reason}</span>
                </div>
                <button onClick={() => deleteHoliday(holiday.id)} disabled={deletingId === holiday.id}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Subjects per Class Section ───────────────────────────────
function SubjectsSettingsSection({ schoolId }: { schoolId: string }) {
  const [selectedGrade, setSelectedGrade] = useState<number>(1);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('class_subjects').select('id, class_grade, subject_name, order_index')
        .eq('school_id', schoolId).eq('class_grade', selectedGrade).order('order_index', { ascending: true });
      setSubjects(data || []);
      setLoading(false);
    };
    load();
  }, [schoolId, selectedGrade]);

  const addSubject = async () => {
    setError('');
    const name = newSubjectName.trim();
    if (!name) { setError('Please enter a subject name.'); return; }
    if (subjects.some(s => s.subject_name.toLowerCase() === name.toLowerCase())) { setError('This subject already exists for this class.'); return; }
    setSaving(true);
    const { data, error: dbError } = await supabase
      .from('class_subjects')
      .insert({ school_id: schoolId, class_grade: selectedGrade, subject_name: name, order_index: subjects.length })
      .select().single();
    if (!dbError && data) {
      setSubjects(prev => [...prev, data]);
      setNewSubjectName('');
      setSuccessMsg('Subject added.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } else { setError('Failed to add subject. Please try again.'); }
    setSaving(false);
  };

  const deleteSubject = async (id: string) => {
    setDeletingId(id);
    await supabase.from('class_subjects').delete().eq('id', id);
    setSubjects(prev => prev.filter(s => s.id !== id));
    setDeletingId(null);
  };

  const getOrdinal = (n: number) => { const s = ['th','st','nd','rd']; const v = n % 100; return n + (s[(v-20)%10] || s[v] || s[0]); };

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <BookOpen className="w-4 h-4 text-purple-500" />
        <h3 className="font-semibold text-slate-800">Subjects per Class</h3>
      </div>
      <p className="text-sm text-slate-400">Set which subjects are taught in each class. These will appear when entering results.</p>
      <div>
        <label className="label">Select Class</label>
        <div className="relative inline-block">
          <select value={selectedGrade}
            onChange={e => { setSelectedGrade(Number(e.target.value)); setError(''); setSuccessMsg(''); setNewSubjectName(''); }}
            className="input pr-8 appearance-none cursor-pointer" style={{ minWidth: '160px' }}>
            {GRADES.map(g => <option key={g} value={g}>Class {g} ({getOrdinal(g)} Grade)</option>)}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>
      <div className="flex gap-2">
        <input type="text" value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addSubject()} placeholder="e.g. Mathematics, English, Urdu..." className="input flex-1" />
        <button onClick={addSubject} disabled={saving} className="btn-primary">
          <Plus className="w-4 h-4" />{saving ? 'Adding...' : 'Add'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {successMsg && <p className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {successMsg}</p>}
      {loading ? (
        <div className="py-6 text-center text-sm text-slate-400">Loading...</div>
      ) : subjects.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl">
          <BookOpen className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No subjects added for Class {selectedGrade} yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Class {selectedGrade} — {subjects.length} subject{subjects.length !== 1 ? 's' : ''}</p>
          {subjects.map((subject, index) => (
            <div key={subject.id} className="flex items-center justify-between p-3 bg-purple-50 border border-purple-100 rounded-xl group">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold flex items-center justify-center">{index + 1}</span>
                <span className="text-sm font-medium text-slate-700">{subject.subject_name}</span>
              </div>
              <button onClick={() => deleteSubject(subject.id)} disabled={deletingId === subject.id}
                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      {subjects.length > 0 && <p className="text-xs text-slate-300 italic">Tip: Switch the class above to add subjects for other classes.</p>}
    </div>
  );
}

// ─── Exam Structure Section ───────────────────────────────────
function ExamStructureSection({ schoolId }: { schoolId: string }) {
  const [selectedGrade, setSelectedGrade] = useState<number>(1);
  const [structure, setStructure] = useState<ExamStructure>({ has_monthly: false, has_midterm: false, has_annual: false, monthly_months: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from('exam_structure').select('*')
        .eq('school_id', schoolId).eq('class_grade', selectedGrade).single();
      if (data) {
        setStructure({ id: data.id, has_monthly: data.has_monthly, has_midterm: data.has_midterm, has_annual: data.has_annual, monthly_months: data.monthly_months || [] });
      } else {
        setStructure({ has_monthly: false, has_midterm: false, has_annual: false, monthly_months: [] });
      }
      setLoading(false);
    };
    load();
  }, [schoolId, selectedGrade]);

  const toggleMonth = (month: number) => {
    setStructure(prev => ({
      ...prev,
      monthly_months: prev.monthly_months.includes(month)
        ? prev.monthly_months.filter(m => m !== month)
        : [...prev.monthly_months, month].sort((a, b) => a - b),
    }));
  };

  const saveStructure = async () => {
    setSaving(true);
    const payload = { school_id: schoolId, class_grade: selectedGrade, has_monthly: structure.has_monthly, has_midterm: structure.has_midterm, has_annual: structure.has_annual, monthly_months: structure.has_monthly ? structure.monthly_months : [] };
    const { data, error } = await supabase.from('exam_structure').upsert(payload, { onConflict: 'school_id,class_grade' }).select().single();
    if (!error && data) { setStructure(prev => ({ ...prev, id: data.id })); setSuccessMsg('Saved!'); setTimeout(() => setSuccessMsg(''), 3000); }
    setSaving(false);
  };

  const getOrdinal = (n: number) => { const s = ['th','st','nd','rd']; const v = n % 100; return n + (s[(v-20)%10] || s[v] || s[0]); };

  const examTypes = [
    { key: 'has_monthly', label: 'Monthly Exams', desc: 'Exams held in specific months during the year', activeClass: 'border-blue-200 bg-blue-50', textClass: 'text-blue-700', toggleClass: 'bg-blue-500' },
    { key: 'has_midterm', label: 'Midterm Exam', desc: 'One exam held in the middle of the year', activeClass: 'border-amber-200 bg-amber-50', textClass: 'text-amber-700', toggleClass: 'bg-amber-500' },
    { key: 'has_annual', label: 'Annual Exam', desc: 'Final exam held at the end of the year', activeClass: 'border-emerald-200 bg-emerald-50', textClass: 'text-emerald-700', toggleClass: 'bg-emerald-500' },
  ];

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardList className="w-4 h-4 text-blue-500" />
        <h3 className="font-semibold text-slate-800">Exam Structure</h3>
      </div>
      <p className="text-sm text-slate-400">Set which exams each class has and which months have monthly exams.</p>
      <div>
        <label className="label">Select Class</label>
        <div className="relative inline-block">
          <select value={selectedGrade} onChange={e => { setSelectedGrade(Number(e.target.value)); setSuccessMsg(''); }}
            className="input pr-8 appearance-none cursor-pointer" style={{ minWidth: '160px' }}>
            {GRADES.map(g => <option key={g} value={g}>Class {g} ({getOrdinal(g)} Grade)</option>)}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>
      {loading ? <div className="py-4 text-center text-sm text-slate-400">Loading...</div> : (
        <>
          <div>
            <label className="label">Exam Types for Class {selectedGrade}</label>
            <div className="space-y-2">
              {examTypes.map(({ key, label, desc, activeClass, textClass, toggleClass }) => {
                const isOn = structure[key as keyof ExamStructure] as boolean;
                return (
                  <div key={key} onClick={() => setStructure(prev => ({ ...prev, [key]: !isOn }))}
                    className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${isOn ? activeClass : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                    <div>
                      <p className={`text-sm font-semibold ${isOn ? textClass : 'text-slate-600'}`}>{label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-all flex items-center px-1 ${isOn ? toggleClass : 'bg-slate-200'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${isOn ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {structure.has_monthly && (
            <div>
              <label className="label">Which months have monthly exams?</label>
              <p className="text-xs text-slate-400 mb-2">Select all months where a monthly exam is held for Class {selectedGrade}.</p>
              <div className="grid grid-cols-3 gap-2">
                {MONTHS.map(({ value, label }) => {
                  const isSelected = structure.monthly_months.includes(value);
                  return (
                    <button key={value} onClick={() => toggleMonth(value)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border-2 transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300'}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
              {structure.monthly_months.length > 0 && (
                <p className="text-xs text-blue-600 mt-2 font-medium">
                  ✓ {structure.monthly_months.length} month{structure.monthly_months.length !== 1 ? 's' : ''} selected: {structure.monthly_months.map(m => MONTHS.find(mo => mo.value === m)?.label).join(', ')}
                </p>
              )}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button onClick={saveStructure} disabled={saving} className="btn-primary">
              <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save Exam Structure'}
            </button>
            {successMsg && <span className="text-sm text-emerald-600 font-medium flex items-center gap-1"><CheckCircle className="w-4 h-4" /> {successMsg}</span>}
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-1">
            <p className="font-semibold text-slate-600">Class {selectedGrade} Summary:</p>
            <p>Monthly: {structure.has_monthly ? `Yes (${structure.monthly_months.length} month${structure.monthly_months.length !== 1 ? 's' : ''} selected)` : 'No'}</p>
            <p>Midterm: {structure.has_midterm ? 'Yes' : 'No'}</p>
            <p>Annual: {structure.has_annual ? 'Yes' : 'No'}</p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Grade System Section ─────────────────────────────────────
function GradeSystemSection({ schoolId }: { schoolId: string }) {
  const [gradeSystem, setGradeSystem] = useState<GradeSystem>({ grade_mode: 'percentage', passing_percentage: 40 });
  const [gradeRanges, setGradeRanges] = useState<GradeRange[]>(DEFAULT_GRADE_RANGES);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [newRange, setNewRange] = useState<GradeRange>({ min_percentage: 0, max_percentage: 0, grade_label: '' });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      setLoading(true);
      const { data: gsData } = await supabase.from('grade_system').select('*').eq('school_id', schoolId).single();
      if (gsData) {
        setGradeSystem({ id: gsData.id, grade_mode: gsData.grade_mode, passing_percentage: gsData.passing_percentage });
      }
      const { data: grData } = await supabase.from('grade_ranges').select('*').eq('school_id', schoolId).order('min_percentage', { ascending: false });
      if (grData && grData.length > 0) setGradeRanges(grData);
      setLoading(false);
    };
    load();
  }, [schoolId]);

  const saveGradeSystem = async () => {
    setError('');
    if (gradeSystem.passing_percentage < 0 || gradeSystem.passing_percentage > 100) {
      setError('Passing percentage must be between 0 and 100.');
      return;
    }
    setSaving(true);
    // Save grade_system
    const { data: gsData, error: gsError } = await supabase
      .from('grade_system')
      .upsert({ school_id: schoolId, grade_mode: gradeSystem.grade_mode, passing_percentage: gradeSystem.passing_percentage }, { onConflict: 'school_id' })
      .select().single();
    if (gsError) { setError('Failed to save. Please try again.'); setSaving(false); return; }
    if (gsData) setGradeSystem(prev => ({ ...prev, id: gsData.id }));

    // If letter mode — save grade ranges
    if (gradeSystem.grade_mode === 'letter') {
      // Delete existing ranges and re-insert
      await supabase.from('grade_ranges').delete().eq('school_id', schoolId);
      if (gradeRanges.length > 0) {
        const toInsert = gradeRanges.map(r => ({
          school_id: schoolId,
          min_percentage: r.min_percentage,
          max_percentage: r.max_percentage,
          grade_label: r.grade_label,
        }));
        await supabase.from('grade_ranges').insert(toInsert);
        // Reload to get IDs
        const { data: freshRanges } = await supabase.from('grade_ranges').select('*').eq('school_id', schoolId).order('min_percentage', { ascending: false });
        if (freshRanges) setGradeRanges(freshRanges);
      }
    }
    setSuccessMsg('Saved!');
    setTimeout(() => setSuccessMsg(''), 3000);
    setSaving(false);
  };

  const addRange = () => {
    setError('');
    if (!newRange.grade_label.trim()) { setError('Please enter a grade label.'); return; }
    if (newRange.min_percentage > newRange.max_percentage) { setError('Min % cannot be greater than Max %.'); return; }
    setGradeRanges(prev => [...prev, { ...newRange, grade_label: newRange.grade_label.trim() }].sort((a, b) => b.min_percentage - a.min_percentage));
    setNewRange({ min_percentage: 0, max_percentage: 0, grade_label: '' });
  };

  const removeRange = (index: number) => {
    setGradeRanges(prev => prev.filter((_, i) => i !== index));
  };

  const resetToDefault = () => {
    setGradeRanges(DEFAULT_GRADE_RANGES);
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Star className="w-4 h-4 text-yellow-500" />
        <h3 className="font-semibold text-slate-800">Grade System</h3>
      </div>
      <p className="text-sm text-slate-400">
        Set how results are graded across your school. Applies to all classes.
      </p>

      {loading ? <div className="py-4 text-center text-sm text-slate-400">Loading...</div> : (
        <>
          {/* Grade Mode Toggle */}
          <div>
            <label className="label">Grading Mode</label>
            <div className="flex gap-3">
              {[
                { value: 'percentage', label: '% Percentage Only', desc: 'Show only percentage, no letter grade' },
                { value: 'letter', label: 'A B C Letter Grades', desc: 'Show letter grade + percentage' },
              ].map(({ value, label, desc }) => {
                const isOn = gradeSystem.grade_mode === value;
                return (
                  <div key={value} onClick={() => setGradeSystem(prev => ({ ...prev, grade_mode: value as 'letter' | 'percentage' }))}
                    className={`flex-1 p-3 rounded-xl border-2 cursor-pointer transition-all ${isOn ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                    <p className={`text-sm font-semibold ${isOn ? 'text-blue-700' : 'text-slate-600'}`}>{label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Passing Percentage */}
          <div>
            <label className="label">Passing Percentage</label>
            <div className="flex items-center gap-3">
              <input
                type="number" min={0} max={100}
                value={gradeSystem.passing_percentage}
                onChange={e => setGradeSystem(prev => ({ ...prev, passing_percentage: Number(e.target.value) }))}
                className="input" style={{ maxWidth: '120px' }}
              />
              <span className="text-sm text-slate-500">% — students below this are marked <span className="text-red-500 font-semibold">Fail</span></span>
            </div>
          </div>

          {/* Letter Grade Ranges — only if letter mode */}
          {gradeSystem.grade_mode === 'letter' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="label mb-0">Grade Ranges</label>
                <button onClick={resetToDefault} className="text-xs text-blue-500 hover:text-blue-700 font-medium">Reset to Default</button>
              </div>
              <p className="text-xs text-slate-400">Define what percentage range maps to each letter grade.</p>

              {/* Existing ranges */}
              <div className="space-y-2">
                {gradeRanges.map((range, index) => (
                  <div key={index} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="w-10 h-8 rounded-lg bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center flex-shrink-0">
                      {range.grade_label}
                    </span>
                    <span className="text-sm text-slate-600 flex-1">
                      {range.min_percentage}% – {range.max_percentage}%
                    </span>
                    <button onClick={() => removeRange(index)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add new range */}
              <div className="flex gap-2 items-end flex-wrap">
                <div>
                  <label className="label text-xs">Grade Label</label>
                  <input type="text" value={newRange.grade_label} onChange={e => setNewRange(prev => ({ ...prev, grade_label: e.target.value }))}
                    placeholder="e.g. A+" className="input" style={{ maxWidth: '80px' }} />
                </div>
                <div>
                  <label className="label text-xs">Min %</label>
                  <input type="number" min={0} max={100} value={newRange.min_percentage}
                    onChange={e => setNewRange(prev => ({ ...prev, min_percentage: Number(e.target.value) }))}
                    className="input" style={{ maxWidth: '80px' }} />
                </div>
                <div>
                  <label className="label text-xs">Max %</label>
                  <input type="number" min={0} max={100} value={newRange.max_percentage}
                    onChange={e => setNewRange(prev => ({ ...prev, max_percentage: Number(e.target.value) }))}
                    className="input" style={{ maxWidth: '80px' }} />
                </div>
                <button onClick={addRange} className="btn-primary">
                  <Plus className="w-4 h-4" /> Add Grade
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* Save */}
          <div className="flex items-center gap-3">
            <button onClick={saveGradeSystem} disabled={saving} className="btn-primary">
              <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save Grade System'}
            </button>
            {successMsg && <span className="text-sm text-emerald-600 font-medium flex items-center gap-1"><CheckCircle className="w-4 h-4" /> {successMsg}</span>}
          </div>

          {/* Preview */}
          <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-1">
            <p className="font-semibold text-slate-600">Preview:</p>
            <p>Mode: {gradeSystem.grade_mode === 'letter' ? 'Letter Grades (A, B, C...)' : 'Percentage Only'}</p>
            <p>Passing mark: {gradeSystem.passing_percentage}%</p>
            {gradeSystem.grade_mode === 'letter' && <p>Grade ranges: {gradeRanges.length} defined</p>}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Logo Upload Section ──────────────────────────────────────
const BUCKET = 'school-assets';
const LOGO_PATH = 'logo/school-logo';

function LogoUploadSection({ schoolId }: { schoolId: string }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!schoolId) return;
    supabase
      .from('school_settings')
      .select('logo_url')
      .eq('school_id', schoolId)
      .single()
      .then(({ data }) => {
        if (data?.logo_url) setLogoUrl(data.logo_url);
      });
  }, [schoolId]);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg(text); setMsgType(type);
    setTimeout(() => setMsg(''), 3500);
  };

  const validateFile = (file: File): string | null => {
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type))
      return 'Only PNG, JPG, WebP, or SVG files are allowed.';
    if (file.size > 2 * 1024 * 1024) return 'File must be under 2 MB.';
    return null;
  };

  const handleFile = useCallback(async (file: File) => {
    const err = validateFile(file);
    if (err) { showMsg(err, 'error'); return; }

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const filePath = `${LOGO_PATH}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET).upload(filePath, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      await supabase.from('school_settings')
        .update({ logo_url: publicUrl })
        .eq('school_id', schoolId);

      setLogoUrl(publicUrl);
      setPreview(null);
      showMsg('Logo updated successfully!');
    } catch (e) {
      setPreview(null);
      showMsg(e instanceof Error ? e.message : 'Upload failed. Please try again.', 'error');
    } finally {
      setUploading(false);
    }
  }, [schoolId]);

  const handleRemove = async () => {
    setRemoving(true);
    await supabase.storage.from(BUCKET).remove(
      ['png','jpg','jpeg','webp','svg'].map(ext => `${LOGO_PATH}.${ext}`)
    );
    await supabase.from('school_settings').update({ logo_url: null }).eq('school_id', schoolId);
    setLogoUrl(null);
    setPreview(null);
    showMsg('Logo removed. Certificates will show the default seal.');
    setRemoving(false);
  };

  const displayUrl = preview || logoUrl;

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Upload className="w-4 h-4 text-blue-600" />
        <h3 className="font-semibold text-slate-800">School Logo</h3>
      </div>
      <p className="text-sm text-slate-400">
        Displayed at the top of every certificate. PNG, JPG, WebP or SVG · max 2 MB.
      </p>

      {/* Current logo + info */}
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full border-2 border-amber-400 overflow-hidden flex items-center justify-center bg-amber-50 flex-shrink-0 relative">
          {displayUrl ? (
            <img src={displayUrl} alt="School Logo" className="w-full h-full object-cover" />
          ) : (
            <School className="w-8 h-8 text-slate-300" />
          )}
          {uploading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-slate-700">
            {logoUrl ? 'Current logo' : 'No logo uploaded'}
          </p>
          <p className="text-xs text-slate-400">
            {logoUrl ? 'Upload a new image to replace it.' : 'Upload your school logo to display on certificates.'}
          </p>
          {logoUrl && (
            <button
              onClick={handleRemove}
              disabled={removing}
              className="btn-danger text-xs py-1"
            >
              <X className="w-3 h-3" />
              {removing ? 'Removing…' : 'Remove Logo'}
            </button>
          )}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          dragging ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50'
        }`}
      >
        <Upload className="w-6 h-6 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-600">
          {uploading ? 'Uploading…' : 'Drop image here, or click to browse'}
        </p>
        <p className="text-xs text-slate-400 mt-1">Square image recommended · circular crop on certificates</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />

      {msg && (
        <div className={`flex items-center gap-2 text-sm font-medium p-3 rounded-lg ${
          msgType === 'success'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {msgType === 'success' ? <CheckCircle className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {msg}
        </div>
      )}

      <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-1">
        <p className="font-semibold text-slate-600">💡 Tips for best results:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Use a square image (e.g. 400×400 px)</li>
          <li>PNG with transparent background looks cleanest</li>
          <li>Logo appears as an 80 px circle on all certificates</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Main Settings Page (fixed to always show sections) ──────
export default function Settings() {
  const { settings, updateSettings } = useSchool();
  const [schoolName, setSchoolName] = useState(settings?.school_name || '');
  const [principalName, setPrincipalName] = useState(settings?.principal_name || '');
  const [address, setAddress] = useState(settings?.address || '');
  const [phone, setPhone] = useState(settings?.phone || '');
  const [email, setEmail] = useState(settings?.email || '');
  const [website, setWebsite] = useState(settings?.website || '');
  const [registrationNumber, setRegistrationNumber] = useState(settings?.registration_number || '');
  const [establishedYear, setEstablishedYear] = useState(settings?.established_year || new Date().getFullYear());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fallback: fetch school_id directly from school_members if hook doesn't provide it
  const [directSchoolId, setDirectSchoolId] = useState<string>('');

  useEffect(() => {
    if (settings?.school_id) {
      setDirectSchoolId(settings.school_id);
      return;
    }
    const fetchSchoolId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('school_members')
        .select('school_id')
        .eq('user_id', user.id)
        .single();
      if (data) setDirectSchoolId(data.school_id);
    };
    fetchSchoolId();
  }, [settings?.school_id]);

  async function handleSave() {
    setSaving(true);
    await updateSettings({
      school_name: schoolName,
      principal_name: principalName,
      address,
      phone,
      email,
      website,
      registration_number: registrationNumber,
      established_year: establishedYear,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const activeSchoolId = settings?.school_id || directSchoolId;

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
        <p className="text-slate-500 text-sm">Configure your school information</p>
      </div>

      {/* School Information */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <School className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-slate-800">School Information</h3>
        </div>
        <div>
          <label className="label">School Name *</label>
          <input className="input" value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Your school name" />
          <p className="text-xs text-slate-400 mt-1">This name appears throughout {APP_NAME}</p>
        </div>
        <div>
          <label className="label">Principal Name</label>
          <input className="input" value={principalName} onChange={e => setPrincipalName(e.target.value)} placeholder="Full name of principal" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Established Year</label>
            <input type="number" className="input" value={establishedYear} onChange={e => setEstablishedYear(parseInt(e.target.value))} min="1900" max={new Date().getFullYear()} />
          </div>
          <div>
            <label className="label">Registration Number</label>
            <input className="input" value={registrationNumber} onChange={e => setRegistrationNumber(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Address</label>
          <input className="input" value={address} onChange={e => setAddress(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Phone</label>
            <input className="input" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Website</label>
          <input className="input" value={website} onChange={e => setWebsite(e.target.value)} />
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
        </button>
        {saved && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-emerald-700">Settings updated! School name is now "{schoolName}" across the app.</span>
          </div>
        )}
      </div>

      {/* Logo Upload + other sections */}
      {activeSchoolId && (
        <>
          <LogoUploadSection schoolId={activeSchoolId} />
          <AttendanceSettingsSection schoolId={activeSchoolId} />
          <SubjectsSettingsSection schoolId={activeSchoolId} />
          <ExamStructureSection schoolId={activeSchoolId} />
          <GradeSystemSection schoolId={activeSchoolId} />
        </>
      )}

      {/* System Information */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Database className="w-4 h-4 text-emerald-600" />
          <h3 className="font-semibold text-slate-800">System Information</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['Platform', APP_NAME],
            ['Current School', schoolName || 'My School'],
            ['Data Coverage', '10-Year History'],
            ['Version', 'v2.0']
          ].map(([l, v]) => (
            <div key={l as string} className="bg-slate-50 rounded-xl p-3">
              <p className="text-slate-400 text-xs">{l}</p>
              <p className="font-medium text-slate-700 mt-0.5">{v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">Multi-Tenant Security</p>
          <p className="mt-0.5">Your school data is completely isolated from other schools on {APP_NAME}. Each login is linked to your specific school database.</p>
        </div>
      </div>
    </div>
  );
}