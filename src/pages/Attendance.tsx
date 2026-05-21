import React, { useState, useEffect, useCallback } from 'react';
import { useSchool } from '../lib/schoolContext';
import { supabase } from '../lib/supabase';
import {
  ChevronLeft,
  ChevronRight,
  Edit2,
  Save,
  AlertTriangle,
  CalendarOff,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Info,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────
type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave';

interface Student {
  id: string;
  full_name: string;
  roll_number?: string | null;
}

interface ClassRecord {
  id: string;
  name: string;
  section?: string | null;
}

interface AttendanceRecord {
  id?: string;
  student_id: string;
  status: AttendanceStatus;
  is_corrected?: boolean;
  correction_reason?: string | null;
  corrected_at?: string | null;
}

interface Holiday {
  id: string;
  date: string;
  reason: string;
}

// ─── Constants ────────────────────────────────────────────────
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; shortLabel: string; activeClass: string; icon: React.ReactNode }
> = {
  present: {
    label: 'Present',
    shortLabel: 'P',
    activeClass: 'bg-emerald-500 border-emerald-500 text-white',
    icon: <CheckCircle2 size={12} />,
  },
  absent: {
    label: 'Absent',
    shortLabel: 'A',
    activeClass: 'bg-red-500 border-red-500 text-white',
    icon: <XCircle size={12} />,
  },
  late: {
    label: 'Late',
    shortLabel: 'L',
    activeClass: 'bg-amber-400 border-amber-400 text-white',
    icon: <Clock size={12} />,
  },
  leave: {
    label: 'Leave',
    shortLabel: 'Lv',
    activeClass: 'bg-blue-500 border-blue-500 text-white',
    icon: <FileText size={12} />,
  },
};

const TODAY = new Date().toISOString().split('T')[0];

// ─── Main Component ───────────────────────────────────────────
export default function Attendance() {
  const { settings } = useSchool();
  const schoolId = settings?.school_id || null;
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(TODAY);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus | null>>({});
  const [savedRecords, setSavedRecords] = useState<Record<string, AttendanceRecord>>({});
  const [isAlreadyMarked, setIsAlreadyMarked] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [weeklyOffDays, setWeeklyOffDays] = useState<number[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // school_id comes from useSchool() hook — same as rest of app

  // ── Load classes, settings, holidays ──────────────────────
  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      // Each query is independent — one failure won't block the others

      // Classes (critical)
      const { data: classData, error: classErr } = await supabase
        .from('classes')
        .select('id, name, section')
        .eq('school_id', schoolId)
        .order('name');
      if (classErr) console.error('Classes load error:', classErr.message);
      if (classData) setClasses(classData);

      // Weekly off days
      const { data: settingsData } = await supabase
        .from('school_settings')
        .select('weekly_off_days')
        .eq('school_id', schoolId)
        .single();
      if (settingsData?.weekly_off_days) setWeeklyOffDays(settingsData.weekly_off_days);

      // Holidays — table may not exist yet if SQL migration not run
      const { data: holidayData, error: holidayErr } = await supabase
        .from('school_holidays')
        .select('id, date, reason')
        .eq('school_id', schoolId);
      if (holidayErr) console.warn('school_holidays not available yet:', holidayErr.message);
      if (holidayData) setHolidays(holidayData);
    };
    load();
  }, [schoolId]);

  // ── Load students when class changes ──────────────────────
  useEffect(() => {
    if (!schoolId || !selectedClass) {
      setStudents([]);
      return;
    }
    const loadStudents = async () => {
      const { data } = await supabase
        .from('students')
        .select('id, full_name, roll_number')
        .eq('school_id', schoolId)
        .eq('class_id', selectedClass)
        .order('full_name');
      if (data) setStudents(data);
    };
    loadStudents();
  }, [schoolId, selectedClass]);

  // ── Load attendance records for selected date ─────────────
  const loadAttendance = useCallback(async () => {
    if (!schoolId || !selectedClass || students.length === 0) {
      setAttendance({});
      setSavedRecords({});
      setIsAlreadyMarked(false);
      setIsEditMode(false);
      return;
    }
    setLoading(true);
    const studentIds = students.map((s) => s.id);
    const { data } = await supabase
      .from('attendance_records')
      .select('id, student_id, status, is_corrected, correction_reason, corrected_at')
      .eq('school_id', schoolId)
      .eq('attendance_date', selectedDate)
      .in('student_id', studentIds);

    if (data && data.length > 0) {
      const records: Record<string, AttendanceRecord> = {};
      const statuses: Record<string, AttendanceStatus | null> = {};
      data.forEach((r) => {
        records[r.student_id] = r;
        statuses[r.student_id] = r.status as AttendanceStatus;
      });
      setSavedRecords(records);
      setAttendance(statuses);
      setIsAlreadyMarked(true);
    } else {
      setSavedRecords({});
      // Start fresh: all unmarked
      const fresh: Record<string, null> = {};
      students.forEach((s) => (fresh[s.id] = null));
      setAttendance(fresh);
      setIsAlreadyMarked(false);
    }
    setIsEditMode(false);
    setLoading(false);
  }, [schoolId, selectedClass, selectedDate, students]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  // ── Holiday check ──────────────────────────────────────────
  const getHolidayInfo = (): { isOff: boolean; reason: string } => {
    const dayOfWeek = new Date(selectedDate + 'T00:00:00').getDay();
    if (weeklyOffDays.includes(dayOfWeek)) {
      return { isOff: true, reason: `Weekly off — ${DAY_NAMES[dayOfWeek]}` };
    }
    const holiday = holidays.find((h) => h.date === selectedDate);
    if (holiday) return { isOff: true, reason: holiday.reason };
    return { isOff: false, reason: '' };
  };

  // ── Date navigation ────────────────────────────────────────
  const navigateDate = (direction: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + direction);
    const newDate = d.toISOString().split('T')[0];
    // Don't allow future dates
    if (newDate <= TODAY) setSelectedDate(newDate);
  };

  // ── Mark student ───────────────────────────────────────────
  const markStudent = (studentId: string, status: AttendanceStatus) => {
    if (isAlreadyMarked && !isEditMode) return;
    setAttendance((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === status ? null : status,
    }));
  };

  // ── Mark all at once ───────────────────────────────────────
  const markAll = (status: AttendanceStatus) => {
    if (isAlreadyMarked && !isEditMode) return;
    const updated: Record<string, AttendanceStatus> = {};
    students.forEach((s) => (updated[s.id] = status));
    setAttendance(updated);
  };

  // ── Save handler ───────────────────────────────────────────
  const handleSave = () => {
    if (isEditMode) {
      setShowCorrectionModal(true);
    } else {
      saveAttendance(null);
    }
  };

  const saveAttendance = async (reason: string | null) => {
    if (!schoolId) return;
    setSaving(true);
    setErrorMsg('');

    // Only save students that have been explicitly marked — skip unmarked ones
    const entries = students
      .filter((student) => attendance[student.id] !== null && attendance[student.id] !== undefined)
      .map((student) => ({
        school_id: schoolId,
        student_id: student.id,
        attendance_date: selectedDate,
        status: attendance[student.id] as AttendanceStatus,
        is_corrected: reason ? true : false,
        correction_reason: reason ?? null,
        corrected_at: reason ? new Date().toISOString() : null,
      }));

    if (entries.length === 0) {
      setSaving(false);
      setErrorMsg('No students marked. Please mark at least one student before saving.');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }

    const { error } = await supabase
      .from('attendance_records')
      .upsert(entries, { onConflict: 'school_id,student_id,attendance_date' });

    if (error) {
      setErrorMsg('Failed to save attendance. Please try again.');
      console.error(error);
    } else {
      setSuccessMsg(reason ? 'Attendance corrected and saved.' : 'Attendance saved successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
      setShowCorrectionModal(false);
      setCorrectionReason('');
      await loadAttendance();
    }
    setSaving(false);
  };

  // ── Stats ──────────────────────────────────────────────────
  const stats = {
    present: Object.values(attendance).filter((v) => v === 'present').length,
    absent: Object.values(attendance).filter((v) => v === 'absent').length,
    late: Object.values(attendance).filter((v) => v === 'late').length,
    leave: Object.values(attendance).filter((v) => v === 'leave').length,
    unmarked: students.filter((s) => !attendance[s.id]).length,
  };

  const holidayInfo = getHolidayInfo();
  const isToday = selectedDate === TODAY;
  const isFuture = selectedDate > TODAY;

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Attendance</h1>
        <p className="text-sm text-gray-500 mt-1">Daily records saved permanently for every student</p>
      </div>

      {/* Date Navigation Row */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button
          onClick={() => navigateDate(-1)}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          title="Previous day"
        >
          <ChevronLeft size={18} />
        </button>

        <input
          type="date"
          value={selectedDate}
          max={TODAY}
          onChange={(e) => e.target.value <= TODAY && setSelectedDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-300"
        />

        <button
          onClick={() => navigateDate(1)}
          disabled={isToday}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Next day"
        >
          <ChevronRight size={18} />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 font-medium">
            {DAY_NAMES[new Date(selectedDate + 'T00:00:00').getDay()]}
          </span>
          {isToday && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              Today
            </span>
          )}
        </div>
      </div>

      {/* Holiday / Off Day Banner */}
      {holidayInfo.isOff && (
        <div className="mb-5 flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
          <CalendarOff size={18} className="text-orange-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-orange-800 font-semibold text-sm">Holiday — {holidayInfo.reason}</p>
            <p className="text-orange-600 text-xs mt-0.5">
              Attendance cannot be marked on holidays or weekly off days.
            </p>
          </div>
        </div>
      )}

      {/* Class Selector */}
      <div className="mb-5">
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Class</label>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 w-full max-w-sm text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
        >
          <option value="">— Select a class —</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.section ? ` (${c.section})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Main attendance area — only show when class selected and not holiday */}
      {selectedClass && !holidayInfo.isOff && (
        <>
          {/* Already marked banner */}
          {isAlreadyMarked && !isEditMode && (
            <div className="mb-4 flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-2">
                <Info size={15} className="text-slate-500" />
                <span className="text-sm text-slate-600 font-medium">
                  Attendance already recorded for this date.
                </span>
              </div>
              <button
                onClick={() => setIsEditMode(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 border border-blue-300 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors"
              >
                <Edit2 size={12} /> Edit
              </button>
            </div>
          )}

          {/* Edit mode warning */}
          {isEditMode && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={15} className="text-amber-500 shrink-0" />
              <span className="text-sm text-amber-700">
                <strong>Edit mode</strong> — You are changing already-saved attendance. A correction
                reason will be required.
              </span>
            </div>
          )}

          {/* Success / Error messages */}
          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium">
              ✓ {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          {/* Stats bar */}
          {students.length > 0 && (
            <div className="flex gap-2 mb-4 flex-wrap">
              {[
                { key: 'present', label: 'Present', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                { key: 'absent', label: 'Absent', color: 'bg-red-50 text-red-700 border-red-200' },
                { key: 'late', label: 'Late', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                { key: 'leave', label: 'Leave', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                { key: 'unmarked', label: 'Unmarked', color: 'bg-gray-50 text-gray-500 border-gray-200' },
              ].map(({ key, label, color }) => (
                <div
                  key={key}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${color}`}
                >
                  <span className="text-base font-bold">{stats[key as keyof typeof stats]}</span>
                  {label}
                </div>
              ))}
            </div>
          )}

          {/* Bulk marking buttons */}
          {students.length > 0 && (!isAlreadyMarked || isEditMode) && (
            <div className="flex flex-col gap-2 mb-4">

              {/* Mark remaining unmarked as Present — main smart button */}
              {stats.unmarked > 0 && (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-emerald-800">
                      {stats.unmarked} student{stats.unmarked > 1 ? 's' : ''} not marked yet
                    </p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      Mark absent / late / leave individually first, then click to bulk-present the rest
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const updated = { ...attendance };
                      students.forEach((s) => {
                        if (!updated[s.id]) updated[s.id] = 'present';
                      });
                      setAttendance(updated);
                    }}
                    className="shrink-0 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors"
                  >
                    ✓ Mark Remaining Present
                  </button>
                </div>
              )}

              {/* Mark all as same status */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400 font-medium">Mark all as:</span>
                {(['present', 'absent', 'late', 'leave'] as AttendanceStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => markAll(status)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 capitalize transition-colors"
                  >
                    {status}
                  </button>
                ))}
                <span className="text-gray-200 text-xs">|</span>
                <button
                  onClick={() => {
                    const reset: Record<string, null> = {};
                    students.forEach((s) => (reset[s.id] = null));
                    setAttendance(reset);
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-red-50 hover:text-red-500 text-gray-400 transition-colors"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}

          {/* Student List */}
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading students...</div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              No students found in this class.
            </div>
          ) : (
            <div className="space-y-2">
              {students.map((student, index) => {
                const currentStatus = attendance[student.id];
                const saved = savedRecords[student.id];
                const disabled = isAlreadyMarked && !isEditMode;
                const isUnmarked = !currentStatus;

                // Row background:
                // • Unmarked (not disabled) → soft amber/yellow tint — needs attention
                // • Unmarked (disabled/view-only) → gray — record was never saved for this date
                // • Marked → white (normal)
                const rowClass = disabled
                  ? 'bg-gray-50 border-gray-100'
                  : isUnmarked
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-white border-gray-200 hover:shadow-sm';

                return (
                  <div
                    key={student.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${rowClass}`}
                  >
                    {/* Row number */}
                    <span className="text-gray-300 text-xs w-5 text-right shrink-0">{index + 1}</span>

                    {/* Unmarked dot indicator — only visible when not disabled and student not marked */}
                    {!disabled && isUnmarked && (
                      <span
                        className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                        title="Not marked yet"
                      />
                    )}

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <span
                        className={`font-medium text-sm ${
                          isUnmarked && !disabled ? 'text-amber-800' : 'text-gray-800'
                        }`}
                      >
                        {student.full_name}
                      </span>
                      {student.roll_number && (
                        <span className="ml-2 text-xs text-gray-400">#{student.roll_number}</span>
                      )}
                      {!disabled && isUnmarked && (
                        <span className="ml-2 text-xs text-amber-500 font-semibold">
                          — not marked
                        </span>
                      )}
                      {saved?.is_corrected && (
                        <span
                          className="ml-2 text-xs text-orange-500 font-medium"
                          title={`Corrected: ${saved.correction_reason}`}
                        >
                          ✎ edited
                        </span>
                      )}
                    </div>

                    {/* Status Buttons */}
                    <div className="flex gap-1 shrink-0">
                      {(['present', 'absent', 'late', 'leave'] as AttendanceStatus[]).map(
                        (status) => {
                          const cfg = STATUS_CONFIG[status];
                          const isActive = currentStatus === status;
                          return (
                            <button
                              key={status}
                              onClick={() => markStudent(student.id, status)}
                              disabled={disabled}
                              title={cfg.label}
                              className={`
                                w-9 h-9 rounded-lg border-2 text-xs font-bold transition-all flex items-center justify-center gap-0.5
                                ${isActive ? cfg.activeClass : 'border-gray-200 text-gray-300 bg-white'}
                                ${disabled ? 'cursor-default' : 'cursor-pointer hover:border-gray-400'}
                              `}
                            >
                              {cfg.shortLabel}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Save Button */}
          {students.length > 0 && (!isAlreadyMarked || isEditMode) && (
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
              >
                <Save size={16} />
                {saving ? 'Saving...' : isEditMode ? 'Save Corrections' : 'Save Attendance'}
              </button>
              {isEditMode && (
                <button
                  onClick={() => {
                    setIsEditMode(false);
                    loadAttendance();
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              )}
{/* unmarked warning removed — unmarked students are simply skipped on save */}
            </div>
          )}
        </>
      )}

      {/* Prompt to select class */}
      {!selectedClass && (
        <div className="text-center py-16 text-gray-400 text-sm">
          Select a class above to begin marking attendance.
        </div>
      )}

      {/* ── Correction Reason Modal ────────────────────────── */}
      {showCorrectionModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Reason for Correction</h3>
            <p className="text-sm text-gray-500 mb-4">
              Attendance for{' '}
              <strong>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-PK', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </strong>{' '}
              is already saved. Please explain why you are making changes.
            </p>
            <textarea
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder="e.g. Marked wrong student absent by mistake"
              rows={3}
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setShowCorrectionModal(false);
                  setCorrectionReason('');
                }}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => correctionReason.trim() && saveAttendance(correctionReason.trim())}
                disabled={!correctionReason.trim() || saving}
                className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40"
              >
                {saving ? 'Saving...' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
