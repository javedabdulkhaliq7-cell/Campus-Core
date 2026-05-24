import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useSchool } from '../lib/schoolContext';
import {
  Search, ArrowLeft, Edit2, Save, X, Printer,
  User, CreditCard, CalendarCheck, ClipboardList,
  CheckCircle, AlertCircle, Clock, MinusCircle,
  ChevronDown, Camera, FileText, Upload, Trash2,
  BookOpen, FileUp, Contact, ScrollText,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  full_name: string;
  roll_number?: string;
  father_name?: string;
  father_phone?: string;
  phone?: string;
  cnic?: string;
  address?: string;
  date_of_birth?: string;
  admission_date?: string;
  status?: string;
  current_grade?: number;
  current_section?: string;
  class_id?: string;
  photo_url?: string;
}

interface FeeRecord {
  id: string;
  fee_month: number;
  fee_year: number;
  total_amount: number;
  amount_paid: number;
  status: string;
  payment_date?: string;
}

interface AttendanceSummary {
  month: string;
  present: number;
  absent: number;
  late: number;
  leave: number;
}

interface Result {
  id: string;
  exam_type: string;
  subject_name: string;
  obtained_marks: number;
  total_marks: number;
  pass_fail: string;
  exam_year: number;
  exam_month?: number;
  grade?: string;
}

interface StudentDoc {
  id: string;
  document_name: string;
  category: string;
  file_url: string;
  uploaded_at: string;
}

type Tab = 'profile' | 'fees' | 'attendance' | 'results' | 'documents' | 'idcard' | 'certificate';

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

function genCertNumber() {
  const n = String(Math.floor(Math.random() * 9000) + 1000);
  return `LC-${CURRENT_YEAR}-${n}`;
}

// ── Badges ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:      { label: 'Active',      cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    graduated:   { label: 'Graduated',   cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
    transferred: { label: 'Transferred', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
    inactive:    { label: 'Inactive',    cls: 'bg-slate-100 text-slate-500 border border-slate-200' },
  };
  const s = map[status ?? 'active'] ?? map['active'];
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

function FeeStatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    Paid:    'bg-emerald-50 text-emerald-700 border border-emerald-200',
    Partial: 'bg-amber-50 text-amber-700 border border-amber-200',
    Unpaid:  'bg-red-50 text-red-600 border border-red-200',
  };
  return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls[status] ?? cls['Unpaid']}`}>{status}</span>;
}

// ── Info Field ─────────────────────────────────────────────────────────────────

function InfoField({ label, value, editing, name, onChange, type = 'text' }: {
  label: string; value?: string; editing: boolean; name: string;
  onChange: (n: string, v: string) => void; type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      {editing ? (
        <input type={type} value={value ?? ''} onChange={e => onChange(name, e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
      ) : (
        <span className="text-sm text-slate-700 font-medium">
          {value || <span className="text-slate-300 font-normal">—</span>}
        </span>
      )}
    </div>
  );
}

// ── Print helper — opens a new window ────────────────────────────────────────

function printHTML(html: string, title = 'Print') {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; }
      @media print { body { margin: 0; } }
    </style>
  </head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

// ── ID Card Component ─────────────────────────────────────────────────────────

function IDCardTab({ student, schoolName, cardYear }: {
  student: Student; schoolName: string; cardYear: number;
}) {
  const academicYear = `${cardYear}-${String(cardYear + 1).slice(-2)}`;

  function printCard() {
    const photoHTML = student.photo_url
      ? `<img src="${student.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" />`
      : `<div style="width:100%;height:100%;background:#1d4ed8;border-radius:6px;display:flex;align-items:center;justify-content:center;color:white;font-size:28px;font-weight:700;">${student.full_name.charAt(0).toUpperCase()}</div>`;

    const html = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f1f5f9;">
        <div style="width:85.6mm;background:white;border-radius:10px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.15);font-family:'Segoe UI',Arial,sans-serif;">
          <!-- Header -->
          <div style="background:linear-gradient(135deg,#1d4ed8,#2563eb);padding:10px 14px;display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:28px;height:28px;background:white;border-radius:6px;display:flex;align-items:center;justify-content:center;">
                <div style="width:16px;height:16px;background:#1d4ed8;border-radius:3px;"></div>
              </div>
              <div>
                <div style="color:white;font-size:11px;font-weight:700;line-height:1.2;">${schoolName}</div>
                <div style="color:#bfdbfe;font-size:8px;">STUDENT ID CARD</div>
              </div>
            </div>
            <div style="background:rgba(255,255,255,0.2);border-radius:4px;padding:3px 7px;">
              <div style="color:white;font-size:8px;font-weight:600;">${academicYear}</div>
            </div>
          </div>

          <!-- Body -->
          <div style="padding:10px 14px;display:flex;gap:12px;align-items:flex-start;">
            <!-- Photo -->
            <div style="width:56px;height:68px;flex-shrink:0;border:2px solid #e2e8f0;border-radius:8px;overflow:hidden;">
              ${photoHTML}
            </div>
            <!-- Info -->
            <div style="flex:1;min-width:0;">
              <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:6px;line-height:1.3;">${student.full_name}</div>
              <table style="width:100%;border-collapse:collapse;">
                ${[
                  ['Father', student.father_name ?? '—'],
                  ['Class', `${student.current_grade ?? '—'} — ${student.current_section ?? '—'}`],
                  ['Roll No.', student.roll_number ?? '—'],
                  ['CNIC/B-Form', student.cnic ?? '—'],
                ].map(([label, val]) => `
                  <tr>
                    <td style="font-size:7.5px;color:#64748b;font-weight:600;padding:1.5px 0;width:52px;">${label}</td>
                    <td style="font-size:7.5px;color:#1e293b;font-weight:500;padding:1.5px 0;">: ${val}</td>
                  </tr>`).join('')}
              </table>
            </div>
          </div>

          <!-- Footer -->
          <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:6px 14px;display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:7px;color:#94a3b8;">If found, please return to school</div>
            <div style="font-size:7px;color:#3b82f6;font-weight:600;">Campus Core</div>
          </div>
        </div>
      </div>
      <style>@media print { @page { size: 85.6mm 54mm; margin: 0; } }</style>
    `;
    printHTML(html, 'Student ID Card');
  }

  function printSheet() {
    // A4 with 4 cards (2×2 grid)
    const photoHTML = student.photo_url
      ? `<img src="${student.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" />`
      : `<div style="width:100%;height:100%;background:#1d4ed8;border-radius:6px;display:flex;align-items:center;justify-content:center;color:white;font-size:28px;font-weight:700;">${student.full_name.charAt(0).toUpperCase()}</div>`;

    const singleCard = `
      <div style="width:85.6mm;background:white;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;font-family:'Segoe UI',Arial,sans-serif;page-break-inside:avoid;">
        <div style="background:linear-gradient(135deg,#1d4ed8,#2563eb);padding:10px 14px;display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:28px;height:28px;background:white;border-radius:6px;display:flex;align-items:center;justify-content:center;">
              <div style="width:16px;height:16px;background:#1d4ed8;border-radius:3px;"></div>
            </div>
            <div>
              <div style="color:white;font-size:11px;font-weight:700;line-height:1.2;">${schoolName}</div>
              <div style="color:#bfdbfe;font-size:8px;">STUDENT ID CARD</div>
            </div>
          </div>
          <div style="background:rgba(255,255,255,0.2);border-radius:4px;padding:3px 7px;">
            <div style="color:white;font-size:8px;font-weight:600;">${academicYear}</div>
          </div>
        </div>
        <div style="padding:10px 14px;display:flex;gap:12px;align-items:flex-start;">
          <div style="width:56px;height:68px;flex-shrink:0;border:2px solid #e2e8f0;border-radius:8px;overflow:hidden;">${photoHTML}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:6px;line-height:1.3;">${student.full_name}</div>
            <table style="width:100%;border-collapse:collapse;">
              ${[
                ['Father', student.father_name ?? '—'],
                ['Class', `${student.current_grade ?? '—'} — ${student.current_section ?? '—'}`],
                ['Roll No.', student.roll_number ?? '—'],
                ['CNIC/B-Form', student.cnic ?? '—'],
              ].map(([l, v]) => `<tr><td style="font-size:7.5px;color:#64748b;font-weight:600;padding:1.5px 0;width:52px;">${l}</td><td style="font-size:7.5px;color:#1e293b;font-weight:500;padding:1.5px 0;">: ${v}</td></tr>`).join('')}
            </table>
          </div>
        </div>
        <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:6px 14px;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:7px;color:#94a3b8;">If found, please return to school</div>
          <div style="font-size:7px;color:#3b82f6;font-weight:600;">Campus Core</div>
        </div>
      </div>`;

    const html = `
      <div style="padding:10mm;background:#f8fafc;min-height:297mm;">
        <div style="display:grid;grid-template-columns:repeat(2,85.6mm);gap:8mm;justify-content:center;">
          ${singleCard}${singleCard}${singleCard}${singleCard}
        </div>
      </div>
      <style>@media print { @page { size: A4; margin: 10mm; } }</style>
    `;
    printHTML(html, 'ID Cards Sheet');
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Student ID Card — {academicYear}</h3>
        <div className="flex gap-2">
          <button onClick={printCard}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
            <Printer className="w-4 h-4" /> Print Card
          </button>
          <button onClick={printSheet}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Printer className="w-4 h-4" /> Print 4 on A4
          </button>
        </div>
      </div>

      {/* Card preview */}
      <div className="flex justify-center">
        <div className="w-80 bg-white rounded-2xl overflow-hidden shadow-xl border border-slate-200">
          {/* Card header */}
          <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow">
                <div className="w-4 h-4 bg-blue-600 rounded-sm" />
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">{schoolName}</p>
                <p className="text-blue-200 text-xs">STUDENT ID CARD</p>
              </div>
            </div>
            <div className="bg-white/20 rounded-md px-2 py-1">
              <p className="text-white text-xs font-semibold">{academicYear}</p>
            </div>
          </div>

          {/* Card body */}
          <div className="px-5 py-4 flex gap-4 items-start">
            {/* Photo */}
            <div className="w-16 h-20 rounded-xl border-2 border-slate-200 overflow-hidden flex-shrink-0 bg-blue-100 flex items-center justify-center">
              {student.photo_url
                ? <img src={student.photo_url} alt="" className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                : <span className="text-blue-700 font-bold text-2xl">{student.full_name.charAt(0).toUpperCase()}</span>
              }
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-sm mb-3 leading-tight">{student.full_name}</p>
              <div className="space-y-1.5">
                {[
                  ['Father', student.father_name],
                  ['Class', student.current_grade ? `${student.current_grade} — ${student.current_section ?? ''}` : null],
                  ['Roll No.', student.roll_number],
                  ['CNIC/B-Form', student.cnic],
                ].map(([label, val]) => (
                  <div key={label as string} className="flex gap-1 text-xs leading-tight">
                    <span className="text-slate-400 font-semibold w-14 flex-shrink-0">{label}</span>
                    <span className="text-slate-700">: {val || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Card footer */}
          <div className="bg-slate-50 border-t border-slate-100 px-5 py-2 flex items-center justify-between">
            <p className="text-xs text-slate-400">If found, please return to school</p>
            <p className="text-xs text-blue-500 font-semibold">Campus Core</p>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400 mt-4">
        Preview — use the print buttons above to print
      </p>
    </div>
  );
}

// ── Leaving Certificate Component ─────────────────────────────────────────────

function CertificateTab({ student, schoolName }: { student: Student; schoolName: string }) {
  const today = new Date().toISOString().split('T')[0];
  const [certNo, setCertNo]       = useState(genCertNumber);
  const [issueDate, setIssueDate] = useState(today);
  const [leavingDate, setLeavingDate] = useState(today);
  const [reason, setReason]       = useState('');
  const [conduct, setConduct]     = useState('Good');
  const [feeStatus, setFeeStatus] = useState<'Cleared' | 'Pending'>('Cleared');
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  const { settings } = useSchool();
  const schoolId = settings?.school_id;

  async function saveAndPrint() {
    setSaving(true);
    if (schoolId) {
      await supabase.from('leaving_certificates').insert({
        student_id: student.id,
        school_id: schoolId,
        certificate_number: certNo,
        issue_date: issueDate,
        last_class: student.current_grade ? `Class ${student.current_grade}-${student.current_section ?? ''}` : '',
        reason,
      }).select().single();
    }
    setSaving(false);
    setSaved(true);
    doPrint();
  }

  function doPrint() {
    const html = `
      <div style="padding:20mm 25mm;min-height:297mm;font-family:'Segoe UI',Arial,sans-serif;background:white;position:relative;">

        <!-- Border -->
        <div style="position:absolute;inset:8mm;border:3px double #1d4ed8;border-radius:4px;pointer-events:none;"></div>
        <div style="position:absolute;inset:10.5mm;border:1px solid #93c5fd;border-radius:2px;pointer-events:none;"></div>

        <!-- School header -->
        <div style="text-align:center;margin-bottom:8mm;padding-bottom:6mm;border-bottom:2px solid #1d4ed8;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:50px;height:50px;background:#1d4ed8;border-radius:12px;margin-bottom:6px;">
            <div style="width:28px;height:28px;background:white;border-radius:6px;"></div>
          </div>
          <h1 style="font-size:22px;font-weight:800;color:#1e293b;margin:4px 0 2px;">${schoolName}</h1>
          <p style="font-size:11px;color:#64748b;letter-spacing:2px;text-transform:uppercase;">Managed via Campus Core</p>
        </div>

        <!-- Certificate title -->
        <div style="text-align:center;margin-bottom:8mm;">
          <h2 style="font-size:18px;font-weight:700;color:#1d4ed8;letter-spacing:3px;text-transform:uppercase;margin-bottom:4px;">Leaving Certificate</h2>
          <div style="width:80px;height:3px;background:#1d4ed8;margin:0 auto;border-radius:2px;"></div>
        </div>

        <!-- Cert No + Date row -->
        <div style="display:flex;justify-content:space-between;margin-bottom:8mm;font-size:11px;color:#475569;">
          <div><strong>Certificate No:</strong> ${certNo}</div>
          <div><strong>Date of Issue:</strong> ${new Date(issueDate).toLocaleDateString('en-PK', { day:'2-digit', month:'long', year:'numeric' })}</div>
        </div>

        <!-- Body text -->
        <div style="font-size:13px;color:#1e293b;line-height:2;margin-bottom:8mm;">
          <p style="margin-bottom:6mm;">
            This is to certify that <strong>${student.full_name}</strong>,
            Son/Daughter of <strong>${student.father_name ?? '—'}</strong>,
            bearing Roll No. <strong>${student.roll_number ?? '—'}</strong>
            ${student.cnic ? `, CNIC/B-Form No. <strong>${student.cnic}</strong>` : ''},
            was a bonafide student of <strong>Class ${student.current_grade ?? '—'}-${student.current_section ?? '—'}</strong>
            at this institution.
          </p>

          <table style="width:100%;border-collapse:collapse;margin-bottom:6mm;">
            ${[
              ['Date of Admission', student.admission_date ? new Date(student.admission_date).toLocaleDateString('en-PK',{day:'2-digit',month:'long',year:'numeric'}) : '—'],
              ['Date of Birth', student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('en-PK',{day:'2-digit',month:'long',year:'numeric'}) : '—'],
              ['Date of Leaving', new Date(leavingDate).toLocaleDateString('en-PK',{day:'2-digit',month:'long',year:'numeric'})],
              ['Last Class Attended', student.current_grade ? `Class ${student.current_grade}-${student.current_section ?? ''}` : '—'],
              ['Reason for Leaving', reason || '—'],
              ['Character &amp; Conduct', conduct],
              ['Fee Clearance Status', feeStatus],
            ].map(([label, val]) => `
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:5px 0;font-weight:600;color:#475569;width:45%;font-size:12px;">${label}</td>
                <td style="padding:5px 0;color:#1e293b;font-size:12px;">: &nbsp;${val}</td>
              </tr>`).join('')}
          </table>
        </div>

        <!-- Signature -->
        <div style="display:flex;justify-content:flex-end;margin-top:14mm;">
          <div style="text-align:center;min-width:160px;">
            <div style="height:40px;border-bottom:1.5px solid #1e293b;margin-bottom:4px;"></div>
            <p style="font-size:11px;font-weight:700;color:#1e293b;">Principal</p>
            <p style="font-size:10px;color:#64748b;margin-top:2px;">${schoolName}</p>
          </div>
        </div>

        <!-- Stamp area -->
        <div style="position:absolute;bottom:22mm;left:30mm;">
          <div style="width:70px;height:70px;border:2px dashed #cbd5e1;border-radius:50%;display:flex;align-items:center;justify-content:center;">
            <p style="font-size:8px;color:#cbd5e1;text-align:center;line-height:1.4;">Official<br/>Stamp</p>
          </div>
        </div>

      </div>
      <style>@media print { @page { size: A4; margin: 0; } }</style>
    `;
    printHTML(html, 'Leaving Certificate');
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Leaving Certificate</h3>
        <div className="flex gap-2">
          <button onClick={doPrint}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
            <Printer className="w-4 h-4" /> Preview &amp; Print
          </button>
          <button onClick={saveAndPrint} disabled={saving}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save & Print'}
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

        {/* Certificate No */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Certificate Number</label>
          <input value={certNo} onChange={e => setCertNo(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono" />
        </div>

        {/* Issue Date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Date of Issue</label>
          <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>

        {/* Leaving Date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Date of Leaving</label>
          <input type="date" value={leavingDate} onChange={e => setLeavingDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>

        {/* Fee Status */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fee Clearance Status</label>
          <div className="relative">
            <select value={feeStatus} onChange={e => setFeeStatus(e.target.value as 'Cleared' | 'Pending')}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none">
              <option value="Cleared">Cleared</option>
              <option value="Pending">Pending</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Character & Conduct */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Character &amp; Conduct</label>
          <div className="relative">
            <select value={conduct} onChange={e => setConduct(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none">
              <option>Excellent</option>
              <option>Very Good</option>
              <option>Good</option>
              <option>Satisfactory</option>
              <option>Needs Improvement</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Reason */}
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Reason for Leaving</label>
          <input value={reason} onChange={e => setReason(e.target.value)}
            placeholder="e.g. Family relocated, transfer to another school..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
      </div>

      {/* Preview card */}
      <div className="mt-6 p-5 border-2 border-dashed border-blue-200 rounded-2xl bg-blue-50/40">
        <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-3">Certificate Preview</p>
        <div className="space-y-1.5 text-sm text-slate-600">
          <p>This is to certify that <strong className="text-slate-800">{student.full_name}</strong>, S/D of <strong className="text-slate-800">{student.father_name ?? '—'}</strong>, Roll No. <strong className="text-slate-800">{student.roll_number ?? '—'}</strong>, was a student of <strong className="text-slate-800">Class {student.current_grade}-{student.current_section}</strong>.</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-3 text-xs">
            {[
              ['Certificate No', certNo],
              ['Date of Issue', issueDate],
              ['Date of Leaving', leavingDate],
              ['Reason', reason || '—'],
              ['Conduct', conduct],
              ['Fee Status', feeStatus],
            ].map(([l, v]) => (
              <div key={l} className="flex gap-1">
                <span className="text-slate-400 font-semibold">{l}:</span>
                <span className="text-slate-700">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function StudentProfiles() {
  const { settings, schoolName } = useSchool();
  const schoolId = settings?.school_id;

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Student>>({});
  const [saving, setSaving] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSummary[]>([]);
  const [examResults, setExamResults] = useState<Result[]>([]);
  const [documents, setDocuments] = useState<StudentDoc[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  const [docUploading, setDocUploading] = useState(false);
  const [docName, setDocName] = useState('');
  const [docCategory, setDocCategory] = useState('General');
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [docError, setDocError] = useState('');
  const docFileRef = useRef<HTMLInputElement>(null);

  // ── Search ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!query.trim() || !schoolId) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('students')
        .select('id, full_name, roll_number, father_name, current_grade, current_section, status, photo_url')
        .eq('school_id', schoolId)
        .or(`full_name.ilike.%${query.trim()}%,father_name.ilike.%${query.trim()}%,roll_number.ilike.%${query.trim()}%`)
        .order('full_name').limit(20);
      setSearchResults(data ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, schoolId]);

  async function selectStudent(s: Student) {
    const { data } = await supabase.from('students').select('*').eq('id', s.id).single();
    setSelectedStudent(data ?? s);
    setActiveTab('profile');
    setEditing(false);
    setQuery('');
    setSearchResults([]);
  }

  // ── Load tab data ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedStudent || activeTab === 'profile' || activeTab === 'idcard' || activeTab === 'certificate') return;
    setTabLoading(true);

    if (activeTab === 'fees') {
      supabase.from('fee_records')
        .select('id, fee_month, fee_year, total_amount, amount_paid, status, payment_date')
        .eq('student_id', selectedStudent.id).eq('fee_year', selectedYear)
        .order('fee_month', { ascending: false })
        .then(({ data }) => { setFees(data ?? []); setTabLoading(false); });

    } else if (activeTab === 'attendance') {
      supabase.from('attendance_records')
        .select('attendance_date, status')
        .eq('student_id', selectedStudent.id)
        .gte('attendance_date', `${selectedYear}-01-01`)
        .lte('attendance_date', `${selectedYear}-12-31`)
        .then(({ data }) => {
          if (!data) { setAttendance([]); setTabLoading(false); return; }
          const map: Record<string, AttendanceSummary> = {};
          data.forEach(r => {
            const d = new Date(r.attendance_date);
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            if (!map[key]) map[key] = { month: key, present:0, absent:0, late:0, leave:0 };
            if (r.status==='present') map[key].present++;
            else if (r.status==='absent') map[key].absent++;
            else if (r.status==='late') map[key].late++;
            else if (r.status==='leave') map[key].leave++;
          });
          setAttendance(Object.values(map).sort((a,b)=>b.month.localeCompare(a.month)));
          setTabLoading(false);
        });

    } else if (activeTab === 'results') {
      supabase.from('student_results')
        .select('id, exam_type, subject_name, obtained_marks, total_marks, pass_fail, exam_year, exam_month, grade')
        .eq('student_id', selectedStudent.id).eq('exam_year', selectedYear)
        .then(({ data }) => {
          if (!data) { setExamResults([]); setTabLoading(false); return; }
          const seen = new Set<string>();
          const deduped = data.filter(r => {
            const k = `${r.exam_type}-${r.exam_year}-${r.exam_month??0}-${r.subject_name}`;
            if (seen.has(k)) return false;
            seen.add(k); return true;
          });
          setExamResults(deduped);
          setTabLoading(false);
        });

    } else if (activeTab === 'documents') {
      supabase.from('student_documents')
        .select('id, document_name, category, file_url, uploaded_at')
        .eq('student_id', selectedStudent.id)
        .order('uploaded_at', { ascending: false })
        .then(({ data }) => { setDocuments(data ?? []); setTabLoading(false); });
    }
  }, [activeTab, selectedStudent, selectedYear]);

  // ── Photo upload ─────────────────────────────────────────────────────────────

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedStudent || !schoolId) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
    setPhotoUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${schoolId}/${selectedStudent.id}/photo.${ext}`;
      const { error: upErr } = await supabase.storage.from('student-photos').upload(path, file, { upsert:true, contentType:file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('student-photos').getPublicUrl(path);
      const photo_url = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from('students').update({ photo_url }).eq('id', selectedStudent.id);
      setSelectedStudent(prev => prev ? { ...prev, photo_url } : prev);
    } catch (err: any) {
      alert('Photo upload failed: ' + (err.message ?? 'Make sure bucket is public (run the SQL fix).'));
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

  // ── Document upload ───────────────────────────────────────────────────────────

  async function handleDocUpload() {
    const file = docFileRef.current?.files?.[0];
    setDocError('');
    if (!file) { setDocError('Please choose a file.'); return; }
    if (!docName.trim()) { setDocError('Please enter a document name.'); return; }
    if (!selectedStudent || !schoolId) return;
    setDocUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'file';
      const path = `${schoolId}/${selectedStudent.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('student-documents').upload(path, file, { contentType:file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('student-documents').getPublicUrl(path);
      const { data: doc, error: dbErr } = await supabase.from('student_documents').insert({
        student_id: selectedStudent.id, school_id: schoolId,
        document_name: docName.trim(), category: docCategory,
        file_url: urlData.publicUrl, file_size: file.size, mime_type: file.type,
      }).select().single();
      if (dbErr) throw dbErr;
      if (doc) setDocuments(prev => [doc, ...prev]);
      setDocName(''); setDocCategory('General');
      if (docFileRef.current) docFileRef.current.value = '';
      setShowDocUpload(false);
    } catch (err: any) {
      setDocError('Upload failed: ' + (err.message ?? 'Make sure bucket is public.'));
    } finally { setDocUploading(false); }
  }

  async function deleteDocument(docId: string) {
    if (!confirm('Delete this document?')) return;
    await supabase.from('student_documents').delete().eq('id', docId);
    setDocuments(prev => prev.filter(d => d.id !== docId));
  }

  // ── Edit ──────────────────────────────────────────────────────────────────────

  function startEdit() { setEditData({ ...selectedStudent }); setEditing(true); }
  function cancelEdit() { setEditing(false); setEditData({}); }
  function handleFieldChange(name: string, value: string) { setEditData(prev => ({ ...prev, [name]: value })); }

  async function saveEdit() {
    if (!selectedStudent) return;
    setSaving(true);
    const { data, error } = await supabase.from('students').update({
      full_name: editData.full_name, father_name: editData.father_name, father_phone: editData.father_phone,
      phone: editData.phone, cnic: editData.cnic, address: editData.address,
      date_of_birth: editData.date_of_birth || null, admission_date: editData.admission_date || null,
      status: editData.status, current_grade: editData.current_grade ? Number(editData.current_grade) : null,
      current_section: editData.current_section, roll_number: editData.roll_number,
    }).eq('id', selectedStudent.id).select().single();
    setSaving(false);
    if (!error && data) { setSelectedStudent(data); setEditing(false); setEditData({}); }
    else if (error) alert('Save failed: ' + error.message);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function capitalize(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  const showYearSelector = ['fees','attendance','results'].includes(activeTab);

  // Group results
  type ExamGroup = { label: string; rows: Result[]; sortOrder: number };
  const examMap: Record<string, ExamGroup> = {};
  examResults.forEach(r => {
    const key = r.exam_type === 'monthly' ? `monthly-${r.exam_month??0}` : r.exam_type;
    if (!examMap[key]) {
      let label = '', sortOrder = 0;
      if (key.startsWith('monthly-')) { const m=Number(key.split('-')[1]); label=`Monthly — ${MONTH_NAMES[m-1]??''}`; sortOrder=m; }
      else if (key==='midterm') { label='Midterm Exam'; sortOrder=50; }
      else if (key==='annual') { label='Annual Exam'; sortOrder=99; }
      else { label=capitalize(key); sortOrder=60; }
      examMap[key] = { label, rows:[], sortOrder };
    }
    examMap[key].rows.push(r);
  });
  const sortedExamGroups = Object.entries(examMap).sort(([,a],[,b])=>a.sortOrder-b.sortOrder);

  // Attendance totals
  const attTotals = attendance.reduce((a,r)=>({ present:a.present+r.present, absent:a.absent+r.absent, late:a.late+r.late, leave:a.leave+r.leave }),{present:0,absent:0,late:0,leave:0});
  const attTotal = attTotals.present+attTotals.absent+attTotals.late+attTotals.leave;
  const attPct = attTotal>0 ? Math.round((attTotals.present/attTotal)*100) : 0;

  // ── Search view ───────────────────────────────────────────────────────────────

  if (!selectedStudent) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-xl">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <User className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Student Profiles</h2>
            <p className="text-slate-400 text-sm mt-1">Search by name, roll number, or father's name</p>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input autoFocus type="text" placeholder="Search students..." value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 text-base border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 bg-white shadow-sm transition-colors" />
            {searching && <div className="absolute right-4 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}
          </div>
          {searchResults.length > 0 && (
            <div className="mt-3 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
              {searchResults.map((s,i) => (
                <button key={s.id} onClick={() => selectStudent(s)}
                  className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-blue-50 transition-colors text-left ${i!==0?'border-t border-slate-100':''}`}>
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0 overflow-hidden">
                    {s.photo_url ? <img src={s.photo_url} alt="" className="w-full h-full object-cover" onError={e=>{(e.target as HTMLImageElement).style.display='none'}} /> : s.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{s.full_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {s.father_name?`Father: ${s.father_name}`:''}
                      {s.roll_number?` · Roll# ${s.roll_number}`:''}
                      {s.current_grade?` · Grade ${s.current_grade}${s.current_section??''}`:''}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </button>
              ))}
            </div>
          )}
          {query.trim() && !searching && searchResults.length===0 && (
            <div className="mt-4 text-center text-slate-400 text-sm">No students found for "{query}"</div>
          )}
        </div>
      </div>
    );
  }

  // ── Profile view ──────────────────────────────────────────────────────────────

  const displayData = editing ? editData as Student : selectedStudent;

  return (
    <div className="max-w-4xl mx-auto">

      {/* Top bar */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => setSelectedStudent(null)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Search
        </button>
        <div className="flex items-center gap-2">
          {!editing ? (
            <>
              <button onClick={() => window.print()}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
                <Printer className="w-4 h-4" /> Print
              </button>
              <button onClick={startEdit}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Edit2 className="w-4 h-4" /> Edit
              </button>
            </>
          ) : (
            <>
              <button onClick={cancelEdit} className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={saveEdit} disabled={saving} className="flex items-center gap-2 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Profile header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-4 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-md overflow-hidden">
              {selectedStudent.photo_url
                ? <img src={selectedStudent.photo_url} alt={selectedStudent.full_name} className="w-full h-full object-cover" onError={e=>{(e.target as HTMLImageElement).style.display='none'}} />
                : <span>{selectedStudent.full_name.charAt(0).toUpperCase()}</span>
              }
            </div>
            <button onClick={() => photoInputRef.current?.click()} disabled={photoUploading}
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-md hover:bg-blue-700 transition-colors"
              title="Upload photo">
              {photoUploading
                ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Camera className="w-3.5 h-3.5" />}
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-slate-800">{selectedStudent.full_name}</h2>
              <StatusBadge status={selectedStudent.status} />
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {selectedStudent.current_grade ? `Grade ${selectedStudent.current_grade}` : ''}
              {selectedStudent.current_section ? ` — Section ${selectedStudent.current_section}` : ''}
              {selectedStudent.roll_number ? ` · Roll# ${selectedStudent.roll_number}` : ''}
            </p>
            {selectedStudent.father_name && <p className="text-xs text-slate-400 mt-0.5">Father: {selectedStudent.father_name}</p>}
          </div>
        </div>
      </div>

      {/* Tabs + Year selector */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 flex-1 overflow-x-auto">
          {([
            { id:'profile',     label:'Profile',     icon:User },
            { id:'fees',        label:'Fees',         icon:CreditCard },
            { id:'attendance',  label:'Attendance',   icon:CalendarCheck },
            { id:'results',     label:'Results',      icon:ClipboardList },
            { id:'documents',   label:'Documents',    icon:FileText },
            { id:'idcard', label:'ID Card', icon:Contact },
            { id:'certificate', label:'Certificate',  icon:ScrollText },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap min-w-0 ${
                activeTab===id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline truncate">{label}</span>
            </button>
          ))}
        </div>
        {showYearSelector && (
          <div className="relative flex-shrink-0">
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
              className="pl-3 pr-7 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none text-slate-700 shadow-sm">
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">

        {/* ── Profile ─────────────────────────────────────────────────────────── */}
        {activeTab === 'profile' && (
          <div className="p-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
              <InfoField label="Full Name"      value={displayData.full_name}     editing={editing} name="full_name"     onChange={handleFieldChange} />
              <InfoField label="Father's Name"  value={displayData.father_name}   editing={editing} name="father_name"   onChange={handleFieldChange} />
              <InfoField label="Date of Birth"  value={displayData.date_of_birth} editing={editing} name="date_of_birth" onChange={handleFieldChange} type="date" />
              <InfoField label="CNIC / B-Form"  value={displayData.cnic}          editing={editing} name="cnic"          onChange={handleFieldChange} />
              <InfoField label="Phone"          value={displayData.phone}         editing={editing} name="phone"         onChange={handleFieldChange} type="tel" />
              <InfoField label="Father's Phone" value={displayData.father_phone}  editing={editing} name="father_phone"  onChange={handleFieldChange} type="tel" />
              <div className="sm:col-span-2">
                <InfoField label="Address" value={displayData.address} editing={editing} name="address" onChange={handleFieldChange} />
              </div>
            </div>
            <div className="border-t border-slate-100 pt-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Academic Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <InfoField label="Roll Number"    value={displayData.roll_number}                                          editing={editing} name="roll_number"    onChange={handleFieldChange} />
                <InfoField label="Admission Date" value={displayData.admission_date}                                       editing={editing} name="admission_date" onChange={handleFieldChange} type="date" />
                <InfoField label="Grade"          value={displayData.current_grade?String(displayData.current_grade):''} editing={editing} name="current_grade"  onChange={handleFieldChange} />
                <InfoField label="Section"        value={displayData.current_section}                                      editing={editing} name="current_section" onChange={handleFieldChange} />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</span>
                  {editing ? (
                    <div className="relative">
                      <select value={editData.status ?? 'active'} onChange={e => handleFieldChange('status', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none">
                        <option value="active">Active</option>
                        <option value="graduated">Graduated</option>
                        <option value="transferred">Transferred</option>
                        <option value="inactive">Inactive</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  ) : <StatusBadge status={selectedStudent.status} />}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Fees ────────────────────────────────────────────────────────────── */}
        {activeTab === 'fees' && (
          <div className="p-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Fee History — {selectedYear}</h3>
            {tabLoading ? <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
            : fees.length===0 ? (
              <div className="text-center py-12 text-slate-400">
                <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No fee records for {selectedYear}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label:'Total Paid',  value:`Rs ${fees.filter(f=>f.status==='Paid').reduce((s,f)=>s+(f.amount_paid??0),0).toLocaleString()}`, cls:'text-emerald-700 bg-emerald-50 border border-emerald-100' },
                    { label:'Partial',     value:`${fees.filter(f=>f.status==='Partial').length} month(s)`, cls:'text-amber-700 bg-amber-50 border border-amber-100' },
                    { label:'Unpaid',      value:`${fees.filter(f=>f.status==='Unpaid').length} month(s)`,  cls:'text-red-600 bg-red-50 border border-red-100' },
                  ].map(({ label, value, cls }) => (
                    <div key={label} className={`rounded-xl p-3 ${cls}`}>
                      <p className="text-xs font-semibold opacity-70">{label}</p>
                      <p className="text-sm font-bold mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['Month','Total','Paid','Status','Date'].map(h => (
                          <th key={h} className={`pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider ${h==='Month'?'text-left':'text-center'} ${h==='Date'?'hidden sm:table-cell':''}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fees.map(f => (
                        <tr key={f.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-3 font-medium text-slate-700">{MONTH_NAMES[f.fee_month-1]} {f.fee_year}</td>
                          <td className="py-3 text-center text-slate-600">Rs {(f.total_amount??0).toLocaleString()}</td>
                          <td className="py-3 text-center text-slate-600">Rs {(f.amount_paid??0).toLocaleString()}</td>
                          <td className="py-3 text-center"><FeeStatusBadge status={f.status} /></td>
                          <td className="py-3 text-center text-slate-400 text-xs hidden sm:table-cell">
                            {f.payment_date ? new Date(f.payment_date).toLocaleDateString('en-PK') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Attendance ───────────────────────────────────────────────────────── */}
        {activeTab === 'attendance' && (
          <div className="p-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Attendance — {selectedYear}</h3>
            {tabLoading ? <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
            : attendance.length===0 ? (
              <div className="text-center py-12 text-slate-400">
                <CalendarCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No attendance records for {selectedYear}</p>
              </div>
            ) : (
              <>
                <div className={`flex items-center justify-between p-4 rounded-xl mb-4 ${attPct>=75?'bg-emerald-50 border border-emerald-100':'bg-red-50 border border-red-100'}`}>
                  <div className="grid grid-cols-4 gap-6 flex-1">
                    {[
                      {label:'Present', value:attTotals.present, Icon:CheckCircle, color:'text-emerald-600'},
                      {label:'Absent',  value:attTotals.absent,  Icon:AlertCircle, color:'text-red-500'},
                      {label:'Late',    value:attTotals.late,    Icon:Clock,       color:'text-amber-500'},
                      {label:'Leave',   value:attTotals.leave,   Icon:MinusCircle, color:'text-slate-400'},
                    ].map(({ label, value, Icon, color }) => (
                      <div key={label} className="text-center">
                        <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
                        <p className="text-xl font-bold text-slate-800">{value}</p>
                        <p className="text-xs text-slate-500">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="ml-6 text-right flex-shrink-0">
                    <p className={`text-3xl font-bold ${attPct>=75?'text-emerald-600':'text-red-600'}`}>{attPct}%</p>
                    <p className="text-xs text-slate-500 mt-0.5">Year total</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {attendance.map(a => {
                    const total = a.present+a.absent+a.late+a.leave;
                    const pct = total>0?Math.round((a.present/total)*100):0;
                    const [y,mo] = a.month.split('-');
                    return (
                      <div key={a.month} className="border border-slate-100 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-slate-700 text-sm">{MONTH_NAMES[Number(mo)-1]} {y}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pct>=75?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-600'}`}>{pct}%</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center">
                          {[
                            {label:'P',  value:a.present, color:'text-emerald-600 bg-emerald-50'},
                            {label:'A',  value:a.absent,  color:'text-red-500 bg-red-50'},
                            {label:'L',  value:a.late,    color:'text-amber-600 bg-amber-50'},
                            {label:'Lv', value:a.leave,   color:'text-slate-500 bg-slate-50'},
                          ].map(({ label, value, color }) => (
                            <div key={label} className={`rounded-lg py-1.5 ${color}`}>
                              <p className="text-base font-bold">{value}</p>
                              <p className="text-xs opacity-70">{label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────────────────────── */}
        {activeTab === 'results' && (
          <div className="p-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Exam Results — {selectedYear}</h3>
            {tabLoading ? <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
            : sortedExamGroups.length===0 ? (
              <div className="text-center py-12 text-slate-400">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No results found for {selectedYear}</p>
              </div>
            ) : (
              <div className="space-y-5">
                {sortedExamGroups.map(([key, { label, rows }]) => {
                  const totObt = rows.reduce((s,r)=>s+(r.obtained_marks??0),0);
                  const totMrk = rows.reduce((s,r)=>s+(r.total_marks??0),0);
                  const pct = totMrk>0?Math.round((totObt/totMrk)*100):0;
                  const allPass = rows.every(r=>r.pass_fail==='pass');
                  return (
                    <div key={key} className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-bold text-slate-700">{label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 font-medium">{totObt}/{totMrk} ({pct}%)</span>
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${allPass?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-600'}`}>
                            {allPass?'PASS':'FAIL'}
                          </span>
                        </div>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/50">
                            {['Subject','Obtained','Total','%','Result'].map(h => (
                              <th key={h} className={`px-4 py-2 text-xs text-slate-400 font-semibold ${h==='Subject'?'text-left':'text-center'}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(r => {
                            const sp = r.total_marks>0?Math.round((r.obtained_marks/r.total_marks)*100):0;
                            return (
                              <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                                <td className="px-4 py-2.5 text-slate-700 font-medium">{r.subject_name}</td>
                                <td className="px-4 py-2.5 text-center font-bold text-slate-700">{r.obtained_marks}</td>
                                <td className="px-4 py-2.5 text-center text-slate-500">{r.total_marks}</td>
                                <td className="px-4 py-2.5 text-center"><span className={sp>=40?'text-emerald-600 font-semibold':'text-red-500 font-semibold'}>{sp}%</span></td>
                                <td className="px-4 py-2.5 text-center">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.pass_fail==='pass'?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-600'}`}>
                                    {r.pass_fail?.toUpperCase()}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Documents ────────────────────────────────────────────────────────── */}
        {activeTab === 'documents' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Documents</h3>
              <button onClick={() => { setShowDocUpload(v=>!v); setDocError(''); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Upload className="w-3.5 h-3.5" /> Upload
              </button>
            </div>
            {showDocUpload && (
              <div className="mb-5 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <p className="text-sm font-semibold text-slate-700">Upload New Document</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Document Name *</label>
                    <input type="text" placeholder="e.g. Birth Certificate" value={docName} onChange={e=>setDocName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Category</label>
                    <select value={docCategory} onChange={e=>setDocCategory(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      {['General','Identity','Academic','Medical','Fee','Other'].map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">File *</label>
                  <input ref={docFileRef} type="file"
                    className="w-full text-sm text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
                </div>
                {docError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{docError}</div>}
                <div className="flex gap-2">
                  <button onClick={handleDocUpload} disabled={docUploading}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60">
                    <FileUp className="w-4 h-4" /> {docUploading?'Uploading...':'Upload Document'}
                  </button>
                  <button onClick={()=>{setShowDocUpload(false);setDocError('');}}
                    className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {tabLoading ? <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
            : documents.length===0 && !showDocUpload ? (
              <div className="text-center py-12 text-slate-400">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No documents uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl hover:bg-slate-50">
                    <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{doc.document_name}</p>
                      <p className="text-xs text-slate-400">{doc.category} · {new Date(doc.uploaded_at).toLocaleDateString('en-PK')}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium">View</a>
                      <button onClick={()=>deleteDocument(doc.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ID Card ──────────────────────────────────────────────────────────── */}
        {activeTab === 'idcard' && (
          <IDCardTab student={selectedStudent} schoolName={schoolName} cardYear={selectedYear} />
        )}

        {/* ── Certificate ──────────────────────────────────────────────────────── */}
        {activeTab === 'certificate' && (
          <CertificateTab student={selectedStudent} schoolName={schoolName} />
        )}

      </div>
    </div>
  );
}
