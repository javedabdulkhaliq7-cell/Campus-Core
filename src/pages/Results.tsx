import { useState, useEffect } from 'react';
import { useSchool } from '../lib/schoolContext';
import { supabase } from '../lib/supabase';
import {
  ClipboardList, ChevronDown, Save, CheckCircle, Eye, Edit3,
  Printer, Trophy, TrendingUp, Users, BookOpen, AlertCircle, Palette, Check
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────
interface Student { id: string; full_name: string; roll_number?: string; photo_url?: string | null; }
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
  exam_type: string;
  exam_month: number | null;
  exam_year: number;
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

function examGroupLabel(examType: string, examMonth: number | null, examYear: number): string {
  if (examType === 'monthly') {
    const mo = MONTHS.find(m => m.value === examMonth)?.label ?? '';
    return `Monthly Test — ${mo} ${examYear}`;
  }
  if (examType === 'midterm') return `Midterm Examination — ${examYear}`;
  return `Annual Examination — ${examYear}`;
}

function examGroupKey(examType: string, examMonth: number | null, examYear: number): string {
  return `${examType}_${examMonth ?? 0}_${examYear}`;
}

// Sort order: monthly (by month) < midterm < annual
function examGroupSortOrder(examType: string, examMonth: number | null): number {
  if (examType === 'monthly') return (examMonth ?? 0);
  if (examType === 'midterm') return 100;
  return 200;
}

// ─── Print helpers ─────────────────────────────────────────────
function printHTML(html: string, title = 'Print', opts?: { landscape?: boolean; fonts?: boolean }) {
  const win = window.open('', '_blank', 'width=960,height=700');
  if (!win) return;
  const fontLink = opts?.fonts
    ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Poppins:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap">`
    : '';
  const pageSize = opts?.landscape ? 'A4 landscape' : 'A4';
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>${fontLink}
    <style>* { margin:0; padding:0; box-sizing:border-box; } body { font-family:'Segoe UI',Arial,sans-serif; background:#fff; }
    @media print { @page { size:${pageSize}; margin:0; } }</style>
  </head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

// ─── Certificate-style design helpers (used by the formal result-card prints) ──

interface CertTheme {
  id: string;
  name: string;
  ornaments: boolean;
  bg: string;
  borderOuter: string;
  borderInner: string;
  ornamentColorDark: string;
  ornamentColorLight: string;
  headingFont: string;
  bodyFont: string;
  schoolNameColor: string;
  titleColor: string;
  textColor: string;
  mutedColor: string;
  cardBg: string;
  cardBorder: string;
  bannerBg: string;
  bannerBorder: string;
  bannerText: string;
  bannerMuted: string;
  tableHeadBg: string;
  tableHeadBorder: string;
  tableHeadText: string;
  rowBorder: string;
  logoBorder: string;
  photoBg: string;
  photoText: string;
  passBg: string;
  passText: string;
  failBg: string;
  failText: string;
}

const CERT_TEMPLATES: CertTheme[] = [
  {
    id: 'gold_classic', name: 'Gold Classic', ornaments: true,
    bg: '#FEFCF3', borderOuter: '#8B6914', borderInner: '#C5973A',
    ornamentColorDark: '#8B6914', ornamentColorLight: '#C5973A',
    headingFont: "'Cinzel',serif", bodyFont: "'Cormorant Garamond',Georgia,serif",
    schoolNameColor: '#1B3A6B', titleColor: '#5C1010', textColor: '#1A1008', mutedColor: '#5A4A2A',
    cardBg: '#FBF7E8', cardBorder: '#C5973A',
    bannerBg: '#1B3A6B', bannerBorder: '#8B6914', bannerText: '#FEFCF3', bannerMuted: '#D9C896',
    tableHeadBg: '#F5EFD9', tableHeadBorder: '#C5973A', tableHeadText: '#8B6914', rowBorder: '#E5DCC0',
    logoBorder: '#C5973A', photoBg: '#1B3A6B', photoText: '#FEFCF3',
    passBg: '#DCEEDF', passText: '#1F6B3D', failBg: '#F5DADA', failText: '#8B1E1E',
  },
  {
    id: 'navy_modern', name: 'Navy Modern', ornaments: false,
    bg: '#FFFFFF', borderOuter: '#1B3A6B', borderInner: '#9DB6DD',
    ornamentColorDark: '#1B3A6B', ornamentColorLight: '#9DB6DD',
    headingFont: "'Poppins',sans-serif", bodyFont: "'Inter',Arial,sans-serif",
    schoolNameColor: '#0F2A52', titleColor: '#1B3A6B', textColor: '#1E293B', mutedColor: '#64748B',
    cardBg: '#F2F6FC', cardBorder: '#9DB6DD',
    bannerBg: '#1B3A6B', bannerBorder: '#1B3A6B', bannerText: '#FFFFFF', bannerMuted: '#BFD3F0',
    tableHeadBg: '#EAF1FB', tableHeadBorder: '#9DB6DD', tableHeadText: '#1B3A6B', rowBorder: '#E2E8F0',
    logoBorder: '#9DB6DD', photoBg: '#1B3A6B', photoText: '#FFFFFF',
    passBg: '#D1FAE5', passText: '#065F46', failBg: '#FEE2E2', failText: '#991B1B',
  },
  {
    id: 'minimal_mono', name: 'Minimal Mono', ornaments: false,
    bg: '#FFFFFF', borderOuter: '#1E293B', borderInner: '#CBD5E1',
    ornamentColorDark: '#1E293B', ornamentColorLight: '#94A3B8',
    headingFont: "'Inter',Arial,sans-serif", bodyFont: "'Inter',Arial,sans-serif",
    schoolNameColor: '#0F172A', titleColor: '#0F172A', textColor: '#1E293B', mutedColor: '#64748B',
    cardBg: '#F8FAFC', cardBorder: '#E2E8F0',
    bannerBg: '#0F172A', bannerBorder: '#0F172A', bannerText: '#FFFFFF', bannerMuted: '#CBD5E1',
    tableHeadBg: '#F1F5F9', tableHeadBorder: '#E2E8F0', tableHeadText: '#475569', rowBorder: '#F1F5F9',
    logoBorder: '#E2E8F0', photoBg: '#0F172A', photoText: '#FFFFFF',
    passBg: '#DCFCE7', passText: '#166534', failBg: '#FEE2E2', failText: '#991B1B',
  },
  {
    id: 'maroon_heritage', name: 'Maroon Heritage', ornaments: true,
    bg: '#FCF8F4', borderOuter: '#6B1414', borderInner: '#B08850',
    ornamentColorDark: '#6B1414', ornamentColorLight: '#B08850',
    headingFont: "'Cinzel',serif", bodyFont: "'Cormorant Garamond',Georgia,serif",
    schoolNameColor: '#6B1414', titleColor: '#6B1414', textColor: '#241412', mutedColor: '#6B4A3A',
    cardBg: '#F7ECE3', cardBorder: '#B08850',
    bannerBg: '#6B1414', bannerBorder: '#B08850', bannerText: '#FCF8F4', bannerMuted: '#E8C9A0',
    tableHeadBg: '#F1E0CE', tableHeadBorder: '#B08850', tableHeadText: '#6B1414', rowBorder: '#E8D7C3',
    logoBorder: '#B08850', photoBg: '#6B1414', photoText: '#FCF8F4',
    passBg: '#DCEEDF', passText: '#1F6B3D', failBg: '#F5DADA', failText: '#8B1E1E',
  },
  {
    id: 'emerald_elegant', name: 'Emerald Elegant', ornaments: true,
    bg: '#F7FBF8', borderOuter: '#0F4C3A', borderInner: '#C5973A',
    ornamentColorDark: '#0F4C3A', ornamentColorLight: '#C5973A',
    headingFont: "'Cinzel',serif", bodyFont: "'Cormorant Garamond',Georgia,serif",
    schoolNameColor: '#0F4C3A', titleColor: '#0F4C3A', textColor: '#142420', mutedColor: '#3F5A50',
    cardBg: '#EAF4EE', cardBorder: '#C5973A',
    bannerBg: '#0F4C3A', bannerBorder: '#C5973A', bannerText: '#F7FBF8', bannerMuted: '#D9C896',
    tableHeadBg: '#E3F0E7', tableHeadBorder: '#C5973A', tableHeadText: '#0F4C3A', rowBorder: '#D7E8DC',
    logoBorder: '#C5973A', photoBg: '#0F4C3A', photoText: '#F7FBF8',
    passBg: '#DCEEDF', passText: '#1F6B3D', failBg: '#F5DADA', failText: '#8B1E1E',
  },
];

function getTemplate(id: string): CertTheme {
  return CERT_TEMPLATES.find(t => t.id === id) ?? CERT_TEMPLATES[0];
}

function certOrnamentSVG(rotate: number, theme: CertTheme) {
  return `<svg width="46" height="46" viewBox="0 0 64 64" style="transform:rotate(${rotate}deg);display:block;">
    <path d="M4 4 L24 4 M4 4 L4 24" stroke="${theme.ornamentColorDark}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M10 10 L20 10 M10 10 L10 20" stroke="${theme.ornamentColorLight}" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <path d="M4 4 Q16 16 28 28" stroke="${theme.ornamentColorLight}" stroke-width="0.8" fill="none" opacity="0.5"/>
    <rect x="1.5" y="1.5" width="5" height="5" fill="${theme.ornamentColorDark}" transform="rotate(45 4 4)"/>
    <circle cx="24" cy="4" r="1.5" fill="${theme.ornamentColorLight}"/>
    <circle cx="4" cy="24" r="1.5" fill="${theme.ornamentColorLight}"/>
  </svg>`;
}

function certFrameStart(theme: CertTheme, extraStyle = '') {
  const ornamentsHTML = theme.ornaments ? `
      <div style="position:absolute;top:9mm;left:9mm;">${certOrnamentSVG(0, theme)}</div>
      <div style="position:absolute;top:9mm;right:9mm;">${certOrnamentSVG(90, theme)}</div>
      <div style="position:absolute;bottom:9mm;left:9mm;">${certOrnamentSVG(270, theme)}</div>
      <div style="position:absolute;bottom:9mm;right:9mm;">${certOrnamentSVG(180, theme)}</div>` : '';
  const borderWidth = theme.ornaments ? '3px' : '2px';
  return `
    <div style="padding:17mm 19mm;min-height:297mm;font-family:${theme.bodyFont};background:${theme.bg};position:relative;color:${theme.textColor};${extraStyle}">
      <div style="position:absolute;inset:8mm;border:${borderWidth} solid ${theme.borderOuter};${theme.ornaments?'':'border-radius:6px;'}pointer-events:none;"></div>
      <div style="position:absolute;inset:11mm;border:1px solid ${theme.borderInner};${theme.ornaments?'':'border-radius:4px;'}pointer-events:none;"></div>
      ${ornamentsHTML}
  `;
}
function certFrameEnd() { return `</div>`; }

function certGoldDivider(theme: CertTheme) {
  return `<div style="display:flex;align-items:center;width:100%;margin:6px 0 10px;">
    <div style="flex:1;height:1px;background:linear-gradient(to right,transparent,${theme.borderInner} 40%,${theme.borderOuter} 50%);"></div>
    <span style="color:${theme.borderOuter};font-size:13px;margin:0 10px;line-height:1;">◆</span>
    <div style="flex:1;height:1px;background:linear-gradient(to left,transparent,${theme.borderInner} 40%,${theme.borderOuter} 50%);"></div>
  </div>`;
}

function certLogoHTML(logoUrl: string | null, theme: CertTheme) {
  return logoUrl
    ? `<img src="${logoUrl}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid ${theme.logoBorder};margin-bottom:6px;" />`
    : `<div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;border:2px solid ${theme.logoBorder};background:${theme.bg};margin-bottom:6px;"><div style="width:24px;height:24px;background:${theme.schoolNameColor};border-radius:5px;"></div></div>`;
}

function certHeaderHTML(schoolName: string, logoUrl: string | null, title: string, subtitle: string, theme: CertTheme) {
  return `
    <div style="text-align:center;margin-bottom:8px;">
      ${certLogoHTML(logoUrl, theme)}
      <div style="font-family:${theme.headingFont};font-size:16px;font-weight:700;color:${theme.schoolNameColor};letter-spacing:.1em;text-transform:uppercase;">${schoolName}</div>
      ${certGoldDivider(theme)}
      <div style="font-family:${theme.headingFont};font-size:19px;font-weight:700;color:${theme.titleColor};letter-spacing:.13em;text-transform:uppercase;margin:2px 0;">${title}</div>
      <div style="font-family:${theme.headingFont};font-size:10.5px;font-weight:600;color:${theme.schoolNameColor};letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px;">${subtitle}</div>
      ${certGoldDivider(theme)}
    </div>`;
}

function certPhotoHTML(student: Student, theme: CertTheme, size = 58) {
  if (student.photo_url) {
    return `<img src="${student.photo_url}" style="width:${size}px;height:${size}px;border-radius:10px;object-fit:cover;border:2px solid ${theme.logoBorder};flex-shrink:0;" />`;
  }
  const initial = (student.full_name || '?').charAt(0).toUpperCase();
  return `<div style="width:${size}px;height:${size}px;border-radius:10px;background:${theme.photoBg};color:${theme.photoText};display:flex;align-items:center;justify-content:center;font-family:${theme.headingFont};font-size:${Math.round(size*0.4)}px;font-weight:700;flex-shrink:0;border:2px solid ${theme.logoBorder};">${initial}</div>`;
}

function certInfoGridHTML(student: Student, fields: [string, string][], theme: CertTheme) {
  return `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">
      ${certPhotoHTML(student, theme, 58)}
      <div style="flex:1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;background:${theme.cardBg};border:1px solid ${theme.cardBorder};border-radius:4px;padding:10px 14px;">
        ${fields.map(([l, v]) => `
          <div${l === 'Exams Included' ? ' style="grid-column:span 2"' : ''}>
            <p style="font-family:${theme.headingFont};font-size:8.5px;font-weight:700;color:${theme.borderOuter};text-transform:uppercase;letter-spacing:.07em;margin-bottom:2px;">${l}</p>
            <p style="font-size:13px;font-weight:600;color:${theme.textColor};">${v}</p>
          </div>`).join('')}
      </div>
    </div>`;
}

function certTableHTML(rows: SavedResult[], gradeSystem: GradeSystem, theme: CertTheme) {
  const rowsHTML = rows.map(r => {
    const pct = calcPercentage(r.obtained_marks, r.total_marks);
    return `
      <tr style="border-bottom:1px solid ${theme.rowBorder};">
        <td style="padding:7px 10px;font-size:12.5px;color:${theme.textColor};font-weight:500;">${r.subject_name}</td>
        <td style="padding:7px 10px;font-size:12.5px;text-align:center;font-weight:700;color:${theme.textColor};">${r.obtained_marks}</td>
        <td style="padding:7px 10px;font-size:12.5px;text-align:center;color:${theme.mutedColor};">${r.total_marks}</td>
        <td style="padding:7px 10px;font-size:12.5px;text-align:center;font-weight:600;color:${pct >= gradeSystem.passing_percentage ? theme.passText : theme.failText};">${pct}%</td>
        ${gradeSystem.grade_mode === 'letter' ? `<td style="padding:7px 10px;font-size:12.5px;text-align:center;font-weight:700;color:${theme.schoolNameColor};">${r.grade}</td>` : ''}
        <td style="padding:7px 10px;font-size:11px;text-align:center;">
          <span style="background:${r.pass_fail==='pass'?theme.passBg:theme.failBg};color:${r.pass_fail==='pass'?theme.passText:theme.failText};padding:2px 9px;border-radius:3px;font-weight:700;letter-spacing:.04em;">${r.pass_fail?.toUpperCase()}</span>
        </td>
      </tr>`;
  }).join('');

  return `
    <div style="border:1px solid ${theme.cardBorder};border-radius:4px;overflow:hidden;margin-bottom:12px;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:${theme.tableHeadBg};border-bottom:1px solid ${theme.tableHeadBorder};">
            ${['Subject','Obtained','Total','%',...(gradeSystem.grade_mode==='letter'?['Grade']:[]),'Result']
              .map(h=>`<th style="padding:7px 10px;font-family:${theme.headingFont};font-size:9.5px;font-weight:700;color:${theme.tableHeadText};text-transform:uppercase;letter-spacing:.05em;${h==='Subject'?'text-align:left':'text-align:center'}">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>
    </div>`;
}

function certResultBannerHTML(label: string, obtained: number, total: number, pct: number, grade: string, passFail: string, gradeSystem: GradeSystem, theme: CertTheme) {
  return `
    <div style="background:${theme.bannerBg};border:1px solid ${theme.bannerBorder};border-radius:4px;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
      <span style="font-family:${theme.headingFont};font-size:11.5px;font-weight:700;color:${theme.bannerText};letter-spacing:.05em;text-transform:uppercase;">${label}</span>
      <div style="display:flex;align-items:center;gap:14px;">
        <span style="font-size:13px;color:${theme.bannerMuted};">${obtained} / ${total}</span>
        <span style="font-family:${theme.headingFont};font-size:15px;font-weight:800;color:${theme.bannerText};">${pct}%</span>
        ${gradeSystem.grade_mode==='letter'?`<span style="font-family:${theme.headingFont};font-size:14px;font-weight:800;color:${theme.bannerMuted};">${grade}</span>`:''}
        <span style="background:${passFail==='pass'?theme.passBg:theme.failBg};color:${passFail==='pass'?theme.passText:theme.failText};font-family:${theme.headingFont};font-size:11px;font-weight:800;padding:3px 14px;border-radius:3px;letter-spacing:.05em;">${passFail==='pass'?'PASS':'FAIL'}</span>
      </div>
    </div>`;
}

function certSignatureBlockHTML(schoolName: string, theme: CertTheme, principalName?: string) {
  return `
    <div style="display:flex;justify-content:space-between;margin-top:16mm;padding:0 4mm;">
      <div style="text-align:center;min-width:140px;">
        <div style="height:34px;border-bottom:1.5px solid ${theme.borderOuter};margin-bottom:4px;"></div>
        <p style="font-family:${theme.headingFont};font-size:10px;font-weight:700;color:${theme.schoolNameColor};letter-spacing:.06em;">CLASS TEACHER</p>
      </div>
      <div style="text-align:center;min-width:160px;">
        ${principalName ? `<p style="font-size:11px;color:${theme.mutedColor};font-style:italic;margin-bottom:2px;">${principalName}</p>` : ''}
        <div style="height:34px;border-bottom:1.5px solid ${theme.borderOuter};margin-bottom:4px;"></div>
        <p style="font-family:${theme.headingFont};font-size:10px;font-weight:700;color:${theme.schoolNameColor};letter-spacing:.06em;">PRINCIPAL</p>
        <p style="font-size:9px;color:${theme.mutedColor};margin-top:1px;">${schoolName}</p>
      </div>
    </div>`;
}

function certFooterHTML(theme: CertTheme) {
  return `<p style="position:absolute;bottom:11mm;left:50%;transform:translateX(-50%);font-size:9px;color:${theme.mutedColor};font-style:italic;text-align:center;">
    Issued on ${new Date().toLocaleDateString('en-PK',{day:'2-digit',month:'long',year:'numeric'})} &nbsp;·&nbsp; Campus Core
  </p>`;
}

interface ExamGroup {
  examType: string;
  examMonth: number | null;
  examYear: number;
  label: string;
  rows: SavedResult[];
  totalObtained: number;
  totalMax: number;
  percentage: number;
  passFail: string;
  grade: string;
}

function buildExamGroupsForStudent(allResults: SavedResult[], gradeSystem: GradeSystem, gradeRanges: GradeRange[]): ExamGroup[] {
  const map: Record<string, ExamGroup> = {};
  allResults.forEach(r => {
    const key = examGroupKey(r.exam_type, r.exam_month, r.exam_year);
    if (!map[key]) {
      map[key] = {
        examType: r.exam_type,
        examMonth: r.exam_month,
        examYear: r.exam_year,
        label: examGroupLabel(r.exam_type, r.exam_month, r.exam_year),
        rows: [],
        totalObtained: 0, totalMax: 0, percentage: 0, passFail: 'pass', grade: '',
      };
    }
    // Deduplicate by subject_name — keep only the first occurrence per subject
    const alreadyHasSubject = map[key].rows.some(existing => existing.subject_name === r.subject_name);
    if (!alreadyHasSubject) {
      map[key].rows.push(r);
    }
  });
  // Compute totals per group
  Object.values(map).forEach(g => {
    g.totalObtained = g.rows.reduce((s, r) => s + r.obtained_marks, 0);
    g.totalMax      = g.rows.reduce((s, r) => s + r.total_marks, 0);
    g.percentage    = calcPercentage(g.totalObtained, g.totalMax);
    g.passFail      = g.rows.every(r => r.pass_fail === 'pass') ? 'pass' : 'fail';
    g.grade         = gradeSystem.grade_mode === 'letter' ? getGradeLabel(g.percentage, gradeRanges) : `${g.percentage}%`;
  });
  return Object.values(map).sort((a, b) =>
    examGroupSortOrder(a.examType, a.examMonth) - examGroupSortOrder(b.examType, b.examMonth)
  );
}

function printSingleExamCard(
  student: Student,
  group: ExamGroup,
  schoolName: string,
  logoUrl: string | null,
  selectedGrade: number,
  position: number,
  gradeSystem: GradeSystem,
  templateId: string,
  principalName?: string,
) {
  const theme = getTemplate(templateId);
  const html = certFrameStart(theme) +
    certHeaderHTML(schoolName, logoUrl, 'Official Result Card', `${group.label} · Class ${selectedGrade}`, theme) +
    certInfoGridHTML(student, [
      ['Student Name', student.full_name],
      ['Roll No.',     student.roll_number ?? '—'],
      ['Class',        `Class ${selectedGrade}`],
      ['Exam',         group.label],
      ['Position',     getOrdinal(position)],
      ['Overall',      `${group.totalObtained}/${group.totalMax} (${group.percentage}%)`],
    ], theme) +
    certTableHTML(group.rows, gradeSystem, theme) +
    certResultBannerHTML(`${group.label} — Result`, group.totalObtained, group.totalMax, group.percentage, group.grade, group.passFail, gradeSystem, theme) +
    certSignatureBlockHTML(schoolName, theme, principalName) +
    certFooterHTML(theme) +
    certFrameEnd();

  printHTML(html, `${group.label} — ${student.full_name}`, { fonts: true });
}

function printAllExams(
  student: Student,
  groups: ExamGroup[],
  schoolName: string,
  logoUrl: string | null,
  selectedGrade: number,
  gradeSystem: GradeSystem,
  templateId: string,
  principalName?: string,
) {
  const theme = getTemplate(templateId);
  const grandObt = groups.reduce((s, g) => s + g.totalObtained, 0);
  const grandTot = groups.reduce((s, g) => s + g.totalMax, 0);
  const grandPct = calcPercentage(grandObt, grandTot);
  const allPass  = groups.every(g => g.passFail === 'pass');

  const groupsHTML = groups.map(g => `
    <div style="margin-bottom:14px;border:1px solid ${theme.cardBorder};border-radius:4px;overflow:hidden;page-break-inside:avoid;">
      <div style="background:${theme.bannerBg};padding:7px 12px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-family:${theme.headingFont};font-size:11px;font-weight:700;color:${theme.bannerText};text-transform:uppercase;letter-spacing:.05em;">${g.label}</span>
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:11px;color:${theme.bannerMuted};">${g.totalObtained}/${g.totalMax}</span>
          <span style="font-family:${theme.headingFont};font-size:12px;font-weight:800;color:${theme.bannerText};">${g.percentage}%</span>
          ${gradeSystem.grade_mode==='letter'?`<span style="font-size:11px;font-weight:700;color:${theme.bannerMuted};">${g.grade}</span>`:''}
          <span style="background:${g.passFail==='pass'?theme.passBg:theme.failBg};color:${g.passFail==='pass'?theme.passText:theme.failText};font-size:10px;font-weight:700;padding:2px 10px;border-radius:3px;">${g.passFail==='pass'?'PASS':'FAIL'}</span>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:${theme.tableHeadBg};border-bottom:1px solid ${theme.tableHeadBorder};">
            ${['Subject','Obtained','Total','%',...(gradeSystem.grade_mode==='letter'?['Grade']:[]),'Result']
              .map(h=>`<th style="padding:6px 10px;font-family:${theme.headingFont};font-size:9px;font-weight:700;color:${theme.tableHeadText};text-transform:uppercase;${h==='Subject'?'text-align:left':'text-align:center'}">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${g.rows.map(r => {
          const pct = calcPercentage(r.obtained_marks, r.total_marks);
          return `
            <tr style="border-bottom:1px solid ${theme.rowBorder};">
              <td style="padding:6px 10px;font-size:11.5px;color:${theme.textColor};font-weight:500;">${r.subject_name}</td>
              <td style="padding:6px 10px;font-size:11.5px;text-align:center;font-weight:700;color:${theme.textColor};">${r.obtained_marks}</td>
              <td style="padding:6px 10px;font-size:11.5px;text-align:center;color:${theme.mutedColor};">${r.total_marks}</td>
              <td style="padding:6px 10px;font-size:11.5px;text-align:center;font-weight:600;color:${pct>=gradeSystem.passing_percentage?theme.passText:theme.failText};">${pct}%</td>
              ${gradeSystem.grade_mode==='letter'?`<td style="padding:6px 10px;font-size:11.5px;text-align:center;font-weight:700;color:${theme.schoolNameColor};">${r.grade}</td>`:''}
              <td style="padding:6px 10px;font-size:10px;text-align:center;">
                <span style="background:${r.pass_fail==='pass'?theme.passBg:theme.failBg};color:${r.pass_fail==='pass'?theme.passText:theme.failText};padding:2px 8px;border-radius:3px;font-weight:700;">${r.pass_fail?.toUpperCase()}</span>
              </td>
            </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`).join('');

  const html = certFrameStart(theme) +
    certHeaderHTML(schoolName, logoUrl, 'Full Year Report Card', `Class ${selectedGrade}`, theme) +
    certInfoGridHTML(student, [
      ['Student Name', student.full_name],
      ['Roll No.',     student.roll_number ?? '—'],
      ['Class',        `Class ${selectedGrade}`],
      ['Exams Included', groups.map(g=>g.label).join(', ')],
      ['Grand Total',  `${grandObt} / ${grandTot}`],
      ['Overall %',    `${grandPct}%`],
    ], theme) +
    groupsHTML +
    certResultBannerHTML('Grand Total — All Exams', grandObt, grandTot, grandPct, '', allPass?'pass':'fail', { ...gradeSystem, grade_mode: 'percentage' }, theme) +
    certSignatureBlockHTML(schoolName, theme, principalName) +
    certFooterHTML(theme) +
    certFrameEnd();

  printHTML(html, `Full Year Report — ${student.full_name}`, { fonts: true });
}

// ─── Print one result card per student in the class, all in a single document ──
function printAllResultCards(
  withPositions: { student: Student; totalObtained: number; totalMax: number; percentage: number; passFail: string; grade: string; position: number; results: SavedResult[] }[],
  schoolName: string,
  logoUrl: string | null,
  selectedGrade: number,
  examLabel: string,
  gradeSystem: GradeSystem,
  templateId: string,
  principalName?: string,
) {
  const theme = getTemplate(templateId);
  const cardsHTML = withPositions.map((item, idx) => {
    const cardInner =
      certHeaderHTML(schoolName, logoUrl, 'Official Result Card', `${examLabel} · Class ${selectedGrade}`, theme) +
      certInfoGridHTML(item.student, [
        ['Student Name', item.student.full_name],
        ['Roll No.',     item.student.roll_number ?? '—'],
        ['Class',        `Class ${selectedGrade}`],
        ['Exam',         examLabel],
        ['Position',     getOrdinal(item.position)],
        ['Overall',      `${item.totalObtained}/${item.totalMax} (${item.percentage}%)`],
      ], theme) +
      certTableHTML(item.results, gradeSystem, theme) +
      certResultBannerHTML(`${examLabel} — Result`, item.totalObtained, item.totalMax, item.percentage, item.grade, item.passFail, gradeSystem, theme) +
      certSignatureBlockHTML(schoolName, theme, principalName) +
      certFooterHTML(theme);

    const pageBreak = idx < withPositions.length - 1 ? 'page-break-after:always;' : '';
    return certFrameStart(theme, pageBreak) + cardInner + certFrameEnd();
  }).join('');

  printHTML(cardsHTML, `All Result Cards — Class ${selectedGrade} — ${examLabel}`, { fonts: true });
}

function printClassMarksheet(
  withPositions: { student: Student; totalObtained: number; totalMax: number; percentage: number; passFail: string; grade: string; position: number; results: SavedResult[] }[],
  subjects: Subject[],
  schoolName: string,
  logoUrl: string | null,
  selectedGrade: number,
  examLabel: string,
  gradeSystem: GradeSystem,
) {
  // Total number of columns determines how tight the layout needs to be so that,
  // no matter how many subjects a class has, every column fits on the landscape page.
  const totalCols = 3 + subjects.length + 2 + (gradeSystem.grade_mode === 'letter' ? 1 : 0) + 1;
  const cellFont    = totalCols > 14 ? 8.5  : totalCols > 10 ? 9.5  : 11;
  const headFont     = totalCols > 14 ? 7    : totalCols > 10 ? 8   : 9;
  const cellPad      = totalCols > 14 ? '4px 3px' : totalCols > 10 ? '5px 4px' : '6px 8px';

  const rowsHTML = withPositions.map(item => `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:${cellPad};text-align:center;font-size:${cellFont}px;font-weight:700;color:${item.position<=3?'#b45309':'#64748b'};">${item.position}</td>
      <td style="padding:${cellPad};font-size:${cellFont}px;font-weight:600;color:#1e293b;white-space:nowrap;">${item.student.full_name}</td>
      <td style="padding:${cellPad};text-align:center;font-size:${cellFont}px;color:#64748b;white-space:nowrap;">${item.student.roll_number??'—'}</td>
      ${subjects.map(sub => {
        const r = item.results.find(res => res.subject_name === sub.subject_name);
        return `<td style="padding:${cellPad};text-align:center;font-size:${cellFont}px;color:#1e293b;">${r ? r.obtained_marks : '—'}</td>`;
      }).join('')}
      <td style="padding:${cellPad};text-align:center;font-size:${cellFont}px;font-weight:700;color:#1e293b;white-space:nowrap;">${item.totalObtained}/${item.totalMax}</td>
      <td style="padding:${cellPad};text-align:center;font-size:${cellFont}px;font-weight:700;color:${item.percentage>=gradeSystem.passing_percentage?'#059669':'#dc2626'};">${item.percentage}%</td>
      ${gradeSystem.grade_mode==='letter'?`<td style="padding:${cellPad};text-align:center;font-size:${cellFont}px;font-weight:700;color:#7c3aed;">${item.grade}</td>`:''}
      <td style="padding:${cellPad};text-align:center;">
        <span style="background:${item.passFail==='pass'?'#d1fae5':'#fee2e2'};color:${item.passFail==='pass'?'#065f46':'#991b1b'};font-size:${Math.max(cellFont-1,7)}px;font-weight:700;padding:2px 7px;border-radius:20px;white-space:nowrap;">${item.passFail==='pass'?'PASS':'FAIL'}</span>
      </td>
    </tr>`).join('');

  const passed = withPositions.filter(s => s.passFail === 'pass').length;
  const failed = withPositions.filter(s => s.passFail === 'fail').length;
  const avg = withPositions.length > 0 ? Math.round(withPositions.reduce((s, i) => s + i.percentage, 0) / withPositions.length) : 0;

  const logoHTMLSheet = logoUrl
    ? `<img src="${logoUrl}" style="width:46px;height:46px;border-radius:50%;object-fit:cover;border:2px solid #e2e8f0;margin-bottom:3px;" />`
    : `<div style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;background:#1d4ed8;border-radius:50%;margin-bottom:3px;"><div style="width:20px;height:20px;background:white;border-radius:4px;"></div></div>`;

  const html = `
    <div style="padding:8mm 10mm;font-family:'Segoe UI',Arial,sans-serif;background:white;">
      <div style="text-align:center;padding-bottom:6px;margin-bottom:8px;border-bottom:2px solid #1d4ed8;">
        ${logoHTMLSheet}
        <h1 style="font-size:16px;font-weight:800;color:#0f172a;margin:2px 0 1px;">${schoolName}</h1>
        <div style="display:inline-block;background:#1e3a8a;color:white;padding:2px 12px;border-radius:20px;margin-top:3px;">
          <p style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${examLabel} &nbsp;·&nbsp; Class ${selectedGrade}</p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;">
        ${[['Total Students',withPositions.length,'#1d4ed8'],['Passed',passed,'#059669'],['Failed',failed,'#dc2626'],['Class Average',`${avg}%`,'#7c3aed']]
          .map(([l,v,c])=>`<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 12px;text-align:center;">
            <p style="font-size:8.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">${l}</p>
            <p style="font-size:16px;font-weight:800;color:${c};">${v}</p>
          </div>`).join('')}
      </div>
      <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;table-layout:auto;">
          <thead>
            <tr style="background:#1d4ed8;">
              ${['#','Student Name','Roll No.',...subjects.map(s=>s.subject_name),'Total','%',...(gradeSystem.grade_mode==='letter'?['Grade']:[]),'Result']
                .map(h=>`<th style="padding:${cellPad};font-size:${headFont}px;font-weight:700;color:white;text-transform:uppercase;letter-spacing:.03em;${h==='Student Name'?'text-align:left':'text-align:center'};white-space:nowrap;">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>${rowsHTML}</tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:10mm;">
        <div style="text-align:center;min-width:130px;"><div style="height:28px;border-bottom:1.5px solid #334155;margin-bottom:4px;"></div><p style="font-size:10px;font-weight:700;color:#334155;">Class Teacher</p></div>
        <div style="text-align:center;min-width:130px;"><div style="height:28px;border-bottom:1.5px solid #334155;margin-bottom:4px;"></div><p style="font-size:10px;font-weight:700;color:#334155;">Principal</p><p style="font-size:9px;color:#64748b;margin-top:1px;">${schoolName}</p></div>
      </div>
      <p style="text-align:center;font-size:9px;color:#94a3b8;margin-top:6mm;">Printed on ${new Date().toLocaleDateString('en-PK',{day:'2-digit',month:'long',year:'numeric'})} &nbsp;·&nbsp; Campus Core</p>
    </div>`;
  printHTML(html, `Marksheet — Class ${selectedGrade} — ${examLabel}`, { landscape: true });
}

// ─── Main Results Page ────────────────────────────────────────
export default function Results() {
  const { settings, schoolName } = useSchool();
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

  // All exam results for the selected student (all types for the year)
  const [allStudentResults, setAllStudentResults] = useState<SavedResult[]>([]);
  const [studentResultsLoading, setStudentResultsLoading] = useState(false);

  // ── Result card template (saved permanently per school) ──
  const [resultTemplateId, setResultTemplateId] = useState<string>('gold_classic');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  // ── Publish to Parents ──
  const [publishedExamKey, setPublishedExamKey] = useState<string | null>(null);
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishMsg, setPublishMsg] = useState('');

  useEffect(() => {
    if (!schoolId) return;
    supabase.from('school_settings').select('result_template_id').eq('school_id', schoolId).single()
      .then(({ data }) => {
        if (data?.result_template_id) setResultTemplateId(data.result_template_id);
      });
  }, [schoolId]);

  async function chooseTemplate(id: string) {
    setResultTemplateId(id);
    setTemplateSaving(true);
    await supabase.from('school_settings').update({ result_template_id: id }).eq('school_id', schoolId);
    setTemplateSaving(false);
  }

  // Check publish status when exam selection changes in view mode
  useEffect(() => {
    if (!schoolId || mode !== 'view') return;
    const currentKey = examGroupKey(examType, examType === 'monthly' ? selectedMonth : null, selectedYear);
    supabase
      .from('classes')
      .select('id')
      .eq('school_id', schoolId)
      .eq('grade', selectedGrade)
      .maybeSingle()
      .then(({ data: cls }) => {
        if (!cls) { setPublishedExamKey(null); return; }
        const q = supabase
          .from('share_results_log')
          .select('id, is_published')
          .eq('school_id', schoolId)
          .eq('exam_type', examType)
          .eq('exam_year', selectedYear)
          .eq('scope', 'class')
          .eq('scope_id', cls.id);
        if (examType === 'monthly') q.eq('exam_month', selectedMonth);
        q.maybeSingle().then(({ data }) => {
          setPublishedExamKey(data?.is_published ? currentKey : null);
        });
      });
  }, [schoolId, mode, examType, selectedMonth, selectedYear, selectedGrade]);

  async function publishResult() {
    if (publishLoading) return;
    setPublishLoading(true);
    const currentKey = examGroupKey(examType, examType === 'monthly' ? selectedMonth : null, selectedYear);
    const isCurrentlyPublished = publishedExamKey === currentKey;

    // Look up class UUID for this grade
    const { data: cls, error: clsErr } = await supabase
      .from('classes')
      .select('id')
      .eq('school_id', schoolId)
      .eq('grade', selectedGrade)
      .maybeSingle();

    if (clsErr || !cls) {
      console.error('Could not find class for grade', selectedGrade, clsErr);
      setPublishMsg('Error: Could not find class record for this grade.');
      setTimeout(() => setPublishMsg(''), 4000);
      setPublishLoading(false);
      return;
    }

    const classId = cls.id;

    // Check if row already exists
    const q = supabase
      .from('share_results_log')
      .select('id')
      .eq('school_id', schoolId)
      .eq('exam_type', examType)
      .eq('exam_year', selectedYear)
      .eq('scope', 'class')
      .eq('scope_id', classId);
    if (examType === 'monthly') q.eq('exam_month', selectedMonth);
    const { data: existing } = await q.maybeSingle();

    if (existing) {
      const { error } = await supabase.from('share_results_log')
        .update({
          is_published: !isCurrentlyPublished,
          template_id: resultTemplateId,
          published_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (error) console.error('Publish update error:', error);
    } else {
      const { data: authData } = await supabase.auth.getUser();
      const { error } = await supabase.from('share_results_log').insert({
        school_id: schoolId,
        shared_by: authData?.user?.id,
        exam_type: examType,
        exam_year: selectedYear,
        exam_month: examType === 'monthly' ? selectedMonth : null,
        scope: 'class',
        scope_id: classId,
        template_id: resultTemplateId,
        is_published: true,
        published_at: new Date().toISOString(),
      });
      if (error) console.error('Publish insert error:', error);
    }

    setPublishedExamKey(isCurrentlyPublished ? null : currentKey);
    setPublishMsg(isCurrentlyPublished
      ? 'Result unpublished from parent portal.'
      : 'Result published! Parents can now view it.');
    setTimeout(() => setPublishMsg(''), 4000);
    setPublishLoading(false);
  }

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
        supabase.from('students').select('id, full_name, roll_number, photo_url').eq('school_id', schoolId).eq('current_grade', selectedGrade).order('full_name'),
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

  // When a student is selected in view mode, fetch ALL their results for the year
  useEffect(() => {
    if (!selectedStudent || !schoolId) { setAllStudentResults([]); return; }
    setStudentResultsLoading(true);
    supabase
      .from('student_results')
      .select('*')
      .eq('school_id', schoolId)
      .eq('student_id', selectedStudent.id)
      .eq('exam_year', selectedYear)
      .eq('class_grade', selectedGrade)
      .then(({ data }) => {
        setAllStudentResults(data ?? []);
        setStudentResultsLoading(false);
      });
  }, [selectedStudent, schoolId, selectedYear, selectedGrade]);

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
    const allStudentResults = savedResults.filter(r => r.student_id === student.id);
    if (allStudentResults.length === 0) return null;
    // Deduplicate by subject_name — keep only the first occurrence per subject
    // (guards against duplicate rows for the same student/exam/subject)
    const seenSubjects = new Set<string>();
    const studentResults = allStudentResults.filter(r => {
      if (seenSubjects.has(r.subject_name)) return false;
      seenSubjects.add(r.subject_name);
      return true;
    });
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
            // ── Individual Student View — all exams grouped ──
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <button onClick={() => setSelectedStudent(null)} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
                  ← Back to Class Results
                </button>
                <button onClick={() => { setSelectedStudent(null); setShowTemplatePicker(true); }}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
                  <Palette className="w-3.5 h-3.5" /> Card Template: <span className="font-semibold text-slate-600">{getTemplate(resultTemplateId).name}</span> · Change
                </button>
              </div>

              {studentResultsLoading ? (
                <div className="card py-12 text-center text-slate-400">Loading results...</div>
              ) : (() => {
                const examGroups = buildExamGroupsForStudent(allStudentResults, gradeSystem, gradeRanges);
                const sData = withPositions.find(s => s.student.id === selectedStudent.id);
                const position = sData?.position ?? 1;

                if (examGroups.length === 0) return (
                  <div className="card py-12 text-center text-slate-400">
                    <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No results found for {selectedStudent.full_name} in {selectedYear}</p>
                  </div>
                );

                return (
                  <div className="space-y-4">
                    {/* Student header */}
                    <div className="card">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                          <h3 className="text-lg font-bold text-slate-800">{selectedStudent.full_name}</h3>
                          <p className="text-sm text-slate-500">Class {selectedGrade} — {selectedYear} — {examGroups.length} exam{examGroups.length > 1 ? 's' : ''}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {sData && (
                            <>
                              <div className="text-center px-3 py-1.5 bg-blue-50 rounded-xl">
                                <p className="text-xs text-slate-400">Position</p>
                                <p className="text-base font-bold text-blue-600">{getOrdinal(position)}</p>
                              </div>
                              <div className="text-center px-3 py-1.5 bg-emerald-50 rounded-xl">
                                <p className="text-xs text-slate-400">Avg %</p>
                                <p className="text-base font-bold text-emerald-600">{sData.percentage}%</p>
                              </div>
                            </>
                          )}
                          {/* Print All button */}
                          {examGroups.length > 1 && (
                            <button
                              onClick={() => printAllExams(selectedStudent, examGroups, schoolName, settings?.logo_url ?? null, selectedGrade, gradeSystem, resultTemplateId, (settings as any)?.principal_name)}
                              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
                              <Printer className="w-4 h-4" /> Print All Exams
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* One card per exam group */}
                    {examGroups.map(group => (
                      <div key={`${group.examType}_${group.examMonth}`} className="card space-y-3">
                        {/* Exam group header */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <span className="inline-block bg-blue-900 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide mb-1">
                              {group.label}
                            </span>
                            <div className="flex items-center gap-3 mt-1">
                              <span className={`text-sm font-bold ${group.percentage >= gradeSystem.passing_percentage ? 'text-emerald-600' : 'text-red-500'}`}>
                                {group.totalObtained}/{group.totalMax} ({group.percentage}%)
                              </span>
                              {gradeSystem.grade_mode === 'letter' && (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold">{group.grade}</span>
                              )}
                              <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${group.passFail === 'pass' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                {group.passFail === 'pass' ? 'PASS' : 'FAIL'}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => printSingleExamCard(selectedStudent, group, schoolName, settings?.logo_url ?? null, selectedGrade, position, gradeSystem, resultTemplateId, (settings as any)?.principal_name)}
                            className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors">
                            <Printer className="w-3.5 h-3.5" /> Print This Result
                          </button>
                        </div>

                        {/* Subject table */}
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
                            {group.rows.map(r => {
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
                              <td className="p-3 text-center font-bold text-slate-700">{group.totalObtained}</td>
                              <td className="p-3 text-center font-bold text-slate-700">{group.totalMax}</td>
                              <td className="p-3 text-center font-bold">
                                <span className={group.percentage >= gradeSystem.passing_percentage ? 'text-emerald-600' : 'text-red-500'}>{group.percentage}%</span>
                              </td>
                              {gradeSystem.grade_mode === 'letter' && (
                                <td className="p-3 text-center">
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-bold">{group.grade}</span>
                                </td>
                              )}
                              <td className="p-3 text-center">
                                {group.passFail === 'pass'
                                  ? <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold">PASS</span>
                                  : <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-lg text-sm font-bold">FAIL</span>}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ))}

                    {/* Print all at bottom too if multiple exams */}
                    {examGroups.length > 1 && (
                      <button
                        onClick={() => printAllExams(selectedStudent, examGroups, schoolName, settings?.logo_url ?? null, selectedGrade, gradeSystem, resultTemplateId, (settings as any)?.principal_name)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors w-fit">
                        <Printer className="w-4 h-4" /> Print Full Year Report Card
                      </button>
                    )}
                  </div>
                );
              })()}
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
                <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-800">Class {selectedGrade} — {examLabel}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Click any student to see their full report card</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowTemplatePicker(v => !v)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors">
                      <Palette className="w-3.5 h-3.5" /> Card Template: {getTemplate(resultTemplateId).name}
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTemplatePicker ? 'rotate-180' : ''}`} />
                    </button>
                    <button onClick={() => printClassMarksheet(withPositions, subjects, schoolName, settings?.logo_url ?? null, selectedGrade, examLabel, gradeSystem)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors">
                      <Printer className="w-3.5 h-3.5" /> Print Marksheet
                    </button>
                    {withPositions.length > 0 && (
                      <button onClick={() => printAllResultCards(withPositions, schoolName, settings?.logo_url ?? null, selectedGrade, examLabel, gradeSystem, resultTemplateId, (settings as any)?.principal_name)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors">
                        <Printer className="w-3.5 h-3.5" /> Print All Result Cards
                      </button>
                    )}
                    {withPositions.length > 0 && (() => {
                      const currentKey = examGroupKey(examType, examType === 'monthly' ? selectedMonth : null, selectedYear);
                      const isPublished = publishedExamKey === currentKey;
                      return (
                        <button
                          onClick={publishResult}
                          disabled={publishLoading}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 ${
                            isPublished
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-orange-500 text-white hover:bg-orange-600'
                          }`}
                        >
                          {publishLoading
                            ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                            : isPublished
                              ? <CheckCircle className="w-3.5 h-3.5" />
                              : <Trophy className="w-3.5 h-3.5" />
                          }
                          {isPublished ? 'Published ✓' : 'Publish to Parents'}
                        </button>
                      );
                    })()}
                  </div>
                </div>

                {publishMsg && (
                  <div className={`px-4 py-2.5 text-sm font-medium border-b flex items-center gap-2 ${
                    publishMsg.includes('unpublished') || publishMsg.includes('Error')
                      ? 'bg-slate-50 text-slate-600 border-slate-100'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  }`}>
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    {publishMsg}
                  </div>
                )}

                {showTemplatePicker && (
                  <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Choose Result Card Template</p>
                      {templateSaving && <span className="text-xs text-slate-400">Saving…</span>}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {CERT_TEMPLATES.map(t => {
                        const selected = t.id === resultTemplateId;
                        return (
                          <button key={t.id} onClick={() => chooseTemplate(t.id)}
                            className={`relative rounded-xl overflow-hidden border-2 transition-all text-left ${selected ? 'border-blue-600 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}>
                            <div style={{ background: t.bg, padding: '10px 8px', minHeight: 64 }} className="flex flex-col items-center justify-center gap-1.5">
                              <div style={{
                                width: 30, height: 22, borderRadius: t.ornaments ? 3 : 4,
                                border: `2px solid ${t.borderOuter}`,
                                boxShadow: `inset 0 0 0 2px ${t.bg}, inset 0 0 0 3px ${t.borderInner}`,
                              }} />
                              <span style={{ fontFamily: t.headingFont, color: t.schoolNameColor, fontSize: 9, fontWeight: 700, letterSpacing: '.04em' }}>
                                Aa
                              </span>
                            </div>
                            <div className="bg-white px-2 py-1.5 text-center">
                              <p className="text-[11px] font-semibold text-slate-700 leading-tight">{t.name}</p>
                            </div>
                            {selected && (
                              <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-3">This template applies to every result card printed for this school — single, full-year, and bulk class prints.</p>
                  </div>
                )}
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