import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { QrReader } from 'react-qr-reader';
import * as faceapi from 'face-api.js';
import { supabase } from '../lib/supabase';
import { useSchool } from '../lib/schoolContext';
import {
  School, LogOut, QrCode, Smile,
  CheckCircle, XCircle, AlertCircle, Loader, X, Eye,
  RefreshCw, Search, Menu,
} from 'lucide-react';
import WatchmanSidebar from '../components/WatchmanSidebar';

// Same @types/react duplicate-version workaround as the QRCodeSVG cast in
// StudentProfiles.tsx ("bigint is not assignable to ReactNode"). Run
// `npm ls @types/react` if you want to fix the root cause instead.
const QrScanner = QrReader as unknown as (props: {
  constraints?: MediaTrackConstraints;
  onResult: (result: any, error: any) => void;
  containerStyle?: CSSProperties;
  videoContainerStyle?: CSSProperties;
  videoStyle?: CSSProperties;
}) => JSX.Element;

// ── Watchman Portal ──────────────────────────────────────────────────────────
// Phase 5: Scan QR with confirmation step (spec §7.3).
// Phase 6 (this update): Scan Face — auto-marks, no confirmation step, but
//   gated on (a) ≥80% match confidence and (b) a passive liveness check
//   (blink detection) so a printed/screen photo held up to the camera can't
//   get marked present on its own.
// Phase 7: Today's Attendance list (full page).
// Phase 8: Proper WatchmanSidebar — the mode switcher below is a stand-in.

interface WatchmanAppProps {
  user: { email?: string } | null;
  onLogout: () => void;
}

interface PendingStudent {
  id: string;
  full_name: string;
  roll_number: string | null;
  reference_photo_url: string | null;
  current_grade: number | null;
  current_section: string | null;
}

interface FaceStudent {
  id: string;
  full_name: string;
  roll_number: string | null;
  current_grade: number | null;
  current_section: string | null;
}

interface AttendanceRow {
  id: string;
  student_id: string;
  full_name: string;
  roll_number: string | null;
  current_grade: number | null;
  current_section: string | null;
  identification_method: 'qr' | 'face' | 'manual' | null;
  verified_by_watchman: boolean;
  match_confidence: number | null;
  created_at: string;
}

type Mode = 'qr' | 'face' | 'attendance';

// Fixed thresholds — not exposed in admin settings (spec §13).
const FACE_MATCH_THRESHOLD = 0.80;     // raised from the spec's original 0.75 per request
const EAR_CLOSED = 0.21;               // eye-aspect-ratio below this ≈ eyes shut
const EAR_OPEN = 0.27;                 // eye-aspect-ratio above this ≈ eyes open
const LIVENESS_VALID_MS = 8000;        // a confirmed blink "counts" for this long
const DETECTION_INTERVAL_MS = 350;

const MODELS_URL = '/models'; // see public/models setup note in the build summary

// ── Face model loading (module-level so it only happens once per page load) ──
let modelsLoadPromise: Promise<void> | null = null;
function loadFaceModels(): Promise<void> {
  if (!modelsLoadPromise) {
    modelsLoadPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
    ]).then(() => undefined);
  }
  return modelsLoadPromise;
}

// ── Eye-aspect-ratio (EAR) — standard 6-point formula ────────────────────────
// face-api.js's getLeftEye()/getRightEye() each return 6 landmark points in
// the order [outer corner, top1, top2, inner corner, bottom2, bottom1].
function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function eyeAspectRatio(eye: { x: number; y: number }[]) {
  const vertical1 = dist(eye[1], eye[5]);
  const vertical2 = dist(eye[2], eye[4]);
  const horizontal = dist(eye[0], eye[3]);
  return (vertical1 + vertical2) / (2 * horizontal);
}

export default function WatchmanApp({ user, onLogout }: WatchmanAppProps) {
  const { settings, schoolName, schoolLogo } = useSchool();
  const schoolId = (settings as any)?.school_id;

  const [mode, setMode] = useState<Mode>('qr');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // ── QR scan flow (Phase 5) ──────────────────────────────────────────────
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingStudent | null>(null);
  const [looking, setLooking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const lastScannedTokenRef = useRef<string | null>(null);

  // ── Face scan flow (Phase 6) ────────────────────────────────────────────
  const [faceStage, setFaceStage] = useState<'idle' | 'loading_models' | 'loading_references' | 'scanning'>('idle');
  const [refLoadProgress, setRefLoadProgress] = useState<{ done: number; total: number } | null>(null);
  const [faceHint, setFaceHint] = useState<{ text: string; tone: 'info' | 'warning' } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectTimerRef = useRef<number | null>(null);
  const referenceDescriptorsRef = useRef<Map<string, { descriptor: Float32Array; student: FaceStudent }> | null>(null);
  const referencesLoadedForSchoolRef = useRef<string | null>(null); // avoid reloading on every mode switch
  const processingFaceRef = useRef(false);
  const eyeStateRef = useRef<'open' | 'closed'>('open');
  const livenessConfirmedAtRef = useRef<number | null>(null);

  // ── Today's attendance summary (lightweight count — full list is Phase 7) ──
  const [presentCount, setPresentCount] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // ── Today's Attendance list (Phase 7) ───────────────────────────────────
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSearch, setAttendanceSearch] = useState('');

  useEffect(() => {
    if (schoolId) fetchAttendanceSummary();
  }, [schoolId]);

  async function fetchAttendanceSummary() {
    const today = new Date().toISOString().split('T')[0];
    const [{ count: present }, { count: total }] = await Promise.all([
      supabase.from('attendance_records').select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId).eq('attendance_date', today).eq('status', 'present'),
      supabase.from('students').select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId).eq('status', 'active'),
    ]);
    setPresentCount(present ?? 0);
    setTotalCount(total ?? 0);
  }

  // ── Today's Attendance list ─────────────────────────────────────────────
  useEffect(() => {
    if (mode === 'attendance' && schoolId) fetchTodayAttendance();
  }, [mode, schoolId]);

  async function fetchTodayAttendance() {
    setAttendanceLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      // Assumes a FK from attendance_records.student_id -> students.id, and that
      // attendance_records already has a `created_at` timestamp column (standard
      // on most Supabase tables). If Supabase complains about an ambiguous
      // relationship, swap `students(...)` for `students!attendance_records_student_id_fkey(...)`.
      const { data, error } = await supabase
        .from('attendance_records')
        .select('id, student_id, identification_method, verified_by_watchman, match_confidence, created_at, students(full_name, roll_number, current_grade, current_section)')
        .eq('school_id', schoolId)
        .eq('attendance_date', today)
        .eq('status', 'present')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows: AttendanceRow[] = (data ?? []).map((r: any) => ({
        id: r.id,
        student_id: r.student_id,
        full_name: r.students?.full_name ?? 'Unknown',
        roll_number: r.students?.roll_number ?? null,
        current_grade: r.students?.current_grade ?? null,
        current_section: r.students?.current_section ?? null,
        identification_method: r.identification_method,
        verified_by_watchman: !!r.verified_by_watchman,
        match_confidence: r.match_confidence,
        created_at: r.created_at,
      }));
      setAttendanceRows(rows);
    } catch (err: any) {
      setResult({ success: false, message: 'Failed to load attendance list: ' + (err.message ?? 'Unknown error') });
    } finally {
      setAttendanceLoading(false);
    }
  }

  const filteredAttendance = attendanceRows.filter(r =>
    r.full_name.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
    (r.roll_number ?? '').toLowerCase().includes(attendanceSearch.toLowerCase())
  );

  // ── QR scan handler ──────────────────────────────────────────────────────
  async function handleQRResult(scanResult: any, _error: any) {
    if (pendingConfirmation || looking) return;
    if (!scanResult) return; // react-qr-reader fires `error` on most no-code frames — that's normal

    const text: string | undefined = scanResult.getText?.() ?? scanResult.text;
    if (!text || text === lastScannedTokenRef.current) return;

    let token: string | null = null;
    try { token = new URL(text).searchParams.get('token'); } catch { token = null; }

    if (!token) {
      setResult({ success: false, message: 'Invalid QR code' });
      return;
    }

    lastScannedTokenRef.current = text;
    setLooking(true);
    setResult(null);

    try {
      const { data: student, error: lookupErr } = await supabase
        .from('students')
        .select('id, full_name, roll_number, reference_photo_url, current_grade, current_section')
        .eq('attendance_token', token)
        .eq('school_id', schoolId)
        .single();

      if (lookupErr || !student) {
        setResult({ success: false, message: 'Student not found for this QR code' });
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('student_id', student.id)
        .eq('attendance_date', today);

      if (existing && existing.length > 0) {
        setResult({ success: false, message: `${student.full_name} is already marked present today` });
        return;
      }

      setPendingConfirmation(student);
    } finally {
      setLooking(false);
      setTimeout(() => { lastScannedTokenRef.current = null; }, 3000);
    }
  }

  async function handleConfirm() {
    if (!pendingConfirmation || !schoolId) return;
    setConfirming(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('attendance_records').insert({
        student_id: pendingConfirmation.id,
        attendance_date: today,
        status: 'present',
        school_id: schoolId,
        identification_method: 'qr',
        verified_by_watchman: true,
      });
      if (error) throw error;
      setResult({ success: true, message: `${pendingConfirmation.full_name} — Marked Present` });
      setPendingConfirmation(null);
      fetchAttendanceSummary();
    } catch (err: any) {
      setResult({ success: false, message: 'Failed to mark attendance: ' + (err.message ?? 'Unknown error') });
    } finally {
      setConfirming(false);
    }
  }

  function handleReject() {
    setResult({ success: false, message: 'Mismatch — attendance not marked' });
    setPendingConfirmation(null);
  }

  // ── Face mode lifecycle ──────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'face' || !schoolId) return;
    let cancelled = false;

    (async () => {
      try {
        setFaceStage('loading_models');
        await loadFaceModels();
        if (cancelled) return;

        if (referencesLoadedForSchoolRef.current !== schoolId) {
          setFaceStage('loading_references');
          await loadReferenceDescriptors();
          if (cancelled) return;
        }

        setFaceStage('scanning');
        await startCamera();
        if (cancelled) return;
        startDetectionLoop();
      } catch (err: any) {
        setResult({ success: false, message: 'Face mode failed to start: ' + (err.message ?? 'Unknown error') });
      }
    })();

    return () => {
      cancelled = true;
      stopDetectionLoop();
      stopCamera();
      setFaceStage('idle');
      setFaceHint(null);
      eyeStateRef.current = 'open';
      livenessConfirmedAtRef.current = null;
    };
  }, [mode, schoolId]);

  async function loadReferenceDescriptors() {
    const { data: students } = await supabase
      .from('students')
      .select('id, full_name, roll_number, current_grade, current_section, reference_photo_url')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .not('reference_photo_url', 'is', null);

    const rows = students ?? [];
    setRefLoadProgress({ done: 0, total: rows.length });

    const map = new Map<string, { descriptor: Float32Array; student: FaceStudent }>();
    for (let i = 0; i < rows.length; i++) {
      const s = rows[i];
      try {
        const img = await faceapi.fetchImage(s.reference_photo_url as string);
        const det = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (det) {
          map.set(s.id, {
            descriptor: det.descriptor,
            student: {
              id: s.id, full_name: s.full_name, roll_number: s.roll_number,
              current_grade: s.current_grade, current_section: s.current_section,
            },
          });
        }
      } catch {
        // Skip students whose reference photo can't be read/decoded — they just
        // won't be matchable by face until that photo is replaced (Face ID tab).
      }
      setRefLoadProgress({ done: i + 1, total: rows.length });
    }

    referenceDescriptorsRef.current = map;
    referencesLoadedForSchoolRef.current = schoolId;
  }

  async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function startDetectionLoop() {
    detectTimerRef.current = window.setInterval(faceDetectTick, DETECTION_INTERVAL_MS);
  }
  function stopDetectionLoop() {
    if (detectTimerRef.current) window.clearInterval(detectTimerRef.current);
    detectTimerRef.current = null;
  }

  function updateBlinkState(ear: number) {
    if (eyeStateRef.current === 'open' && ear < EAR_CLOSED) {
      eyeStateRef.current = 'closed';
    } else if (eyeStateRef.current === 'closed' && ear > EAR_OPEN) {
      eyeStateRef.current = 'open';
      livenessConfirmedAtRef.current = Date.now(); // a full close→open cycle = one blink
    }
  }

  function resetLivenessState() {
    livenessConfirmedAtRef.current = null;
    eyeStateRef.current = 'open';
  }

  async function faceDetectTick() {
    if (processingFaceRef.current) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const det = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!det) {
      setFaceHint({ text: 'Looking for a face...', tone: 'info' });
      return;
    }

    const ear = (eyeAspectRatio(det.landmarks.getLeftEye()) + eyeAspectRatio(det.landmarks.getRightEye())) / 2;
    updateBlinkState(ear);
    const liveOK = !!livenessConfirmedAtRef.current && (Date.now() - livenessConfirmedAtRef.current < LIVENESS_VALID_MS);

    const refMap = referenceDescriptorsRef.current;
    let best: { distance: number; student: FaceStudent } | null = null;
    if (refMap) {
      for (const entry of refMap.values()) {
        const distance = faceapi.euclideanDistance(det.descriptor, entry.descriptor);
        if (!best || distance < best.distance) best = { distance, student: entry.student };
      }
    }
    const confidence = best ? 1 - best.distance : 0;

    if (!best || confidence < FACE_MATCH_THRESHOLD) {
      setFaceHint({ text: 'No confident match — try again or use QR', tone: 'warning' });
      return;
    }

    if (!liveOK) {
      setFaceHint({ text: `${best.student.full_name} recognized — please blink naturally to confirm it's really you`, tone: 'info' });
      return;
    }

    // Match + liveness both passed — mark attendance.
    processingFaceRef.current = true;
    setFaceHint(null);
    try {
      await markAttendanceFromFace(best.student, confidence);
    } finally {
      setTimeout(() => {
        processingFaceRef.current = false;
        resetLivenessState();
      }, 3000); // cooldown so the same continuous presence doesn't immediately re-fire
    }
  }

  async function markAttendanceFromFace(student: FaceStudent, confidence: number) {
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('student_id', student.id)
      .eq('attendance_date', today);

    if (existing && existing.length > 0) {
      setResult({ success: false, message: `${student.full_name} is already marked present today` });
      return;
    }

    const { error } = await supabase.from('attendance_records').insert({
      student_id: student.id,
      attendance_date: today,
      status: 'present',
      school_id: schoolId,
      identification_method: 'face',
      verified_by_watchman: false,
      match_confidence: confidence,
    });

    if (error) {
      setResult({ success: false, message: 'Failed to mark attendance: ' + error.message });
      return;
    }

    setResult({ success: true, message: `✅ ${student.full_name} — Marked Present (${Math.round(confidence * 100)}% match)` });
    fetchAttendanceSummary();
  }

  const MODE_TITLES: Record<Mode, string> = {
    qr: 'Scan QR',
    face: 'Scan Face',
    attendance: "Today's Attendance",
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <WatchmanSidebar
        currentMode={mode}
        onNavigate={(m) => { setMode(m); setSidebarOpen(false); }}
        isOpen={sidebarOpen}
        schoolName={schoolName || 'Campus Core'}
        schoolLogo={schoolLogo}
        watchmanEmail={user?.email}
      />

      <div className="flex-1 lg:ml-64 min-w-0 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 lg:px-6 py-3.5 flex items-center gap-4">
          <button className="lg:hidden p-1.5 hover:bg-slate-100 rounded-lg" onClick={() => setSidebarOpen(o => !o)}>
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center bg-white flex-shrink-0">
              {schoolLogo ? (
                <img src={schoolLogo} alt="School Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                  <School className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>
            <span className="font-bold text-slate-800 text-sm">{schoolName || 'Campus Core'}</span>
          </div>
          <h1 className="hidden lg:block font-semibold text-slate-700 text-sm">{MODE_TITLES[mode]}</h1>
          <button
            onClick={onLogout}
            className="ml-auto p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-red-600"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-lg w-full mx-auto space-y-4">
          {/* Result toast */}
        {result && (
          <div className={`p-3 rounded-xl text-sm font-medium flex items-center justify-between gap-2 ${
            result.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            <span className="flex items-center gap-2">
              {result.success ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              {result.message}
            </span>
            <button onClick={() => setResult(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* QR mode */}
        {mode === 'qr' && (
          <>
            {pendingConfirmation ? (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-center space-y-4">
                <div className="w-28 h-28 rounded-2xl bg-slate-100 mx-auto overflow-hidden flex items-center justify-center">
                  {pendingConfirmation.reference_photo_url ? (
                    <img src={pendingConfirmation.reference_photo_url} alt={pendingConfirmation.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <Smile className="w-10 h-10 text-slate-300" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-lg">{pendingConfirmation.full_name}</p>
                  <p className="text-sm text-slate-500">
                    {pendingConfirmation.roll_number ? `Roll No: ${pendingConfirmation.roll_number}` : ''}
                    {pendingConfirmation.current_grade ? ` · Class: ${pendingConfirmation.current_grade}${pendingConfirmation.current_section ?? ''}` : ''}
                  </p>
                </div>
                <p className="text-xs text-slate-400">Does the photo match the person holding the card?</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleReject}
                    disabled={confirming}
                    className="flex-1 flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={confirming}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60"
                  >
                    {confirming ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Confirm
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="relative aspect-square bg-slate-900">
                  <QrScanner
                    constraints={{ facingMode: 'environment' }}
                    onResult={handleQRResult}
                    containerStyle={{ width: '100%', height: '100%' }}
                    videoContainerStyle={{ width: '100%', height: '100%', paddingTop: 0 }}
                    videoStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {looking && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader className="w-8 h-8 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <p className="text-center text-xs text-slate-400 p-3">
                  Point the camera at the QR code on the student's ID card.
                </p>
              </div>
            )}
          </>
        )}

        {/* Face mode */}
        {mode === 'face' && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="relative aspect-square bg-slate-900">
              <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />

              {faceStage !== 'scanning' && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 text-white text-sm text-center px-6">
                  <Loader className="w-7 h-7 animate-spin" />
                  {faceStage === 'loading_models' && <p>Loading face recognition models...</p>}
                  {faceStage === 'loading_references' && (
                    <p>
                      Preparing student reference photos
                      {refLoadProgress ? ` (${refLoadProgress.done}/${refLoadProgress.total})` : '...'}
                    </p>
                  )}
                </div>
              )}

              {faceStage === 'scanning' && faceHint && (
                <div className={`absolute bottom-0 left-0 right-0 px-3 py-2 text-xs text-center flex items-center justify-center gap-1.5 ${
                  faceHint.tone === 'info' ? 'bg-blue-900/80 text-blue-50' : 'bg-amber-900/80 text-amber-50'
                }`}>
                  <Eye className="w-3.5 h-3.5 flex-shrink-0" /> {faceHint.text}
                </div>
              )}
            </div>
            <p className="text-center text-xs text-slate-400 p-3">
              Look directly at the camera and blink naturally — attendance marks automatically at {Math.round(FACE_MATCH_THRESHOLD * 100)}%+ match once liveness is confirmed.
            </p>
          </div>
        )}

        {/* Today's Attendance list (Phase 7) */}
        {mode === 'attendance' && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm">
                  Today's Attendance — {presentCount ?? attendanceRows.length}/{totalCount ?? '—'} students
                </h3>
                <button onClick={fetchTodayAttendance} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500" title="Refresh">
                  <RefreshCw className={`w-4 h-4 ${attendanceLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={attendanceSearch}
                  onChange={e => setAttendanceSearch(e.target.value)}
                  placeholder="Search by name or roll number..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {attendanceLoading ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                <Loader className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading...
              </div>
            ) : filteredAttendance.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                {attendanceRows.length === 0 ? 'No one marked present yet today.' : 'No matches for that search.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-50 max-h-[60vh] overflow-y-auto">
                {filteredAttendance.map(row => (
                  <div key={row.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                      {row.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 text-sm truncate">{row.full_name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {row.roll_number ? `Roll No: ${row.roll_number}` : ''}
                        {row.current_grade ? ` · ${row.current_grade}${row.current_section ?? ''}` : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        row.identification_method === 'face' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {row.identification_method === 'face' ? <Smile className="w-3 h-3" /> : <QrCode className="w-3 h-3" />}
                        {row.identification_method === 'face'
                          ? `Face${row.match_confidence ? ` ${Math.round(row.match_confidence * 100)}%` : ''}`
                          : 'QR · Verified'}
                      </span>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Today's attendance summary (hidden on the Attendance tab — its own header already shows the count) */}
        {mode !== 'attendance' && (
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
            <span className="text-slate-500">Today's Attendance</span>
            <span className="font-semibold text-slate-800">
              {presentCount === null ? '—' : `${presentCount}/${totalCount ?? '—'} students`}
            </span>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}