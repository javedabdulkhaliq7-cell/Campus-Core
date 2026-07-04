// ─── certificate.types.ts ───────────────────────────────────────────────────

import React from "react";

export interface SchoolSettings {
  school_name: string;
  principal_name: string;
  logo_url: string | null;
}

// ─── Certificate visual templates ────────────────────────────────────────────
// 5 presets a principal can choose from; chosen one is saved per-school and
// applied to every certificate type rendered/printed/downloaded.

export interface CertTheme {
  id: string;
  name: string;
  ornaments: boolean;          // corner flourishes on/off
  bg: string;
  borderOuter: string;
  borderInner: string;
  ornamentDark: string;
  ornamentLight: string;
  headingFont: string;          // school name / title / signature labels
  bodyFont: string;             // certificate body text
  schoolNameColor: string;
  titleColor: string;           // certificate subtitle e.g. "CHARACTER CERTIFICATE"
  textColor: string;            // body paragraph
  mutedColor: string;           // cert no / date / principal name
  logoBorder: string;
  sealRingColor: string;        // fallback seal outer ring
  sealBuildingColor: string;    // fallback seal silhouette
}

export const CERT_TEMPLATES: CertTheme[] = [
  {
    id: "gold_classic", name: "Gold Classic", ornaments: true,
    bg: "#FEFCF3", borderOuter: "#8B6914", borderInner: "#C5973A",
    ornamentDark: "#8B6914", ornamentLight: "#C5973A",
    headingFont: "'Cinzel', serif", bodyFont: "'Cormorant Garamond', Georgia, serif",
    schoolNameColor: "#1B3A6B", titleColor: "#5C1010", textColor: "#1A1008", mutedColor: "#5A4A2A",
    logoBorder: "#C5973A", sealRingColor: "#8B6914", sealBuildingColor: "#1B3A6B",
  },
  {
    id: "navy_modern", name: "Navy Modern", ornaments: false,
    bg: "#FFFFFF", borderOuter: "#1B3A6B", borderInner: "#9DB6DD",
    ornamentDark: "#1B3A6B", ornamentLight: "#9DB6DD",
    headingFont: "'Poppins', sans-serif", bodyFont: "'Inter', Arial, sans-serif",
    schoolNameColor: "#0F2A52", titleColor: "#1B3A6B", textColor: "#1E293B", mutedColor: "#64748B",
    logoBorder: "#9DB6DD", sealRingColor: "#1B3A6B", sealBuildingColor: "#1B3A6B",
  },
  {
    id: "minimal_mono", name: "Minimal Mono", ornaments: false,
    bg: "#FFFFFF", borderOuter: "#1E293B", borderInner: "#CBD5E1",
    ornamentDark: "#1E293B", ornamentLight: "#94A3B8",
    headingFont: "'Inter', Arial, sans-serif", bodyFont: "'Inter', Arial, sans-serif",
    schoolNameColor: "#0F172A", titleColor: "#0F172A", textColor: "#1E293B", mutedColor: "#64748B",
    logoBorder: "#E2E8F0", sealRingColor: "#1E293B", sealBuildingColor: "#1E293B",
  },
  {
    id: "maroon_heritage", name: "Maroon Heritage", ornaments: true,
    bg: "#FCF8F4", borderOuter: "#6B1414", borderInner: "#B08850",
    ornamentDark: "#6B1414", ornamentLight: "#B08850",
    headingFont: "'Cinzel', serif", bodyFont: "'Cormorant Garamond', Georgia, serif",
    schoolNameColor: "#6B1414", titleColor: "#6B1414", textColor: "#241412", mutedColor: "#6B4A3A",
    logoBorder: "#B08850", sealRingColor: "#6B1414", sealBuildingColor: "#6B1414",
  },
  {
    id: "emerald_elegant", name: "Emerald Elegant", ornaments: true,
    bg: "#F7FBF8", borderOuter: "#0F4C3A", borderInner: "#C5973A",
    ornamentDark: "#0F4C3A", ornamentLight: "#C5973A",
    headingFont: "'Cinzel', serif", bodyFont: "'Cormorant Garamond', Georgia, serif",
    schoolNameColor: "#0F4C3A", titleColor: "#0F4C3A", textColor: "#142420", mutedColor: "#3F5A50",
    logoBorder: "#C5973A", sealRingColor: "#0F4C3A", sealBuildingColor: "#0F4C3A",
  },
];

export function getCertTemplate(id: string | undefined | null): CertTheme {
  return CERT_TEMPLATES.find((t) => t.id === id) ?? CERT_TEMPLATES[0];
}

// Lets the <S> accent-underline component (used inside every certificate's
// bodyTemplate) pick up the active theme's color without threading a theme
// prop through all 11 certificate definitions individually.
export const CertThemeContext = React.createContext<CertTheme>(CERT_TEMPLATES[0]);

// ─── Field definitions ────────────────────────────────────────────────────────

export type FieldType = "text" | "textarea" | "date" | "number";

export interface CertificateField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
}

// ─── Certificate data (dynamic per type) ─────────────────────────────────────

export type CertificateData = Record<string, string>;

// ─── Certificate definition ───────────────────────────────────────────────────

export interface CertificateDefinition {
  id: CertificateTypeId;
  title: string;
  subtitle: string; // e.g. "CHARACTER CERTIFICATE"
  icon: string; // emoji for the card grid
  fields: CertificateField[];
  bodyTemplate: (data: CertificateData) => React.ReactNode;
}

// ─── 11 certificate type IDs ──────────────────────────────────────────────────

export type CertificateTypeId =
  | "character"
  | "bonafide"
  | "transfer"
  | "migration"
  | "provisional"
  | "extracurricular"
  | "merit"
  | "scholarship"
  | "appreciation"
  | "completion"
  | "internship";

// ─── Ordinal helper ───────────────────────────────────────────────────────────

export function ordinal(n: string | number): string {
  const num = Number(n);
  if (isNaN(num)) return String(n);
  const s = ["th", "st", "nd", "rd"];
  const v = num % 100;
  return num + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ─── Certificate number generator ────────────────────────────────────────────

export function generateCertificateNumber(typeId: CertificateTypeId): string {
  const prefixMap: Record<CertificateTypeId, string> = {
    character: "CHR",
    bonafide: "BON",
    transfer: "TRF",
    migration: "MIG",
    provisional: "PRV",
    extracurricular: "EXT",
    merit: "MRT",
    scholarship: "SCH",
    appreciation: "APR",
    completion: "CMP",
    internship: "INT",
  };
  const year = new Date().getFullYear();
  const storageKey = `cert_counter_${typeId}_${year}`;
  const current = parseInt(localStorage.getItem(storageKey) || "0", 10);
  const next = current + 1;
  localStorage.setItem(storageKey, String(next));
  const prefix = prefixMap[typeId];
  return `CC-${prefix}-${year}-${String(next).padStart(4, "0")}`;
}

// ─── Today's date as YYYY-MM-DD ───────────────────────────────────────────────

export function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

// ─── Format date for display ──────────────────────────────────────────────────

export function formatDisplayDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ─── Strong span with theme-colored underline ────────────────────────────────

export function S({ children }: { children: React.ReactNode }) {
  const theme = React.useContext(CertThemeContext);
  return (
    <strong
      style={{
        fontWeight: 700,
        borderBottom: `1.5px solid ${theme.borderInner}`,
        paddingBottom: "1px",
      }}
    >
      {children}
    </strong>
  );
}

// ─── All 11 certificate definitions ──────────────────────────────────────────

export const CERTIFICATE_DEFINITIONS: CertificateDefinition[] = [
  // 1. Character Certificate
  {
    id: "character",
    title: "Character Certificate",
    subtitle: "CHARACTER CERTIFICATE",
    icon: "🎖️",
    fields: [
      { key: "student_name", label: "Student Name", type: "text", required: true },
      { key: "father_name", label: "Father's Name", type: "text", required: true },
      { key: "roll_number", label: "Roll Number", type: "text", required: true },
      { key: "class", label: "Class", type: "text", required: true },
      { key: "reason", label: "Purpose / Reason", type: "textarea", required: true },
      { key: "issue_date", label: "Issue Date", type: "date", required: true },
      { key: "certificate_number", label: "Certificate Number", type: "text" },
    ],
    bodyTemplate: (d) => (
      <>
        This is to certify that <S>{d.student_name || "___________"}</S>, son/daughter of{" "}
        <S>{d.father_name || "___________"}</S>, Roll No.{" "}
        <S>{d.roll_number || "___"}</S>, studying in Class{" "}
        <S>{d.class || "___"}</S> at this institution, is known to be of sound moral
        character and excellent conduct. Throughout his/her academic tenure, he/she has
        consistently upheld the values of integrity, discipline, and respect. This
        certificate is issued upon his/her request for the purpose of{" "}
        <S>{d.reason || "___________"}</S>.
      </>
    ),
  },

  // 2. Bonafide Certificate
  {
    id: "bonafide",
    title: "Bonafide Certificate",
    subtitle: "BONAFIDE CERTIFICATE",
    icon: "📋",
    fields: [
      { key: "student_name", label: "Student Name", type: "text", required: true },
      { key: "father_name", label: "Father's Name", type: "text", required: true },
      { key: "date_of_birth", label: "Date of Birth", type: "date", required: true },
      { key: "roll_number", label: "Roll Number", type: "text", required: true },
      { key: "class", label: "Class", type: "text", required: true },
      { key: "reason", label: "Purpose / Reason", type: "textarea", required: true },
      { key: "issue_date", label: "Issue Date", type: "date", required: true },
      { key: "certificate_number", label: "Certificate Number", type: "text" },
    ],
    bodyTemplate: (d) => (
      <>
        This is to certify that <S>{d.student_name || "___________"}</S>, son/daughter of{" "}
        <S>{d.father_name || "___________"}</S>, Date of Birth:{" "}
        <S>{d.date_of_birth ? formatDisplayDate(d.date_of_birth) : "___________"}</S>, Roll No.{" "}
        <S>{d.roll_number || "___"}</S>, is a bonafide student of Class{" "}
        <S>{d.class || "___"}</S> at this institution for the current academic session.
        This certificate is being issued upon his/her request for the purpose of{" "}
        <S>{d.reason || "___________"}</S>.
      </>
    ),
  },

  // 3. Transfer Certificate
  {
    id: "transfer",
    title: "Transfer Certificate",
    subtitle: "TRANSFER CERTIFICATE",
    icon: "🔄",
    fields: [
      { key: "student_name", label: "Student Name", type: "text", required: true },
      { key: "father_name", label: "Father's Name", type: "text", required: true },
      { key: "date_of_birth", label: "Date of Birth", type: "date", required: true },
      { key: "roll_number", label: "Roll Number", type: "text", required: true },
      { key: "class", label: "Class", type: "text", required: true },
      { key: "reason", label: "Reason for Leaving", type: "textarea", required: true },
      { key: "issue_date", label: "Issue Date", type: "date", required: true },
      { key: "certificate_number", label: "Certificate Number", type: "text" },
    ],
    bodyTemplate: (d) => (
      <>
        This is to certify that <S>{d.student_name || "___________"}</S>, son/daughter of{" "}
        <S>{d.father_name || "___________"}</S>, Date of Birth:{" "}
        <S>{d.date_of_birth ? formatDisplayDate(d.date_of_birth) : "___________"}</S>, Roll No.{" "}
        <S>{d.roll_number || "___"}</S>, was enrolled in Class{" "}
        <S>{d.class || "___"}</S> at this institution. He/She is hereby issued a Transfer
        Certificate upon leaving this institution. Reason for leaving:{" "}
        <S>{d.reason || "___________"}</S>. He/She has been found to be of good character
        with no outstanding dues.
      </>
    ),
  },

  // 4. Migration Certificate
  {
    id: "migration",
    title: "Migration Certificate",
    subtitle: "MIGRATION CERTIFICATE",
    icon: "🏫",
    fields: [
      { key: "student_name", label: "Student Name", type: "text", required: true },
      { key: "father_name", label: "Father's Name", type: "text", required: true },
      { key: "roll_number", label: "Roll Number", type: "text", required: true },
      { key: "class", label: "Class", type: "text", required: true },
      { key: "issue_date", label: "Issue Date", type: "date", required: true },
      { key: "certificate_number", label: "Certificate Number", type: "text" },
    ],
    bodyTemplate: (d) => (
      <>
        This is to certify that <S>{d.student_name || "___________"}</S>, son/daughter of{" "}
        <S>{d.father_name || "___________"}</S>, Roll No.{" "}
        <S>{d.roll_number || "___"}</S>, has satisfactorily completed his/her studies up
        to Class <S>{d.class || "___"}</S> from this institution. He/She is hereby granted
        permission to migrate to another recognized educational board, having fulfilled all
        requirements of this institution.
      </>
    ),
  },

  // 5. Provisional Certificate
  {
    id: "provisional",
    title: "Provisional Certificate",
    subtitle: "PROVISIONAL CERTIFICATE",
    icon: "📄",
    fields: [
      { key: "student_name", label: "Student Name", type: "text", required: true },
      { key: "father_name", label: "Father's Name", type: "text", required: true },
      { key: "roll_number", label: "Roll Number", type: "text", required: true },
      { key: "class", label: "Class", type: "text", required: true },
      { key: "marks", label: "Marks Obtained", type: "text", required: true },
      { key: "percentage", label: "Percentage", type: "text", required: true },
      { key: "issue_date", label: "Issue Date", type: "date", required: true },
      { key: "certificate_number", label: "Certificate Number", type: "text" },
    ],
    bodyTemplate: (d) => (
      <>
        This is to certify that <S>{d.student_name || "___________"}</S>, son/daughter of{" "}
        <S>{d.father_name || "___________"}</S>, Roll No.{" "}
        <S>{d.roll_number || "___"}</S>, of Class <S>{d.class || "___"}</S> appeared in
        the annual examination and obtained <S>{d.marks || "___"}</S> marks, achieving{" "}
        <S>{d.percentage ? `${d.percentage}%` : "___%"}</S>. This Provisional Certificate
        is issued as a temporary document pending the award of the original marksheet and
        certificates.
      </>
    ),
  },

  // 6. Extracurricular Certificate
  {
    id: "extracurricular",
    title: "Extracurricular Certificate",
    subtitle: "EXTRACURRICULAR CERTIFICATE",
    icon: "🏆",
    fields: [
      { key: "student_name", label: "Student Name", type: "text", required: true },
      { key: "father_name", label: "Father's Name", type: "text", required: true },
      { key: "class", label: "Class", type: "text", required: true },
      { key: "activity_name", label: "Activity Name", type: "text", required: true },
      { key: "position", label: "Role / Position", type: "text", required: true },
      { key: "issue_date", label: "Issue Date", type: "date", required: true },
      { key: "certificate_number", label: "Certificate Number", type: "text" },
    ],
    bodyTemplate: (d) => (
      <>
        This is to certify that <S>{d.student_name || "___________"}</S>, son/daughter of{" "}
        <S>{d.father_name || "___________"}</S>, of Class <S>{d.class || "___"}</S>,
        actively and commendably participated in{" "}
        <S>{d.activity_name || "___________"}</S>. He/She served as{" "}
        <S>{d.position || "___________"}</S> and displayed exceptional talent,
        enthusiasm, and collaborative spirit. This institution recognizes and appreciates
        his/her valuable contribution to enriching school life.
      </>
    ),
  },

  // 7. Merit Certificate
  {
    id: "merit",
    title: "Merit Certificate",
    subtitle: "MERIT CERTIFICATE",
    icon: "🥇",
    fields: [
      { key: "student_name", label: "Student Name", type: "text", required: true },
      { key: "father_name", label: "Father's Name", type: "text", required: true },
      { key: "class", label: "Class", type: "text", required: true },
      { key: "rank", label: "Rank (number)", type: "number", required: true, placeholder: "e.g. 1" },
      { key: "marks", label: "Marks Obtained", type: "text", required: true },
      { key: "percentage", label: "Percentage", type: "text", required: true },
      { key: "issue_date", label: "Issue Date", type: "date", required: true },
      { key: "certificate_number", label: "Certificate Number", type: "text" },
    ],
    bodyTemplate: (d) => (
      <>
        This is to certify that <S>{d.student_name || "___________"}</S>, son/daughter of{" "}
        <S>{d.father_name || "___________"}</S>, of Class <S>{d.class || "___"}</S>, has
        achieved <S>{d.rank ? ordinal(d.rank) : "___"}</S> position in the annual
        examination with a remarkable score of <S>{d.marks || "___"}</S> marks and an
        overall percentage of{" "}
        <S>{d.percentage ? `${d.percentage}%` : "___%"}</S>. This certificate is awarded
        in recognition of outstanding academic excellence and an unwavering commitment to
        learning.
      </>
    ),
  },

  // 8. Scholarship Certificate
  {
    id: "scholarship",
    title: "Scholarship Certificate",
    subtitle: "SCHOLARSHIP CERTIFICATE",
    icon: "🎓",
    fields: [
      { key: "student_name", label: "Student Name", type: "text", required: true },
      { key: "father_name", label: "Father's Name", type: "text", required: true },
      { key: "class", label: "Class", type: "text", required: true },
      { key: "issue_date", label: "Issue Date", type: "date", required: true },
      { key: "certificate_number", label: "Certificate Number", type: "text" },
    ],
    bodyTemplate: (d) => (
      <>
        This is to certify that <S>{d.student_name || "___________"}</S>, son/daughter of{" "}
        <S>{d.father_name || "___________"}</S>, a student of Class{" "}
        <S>{d.class || "___"}</S> at this institution, has been awarded a scholarship in
        acknowledgment of exceptional academic performance and dedication. This institution
        is proud to support his/her educational journey and encourages continued pursuit of
        excellence.
      </>
    ),
  },

  // 9. Appreciation Certificate
  {
    id: "appreciation",
    title: "Appreciation Certificate",
    subtitle: "CERTIFICATE OF APPRECIATION",
    icon: "🌟",
    fields: [
      { key: "student_name", label: "Recipient Name", type: "text", required: true },
      { key: "issue_date", label: "Issue Date", type: "date", required: true },
      { key: "certificate_number", label: "Certificate Number", type: "text" },
    ],
    bodyTemplate: (d) => (
      <>
        This certificate is presented to{" "}
        <S>{d.student_name || "___________"}</S> in sincere appreciation of his/her
        extraordinary dedication, exemplary conduct, and outstanding contributions to this
        institution. Recognized as a beacon of excellence and an inspiration to peers and
        colleagues alike, he/she has left an indelible mark upon the community of this
        school.
      </>
    ),
  },

  // 10. Completion Certificate
  {
    id: "completion",
    title: "Completion Certificate",
    subtitle: "CERTIFICATE OF COMPLETION",
    icon: "✅",
    fields: [
      { key: "student_name", label: "Student Name", type: "text", required: true },
      { key: "father_name", label: "Father's Name", type: "text", required: true },
      { key: "roll_number", label: "Roll Number", type: "text", required: true },
      { key: "class", label: "Class", type: "text", required: true },
      { key: "issue_date", label: "Issue Date", type: "date", required: true },
      { key: "certificate_number", label: "Certificate Number", type: "text" },
    ],
    bodyTemplate: (d) => (
      <>
        This is to certify that <S>{d.student_name || "___________"}</S>, son/daughter of{" "}
        <S>{d.father_name || "___________"}</S>, Roll No.{" "}
        <S>{d.roll_number || "___"}</S>, has successfully completed all academic
        requirements of <S>{d.class || "___"}</S> at this institution. He/She has
        demonstrated consistent effort, satisfactory conduct, and the competencies required
        to advance. This certificate marks the successful culmination of his/her studies at
        this level.
      </>
    ),
  },

  // 11. Internship / Experience Certificate
  {
    id: "internship",
    title: "Internship / Experience Certificate",
    subtitle: "INTERNSHIP & EXPERIENCE CERTIFICATE",
    icon: "💼",
    fields: [
      { key: "teacher_name", label: "Teacher / Staff Name", type: "text", required: true },
      { key: "designation", label: "Designation", type: "text", required: true },
      { key: "start_date", label: "Start Date", type: "date", required: true },
      { key: "end_date", label: "End Date", type: "date", required: true },
      { key: "issue_date", label: "Issue Date", type: "date", required: true },
      { key: "certificate_number", label: "Certificate Number", type: "text" },
    ],
    bodyTemplate: (d) => (
      <>
        This is to certify that{" "}
        <S>{d.teacher_name || "___________"}</S>, serving as{" "}
        <S>{d.designation || "___________"}</S>, has successfully completed a period of
        internship/work experience with this institution from{" "}
        <S>{d.start_date ? formatDisplayDate(d.start_date) : "___________"}</S> to{" "}
        <S>{d.end_date ? formatDisplayDate(d.end_date) : "___________"}</S>. During this
        tenure, he/she demonstrated professionalism, a keen aptitude for learning, and a
        commendable work ethic. We wish him/her every success in future endeavors.
      </>
    ),
  },
];

export const getCertificateDefinition = (id: CertificateTypeId) =>
  CERTIFICATE_DEFINITIONS.find((c) => c.id === id)!;