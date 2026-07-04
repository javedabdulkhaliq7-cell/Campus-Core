import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useSchool } from '../lib/schoolContext';
import {
  Search, ArrowLeft, Edit2, Save, X, Printer,
  User, CreditCard, CalendarCheck, ClipboardList,
  CheckCircle, AlertCircle, Clock, MinusCircle,
  ChevronDown, Camera, FileText, Upload, Trash2,
  BookOpen, FileUp, ScrollText, Loader,
  QrCode, RefreshCw, Smile, KeyRound,
} from 'lucide-react';
// npm install qrcode.react — modern versions (v3+) export QRCodeSVG (named), not a default export.
import { QRCodeSVG } from 'qrcode.react';
// Workaround: if your project has two copies of @types/react installed (a common
// dependency-tree dedup issue), TS can report "bigint is not assignable to ReactNode"
// and refuse to treat QRCodeSVG as a valid JSX component. This cast sidesteps that
// without touching node_modules. The real fix is deduping @types/react — run
// `npm ls @types/react` to confirm there's only one version resolved.
const QRCode = QRCodeSVG as unknown as (props: { value: string; size?: number }) => JSX.Element;
import {
  CERTIFICATE_DEFINITIONS,
  CertificateData,
  CertificateTypeId,
  generateCertificateNumber,
  todayString,
} from './certificate.types';
import CertificatePreview from './CertificatePreview';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ReceiptPreview from '../components/ReceiptPreview';

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
  attendance_token?: string;
  reference_photo_url?: string;
  parent_access_code?: string;
  parent_code_sent?: boolean;
}

interface FeeRecord {
  id: string;
  fee_month: number;
  fee_year: number;
  total_amount: number;
  amount_paid: number;
  status: string;
  payment_date?: string;
  payment_method?: string;
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

type Tab = 'profile' | 'fees' | 'attendance' | 'results' | 'documents' | 'certificate' | 'attendance_qr' | 'face_id' | 'parent_access';

// Raw attendance record per day (fetched from DB)
interface AttendanceRecord {
  attendance_date: string;
  status: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

// ── Function to get next roll number from database ───────────────────────────
async function getNextRollNumber(schoolId: string, grade: number, section: string): Promise<string | null> {
  if (!schoolId) return null;
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
  }
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

// Returns an <img> tag for the student's photo, or an initial-letter avatar if none is set
function studentPhotoHtml(student: Student, size = 64, radius = 12) {
  if (student.photo_url) {
    return `<img src="${student.photo_url}" style="width:${size}px;height:${size}px;border-radius:${radius}px;object-fit:cover;border:2px solid #e2e8f0;flex-shrink:0;" />`;
  }
  const initial = (student.full_name || '?').charAt(0).toUpperCase();
  return `<div style="width:${size}px;height:${size}px;border-radius:${radius}px;background:#1d4ed8;color:white;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*0.4)}px;font-weight:700;flex-shrink:0;">${initial}</div>`;
}

// ── Print Results — professional result card document ─────────────────────────

type ExamGroupEntry = [string, { label: string; rows: Result[]; sortOrder: number }];

function printResults(groups: ExamGroupEntry[], student: Student, schoolName: string, year: number, schoolLogo: string | null) {
  const grandObt = groups.reduce((s,[,g])=>s+g.rows.reduce((a,r)=>a+(r.obtained_marks??0),0),0);
  const grandTot = groups.reduce((s,[,g])=>s+g.rows.reduce((a,r)=>a+(r.total_marks??0),0),0);
  const grandPct = grandTot>0?Math.round((grandObt/grandTot)*100):0;
  const allPass  = groups.every(([,g])=>g.rows.every(r=>r.pass_fail==='pass'));

  const groupsHTML = groups.map(([,{ label, rows }]) => {
    const totObt = rows.reduce((s,r)=>s+(r.obtained_marks??0),0);
    const totMrk = rows.reduce((s,r)=>s+(r.total_marks??0),0);
    const pct    = totMrk>0?Math.round((totObt/totMrk)*100):0;
    const pass   = rows.every(r=>r.pass_fail==='pass');
    const rowsHTML = rows.map(r=>{
      const sp = r.total_marks>0?Math.round((r.obtained_marks/r.total_marks)*100):0;
      return `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:7px 10px;font-size:12px;color:#1e293b;font-weight:500;">${r.subject_name}</td>
          <td style="padding:7px 10px;font-size:12px;text-align:center;font-weight:700;color:#1e293b;">${r.obtained_marks}</td>
          <td style="padding:7px 10px;font-size:12px;text-align:center;color:#64748b;">${r.total_marks}</td>
          <td style="padding:7px 10px;font-size:12px;text-align:center;font-weight:600;color:${sp>=40?'#059669':'#dc2626'};">${sp}%</td>
          <td style="padding:7px 10px;font-size:12px;text-align:center;font-weight:700;color:#475569;">${r.grade??'—'}</td>
          <td style="padding:7px 10px;font-size:11px;text-align:center;">
            <span style="background:${r.pass_fail==='pass'?'#d1fae5':'#fee2e2'};color:${r.pass_fail==='pass'?'#065f46':'#991b1b'};padding:2px 8px;border-radius:20px;font-weight:700;">
              ${(r.pass_fail??'').toUpperCase()}
            </span>
          </td>
        </tr>`;
    }).join('');
    return `
      <div style="margin-bottom:18px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;page-break-inside:avoid;">
        <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:13px;font-weight:700;color:#1e293b;">${label}</span>
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:12px;color:#64748b;">${totObt} / ${totMrk} &nbsp;(${pct}%)</span>
            <span style="background:${pass?'#d1fae5':'#fee2e2'};color:${pass?'#065f46':'#991b1b'};font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;">${pass?'PASS':'FAIL'}</span>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
              ${['Subject','Obtained','Total','%','Grade','Result'].map(h=>`<th style="padding:7px 10px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;${h==='Subject'?'text-align:left':'text-align:center'}">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>${rowsHTML}</tbody>
          <tfoot>
            <tr style="background:#f1f5f9;border-top:2px solid #e2e8f0;">
              <td style="padding:7px 10px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;">Total</td>
              <td style="padding:7px 10px;text-align:center;font-weight:700;font-size:13px;color:#1e293b;">${totObt}</td>
              <td style="padding:7px 10px;text-align:center;font-weight:700;font-size:13px;color:#1e293b;">${totMrk}</td>
              <td style="padding:7px 10px;text-align:center;font-weight:700;color:${pct>=40?'#059669':'#dc2626'};">${pct}%</td>
              <td></td>
              <td style="padding:7px 10px;text-align:center;">
                <span style="background:${pass?'#d1fae5':'#fee2e2'};color:${pass?'#065f46':'#991b1b'};font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;">${pass?'PASS':'FAIL'}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  }).join('');

  const logoHtml = schoolLogo 
    ? `<img src="${schoolLogo}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;margin-bottom:5px;" />`
    : `<div style="width:44px;height:44px;background:#1d4ed8;border-radius:10px;margin-bottom:5px;display:flex;align-items:center;justify-content:center;"><div style="width:24px;height:24px;background:white;border-radius:5px;"></div></div>`;

  const html = `
    <div style="padding:16mm 18mm;min-height:297mm;font-family:'Segoe UI',Arial,sans-serif;background:white;position:relative;">

      <!-- Outer border -->
      <div style="position:absolute;inset:8mm;border:2px solid #1d4ed8;border-radius:6px;pointer-events:none;"></div>
      <div style="position:absolute;inset:10.5mm;border:1px solid #bfdbfe;border-radius:4px;pointer-events:none;"></div>

      <!-- School header with logo -->
      <div style="text-align:center;padding-bottom:10px;margin-bottom:10px;border-bottom:2px solid #1d4ed8;">
        ${logoHtml}
        <h1 style="font-size:20px;font-weight:800;color:#0f172a;margin:3px 0 2px;">${schoolName}</h1>
        <p style="font-size:10px;color:#64748b;letter-spacing:2px;text-transform:uppercase;">Academic Result Card — ${year}</p>
      </div>

      <!-- Student info row -->
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
        ${studentPhotoHtml(student, 60, 10)}
        <div style="flex:1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;">
        ${[
          ['Student Name', student.full_name],
          ["Father's Name", student.father_name??'—'],
          ['Roll No.', student.roll_number??'—'],
          ['Class', student.current_grade?`Class ${student.current_grade}${student.current_section?`-${student.current_section}`:''}` :'—'],
          ['Academic Year', String(year)],
          ['Overall Result', `${grandObt}/${grandTot} (${grandPct}%)`],
        ].map(([l,v])=>`
          <div>
            <p style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">${l}</p>
            <p style="font-size:12px;font-weight:600;color:#1e293b;">${v}</p>
          </div>`).join('')}
        </div>
      </div>

      <!-- Exam groups -->
      ${groupsHTML}

      <!-- Grand total -->
      <div style="background:#1d4ed8;border-radius:8px;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
        <span style="font-size:13px;font-weight:700;color:white;">Grand Total</span>
        <div style="display:flex;align-items:center;gap:16px;">
          <span style="font-size:13px;color:#bfdbfe;">${grandObt} / ${grandTot}</span>
          <span style="font-size:15px;font-weight:800;color:white;">${grandPct}%</span>
          <span style="background:${allPass?'#d1fae5':'#fee2e2'};color:${allPass?'#065f46':'#991b1b'};font-size:12px;font-weight:800;padding:3px 14px;border-radius:20px;">${allPass?'PASS':'FAIL'}</span>
        </div>
      </div>

      <!-- Signature row -->
      <div style="display:flex;justify-content:space-between;margin-top:20mm;padding-top:4px;">
        <div style="text-align:center;min-width:140px;">
          <div style="height:36px;border-bottom:1.5px solid #334155;margin-bottom:4px;"></div>
          <p style="font-size:10px;font-weight:700;color:#334155;">Class Teacher</p>
        </div>
        <div style="text-align:center;min-width:140px;">
          <div style="height:36px;border-bottom:1.5px solid #334155;margin-bottom:4px;"></div>
          <p style="font-size:10px;font-weight:700;color:#334155;">Principal</p>
          <p style="font-size:9px;color:#64748b;margin-top:1px;">${schoolName}</p>
        </div>
      </div>

      <!-- Issue date -->
      <p style="position:absolute;bottom:12mm;left:50%;transform:translateX(-50%);font-size:9px;color:#94a3b8;text-align:center;">
        Issued on ${new Date().toLocaleDateString('en-PK',{day:'2-digit',month:'long',year:'numeric'})} &nbsp;·&nbsp; Generated via Campus Core
      </p>
    </div>
    <style>@media print { @page { size: A4; margin: 0; } }</style>
  `;
  printHTML(html, `Result Card — ${student.full_name}`);
}

// ── Print Attendance History ─────────────────────────────────────────────────

function printAttendanceHistory(student: Student, attendance: AttendanceSummary[], rawAttendance: AttendanceRecord[], weeklyOffDays: number[], schoolName: string, schoolLogo: string | null, year: number) {
  const attTotals = attendance.reduce((a,r)=>({ present:a.present+r.present, absent:a.absent+r.absent, late:a.late+r.late, leave:a.leave+r.leave }),{present:0,absent:0,late:0,leave:0});
  const attTotal = attTotals.present+attTotals.absent+attTotals.late+attTotals.leave;
  const attPct = attTotal>0 ? Math.round((attTotals.present/attTotal)*100) : 0;

  // Build monthly calendars HTML
  const calendarsHTML = attendance.map(a => {
    const [yr, mo] = a.month.split('-').map(Number);
    const dayMap: Record<string, string> = {};
    rawAttendance.forEach(r => { dayMap[r.attendance_date] = r.status; });
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const firstWeekday = new Date(yr, mo-1, 1).getDay();

    const daysHTML = [];
    for (let i = 0; i < firstWeekday; i++) {
      daysHTML.push('<div></div>');
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${yr}-${String(mo).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const dow = new Date(yr, mo-1, day).getDay();
      let statusClass = '';
      if (dayMap[dateStr]) {
        const s = dayMap[dateStr];
        if (s === 'present') statusClass = 'present';
        else if (s === 'absent') statusClass = 'absent';
        else if (s === 'late') statusClass = 'late';
        else if (s === 'leave') statusClass = 'leave';
      } else if (weeklyOffDays.includes(dow)) {
        statusClass = 'off';
      }
      daysHTML.push(`<div class="day-cell ${statusClass}">${day}</div>`);
    }
    const total = a.present + a.absent + a.late + a.leave;
    const pct = total > 0 ? Math.round((a.present / total) * 100) : 0;

    return `
      <div class="month-card">
        <div class="month-header">
          <span class="month-name">${MONTH_NAMES[mo-1]} ${yr}</span>
          <div class="month-stats">
            <span class="stat-present">P:${a.present}</span>
            <span class="stat-absent">A:${a.absent}</span>
            <span class="stat-late">L:${a.late}</span>
            <span class="stat-leave">Lv:${a.leave}</span>
            <span class="stat-percent ${pct>=75?'good':'bad'}">${pct}%</span>
          </div>
        </div>
        <div class="weekdays">
          ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div>${d}</div>`).join('')}
        </div>
        <div class="days-grid">${daysHTML.join('')}</div>
      </div>
    `;
  }).join('');

  const logoHtml = schoolLogo 
    ? `<img src="${schoolLogo}" class="school-logo" />`
    : `<div class="school-logo-placeholder"></div>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Attendance Record — ${student.full_name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: white; padding: 20px; }
        @media print { body { padding: 0; } @page { size: A4; margin: 10mm; } .no-print { display: none; } }
        
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #1d4ed8; padding-bottom: 15px; margin-bottom: 20px; }
        .school-logo { width: 60px; height: 60px; border-radius: 50%; object-fit: cover; margin-bottom: 8px; }
        .school-logo-placeholder { width: 60px; height: 60px; background: #1d4ed8; border-radius: 50%; margin: 0 auto 8px; }
        .school-name { font-size: 20px; font-weight: 800; color: #0f172a; }
        .student-info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; background: #f8fafc; border-radius: 12px; padding: 12px 16px; border: 1px solid #e2e8f0; flex: 1; }
        .student-info-row { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
        .info-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
        .info-value { font-size: 13px; font-weight: 600; color: #1e293b; margin-top: 2px; }
        .summary-bar { display: flex; justify-content: space-between; align-items: center; background: ${attPct>=75?'#d1fae5':'#fee2e2'}; border-radius: 12px; padding: 12px 20px; margin-bottom: 20px; }
        .summary-stats { display: flex; gap: 24px; }
        .stat-item { text-align: center; }
        .stat-number { font-size: 20px; font-weight: 700; }
        .stat-label { font-size: 11px; color: #64748b; }
        .overall-percent { font-size: 28px; font-weight: 700; color: ${attPct>=75?'#059669':'#dc2626'}; }
        .legend { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; }
        .legend-color { width: 12px; height: 12px; border-radius: 3px; }
        .month-card { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 20px; break-inside: avoid; }
        .month-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
        .month-name { font-weight: 700; font-size: 14px; color: #1e293b; }
        .month-stats { display: flex; gap: 12px; font-size: 11px; }
        .stat-present { color: #059669; font-weight: 600; }
        .stat-absent { color: #dc2626; font-weight: 600; }
        .stat-late { color: #d97706; font-weight: 600; }
        .stat-leave { color: #3b82f6; font-weight: 600; }
        .stat-percent { font-weight: 700; padding: 2px 8px; border-radius: 20px; }
        .stat-percent.good { background: #d1fae5; color: #059669; }
        .stat-percent.bad { background: #fee2e2; color: #dc2626; }
        .weekdays { display: grid; grid-template-columns: repeat(7, 1fr); background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
        .weekdays div { text-align: center; padding: 6px; font-size: 10px; font-weight: 600; color: #64748b; }
        .days-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; padding: 8px; background: #f8fafc; }
        .day-cell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 500; border-radius: 8px; background: white; border: 1px solid #e2e8f0; }
        .day-cell.present { background: #059669; color: white; border: none; }
        .day-cell.absent { background: #dc2626; color: white; border: none; }
        .day-cell.late { background: #d97706; color: white; border: none; }
        .day-cell.leave { background: #3b82f6; color: white; border: none; }
        .day-cell.off { background: #e2e8f0; color: #94a3b8; border: none; }
        .footer { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          ${logoHtml}
          <div class="school-name">${schoolName}</div>
          <div style="font-size: 10px; color: #64748b; letter-spacing: 2px;">ATTENDANCE RECORD — ${year}</div>
        </div>
        <div class="student-info-row">
          ${studentPhotoHtml(student, 56, 10)}
          <div class="student-info">
            ${[
              ['Student Name', student.full_name],
              ["Father's Name", student.father_name??'—'],
              ['Roll No.', student.roll_number??'—'],
              ['Class', student.current_grade?`Class ${student.current_grade}${student.current_section?`-${student.current_section}`:''}` :'—'],
            ].map(([l,v])=>`<div><div class="info-label">${l}</div><div class="info-value">${v}</div></div>`).join('')}
          </div>
        </div>
        <div class="summary-bar">
          <div class="summary-stats">
            <div class="stat-item"><div class="stat-number" style="color:#059669;">${attTotals.present}</div><div class="stat-label">Present</div></div>
            <div class="stat-item"><div class="stat-number" style="color:#dc2626;">${attTotals.absent}</div><div class="stat-label">Absent</div></div>
            <div class="stat-item"><div class="stat-number" style="color:#d97706;">${attTotals.late}</div><div class="stat-label">Late</div></div>
            <div class="stat-item"><div class="stat-number" style="color:#3b82f6;">${attTotals.leave}</div><div class="stat-label">Leave</div></div>
          </div>
          <div class="overall-percent">${attPct}%</div>
        </div>
        <div class="legend">
          <div class="legend-item"><div class="legend-color" style="background:#059669;"></div><span>Present</span></div>
          <div class="legend-item"><div class="legend-color" style="background:#dc2626;"></div><span>Absent</span></div>
          <div class="legend-item"><div class="legend-color" style="background:#d97706;"></div><span>Late</span></div>
          <div class="legend-item"><div class="legend-color" style="background:#3b82f6;"></div><span>Leave</span></div>
          <div class="legend-item"><div class="legend-color" style="background:#e2e8f0;"></div><span>Weekly Off</span></div>
          <div class="legend-item"><div class="legend-color" style="background:white;border:1px solid #e2e8f0;"></div><span>No Record</span></div>
        </div>
        ${calendarsHTML}
        <div class="footer">Generated on ${new Date().toLocaleDateString('en-PK')} · Campus Core</div>
      </div>
    </body>
    </html>
  `;
  printHTML(html, `Attendance Record — ${student.full_name}`);
}

// ── Print Fee History ────────────────────────────────────────────────────────

function printFeeHistory(student: Student, fees: FeeRecord[], schoolName: string, schoolLogo: string | null, year: number) {
  const totalPaid = fees.filter(f=>f.status==='Paid').reduce((s,f)=>s+(f.amount_paid??0),0);
  const totalPending = fees.filter(f=>f.status!=='Paid').reduce((s,f)=>s+((f.total_amount||0)-(f.amount_paid||0)),0);
  
  const rowsHTML = fees.map(f => `
    <tr>
      <td>${MONTH_NAMES[f.fee_month-1]} ${f.fee_year}</td>
      <td>Rs ${(f.total_amount??0).toLocaleString()}</td>
      <td>Rs ${(f.amount_paid??0).toLocaleString()}</td>
      <td>Rs ${((f.total_amount||0)-(f.amount_paid||0)).toLocaleString()}</td>
      <td><span class="status-badge ${f.status.toLowerCase()}">${f.status}</span></td>
      <td>${f.payment_date ? new Date(f.payment_date).toLocaleDateString('en-PK') : '—'}</td>
    </tr>
  `).join('');

  const logoHtml = schoolLogo 
    ? `<img src="${schoolLogo}" class="school-logo" />`
    : `<div class="school-logo-placeholder"></div>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Fee History — ${student.full_name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: white; padding: 20px; }
        @media print { body { padding: 0; } @page { size: A4; margin: 10mm; } }
        .container { max-width: 1000px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #1d4ed8; padding-bottom: 15px; margin-bottom: 20px; }
        .school-logo { width: 60px; height: 60px; border-radius: 50%; object-fit: cover; margin-bottom: 8px; }
        .school-logo-placeholder { width: 60px; height: 60px; background: #1d4ed8; border-radius: 50%; margin: 0 auto 8px; }
        .school-name { font-size: 20px; font-weight: 800; color: #0f172a; }
        .student-info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; background: #f8fafc; border-radius: 12px; padding: 12px 16px; border: 1px solid #e2e8f0; flex: 1; }
        .student-info-row { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
        .info-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
        .info-value { font-size: 13px; font-weight: 600; color: #1e293b; margin-top: 2px; }
        .summary-cards { display: flex; gap: 16px; margin-bottom: 20px; }
        .summary-card { flex: 1; background: #f8fafc; border-radius: 12px; padding: 12px; text-align: center; border: 1px solid #e2e8f0; }
        .summary-label { font-size: 11px; color: #64748b; }
        .summary-value { font-size: 22px; font-weight: 700; color: #0f172a; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: #f8fafc; font-weight: 700; color: #475569; }
        td:last-child, th:last-child { text-align: center; }
        .status-badge { padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 600; }
        .status-badge.paid { background: #d1fae5; color: #059669; }
        .status-badge.partial { background: #fed7aa; color: #c2410c; }
        .status-badge.unpaid { background: #fee2e2; color: #dc2626; }
        .footer { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          ${logoHtml}
          <div class="school-name">${schoolName}</div>
          <div style="font-size: 10px; color: #64748b; letter-spacing: 2px;">FEE HISTORY — ${year}</div>
        </div>
        <div class="student-info-row">
          ${studentPhotoHtml(student, 56, 10)}
          <div class="student-info">
            ${[
              ['Student Name', student.full_name],
              ["Father's Name", student.father_name??'—'],
              ['Roll No.', student.roll_number??'—'],
              ['Class', student.current_grade?`Class ${student.current_grade}${student.current_section?`-${student.current_section}`:''}` :'—'],
            ].map(([l,v])=>`<div><div class="info-label">${l}</div><div class="info-value">${v}</div></div>`).join('')}
          </div>
        </div>
        <div class="summary-cards">
          <div class="summary-card"><div class="summary-label">Total Paid</div><div class="summary-value" style="color:#059669;">Rs ${totalPaid.toLocaleString()}</div></div>
          <div class="summary-card"><div class="summary-label">Total Pending</div><div class="summary-value" style="color:#dc2626;">Rs ${totalPending.toLocaleString()}</div></div>
          <div class="summary-card"><div class="summary-label">Total Fees</div><div class="summary-value">Rs ${(totalPaid+totalPending).toLocaleString()}</div></div>
        </div>
        <table>
          <thead><tr><th>Month/Year</th><th>Total</th><th>Paid</th><th>Pending</th><th>Status</th><th>Payment Date</th></tr></thead>
          <tbody>${rowsHTML}</tbody>
        </table>
        <div class="footer">Generated on ${new Date().toLocaleDateString('en-PK')} · Campus Core</div>
      </div>
    </body>
    </html>
  `;
  printHTML(html, `Fee History — ${student.full_name}`);
}

// ── Print Full Student Record ────────────────────────────────────────────────

function printFullRecord(student: Student, fees: FeeRecord[], attendance: AttendanceSummary[], rawAttendance: AttendanceRecord[], weeklyOffDays: number[], examResults: Result[], schoolName: string, schoolLogo: string | null, year: number) {
  // Fee totals
  const totalPaid = fees.filter(f=>f.status==='Paid').reduce((s,f)=>s+(f.amount_paid??0),0);
  const totalPending = fees.filter(f=>f.status!=='Paid').reduce((s,f)=>s+((f.total_amount||0)-(f.amount_paid||0)),0);
  
  // Fee table HTML
  const feeRowsHTML = fees.map(f => `
    <tr><td>${MONTH_NAMES[f.fee_month-1]} ${f.fee_year}</td><td>Rs ${(f.total_amount??0).toLocaleString()}</td><td>Rs ${(f.amount_paid??0).toLocaleString()}</td><td>Rs ${((f.total_amount||0)-(f.amount_paid||0)).toLocaleString()}</td><td class="status-${f.status.toLowerCase()}">${f.status}</td><td>${f.payment_date ? new Date(f.payment_date).toLocaleDateString('en-PK') : '—'}</td></tr>
  `).join('');

  // Attendance totals
  const attTotals = attendance.reduce((a,r)=>({ present:a.present+r.present, absent:a.absent+r.absent, late:a.late+r.late, leave:a.leave+r.leave }),{present:0,absent:0,late:0,leave:0});
  const attTotal = attTotals.present+attTotals.absent+attTotals.late+attTotals.leave;
  const attPct = attTotal>0 ? Math.round((attTotals.present/attTotal)*100) : 0;

  // Results groups
  const examMap: Record<string, { label: string; rows: Result[]; sortOrder: number }> = {};
  examResults.forEach(r => {
    const key = r.exam_type === 'monthly' ? `monthly-${r.exam_month??0}` : r.exam_type;
    if (!examMap[key]) {
      let label = '', sortOrder = 0;
      if (key.startsWith('monthly-')) { const m=Number(key.split('-')[1]); label=`Monthly — ${MONTH_NAMES[m-1]??''}`; sortOrder=m; }
      else if (key==='midterm') { label='Midterm Exam'; sortOrder=50; }
      else if (key==='annual') { label='Annual Exam'; sortOrder=99; }
      else { label=r.exam_type; sortOrder=60; }
      examMap[key] = { label, rows:[], sortOrder };
    }
    examMap[key].rows.push(r);
  });
  const examGroups = Object.entries(examMap).sort(([,a],[,b])=>a.sortOrder-b.sortOrder);
  
  const resultsHTML = examGroups.map(([,{ label, rows }]) => {
    const totObt = rows.reduce((s,r)=>s+(r.obtained_marks??0),0);
    const totMrk = rows.reduce((s,r)=>s+(r.total_marks??0),0);
    const pct = totMrk>0?Math.round((totObt/totMrk)*100):0;
    const pass = rows.every(r=>r.pass_fail==='pass');
    const subjectRows = rows.map(r => {
      const sp = r.total_marks>0?Math.round((r.obtained_marks/r.total_marks)*100):0;
      return `<tr><td>${r.subject_name}</td><td>${r.obtained_marks}</td><td>${r.total_marks}</td><td>${sp}%</td><td>${r.grade??'—'}</td><td class="result-${r.pass_fail}">${r.pass_fail?.toUpperCase()}</td></tr>`;
    }).join('');
    return `
      <div class="exam-group">
        <div class="exam-header">
          <span>${label}</span>
          <div class="exam-stats">${totObt}/${totMrk} (${pct}%) <span class="result-badge ${pass?'pass':'fail'}">${pass?'PASS':'FAIL'}</span></div>
        </div>
        <table class="results-table"><thead><tr><th>Subject</th><th>Obtained</th><th>Total</th><th>%</th><th>Grade</th><th>Result</th></tr></thead><tbody>${subjectRows}</tbody>
        <tfoot><tr><td colspan="2"><strong>Total</strong></td><td><strong>${totMrk}</strong></td><td colspan="3"><strong>${pct}% ${pass?'PASS':'FAIL'}</strong></td></tr></tfoot></table>
      </div>
    `;
  }).join('');

  const logoHtml = schoolLogo 
    ? `<img src="${schoolLogo}" class="school-logo" />`
    : `<div class="school-logo-placeholder"></div>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Full Record — ${student.full_name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: white; padding: 20px; }
        @media print { body { padding: 0; } @page { size: A4; margin: 10mm; } }
        .container { max-width: 1100px; margin: 0 auto; }
        .section { margin-bottom: 25px; page-break-inside: avoid; }
        .section-title { font-size: 16px; font-weight: 700; color: #1d4ed8; border-bottom: 2px solid #1d4ed8; padding-bottom: 6px; margin-bottom: 15px; }
        .header { text-align: center; border-bottom: 2px solid #1d4ed8; padding-bottom: 15px; margin-bottom: 20px; }
        .school-logo { width: 60px; height: 60px; border-radius: 50%; object-fit: cover; margin-bottom: 8px; }
        .school-logo-placeholder { width: 60px; height: 60px; background: #1d4ed8; border-radius: 50%; margin: 0 auto 8px; }
        .school-name { font-size: 20px; font-weight: 800; color: #0f172a; }
        .student-info { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f8fafc; border-radius: 12px; padding: 12px 16px; border: 1px solid #e2e8f0; flex: 1; }
        .student-info-row { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
        .info-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
        .info-value { font-size: 13px; font-weight: 600; color: #1e293b; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px; }
        th, td { padding: 8px 6px; text-align: left; border: 1px solid #e2e8f0; }
        th { background: #f8fafc; font-weight: 700; color: #475569; }
        td:last-child, th:last-child { text-align: center; }
        .status-paid { color: #059669; font-weight: 600; }
        .status-partial { color: #c2410c; font-weight: 600; }
        .status-unpaid { color: #dc2626; font-weight: 600; }
        .result-pass { color: #059669; font-weight: 600; }
        .result-fail { color: #dc2626; font-weight: 600; }
        .exam-group { border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
        .exam-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: 700; }
        .exam-stats { display: flex; align-items: center; gap: 8px; font-size: 11px; }
        .result-badge { padding: 2px 8px; border-radius: 20px; font-size: 10px; }
        .result-badge.pass { background: #d1fae5; color: #059669; }
        .result-badge.fail { background: #fee2e2; color: #dc2626; }
        .results-table { margin-bottom: 0; }
        .footer { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          ${logoHtml}
          <div class="school-name">${schoolName}</div>
          <div style="font-size: 10px; color: #64748b; letter-spacing: 2px;">FULL STUDENT RECORD — ${year}</div>
        </div>
        
        <div class="student-info-row">
          ${studentPhotoHtml(student, 64, 12)}
          <div class="student-info">
            ${[
              ['Student Name', student.full_name],
              ["Father's Name", student.father_name??'—'],
              ['Roll No.', student.roll_number??'—'],
              ['Class', student.current_grade?`Class ${student.current_grade}${student.current_section?`-${student.current_section}`:''}` :'—'],
              ['Date of Birth', student.date_of_birth||'—'],
              ['Admission Date', student.admission_date||'—'],
              ['Status', student.status||'Active'],
              ['Phone', student.phone||'—'],
            ].map(([l,v])=>`<div><div class="info-label">${l}</div><div class="info-value">${v}</div></div>`).join('')}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Fee History</div>
          <div style="display: flex; gap: 12px; margin-bottom: 12px;">
            <div style="background:#d1fae5; padding:8px 12px; border-radius:8px;"><span style="font-size:11px;">Total Paid</span><br/><strong style="color:#059669;">Rs ${totalPaid.toLocaleString()}</strong></div>
            <div style="background:#fee2e2; padding:8px 12px; border-radius:8px;"><span style="font-size:11px;">Pending</span><br/><strong style="color:#dc2626;">Rs ${totalPending.toLocaleString()}</strong></div>
          </div>
          <table>
            <thead><tr><th>Month/Year</th><th>Total</th><th>Paid</th><th>Pending</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>${feeRowsHTML || '<tr><td colspan="6">No fee records</td></tr>'}</tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Attendance Summary</div>
          <div style="display: flex; gap: 16px; margin-bottom: 12px;">
            <div><strong style="color:#059669;">Present:</strong> ${attTotals.present}</div>
            <div><strong style="color:#dc2626;">Absent:</strong> ${attTotals.absent}</div>
            <div><strong style="color:#d97706;">Late:</strong> ${attTotals.late}</div>
            <div><strong style="color:#3b82f6;">Leave:</strong> ${attTotals.leave}</div>
            <div><strong>Overall:</strong> ${attPct}%</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Exam Results</div>
          ${resultsHTML || '<p>No results found</p>'}
        </div>

        <div class="footer">Generated on ${new Date().toLocaleDateString('en-PK')} · Campus Core</div>
      </div>
    </body>
    </html>
  `;
  printHTML(html, `Full Record — ${student.full_name}`);
}

// ── Print Profile (personal + academic info only) ──────────────────────────────

function printProfile(student: Student, schoolName: string, schoolLogo: string | null) {
  const logoHtml = schoolLogo
    ? `<img src="${schoolLogo}" class="school-logo" />`
    : `<div class="school-logo-placeholder"></div>`;

  const personalFields: [string, string][] = [
    ['Full Name', student.full_name || '—'],
    ["Father's Name", student.father_name || '—'],
    ['Date of Birth', student.date_of_birth || '—'],
    ['CNIC / B-Form', student.cnic || '—'],
    ['Phone', student.phone || '—'],
    ["Father's Phone", student.father_phone || '—'],
    ['Address', student.address || '—'],
  ];

  const academicFields: [string, string][] = [
    ['Roll Number', student.roll_number || '—'],
    ['Class', student.current_grade ? `Class ${student.current_grade}${student.current_section ? `-${student.current_section}` : ''}` : '—'],
    ['Admission Date', student.admission_date || '—'],
    ['Status', student.status ? student.status.charAt(0).toUpperCase() + student.status.slice(1) : 'Active'],
  ];

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Student Profile — ${student.full_name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: white; padding: 20px; }
        @media print { body { padding: 0; } @page { size: A4; margin: 10mm; } }
        .container { max-width: 800px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #1d4ed8; padding-bottom: 15px; margin-bottom: 24px; }
        .school-logo { width: 60px; height: 60px; border-radius: 50%; object-fit: cover; margin-bottom: 8px; }
        .school-logo-placeholder { width: 60px; height: 60px; background: #1d4ed8; border-radius: 50%; margin: 0 auto 8px; }
        .school-name { font-size: 20px; font-weight: 800; color: #0f172a; }
        .profile-banner { display: flex; align-items: center; gap: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 22px; margin-bottom: 24px; }
        .name-block .name { font-size: 20px; font-weight: 800; color: #0f172a; }
        .name-block .meta { font-size: 12px; color: #64748b; margin-top: 4px; }
        .section-title { font-size: 13px; font-weight: 700; color: #1d4ed8; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #1d4ed8; padding-bottom: 6px; margin-bottom: 14px; }
        .section { margin-bottom: 24px; }
        .field-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
        .field-grid .full { grid-column: 1 / -1; }
        .info-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
        .info-value { font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 3px; }
        .footer { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          ${logoHtml}
          <div class="school-name">${schoolName}</div>
          <div style="font-size: 10px; color: #64748b; letter-spacing: 2px;">STUDENT PROFILE</div>
        </div>

        <div class="profile-banner">
          ${studentPhotoHtml(student, 84, 14)}
          <div class="name-block">
            <div class="name">${student.full_name}</div>
            <div class="meta">
              ${student.current_grade ? `Class ${student.current_grade}${student.current_section ? `-${student.current_section}` : ''}` : ''}
              ${student.roll_number ? ` · Roll# ${student.roll_number}` : ''}
              ${student.status ? ` · ${student.status.charAt(0).toUpperCase() + student.status.slice(1)}` : ''}
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Personal Information</div>
          <div class="field-grid">
            ${personalFields.map(([l,v])=>`<div class="${l==='Address'?'full':''}"><div class="info-label">${l}</div><div class="info-value">${v}</div></div>`).join('')}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Academic Information</div>
          <div class="field-grid">
            ${academicFields.map(([l,v])=>`<div><div class="info-label">${l}</div><div class="info-value">${v}</div></div>`).join('')}
          </div>
        </div>

        <div class="footer">Generated on ${new Date().toLocaleDateString('en-PK')} · Campus Core</div>
      </div>
    </body>
    </html>
  `;
  printHTML(html, `Student Profile — ${student.full_name}`);
}

// ── Certificate Tab — full 11-type generator with auto-fill ───────────────────

// Fields always auto-filled from student record — never shown in manual form
const AUTO_FILL_KEYS = new Set([
  'student_name', 'father_name', 'roll_number', 'class', 'date_of_birth',
]);

function buildAutoFill(student: Student, typeId: CertificateTypeId): CertificateData {
  const classLabel = student.current_grade
    ? `Class ${student.current_grade}${student.current_section ? `-${student.current_section}` : ''}`
    : '';
  return {
    student_name:       student.full_name ?? '',
    father_name:        student.father_name ?? '',
    roll_number:        student.roll_number ?? '',
    class:              classLabel,
    date_of_birth:      student.date_of_birth ?? '',
    issue_date:         todayString(),
    certificate_number: generateCertificateNumber(typeId),
  };
}

function CertificateTab({ student, schoolName }: { student: Student; schoolName: string }) {
  const { settings } = useSchool();

  const schoolSettings = {
    school_name:    (settings as any)?.school_name ?? schoolName,
    principal_name: (settings as any)?.principal_name ?? '',
    logo_url:       (settings as any)?.logo_url ?? null,
  };

  const [step, setStep]               = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState<CertificateTypeId | null>(null);
  const [formData, setFormData]       = useState<CertificateData>({});
  const [pdfLoading, setPdfLoading]   = useState(false);
  const [pdfDone, setPdfDone]         = useState(false);
  const certRef = useRef<HTMLDivElement>(null);

  function handleSelectType(id: CertificateTypeId) {
    setSelectedType(id);
    const def = CERTIFICATE_DEFINITIONS.find((d: { id: CertificateTypeId }) => d.id === id)!;
    const auto = buildAutoFill(student, id);
    const initial: CertificateData = {};
    def.fields.forEach((f: { key: string }) => { initial[f.key] = auto[f.key] ?? ''; });
    setFormData(initial);
    setStep(2);
    setPdfDone(false);
  }

  function handleFieldChange(key: string, value: string) {
    setFormData((prev: CertificateData) => ({ ...prev, [key]: value }));
  }

  async function handleDownloadPDF() {
    if (!certRef.current || !selectedType) return;
    setPdfLoading(true);
    try {
      const canvas = await html2canvas(certRef.current, {
        scale: 2, useCORS: true, backgroundColor: '#FEFCF3', logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
      const def = CERTIFICATE_DEFINITIONS.find((d: { id: CertificateTypeId }) => d.id === selectedType)!;
      const name = (student.full_name || 'certificate').replace(/\s+/g, '_');
      const date = (formData.issue_date || todayString()).replace(/-/g, '');
      pdf.save(`${def.title.replace(/[\s/]+/g, '_')}_${name}_${date}.pdf`);
      setPdfDone(true);
    } catch (e) {
      console.error(e);
      alert('PDF generation failed. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  }

  function handleReset() {
    setStep(1); setSelectedType(null); setFormData({}); setPdfDone(false);
  }

  const def = selectedType
    ? CERTIFICATE_DEFINITIONS.find((d: { id: CertificateTypeId }) => d.id === selectedType)
    : null;

  const manualFields = def
    ? def.fields.filter((f: { key: string }) =>
        !AUTO_FILL_KEYS.has(f.key) && f.key !== 'certificate_number' && f.key !== 'issue_date')
    : [];

  return (
    <div className="p-4 sm:p-6">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          {step === 1 ? 'Certificate Generator' : step === 2 ? 'Fill Details' : 'Preview & Download'}
        </h3>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map(n => (
            <div key={n} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              n < step ? 'bg-amber-500 text-white' : n === step ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
            }`}>{n < step ? '✓' : n}</div>
          ))}
        </div>
      </div>

      {/* STEP 1 — choose type */}
      {step === 1 && (
        <div>
          <p className="text-sm text-slate-500 mb-4">
            Select a certificate type for <strong className="text-slate-700">{student.full_name}</strong>.
            Student details are filled automatically.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {CERTIFICATE_DEFINITIONS.map((d: { id: CertificateTypeId; icon: string; title: string }) => (
              <button key={d.id} onClick={() => handleSelectType(d.id)}
                className="flex flex-col items-center gap-2 p-3 border-2 border-slate-200 rounded-xl hover:border-amber-400 hover:bg-amber-50 transition-all text-center group">
                <span className="text-2xl">{d.icon}</span>
                <span className="text-xs font-semibold text-slate-600 group-hover:text-amber-700 leading-tight">{d.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2 — manual fields + live preview */}
      {step === 2 && def && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-800">
              <p className="font-semibold mb-0.5">Auto-filled from student record</p>
              <p className="text-emerald-600">Name, father's name, roll number, class{student.date_of_birth ? ', date of birth' : ''} — no need to type these.</p>
            </div>
          </div>

          {manualFields.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Additional Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {manualFields.map((field: { key: string; label: string; type: string; placeholder?: string; required?: boolean }) => (
                  <div key={field.key} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea value={formData[field.key] ?? ''} onChange={e => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder} rows={3}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none" />
                    ) : (
                      <input type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                        value={formData[field.key] ?? ''} onChange={e => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder} min={field.type === 'number' ? 1 : undefined}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Issue Date</label>
              <input type="date" value={formData.issue_date ?? ''} onChange={e => handleFieldChange('issue_date', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Certificate Number</label>
              <input value={formData.certificate_number ?? ''} onChange={e => handleFieldChange('certificate_number', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono text-xs" />
            </div>
          </div>

          {/* Live preview */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Live Preview</p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
              <div style={{ transform:'scale(0.5)', transformOrigin:'top left', width:'1100px', height:'778px', marginBottom:'-389px' }}>
                <CertificatePreview typeId={selectedType!} data={formData} settings={schoolSettings} />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => setStep(1)} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">← Back</button>
            <button onClick={() => setStep(3)} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">Continue →</button>
          </div>
        </div>
      )}

      {/* STEP 3 — full preview + download */}
      {step === 3 && def && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setStep(2)} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">← Edit</button>
            <button onClick={handleDownloadPDF} disabled={pdfLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium disabled:opacity-60">
              {pdfLoading ? '⏳ Generating...' : pdfDone ? '✓ Downloaded!' : '⬇ Download PDF'}
            </button>
            <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
              + New Certificate
            </button>
          </div>

          {pdfDone && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium">
              <CheckCircle className="w-4 h-4" /> Certificate PDF downloaded successfully!
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
            <div style={{ transform:'scale(0.62)', transformOrigin:'top left', width:'1100px', height:'778px', marginBottom:'-296px' }}>
              <CertificatePreview ref={certRef} typeId={selectedType!} data={formData} settings={schoolSettings} />
            </div>
          </div>
        </div>
      )}
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

  // Face ID (reference photo for face-match attendance)
  const faceIdInputRef = useRef<HTMLInputElement>(null);
  const [faceIdUploading, setFaceIdUploading] = useState(false);
  const [faceIdMessage, setFaceIdMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Attendance QR
  const [regeneratingToken, setRegeneratingToken] = useState(false);
  const [qrMessage, setQrMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [generatingAccessCode, setGeneratingAccessCode] = useState(false);
  const [accessCodeMessage, setAccessCodeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSummary[]>([]);
  const [rawAttendance, setRawAttendance] = useState<AttendanceRecord[]>([]);
  const [weeklyOffDays, setWeeklyOffDays] = useState<number[]>([]);
  const [examResults, setExamResults] = useState<Result[]>([]);
  const [documents, setDocuments] = useState<StudentDoc[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  const [docUploading, setDocUploading] = useState(false);
  const [docName, setDocName] = useState('');
  const [docCategory, setDocCategory] = useState('General');
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [docError, setDocError] = useState('');
  const docFileRef = useRef<HTMLInputElement>(null);

  // Receipt state
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  // Roll number generation state
  const [generatingRoll, setGeneratingRoll] = useState(false);

  // Print state — true while fetching fresh data before printing
  const [printing, setPrinting] = useState(false);

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

  async function fetchFeesData(year: number) {
    const { data } = await supabase.from('fee_records')
      .select('id, fee_month, fee_year, total_amount, amount_paid, status, payment_date, payment_method')
      .eq('student_id', selectedStudent!.id).eq('fee_year', year)
      .order('fee_month', { ascending: false });
    return data ?? [];
  }

  async function fetchAttendanceData(year: number) {
    const [attRes, settRes] = await Promise.all([
      supabase.from('attendance_records')
        .select('attendance_date, status')
        .eq('student_id', selectedStudent!.id)
        .gte('attendance_date', `${year}-01-01`)
        .lte('attendance_date', `${year}-12-31`),
      supabase.from('school_settings')
        .select('weekly_off_days')
        .eq('school_id', schoolId)
        .single(),
    ]);
    const raw: AttendanceRecord[] = attRes.data ?? [];
    const offDays = (settRes.data as { weekly_off_days?: number[] } | null)?.weekly_off_days ?? [];

    const map: Record<string, AttendanceSummary> = {};
    raw.forEach(r => {
      const d = new Date(r.attendance_date);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (!map[key]) map[key] = { month: key, present:0, absent:0, late:0, leave:0 };
      if (r.status==='present') map[key].present++;
      else if (r.status==='absent') map[key].absent++;
      else if (r.status==='late') map[key].late++;
      else if (r.status==='leave') map[key].leave++;
    });
    const summary = Object.values(map).sort((a,b) => a.month.localeCompare(b.month));
    return { raw, summary, offDays };
  }

  async function fetchResultsData(year: number) {
    const { data } = await supabase.from('student_results')
      .select('id, exam_type, subject_name, obtained_marks, total_marks, pass_fail, exam_year, exam_month, grade')
      .eq('student_id', selectedStudent!.id).eq('exam_year', year);
    if (!data) return [];
    const seen = new Set<string>();
    return data.filter(r => {
      const k = `${r.exam_type}-${r.exam_year}-${r.exam_month??0}-${r.subject_name}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  // Groups a results array into the same exam-type buckets used for display/printing
  function buildExamGroups(results: Result[]) {
    type ExamGroupLocal = { label: string; rows: Result[]; sortOrder: number };
    const map: Record<string, ExamGroupLocal> = {};
    results.forEach(r => {
      const key = r.exam_type === 'monthly' ? `monthly-${r.exam_month??0}` : r.exam_type;
      if (!map[key]) {
        let label = '', sortOrder = 0;
        if (key.startsWith('monthly-')) { const m=Number(key.split('-')[1]); label=`Monthly — ${MONTH_NAMES[m-1]??''}`; sortOrder=m; }
        else if (key==='midterm') { label='Midterm Exam'; sortOrder=50; }
        else if (key==='annual') { label='Annual Exam'; sortOrder=99; }
        else { label=key.charAt(0).toUpperCase()+key.slice(1); sortOrder=60; }
        map[key] = { label, rows:[], sortOrder };
      }
      map[key].rows.push(r);
    });
    return Object.entries(map).sort(([,a],[,b])=>a.sortOrder-b.sortOrder);
  }

  useEffect(() => {
    if (!selectedStudent || activeTab === 'profile' || activeTab === 'certificate'
        || activeTab === 'attendance_qr' || activeTab === 'face_id' || activeTab === 'parent_access') return;
    setTabLoading(true);

    if (activeTab === 'fees') {
      fetchFeesData(selectedYear).then(data => { setFees(data); setTabLoading(false); });

    } else if (activeTab === 'attendance') {
      fetchAttendanceData(selectedYear).then(({ raw, summary, offDays }) => {
        setRawAttendance(raw);
        setWeeklyOffDays(offDays);
        setAttendance(summary);
        setTabLoading(false);
      });

    } else if (activeTab === 'results') {
      fetchResultsData(selectedYear).then(data => { setExamResults(data); setTabLoading(false); });

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

  // ── Attendance QR — regenerate token ──────────────────────────────────────────

  async function handleRegenerateToken() {
    if (!selectedStudent || !schoolId) return;
    setRegeneratingToken(true);
    setQrMessage(null);
    try {
      const newToken = `att_${selectedStudent.id}_${Math.floor(Math.random() * 100000)}`;
      const { error } = await supabase
        .from('students')
        .update({ attendance_token: newToken })
        .eq('id', selectedStudent.id);
      if (error) throw error;
      setSelectedStudent(prev => prev ? { ...prev, attendance_token: newToken } : prev);
      setQrMessage({ type: 'success', text: 'QR code regenerated. The old code is now invalid.' });
    } catch (err: any) {
      setQrMessage({ type: 'error', text: 'Failed to regenerate token: ' + (err.message ?? 'Unknown error') });
    } finally {
      setRegeneratingToken(false);
    }
  }

  // ── Parent Access Code — generate/regenerate ──────────────────────────────────
  // 6-digit numeric PIN — easier for parents to remember and type than a mixed
  // alphanumeric code, same mental model as a SIM/ATM PIN.

  function generateRandomAccessCode(): string {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    return code;
  }

  function formatAccessCode(code: string): string {
    // Display as "482 915" for readability — stored value stays plain digits.
    return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
  }

  async function handleGenerateAccessCode() {
    if (!selectedStudent || !schoolId) return;
    setGeneratingAccessCode(true);
    setAccessCodeMessage(null);
    try {
      const newCode = generateRandomAccessCode();
      const { error } = await supabase
        .from('students')
        .update({
          parent_access_code: newCode,
          parent_code_sent: true,
          parent_code_sent_at: new Date().toISOString(),
        })
        .eq('id', selectedStudent.id);
      if (error) throw error;
      setSelectedStudent(prev => prev ? { ...prev, parent_access_code: newCode, parent_code_sent: true } : prev);
      setAccessCodeMessage({ type: 'success', text: 'Access code generated. Hand this to the parent — the old code (if any) is now invalid.' });
    } catch (err: any) {
      setAccessCodeMessage({ type: 'error', text: 'Failed to generate code: ' + (err.message ?? 'Unknown error') });
    } finally {
      setGeneratingAccessCode(false);
    }
  }

  function printAccessCodeSlip() {
    if (!selectedStudent?.parent_access_code) return;
    const win = window.open('', '_blank', 'width=420,height=320');
    if (!win) return;
    win.document.write(`
      <html>
        <head><title>Parent Access Slip</title></head>
        <body style="font-family: system-ui, sans-serif; padding: 32px; text-align: center;">
          <p style="font-size: 13px; color: #666; margin: 0 0 4px;">Parent Portal Access</p>
          <h2 style="margin: 0 0 16px; font-size: 18px;">${selectedStudent.full_name}${selectedStudent.roll_number ? ` · Roll No. ${selectedStudent.roll_number}` : ''}</h2>
          <div style="font-size: 28px; font-weight: 700; letter-spacing: 4px; padding: 16px; border: 2px dashed #999; border-radius: 8px; margin-bottom: 16px;">
            ${formatAccessCode(selectedStudent.parent_access_code)}
          </div>
          <p style="font-size: 12px; color: #888;">
            Enter your father's phone number on file and this code at the parent login page.
          </p>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  // ── Face ID — reference photo upload (used for face-match attendance) ────────

  async function handleFaceIdUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedStudent || !schoolId) return;
    if (!file.type.startsWith('image/')) { setFaceIdMessage({ type: 'error', text: 'Please select an image file.' }); return; }
    setFaceIdUploading(true);
    setFaceIdMessage(null);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${schoolId}/${selectedStudent.id}/face-id.${ext}`;
      const { error: upErr } = await supabase.storage.from('student-photos').upload(path, file, { upsert:true, contentType:file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('student-photos').getPublicUrl(path);
      const reference_photo_url = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: dbErr } = await supabase.from('students').update({ reference_photo_url }).eq('id', selectedStudent.id);
      if (dbErr) throw dbErr;
      setSelectedStudent(prev => prev ? { ...prev, reference_photo_url } : prev);
      setFaceIdMessage({ type: 'success', text: 'Reference photo saved for face-match attendance.' });
    } catch (err: any) {
      setFaceIdMessage({ type: 'error', text: 'Upload failed: ' + (err.message ?? 'Make sure bucket is public.') });
    } finally {
      setFaceIdUploading(false);
      if (faceIdInputRef.current) faceIdInputRef.current.value = '';
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

  // ── Receipt generation for fee record ───────────────────────────────────────

  async function generateReceiptForFee(fee: FeeRecord) {
    if (!selectedStudent) return;

    const { data: schoolSettings } = await supabase
      .from('school_settings')
      .select('school_name, address, phone, email, logo_url, principal_name')
      .eq('school_id', schoolId)
      .single();

    const { data: previousFees } = await supabase
      .from('fee_records')
      .select('total_amount, amount_paid, status')
      .eq('student_id', selectedStudent.id)
      .eq('fee_year', fee.fee_year)
      .lt('fee_month', fee.fee_month);

    let previousBalance = 0;
    if (previousFees) {
      for (const pf of previousFees) {
        if (pf.status !== 'Paid') {
          previousBalance += (pf.total_amount || 0) - (pf.amount_paid || 0);
        }
      }
    }

    const totalAmount = fee.total_amount || 0;
    const amountPaid = fee.amount_paid || totalAmount;
    const remaining = (totalAmount + previousBalance) - amountPaid;

    const year = fee.fee_year.toString().slice(-2);
    const month = fee.fee_month.toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const receiptNumber = `RCT-${year}${month}-${random}`;

    setReceiptData({
      receiptNumber,
      schoolName: schoolSettings?.school_name || '',
      schoolLogo: schoolSettings?.logo_url || null,
      schoolAddress: schoolSettings?.address || '',
      schoolPhone: schoolSettings?.phone || '',
      schoolEmail: schoolSettings?.email || '',
      studentName: selectedStudent.full_name,
      rollNumber: selectedStudent.roll_number || '',
      className: `${selectedStudent.current_grade || ''}${selectedStudent.current_section || ''}`,
      fatherName: selectedStudent.father_name || '',
      feeMonth: fee.fee_month,
      feeYear: fee.fee_year,
      totalAmount: totalAmount,
      amountPaid: amountPaid,
      previousBalance: previousBalance,
      remainingBalance: remaining < 0 ? 0 : remaining,
      paymentDate: fee.payment_date || new Date().toISOString().split('T')[0],
      paymentMethod: fee.payment_method || 'Cash',
      receivedBy: schoolSettings?.principal_name || 'Principal',
    });

    setShowReceipt(true);
  }

  // ── Roll number update when grade/section changes ───────────────────────────

  async function handleGradeSectionChange(grade: number, section: string) {
    if (!selectedStudent || !schoolId) return;
    
    const oldGrade = editData.current_grade || selectedStudent.current_grade;
    const oldSection = editData.current_section || selectedStudent.current_section;
    
    if (oldGrade === grade && oldSection === section) return;
    
    setGeneratingRoll(true);
    const newRollNumber = await getNextRollNumber(schoolId, grade, section);
    
    if (newRollNumber) {
      setEditData(prev => ({
        ...prev,
        current_grade: grade,
        current_section: section,
        roll_number: newRollNumber,
      }));
    } else {
      setEditData(prev => ({
        ...prev,
        current_grade: grade,
        current_section: section,
      }));
    }
    setGeneratingRoll(false);
  }

  // ── Manual roll number change with duplicate check ─────────────────────────

  async function handleRollNumberChange(rollNumber: string) {
    if (!rollNumber.trim()) {
      setEditData(prev => ({ ...prev, roll_number: rollNumber }));
      return;
    }
    
    const duplicate = searchResults.find(s => 
      s.roll_number === rollNumber && s.id !== selectedStudent?.id
    );
    
    if (duplicate) {
      alert(`Roll number "${rollNumber}" already exists for student: ${duplicate.full_name}. Please use a different roll number.`);
      return;
    }
    
    setEditData(prev => ({ ...prev, roll_number: rollNumber }));
  }

  // ── Edit ──────────────────────────────────────────────────────────────────────

  function startEdit() { setEditData({ ...selectedStudent }); setEditing(true); }
  function cancelEdit() { setEditing(false); setEditData({}); }
  function handleFieldChange(name: string, value: string) { setEditData(prev => ({ ...prev, [name]: value })); }

  // ── Print (context-aware — always fetches fresh data, regardless of which tabs were visited before) ───
  async function handlePrint() {
    if (!selectedStudent) return;
    const logo = settings?.logo_url || null;
    setPrinting(true);
    try {
      if (activeTab === 'fees') {
        const feesData = await fetchFeesData(selectedYear);
        setFees(feesData);
        printFeeHistory(selectedStudent, feesData, schoolName, logo, selectedYear);

      } else if (activeTab === 'attendance') {
        const { raw, summary, offDays } = await fetchAttendanceData(selectedYear);
        setRawAttendance(raw); setWeeklyOffDays(offDays); setAttendance(summary);
        printAttendanceHistory(selectedStudent, summary, raw, offDays, schoolName, logo, selectedYear);

      } else if (activeTab === 'results') {
        const resultsData = await fetchResultsData(selectedYear);
        setExamResults(resultsData);
        printResults(buildExamGroups(resultsData), selectedStudent, schoolName, selectedYear, logo);

      } else {
        printProfile(selectedStudent, schoolName, logo);
      }
    } finally {
      setPrinting(false);
    }
  }

  async function saveEdit() {
    if (!selectedStudent) return;
    setSaving(true);
    
    const duplicate = searchResults.find(s => 
      s.roll_number === editData.roll_number && s.id !== selectedStudent.id
    );
    if (duplicate) {
      alert(`Roll number "${editData.roll_number}" already exists. Please use a different roll number.`);
      setSaving(false);
      return;
    }
    
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
              {activeTab !== 'documents' && activeTab !== 'certificate' && (
                <button onClick={handlePrint} disabled={printing}
                  className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-60">
                  <Printer className="w-4 h-4" /> {printing ? 'Preparing...' : 'Print'}
                </button>
              )}
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
            { id:'profile',      label:'Profile',       icon:User },
            { id:'attendance_qr',label:'Attendance QR', icon:QrCode },
            { id:'parent_access',label:'Parent Access', icon:KeyRound },
            { id:'face_id',      label:'Face ID',       icon:Smile },
            { id:'fees',         label:'Fees',          icon:CreditCard },
            { id:'attendance',   label:'Attendance',    icon:CalendarCheck },
            { id:'results',      label:'Results',       icon:ClipboardList },
            { id:'documents',    label:'Documents',     icon:FileText },
            { id:'certificate',  label:'Certificate',   icon:ScrollText },
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
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Roll Number</label>
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={editData.roll_number || ''} 
                        onChange={e => handleRollNumberChange(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono"
                      />
                      {generatingRoll && <Loader className="w-4 h-4 animate-spin text-slate-400" />}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-700 font-medium">{selectedStudent.roll_number || '—'}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">Format: 5A-001 (Class-Section-Sequence)</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Grade</label>
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <select 
                        value={editData.current_grade || 1} 
                        onChange={e => {
                          const grade = parseInt(e.target.value);
                          const section = editData.current_section || selectedStudent.current_section || 'A';
                          handleGradeSectionChange(grade, section);
                        }}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => (
                          <option key={g} value={g}>Class {g}</option>
                        ))}
                      </select>
                      {generatingRoll && <Loader className="w-4 h-4 animate-spin text-slate-400" />}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-700 font-medium">{selectedStudent.current_grade || '—'}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Section</label>
                  {editing ? (
                    <select 
                      value={editData.current_section || 'A'} 
                      onChange={e => {
                        const section = e.target.value;
                        const grade = editData.current_grade || selectedStudent.current_grade || 1;
                        handleGradeSectionChange(grade, section);
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {['A','B','C','D','E'].map(s => (
                        <option key={s} value={s}>Section {s}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-slate-700 font-medium">{selectedStudent.current_section || '—'}</p>
                  )}
                </div>
                <InfoField label="Admission Date" value={displayData.admission_date} editing={editing} name="admission_date" onChange={handleFieldChange} type="date" />
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

              {/* Print Buttons */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
                <button onClick={() => printFullRecord(selectedStudent, fees, attendance, rawAttendance, weeklyOffDays, examResults, schoolName, settings?.logo_url || null, selectedYear)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Printer className="w-3.5 h-3.5" /> Print Full Record
                </button>
                <button onClick={() => printFeeHistory(selectedStudent, fees, schoolName, settings?.logo_url || null, selectedYear)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Printer className="w-3.5 h-3.5" /> Print Fee History
                </button>
                <button onClick={() => printAttendanceHistory(selectedStudent, attendance, rawAttendance, weeklyOffDays, schoolName, settings?.logo_url || null, selectedYear)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Printer className="w-3.5 h-3.5" /> Print Attendance
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Attendance QR ───────────────────────────────────────────────────── */}
        {activeTab === 'attendance_qr' && (
          <div className="p-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Attendance QR</h3>

            {qrMessage && (
              <div className={`mb-4 p-3 rounded-xl text-sm font-medium flex items-center justify-between ${
                qrMessage.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {qrMessage.text}
                <button onClick={() => setQrMessage(null)}><X className="w-4 h-4" /></button>
              </div>
            )}

            <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-xl border-2 border-dashed border-slate-200 max-w-sm mx-auto">
              <div className="text-center">
                <p className="font-bold text-slate-800">{selectedStudent.full_name}</p>
                <p className="text-sm text-slate-500">
                  {selectedStudent.roll_number ? `Roll No: ${selectedStudent.roll_number}` : ''}
                  {selectedStudent.current_grade ? ` · Class: ${selectedStudent.current_grade}${selectedStudent.current_section ?? ''}` : ''}
                </p>
              </div>

              {selectedStudent.attendance_token ? (
                <QRCode
                  value={`https://campuscore.app/attendance/scan?token=${selectedStudent.attendance_token}`}
                  size={160}
                />
              ) : (
                <div className="w-40 h-40 bg-slate-100 rounded flex items-center justify-center text-slate-400 text-sm text-center px-4">
                  No QR generated yet
                </div>
              )}

              <button onClick={handleRegenerateToken} disabled={regeneratingToken}
                className="flex items-center gap-2 px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60">
                {regeneratingToken
                  ? <><Loader className="w-4 h-4 animate-spin" /> Regenerating...</>
                  : <><RefreshCw className="w-4 h-4" /> Regenerate QR</>}
              </button>
              <p className="text-xs text-slate-400 text-center">
                Regenerating invalidates the old code immediately. The school places this QR on the student's physical ID card using its own design process — this app only generates the value.
              </p>
            </div>
          </div>
        )}

        {/* ── Parent Access Code ──────────────────────────────────────────────── */}
        {activeTab === 'parent_access' && (
          <div className="p-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Parent Access Code</h3>

            {accessCodeMessage && (
              <div className={`mb-4 p-3 rounded-xl text-sm font-medium flex items-center justify-between ${
                accessCodeMessage.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {accessCodeMessage.text}
                <button onClick={() => setAccessCodeMessage(null)}><X className="w-4 h-4" /></button>
              </div>
            )}

            <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-xl border-2 border-dashed border-slate-200 max-w-sm mx-auto">
              <div className="text-center">
                <p className="font-bold text-slate-800">{selectedStudent.full_name}</p>
                <p className="text-sm text-slate-500">
                  {selectedStudent.roll_number ? `Roll No: ${selectedStudent.roll_number}` : ''}
                  {selectedStudent.current_grade ? ` · Class: ${selectedStudent.current_grade}${selectedStudent.current_section ?? ''}` : ''}
                </p>
                {selectedStudent.father_phone && (
                  <p className="text-xs text-slate-400 mt-1">Father's Phone: {selectedStudent.father_phone}</p>
                )}
              </div>

              {selectedStudent.parent_access_code ? (
                <div className="flex items-center gap-2 w-full">
                  <code className="flex-1 text-center rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-xl font-mono tracking-widest text-slate-800">
                    {formatAccessCode(selectedStudent.parent_access_code)}
                  </code>
                  {selectedStudent.parent_code_sent && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                      Issued
                    </span>
                  )}
                </div>
              ) : (
                <div className="w-40 h-16 bg-slate-100 rounded flex items-center justify-center text-slate-400 text-sm text-center px-4">
                  No code generated yet
                </div>
              )}

              <div className="flex gap-2 w-full">
                <button onClick={handleGenerateAccessCode} disabled={generatingAccessCode}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60">
                  {generatingAccessCode
                    ? <><Loader className="w-4 h-4 animate-spin" /> {selectedStudent.parent_access_code ? 'Regenerating...' : 'Generating...'}</>
                    : <><RefreshCw className="w-4 h-4" /> {selectedStudent.parent_access_code ? 'Regenerate' : 'Generate Code'}</>}
                </button>
                {selectedStudent.parent_access_code && (
                  <button onClick={printAccessCodeSlip}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
                    <Printer className="w-4 h-4" /> Print
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-400 text-center">
                Hand this code to the parent in person. They'll log in with their phone number on file ({selectedStudent.father_phone || 'add a phone number first'}) plus this code. Regenerating invalidates the old code immediately.
              </p>
            </div>
          </div>
        )}

        {/* ── Face ID ──────────────────────────────────────────────────────────── */}
        {activeTab === 'face_id' && (
          <div className="p-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Face ID — Reference Photo</h3>

            {faceIdMessage && (
              <div className={`mb-4 p-3 rounded-xl text-sm font-medium flex items-center justify-between ${
                faceIdMessage.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {faceIdMessage.text}
                <button onClick={() => setFaceIdMessage(null)}><X className="w-4 h-4" /></button>
              </div>
            )}

            <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-xl border-2 border-dashed border-slate-200 max-w-sm mx-auto">
              <div className="w-32 h-32 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {selectedStudent.reference_photo_url
                  ? <img src={selectedStudent.reference_photo_url} alt={selectedStudent.full_name} className="w-full h-full object-cover" />
                  : <Smile className="w-10 h-10 text-slate-300" />}
              </div>

              <button onClick={() => faceIdInputRef.current?.click()} disabled={faceIdUploading}
                className="flex items-center gap-2 px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60">
                {faceIdUploading
                  ? <><Loader className="w-4 h-4 animate-spin" /> Uploading...</>
                  : <><Camera className="w-4 h-4" /> {selectedStudent.reference_photo_url ? 'Replace Photo' : 'Upload or Capture Photo'}</>}
              </button>
              <input ref={faceIdInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFaceIdUpload} />

              <p className="text-xs text-slate-400 text-center">
                Used for live face-match attendance (Watchman's "Scan Face" mode) at a fixed 75% confidence threshold. This is separate from the student's main profile photo.
              </p>
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
                        {['Month','Total','Paid','Status','Date','Action'].map(h => (
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
                          <td className="py-3 text-center">
                            {f.status === 'Paid' && (
                              <button onClick={() => generateReceiptForFee(f)} 
                                className="text-xs px-2 py-1 rounded-lg font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center gap-1 mx-auto">
                                <Printer className="w-3 h-3" /> Receipt
                              </button>
                            )}
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
            {tabLoading
              ? <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
              : attendance.length === 0
              ? (
                <div className="text-center py-12 text-slate-400">
                  <CalendarCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No attendance records for {selectedYear}</p>
                </div>
              ) : (
                <>
                  <div className={`flex items-center justify-between p-4 rounded-xl mb-6 ${attPct>=75?'bg-emerald-50 border border-emerald-100':'bg-red-50 border border-red-100'}`}>
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

                  <div className="flex flex-wrap gap-3 mb-5">
                    {[
                      { color:'bg-emerald-500', label:'Present' },
                      { color:'bg-red-400',     label:'Absent' },
                      { color:'bg-amber-400',   label:'Late' },
                      { color:'bg-blue-300',    label:'Leave' },
                      { color:'bg-slate-200',   label:'Off day' },
                      { color:'bg-white border border-slate-200', label:'No record' },
                    ].map(({ color, label }) => (
                      <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
                        <div className={`w-3 h-3 rounded-sm ${color}`} />
                        {label}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-6">
                    {attendance.map(a => {
                      const [yr, mo] = a.month.split('-').map(Number);
                      const total = a.present+a.absent+a.late+a.leave;
                      const pct   = total>0 ? Math.round((a.present/total)*100) : 0;

                      const dayMap: Record<string, string> = {};
                      rawAttendance.forEach(r => { dayMap[r.attendance_date] = r.status; });

                      const daysInMonth = new Date(yr, mo, 0).getDate();
                      const firstWeekday = new Date(yr, mo-1, 1).getDay();

                      function dayColor(dateStr: string, dow: number): string {
                        if (dayMap[dateStr]) {
                          const s = dayMap[dateStr];
                          if (s==='present') return 'bg-emerald-500 text-white';
                          if (s==='absent')  return 'bg-red-400 text-white';
                          if (s==='late')    return 'bg-amber-400 text-white';
                          if (s==='leave')   return 'bg-blue-300 text-white';
                        }
                        if (weeklyOffDays.includes(dow)) return 'bg-slate-200 text-slate-400';
                        return 'bg-white text-slate-300 border border-slate-100';
                      }

                      return (
                        <div key={a.month} className="border border-slate-200 rounded-xl overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                            <span className="font-semibold text-slate-700 text-sm">{MONTH_NAMES[mo-1]} {yr}</span>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-emerald-600 font-semibold">P:{a.present}</span>
                              <span className="text-red-500 font-semibold">A:{a.absent}</span>
                              <span className="text-amber-500 font-semibold">L:{a.late}</span>
                              <span className="text-blue-400 font-semibold">Lv:{a.leave}</span>
                              <span className={`font-bold px-2 py-0.5 rounded-full ${pct>=75?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-600'}`}>{pct}%</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
                            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                              <div key={d} className="text-center text-xs font-semibold text-slate-400 py-2">{d}</div>
                            ))}
                          </div>

                          <div className="grid grid-cols-7 gap-0.5 p-2 bg-slate-50">
                            {Array.from({ length: firstWeekday }).map((_, i) => (
                              <div key={`empty-${i}`} />
                            ))}
                            {Array.from({ length: daysInMonth }, (_, i) => {
                              const day = i+1;
                              const dow = new Date(yr, mo-1, day).getDay();
                              const dateStr = `${yr}-${String(mo).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                              const colorCls = dayColor(dateStr, dow);
                              return (
                                <div key={day} className={`aspect-square flex items-center justify-center rounded-lg text-xs font-semibold ${colorCls}`}>
                                  {day}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )
            }
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────────────────────── */}
        {activeTab === 'results' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Exam Results — {selectedYear}</h3>
            </div>
            {tabLoading
              ? <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
              : sortedExamGroups.length===0
              ? (
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
                            <button
                              onClick={() => printResults([[key, { label, rows, sortOrder:0 }]], selectedStudent, schoolName, selectedYear, settings?.logo_url || null)}
                              className="flex items-center gap-1 px-2 py-1 text-xs border border-slate-200 rounded-lg hover:bg-white text-slate-500 transition-colors"
                            >
                              <Printer className="w-3 h-3" /> Print
                            </button>
                          </div>
                        </div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                              {['Subject','Obtained','Total','%','Grade','Result'].map(h => (
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
                                  <td className="px-4 py-2.5 text-center font-semibold text-slate-600">{r.grade ?? '—'}</td>
                                  <td className="px-4 py-2.5 text-center">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.pass_fail==='pass'?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-600'}`}>
                                      {r.pass_fail?.toUpperCase()}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-50 border-t-2 border-slate-200">
                              <td className="px-4 py-2.5 text-xs font-bold text-slate-600 uppercase">Total</td>
                              <td className="px-4 py-2.5 text-center font-bold text-slate-800">{totObt}</td>
                              <td className="px-4 py-2.5 text-center font-bold text-slate-800">{totMrk}</td>
                              <td className="px-4 py-2.5 text-center font-bold">{pct}%</td>
                              <td />
                              <td className="px-4 py-2.5 text-center">
                                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${allPass?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-600'}`}>
                                  {allPass?'PASS':'FAIL'}
                                </span>
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    );
                  })}
                </div>
              )
            }
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

        {/* ── Certificate ──────────────────────────────────────────────────────── */}
        {activeTab === 'certificate' && (
          <CertificateTab student={selectedStudent} schoolName={schoolName} />
        )}

      </div>

      {/* Receipt Modal */}
      {showReceipt && receiptData && (
        <ReceiptPreview
          data={receiptData}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  );
}