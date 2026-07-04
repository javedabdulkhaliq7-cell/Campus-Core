// src/components/ParentResultsTab.tsx
import { useEffect, useState } from 'react';
import { parentSupabase } from '../lib/parentSupabaseClient';
import { Download, Lock } from 'lucide-react';

// ── Reuse the same cert rendering logic from admin Results.tsx ──
interface CertTheme {
  id: string; name: string; ornaments: boolean;
  bg: string; borderOuter: string; borderInner: string;
  ornamentColorDark: string; ornamentColorLight: string;
  headingFont: string; bodyFont: string;
  schoolNameColor: string; titleColor: string; textColor: string; mutedColor: string;
  cardBg: string; cardBorder: string;
  bannerBg: string; bannerBorder: string; bannerText: string; bannerMuted: string;
  tableHeadBg: string; tableHeadBorder: string; tableHeadText: string; rowBorder: string;
  logoBorder: string; photoBg: string; photoText: string;
  passBg: string; passText: string; failBg: string; failText: string;
}

const CERT_TEMPLATES: CertTheme[] = [
  { id:'gold_classic',name:'Gold Classic',ornaments:true,bg:'#FEFCF3',borderOuter:'#8B6914',borderInner:'#C5973A',ornamentColorDark:'#8B6914',ornamentColorLight:'#C5973A',headingFont:"'Cinzel',serif",bodyFont:"'Cormorant Garamond',Georgia,serif",schoolNameColor:'#1B3A6B',titleColor:'#5C1010',textColor:'#1A1008',mutedColor:'#5A4A2A',cardBg:'#FBF7E8',cardBorder:'#C5973A',bannerBg:'#1B3A6B',bannerBorder:'#8B6914',bannerText:'#FEFCF3',bannerMuted:'#D9C896',tableHeadBg:'#F5EFD9',tableHeadBorder:'#C5973A',tableHeadText:'#8B6914',rowBorder:'#E5DCC0',logoBorder:'#C5973A',photoBg:'#1B3A6B',photoText:'#FEFCF3',passBg:'#DCEEDF',passText:'#1F6B3D',failBg:'#F5DADA',failText:'#8B1E1E' },
  { id:'navy_modern',name:'Navy Modern',ornaments:false,bg:'#FFFFFF',borderOuter:'#1B3A6B',borderInner:'#9DB6DD',ornamentColorDark:'#1B3A6B',ornamentColorLight:'#9DB6DD',headingFont:"'Poppins',sans-serif",bodyFont:"'Inter',Arial,sans-serif",schoolNameColor:'#0F2A52',titleColor:'#1B3A6B',textColor:'#1E293B',mutedColor:'#64748B',cardBg:'#F2F6FC',cardBorder:'#9DB6DD',bannerBg:'#1B3A6B',bannerBorder:'#1B3A6B',bannerText:'#FFFFFF',bannerMuted:'#BFD3F0',tableHeadBg:'#EAF1FB',tableHeadBorder:'#9DB6DD',tableHeadText:'#1B3A6B',rowBorder:'#E2E8F0',logoBorder:'#9DB6DD',photoBg:'#1B3A6B',photoText:'#FFFFFF',passBg:'#D1FAE5',passText:'#065F46',failBg:'#FEE2E2',failText:'#991B1B' },
  { id:'minimal_mono',name:'Minimal Mono',ornaments:false,bg:'#FFFFFF',borderOuter:'#1E293B',borderInner:'#CBD5E1',ornamentColorDark:'#1E293B',ornamentColorLight:'#94A3B8',headingFont:"'Inter',Arial,sans-serif",bodyFont:"'Inter',Arial,sans-serif",schoolNameColor:'#0F172A',titleColor:'#0F172A',textColor:'#1E293B',mutedColor:'#64748B',cardBg:'#F8FAFC',cardBorder:'#E2E8F0',bannerBg:'#0F172A',bannerBorder:'#0F172A',bannerText:'#FFFFFF',bannerMuted:'#CBD5E1',tableHeadBg:'#F1F5F9',tableHeadBorder:'#E2E8F0',tableHeadText:'#475569',rowBorder:'#F1F5F9',logoBorder:'#E2E8F0',photoBg:'#0F172A',photoText:'#FFFFFF',passBg:'#DCFCE7',passText:'#166534',failBg:'#FEE2E2',failText:'#991B1B' },
  { id:'maroon_heritage',name:'Maroon Heritage',ornaments:true,bg:'#FCF8F4',borderOuter:'#6B1414',borderInner:'#B08850',ornamentColorDark:'#6B1414',ornamentColorLight:'#B08850',headingFont:"'Cinzel',serif",bodyFont:"'Cormorant Garamond',Georgia,serif",schoolNameColor:'#6B1414',titleColor:'#6B1414',textColor:'#241412',mutedColor:'#6B4A3A',cardBg:'#F7ECE3',cardBorder:'#B08850',bannerBg:'#6B1414',bannerBorder:'#B08850',bannerText:'#FCF8F4',bannerMuted:'#E8C9A0',tableHeadBg:'#F1E0CE',tableHeadBorder:'#B08850',tableHeadText:'#6B1414',rowBorder:'#E8D7C3',logoBorder:'#B08850',photoBg:'#6B1414',photoText:'#FCF8F4',passBg:'#DCEEDF',passText:'#1F6B3D',failBg:'#F5DADA',failText:'#8B1E1E' },
  { id:'emerald_elegant',name:'Emerald Elegant',ornaments:true,bg:'#F7FBF8',borderOuter:'#0F4C3A',borderInner:'#C5973A',ornamentColorDark:'#0F4C3A',ornamentColorLight:'#C5973A',headingFont:"'Cinzel',serif",bodyFont:"'Cormorant Garamond',Georgia,serif",schoolNameColor:'#0F4C3A',titleColor:'#0F4C3A',textColor:'#142420',mutedColor:'#3F5A50',cardBg:'#EAF4EE',cardBorder:'#C5973A',bannerBg:'#0F4C3A',bannerBorder:'#C5973A',bannerText:'#F7FBF8',bannerMuted:'#D9C896',tableHeadBg:'#E3F0E7',tableHeadBorder:'#C5973A',tableHeadText:'#0F4C3A',rowBorder:'#D7E8DC',logoBorder:'#C5973A',photoBg:'#0F4C3A',photoText:'#F7FBF8',passBg:'#DCEEDF',passText:'#1F6B3D',failBg:'#F5DADA',failText:'#8B1E1E' },
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

function calcPercentage(obtained: number, total: number) {
  if (total === 0) return 0;
  return Math.round((obtained / total) * 100 * 10) / 10;
}

function getOrdinal(n: number) {
  const s = ['th','st','nd','rd']; const v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

function buildCertHTML(
  student: { full_name: string; roll_number?: string; photo_url?: string | null },
  results: any[],
  examLabel: string,
  classGrade: number,
  position: number,
  schoolName: string,
  logoUrl: string | null,
  gradeSystem: { grade_mode: string; passing_percentage: number },
  templateId: string,
) {
  const theme = getTemplate(templateId);
  const totalObtained = results.reduce((s, r) => s + Number(r.obtained_marks), 0);
  const totalMax = results.reduce((s, r) => s + Number(r.total_marks), 0);
  const pct = calcPercentage(totalObtained, totalMax);
  const passFail = results.every(r => r.pass_fail === 'pass') ? 'pass' : 'fail';
  const grade = results[0]?.grade ?? '';

  const ornamentsHTML = theme.ornaments ? `
    <div style="position:absolute;top:9mm;left:9mm;">${certOrnamentSVG(0, theme)}</div>
    <div style="position:absolute;top:9mm;right:9mm;">${certOrnamentSVG(90, theme)}</div>
    <div style="position:absolute;bottom:9mm;left:9mm;">${certOrnamentSVG(270, theme)}</div>
    <div style="position:absolute;bottom:9mm;right:9mm;">${certOrnamentSVG(180, theme)}</div>` : '';

  const dividerHTML = `<div style="display:flex;align-items:center;width:100%;margin:6px 0 10px;">
    <div style="flex:1;height:1px;background:linear-gradient(to right,transparent,${theme.borderInner} 40%,${theme.borderOuter} 50%);"></div>
    <span style="color:${theme.borderOuter};font-size:13px;margin:0 10px;line-height:1;">◆</span>
    <div style="flex:1;height:1px;background:linear-gradient(to left,transparent,${theme.borderInner} 40%,${theme.borderOuter} 50%);"></div>
  </div>`;

  const logoHTML = logoUrl
    ? `<img src="${logoUrl}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid ${theme.logoBorder};margin-bottom:6px;" />`
    : `<div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;border:2px solid ${theme.logoBorder};background:${theme.bg};margin-bottom:6px;"><div style="width:24px;height:24px;background:${theme.schoolNameColor};border-radius:5px;"></div></div>`;

  const photoHTML = student.photo_url
    ? `<img src="${student.photo_url}" style="width:58px;height:58px;border-radius:10px;object-fit:cover;border:2px solid ${theme.logoBorder};flex-shrink:0;" />`
    : `<div style="width:58px;height:58px;border-radius:10px;background:${theme.photoBg};color:${theme.photoText};display:flex;align-items:center;justify-content:center;font-family:${theme.headingFont};font-size:22px;font-weight:700;flex-shrink:0;border:2px solid ${theme.logoBorder};">${(student.full_name||'?').charAt(0).toUpperCase()}</div>`;

  const fields = [
    ['Student Name', student.full_name],
    ['Roll No.', student.roll_number ?? '—'],
    ['Class', `Class ${classGrade}`],
    ['Exam', examLabel],
    ['Position', getOrdinal(position)],
    ['Overall', `${totalObtained}/${totalMax} (${pct}%)`],
  ];

  const infoGridHTML = `<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">
    ${photoHTML}
    <div style="flex:1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;background:${theme.cardBg};border:1px solid ${theme.cardBorder};border-radius:4px;padding:10px 14px;">
      ${fields.map(([l,v]) => `<div>
        <p style="font-family:${theme.headingFont};font-size:8.5px;font-weight:700;color:${theme.borderOuter};text-transform:uppercase;letter-spacing:.07em;margin-bottom:2px;">${l}</p>
        <p style="font-size:13px;font-weight:600;color:${theme.textColor};">${v}</p>
      </div>`).join('')}
    </div>
  </div>`;

  const tableRowsHTML = results.map(r => {
    const rowPct = calcPercentage(Number(r.obtained_marks), Number(r.total_marks));
    return `<tr style="border-bottom:1px solid ${theme.rowBorder};">
      <td style="padding:7px 10px;font-size:12.5px;color:${theme.textColor};font-weight:500;">${r.subject_name}</td>
      <td style="padding:7px 10px;font-size:12.5px;text-align:center;font-weight:700;color:${theme.textColor};">${r.obtained_marks}</td>
      <td style="padding:7px 10px;font-size:12.5px;text-align:center;color:${theme.mutedColor};">${r.total_marks}</td>
      <td style="padding:7px 10px;font-size:12.5px;text-align:center;font-weight:600;color:${rowPct>=gradeSystem.passing_percentage?theme.passText:theme.failText};">${rowPct}%</td>
      ${gradeSystem.grade_mode==='letter'?`<td style="padding:7px 10px;font-size:12.5px;text-align:center;font-weight:700;color:${theme.schoolNameColor};">${r.grade}</td>`:''}
      <td style="padding:7px 10px;font-size:11px;text-align:center;">
        <span style="background:${r.pass_fail==='pass'?theme.passBg:theme.failBg};color:${r.pass_fail==='pass'?theme.passText:theme.failText};padding:2px 9px;border-radius:3px;font-weight:700;">${r.pass_fail?.toUpperCase()}</span>
      </td>
    </tr>`;
  }).join('');

  const tableHTML = `<div style="border:1px solid ${theme.cardBorder};border-radius:4px;overflow:hidden;margin-bottom:12px;">
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:${theme.tableHeadBg};border-bottom:1px solid ${theme.tableHeadBorder};">
        ${['Subject','Obtained','Total','%',...(gradeSystem.grade_mode==='letter'?['Grade']:[]),'Result']
          .map(h=>`<th style="padding:7px 10px;font-family:${theme.headingFont};font-size:9.5px;font-weight:700;color:${theme.tableHeadText};text-transform:uppercase;letter-spacing:.05em;${h==='Subject'?'text-align:left':'text-align:center'}">${h}</th>`).join('')}
      </tr></thead>
      <tbody>${tableRowsHTML}</tbody>
    </table>
  </div>`;

  const bannerHTML = `<div style="background:${theme.bannerBg};border:1px solid ${theme.bannerBorder};border-radius:4px;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
    <span style="font-family:${theme.headingFont};font-size:11.5px;font-weight:700;color:${theme.bannerText};letter-spacing:.05em;text-transform:uppercase;">${examLabel} — Result</span>
    <div style="display:flex;align-items:center;gap:14px;">
      <span style="font-size:13px;color:${theme.bannerMuted};">${totalObtained} / ${totalMax}</span>
      <span style="font-family:${theme.headingFont};font-size:15px;font-weight:800;color:${theme.bannerText};">${pct}%</span>
      ${gradeSystem.grade_mode==='letter'?`<span style="font-family:${theme.headingFont};font-size:14px;font-weight:800;color:${theme.bannerMuted};">${grade}</span>`:''}
      <span style="background:${passFail==='pass'?theme.passBg:theme.failBg};color:${passFail==='pass'?theme.passText:theme.failText};font-family:${theme.headingFont};font-size:11px;font-weight:800;padding:3px 14px;border-radius:3px;">${passFail==='pass'?'PASS':'FAIL'}</span>
    </div>
  </div>`;

  const sigHTML = `<div style="display:flex;justify-content:space-between;margin-top:16mm;padding:0 4mm;">
    <div style="text-align:center;min-width:140px;">
      <div style="height:34px;border-bottom:1.5px solid ${theme.borderOuter};margin-bottom:4px;"></div>
      <p style="font-family:${theme.headingFont};font-size:10px;font-weight:700;color:${theme.schoolNameColor};letter-spacing:.06em;">CLASS TEACHER</p>
    </div>
    <div style="text-align:center;min-width:160px;">
      <div style="height:34px;border-bottom:1.5px solid ${theme.borderOuter};margin-bottom:4px;"></div>
      <p style="font-family:${theme.headingFont};font-size:10px;font-weight:700;color:${theme.schoolNameColor};letter-spacing:.06em;">PRINCIPAL</p>
      <p style="font-size:9px;color:${theme.mutedColor};margin-top:1px;">${schoolName}</p>
    </div>
  </div>`;

  const footerHTML = `<p style="position:absolute;bottom:11mm;left:50%;transform:translateX(-50%);font-size:9px;color:${theme.mutedColor};font-style:italic;text-align:center;">
    Issued on ${new Date().toLocaleDateString('en-PK',{day:'2-digit',month:'long',year:'numeric'})} · Campus Core
  </p>`;

  const borderWidth = theme.ornaments ? '3px' : '2px';
  const borderRadius = theme.ornaments ? '' : 'border-radius:6px;';

  return `<!DOCTYPE html><html><head>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Poppins:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap">
    <style>* { margin:0; padding:0; box-sizing:border-box; } body { font-family:${theme.bodyFont}; background:${theme.bg}; }
    @media print { @page { size:A4; margin:0; } }</style>
  </head><body>
    <div style="padding:17mm 19mm;min-height:297mm;font-family:${theme.bodyFont};background:${theme.bg};position:relative;color:${theme.textColor};">
      <div style="position:absolute;inset:8mm;border:${borderWidth} solid ${theme.borderOuter};${borderRadius}pointer-events:none;"></div>
      <div style="position:absolute;inset:11mm;border:1px solid ${theme.borderInner};${borderRadius}pointer-events:none;"></div>
      ${ornamentsHTML}
      <div style="text-align:center;margin-bottom:8px;">
        ${logoHTML}
        <div style="font-family:${theme.headingFont};font-size:16px;font-weight:700;color:${theme.schoolNameColor};letter-spacing:.1em;text-transform:uppercase;">${schoolName}</div>
        ${dividerHTML}
        <div style="font-family:${theme.headingFont};font-size:19px;font-weight:700;color:${theme.titleColor};letter-spacing:.13em;text-transform:uppercase;margin:2px 0;">Official Result Card</div>
        <div style="font-family:${theme.headingFont};font-size:10.5px;font-weight:600;color:${theme.schoolNameColor};letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px;">${examLabel} · Class ${classGrade}</div>
        ${dividerHTML}
      </div>
      ${infoGridHTML}
      ${tableHTML}
      ${bannerHTML}
      ${sigHTML}
      ${footerHTML}
    </div>
  </body></html>`;
}

// ── Types ──
interface PublishedExam {
  id: string;
  exam_type: string;
  exam_month: number | null;
  exam_year: number;
  template_id: string;
  scope_id: string;
}

interface StudentResult {
  id: string;
  subject_name: string;
  total_marks: number;
  obtained_marks: number;
  grade: string;
  pass_fail: string;
  class_grade: number;
  exam_type: string;
  exam_month: number | null;
  exam_year: number;
}

interface GradeSystem { grade_mode: string; passing_percentage: number; }

interface Props {
  studentId: string;
  studentName: string;
  rollNumber?: string;
  photoUrl?: string | null | undefined;
  classGrade?: string;
}

const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

export default function ParentResultsTab({ studentId, studentName, rollNumber, photoUrl, classGrade }: Props) {
  const [publishedExams, setPublishedExams] = useState<PublishedExam[]>([]);
  const [allResults, setAllResults] = useState<StudentResult[]>([]);
  const [gradeSystem, setGradeSystem] = useState<GradeSystem>({ grade_mode: 'percentage', passing_percentage: 40 });
  const [schoolName, setSchoolName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    loadData();
  }, [studentId]);

  async function loadData() {
    setLoading(true);

    // Get student's school_id first
    const { data: studentData } = await parentSupabase
      .from('students')
      .select('school_id, current_grade')
      .eq('id', studentId)
      .single();

    if (!studentData) { setLoading(false); return; }
    const schoolId = studentData.school_id;
    const grade = Number(studentData.current_grade ?? classGrade ?? 1);

    // Fetch in parallel
    const [classRes, resultsRes, gsRes, settingsRes] = await Promise.all([
      parentSupabase
        .from('classes')
        .select('id')
        .eq('school_id', schoolId)
        .eq('grade', grade)
        .maybeSingle(),
      parentSupabase
        .from('student_results')
        .select('id, subject_name, total_marks, obtained_marks, grade, pass_fail, class_grade, exam_type, exam_month, exam_year')
        .eq('student_id', studentId),
      parentSupabase
        .from('grade_system')
        .select('grade_mode, passing_percentage')
        .eq('school_id', schoolId)
        .single(),
      parentSupabase
        .from('school_settings')
        .select('school_name, logo_url')
        .eq('school_id', schoolId)
        .single(),
    ]);

    setAllResults(resultsRes.data || []);
    if (gsRes.data) setGradeSystem(gsRes.data);
    if (settingsRes.data) {
      setSchoolName(settingsRes.data.school_name || '');
      setLogoUrl(settingsRes.data.logo_url || null);
    }

    // Now fetch published exams using the class UUID
    const classId = classRes.data?.id;
    if (classId) {
      const { data: published } = await parentSupabase
        .from('share_results_log')
        .select('id, exam_type, exam_month, exam_year, template_id, scope_id')
        .eq('school_id', schoolId)
        .eq('scope', 'class')
        .eq('scope_id', classId)
        .eq('is_published', true)
        .order('exam_year', { ascending: false })
        .order('exam_month', { ascending: false });

      setPublishedExams(published || []);
      if (published && published.length > 0) {
        setSelectedExamId(published[0].id);
      }
    }
    setLoading(false);
  }

  function examLabel(exam: PublishedExam) {
    if (exam.exam_type === 'monthly') {
      return `Monthly — ${MONTHS[exam.exam_month ?? 0]} ${exam.exam_year}`;
    }
    if (exam.exam_type === 'midterm') return `Midterm ${exam.exam_year}`;
    return `Annual ${exam.exam_year}`;
  }


  const selectedExam = publishedExams.find(e => e.id === selectedExamId) ?? null;

  // Deduplicate: keep only one row per subject (latest by id)
  const rawResults = selectedExam
    ? allResults.filter(r =>
        r.exam_type === selectedExam.exam_type &&
        r.exam_year === selectedExam.exam_year &&
        (selectedExam.exam_type !== 'monthly' || r.exam_month === selectedExam.exam_month)
      )
    : [];

  const seen = new Set<string>();
  const selectedResults = rawResults.filter(r => {
    const key = r.subject_name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Build cert HTML for iframe preview
  const certHTML = selectedExam && selectedResults.length > 0
    ? buildCertHTML(
        { full_name: studentName, roll_number: rollNumber, photo_url: photoUrl },
        selectedResults,
        examLabel(selectedExam),
        Number(selectedExam.scope_id),
        1,
        schoolName,
        logoUrl,
        gradeSystem,
        selectedExam.template_id ?? 'gold_classic',
      )
    : null;

  function openPrintWindow(exam: PublishedExam) {
    if (!certHTML) return;
    const win = window.open('', '_blank', 'width=960,height=700');
    if (!win) return;
    win.document.write(certHTML);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  }

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  );

  if (publishedExams.length === 0) return (
    <div className="flex flex-col items-center justify-center py-14 px-4 text-center gap-3">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
        <Lock className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-slate-600 font-medium text-sm">No results published yet</p>
      <p className="text-slate-400 text-xs max-w-xs">The school will publish results here once they are ready. Check back later.</p>
    </div>
  );

  return (
    <div className="space-y-3 p-4">
      {/* Exam selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {publishedExams.map(exam => {
          const isActive = selectedExamId === exam.id;
          return (
            <button key={exam.id} onClick={() => setSelectedExamId(exam.id)}
              className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                isActive ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
              }`}>
              <div className="font-semibold capitalize">{exam.exam_type}</div>
              <div className="opacity-80">{exam.exam_type === 'monthly' ? `${MONTHS[exam.exam_month ?? 0].slice(0,3)} ` : ''}{exam.exam_year}</div>
            </button>
          );
        })}
      </div>

      {selectedExam && certHTML && (
        <>
          {/* Download button */}
          <div className="flex justify-end">
            <button
              onClick={() => openPrintWindow(selectedExam)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>
          </div>

          {/* Certificate preview as iframe */}
          <div className="w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
            <iframe
              srcDoc={certHTML}
              title="Result Certificate"
              className="w-full"
              style={{ height: '780px', border: 'none' }}
              sandbox="allow-same-origin"
            />
          </div>

          <p className="text-center text-xs text-slate-400 pb-1">
            Tap "Download PDF" to save or print the official result card
          </p>
        </>
      )}

      {selectedExam && selectedResults.length === 0 && (
        <div className="text-center py-8 text-slate-400 text-sm">
          Result data not found for this exam.
        </div>
      )}
    </div>
  );
}