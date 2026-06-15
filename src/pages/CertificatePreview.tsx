// ─── CertificatePreview.tsx ───────────────────────────────────────────────────
// A4 Landscape (1100×778px) formal certificate with gold borders, ornaments,
// school logo, and signature blocks.

import React, { forwardRef } from "react";
import {
  CertificateTypeId,
  CertificateData,
  SchoolSettings,
  getCertificateDefinition,
  formatDisplayDate,
} from "./certificate.types";
// Add print styles to the document head (only once)
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.id = 'cert-print-styles';
  style.innerHTML = `
    @media print {
      body * {
        visibility: hidden !important;
      }
      #cert-print-root, #cert-print-root * {
        visibility: visible !important;
      }
      #cert-print-root {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .no-print {
        display: none !important;
      }
    }
  `;
  if (!document.getElementById('cert-print-styles')) {
    document.head.appendChild(style);
  }
}
// ─── Google Fonts loader (idempotent) ─────────────────────────────────────────

const FONT_LINK_ID = "campus-core-cert-fonts";
if (typeof document !== "undefined" && !document.getElementById(FONT_LINK_ID)) {
  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap";
  document.head.appendChild(link);
}

// ─── Print styles (injected once) ────────────────────────────────────────────

const PRINT_STYLE_ID = "campus-core-cert-print";
if (typeof document !== "undefined" && !document.getElementById(PRINT_STYLE_ID)) {
  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;
  style.innerHTML = `
    @media print {
      body > *:not(#cert-print-root) { display: none !important; }
      #cert-print-root { display: block !important; }
      #campus-core-certificate {
        width: 277mm !important;
        height: 190mm !important;
        box-shadow: none !important;
        margin: 0 !important;
        page-break-inside: avoid;
      }
      @page { size: A4 landscape; margin: 0; }
    }
  `;
  document.head.appendChild(style);
}

// ─── SVG Corner Ornament ──────────────────────────────────────────────────────

function CornerOrnament({
  rotate = 0,
  style,
}: {
  rotate?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        position: "absolute",
        ...style,
        transform: `rotate(${rotate}deg)`,
      }}
    >
      {/* Main corner L-arms */}
      <path
        d="M4 4 L24 4 M4 4 L4 24"
        stroke="#8B6914"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Inner corner */}
      <path
        d="M10 10 L20 10 M10 10 L10 20"
        stroke="#C5973A"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
      {/* Diagonal flourish */}
      <path
        d="M4 4 Q16 16 28 28"
        stroke="#C5973A"
        strokeWidth="0.8"
        fill="none"
        opacity="0.5"
      />
      {/* Diamond at corner tip */}
      <rect
        x="1.5"
        y="1.5"
        width="5"
        height="5"
        fill="#8B6914"
        transform="rotate(45 4 4)"
      />
      {/* Small circles on arms */}
      <circle cx="24" cy="4" r="1.5" fill="#C5973A" />
      <circle cx="4" cy="24" r="1.5" fill="#C5973A" />
      {/* Curling leaf */}
      <path
        d="M16 4 Q14 10 10 12 Q14 8 18 10"
        stroke="#C5973A"
        strokeWidth="0.8"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M4 16 Q10 14 12 10 Q8 14 10 18"
        stroke="#C5973A"
        strokeWidth="0.8"
        fill="none"
        opacity="0.7"
      />
    </svg>
  );
}

// ─── Decorative Divider ───────────────────────────────────────────────────────

function GoldDivider() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        margin: "8px 0",
      }}
    >
      <div
        style={{
          flex: 1,
          height: "1px",
          background: "linear-gradient(to right, transparent, #C5973A 40%, #8B6914 50%)",
        }}
      />
      <span
        style={{
          color: "#8B6914",
          fontSize: "14px",
          margin: "0 10px",
          lineHeight: 1,
        }}
      >
        ◆
      </span>
      <div
        style={{
          flex: 1,
          height: "1px",
          background: "linear-gradient(to left, transparent, #C5973A 40%, #8B6914 50%)",
        }}
      />
    </div>
  );
}

// ─── Generic SVG school seal fallback ────────────────────────────────────────

function SchoolSealFallback() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="40" cy="40" r="38" fill="#FEFCF3" stroke="#8B6914" strokeWidth="2" />
      <circle cx="40" cy="40" r="32" fill="none" stroke="#C5973A" strokeWidth="1" />
      {/* School building silhouette */}
      <rect x="22" y="44" width="36" height="18" fill="#1B3A6B" opacity="0.85" />
      <polygon points="40,22 18,44 62,44" fill="#1B3A6B" opacity="0.85" />
      <rect x="35" y="50" width="10" height="12" fill="#FEFCF3" />
      <rect x="23" y="46" width="7" height="6" fill="#FEFCF3" opacity="0.6" />
      <rect x="50" y="46" width="7" height="6" fill="#FEFCF3" opacity="0.6" />
      {/* Star at top */}
      <polygon
        points="40,16 41.5,20.5 46,20.5 42.5,23.5 43.5,28 40,25.5 36.5,28 37.5,23.5 34,20.5 38.5,20.5"
        fill="#C5973A"
      />
      <text
        x="40"
        y="73"
        textAnchor="middle"
        fontFamily="serif"
        fontSize="6"
        fill="#8B6914"
        letterSpacing="1"
      >
        SCHOOL SEAL
      </text>
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CertificatePreviewProps {
  typeId: CertificateTypeId;
  data: CertificateData;
  settings: SchoolSettings;
}

// ─── Main Component ───────────────────────────────────────────────────────────

const CertificatePreview = forwardRef<HTMLDivElement, CertificatePreviewProps>(
  ({ typeId, data, settings }, ref) => {
    const def = getCertificateDefinition(typeId);
    if (!def) return null;

    const isInternship = typeId === "internship";
    const recipientKey = isInternship ? "teacher_name" : "student_name";
    const recipientName = data[recipientKey] || "";

    return (
      <div
        id="campus-core-certificate"
        ref={ref}
        style={{
          width: "1100px",
          height: "778px",
          backgroundColor: "#FEFCF3",
          position: "relative",
          boxSizing: "border-box",
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          color: "#1A1008",
          overflow: "hidden",
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          flexShrink: 0,
        }}
      >
        {/* ── Outer border ── */}
        <div
          style={{
            position: "absolute",
            inset: "10px",
            border: "3px solid #8B6914",
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
        />
        {/* ── Inner border ── */}
        <div
          style={{
            position: "absolute",
            inset: "19px",
            border: "1px solid #C5973A",
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
        />

        {/* ── Corner ornaments ── */}
        <CornerOrnament rotate={0} style={{ top: 6, left: 6 }} />
        <CornerOrnament rotate={90} style={{ top: 6, right: 6 }} />
        <CornerOrnament rotate={270} style={{ bottom: 6, left: 6 }} />
        <CornerOrnament rotate={180} style={{ bottom: 6, right: 6 }} />

        {/* ── Content area ── */}
        <div
          style={{
            position: "absolute",
            inset: "28px 34px 28px 34px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* ── Logo ── */}
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              overflow: "hidden",
              border: "2px solid #C5973A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#FEFCF3",
              flexShrink: 0,
              marginBottom: "6px",
            }}
          >
            {settings.logo_url ? (
              <img
                src={settings.logo_url}
                alt="School Logo"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                crossOrigin="anonymous"
              />
            ) : (
              <SchoolSealFallback />
            )}
          </div>

          {/* ── School Name ── */}
          <div
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: "17px",
              fontWeight: 700,
              color: "#1B3A6B",
              letterSpacing: "0.12em",
              textAlign: "center",
              textTransform: "uppercase",
              marginBottom: "4px",
            }}
          >
            {settings.school_name || "CAMPUS CORE SCHOOL"}
          </div>

          {/* ── Top divider ── */}
          <GoldDivider />

          {/* ── Certificate title ── */}
          <div
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: "24px",
              fontWeight: 700,
              color: "#5C1010",
              letterSpacing: "0.18em",
              textAlign: "center",
              textTransform: "uppercase",
              margin: "4px 0",
            }}
          >
            {def.subtitle}
          </div>

          {/* ── Second divider ── */}
          <GoldDivider />

          {/* ── Body ── */}
          <div
            style={{
              fontSize: "14px",
              lineHeight: 1.9,
              textAlign: "justify",
              color: "#1A1008",
              padding: "6px 32px 0",
              flex: 1,
              width: "100%",
            }}
          >
            {def.bodyTemplate(data)}
          </div>

          {/* ── Bottom row: cert no + date ── */}
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px",
              color: "#5A4A2A",
              fontFamily: "'Cormorant Garamond', serif",
              marginTop: "6px",
              padding: "0 4px",
            }}
          >
            <span>
              <span style={{ color: "#8B6914", fontWeight: 600 }}>Cert. No: </span>
              {data.certificate_number || "—"}
            </span>
            <span>
              <span style={{ color: "#8B6914", fontWeight: 600 }}>Date: </span>
              {data.issue_date ? formatDisplayDate(data.issue_date) : "—"}
            </span>
          </div>

          {/* ── Signature blocks ── */}
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginTop: "10px",
              padding: "0 16px",
            }}
          >
            {/* Class Teacher */}
            <div style={{ textAlign: "center", minWidth: "160px" }}>
              <div
                style={{
                  width: "160px",
                  borderTop: "1.5px solid #8B6914",
                  marginBottom: "4px",
                }}
              />
              <div
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: "11px",
                  color: "#1B3A6B",
                  letterSpacing: "0.08em",
                  fontWeight: 600,
                }}
              >
                CLASS TEACHER
              </div>
            </div>

            {/* Principal */}
            <div style={{ textAlign: "center", minWidth: "180px" }}>
              <div
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "12px",
                  color: "#5A4A2A",
                  fontStyle: "italic",
                  marginBottom: "2px",
                }}
              >
                {settings.principal_name || ""}
              </div>
              <div
                style={{
                  width: "180px",
                  borderTop: "1.5px solid #8B6914",
                  marginBottom: "4px",
                }}
              />
              <div
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: "11px",
                  color: "#1B3A6B",
                  letterSpacing: "0.08em",
                  fontWeight: 600,
                }}
              >
                PRINCIPAL
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

CertificatePreview.displayName = "CertificatePreview";
export default CertificatePreview;
