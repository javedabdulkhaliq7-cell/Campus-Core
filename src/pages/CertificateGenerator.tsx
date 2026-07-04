// ─── CertificateGenerator.tsx ────────────────────────────────────────────────
// 3-step wizard: (1) Choose type → (2) Fill form + live preview → (3) Print/Download

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useSchool } from "../lib/schoolContext";

import {
  CERTIFICATE_DEFINITIONS,
  CertificateData,
  CertificateDefinition,
  CertificateField,
  CertificateTypeId,
  SchoolSettings,
  CERT_TEMPLATES,
  getCertTemplate,
  generateCertificateNumber,
  todayString,
} from "./certificate.types";
import CertificatePreview from "./CertificatePreview";

// ─── Supabase client ──────────────────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const GOLD = "#C5973A";
const NAVY = "#1B3A6B";
const IVORY = "#FEFCF3";
const RED_DEEP = "#5C1010";

// ─── Field renderer ───────────────────────────────────────────────────────────

function FormField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: CertificateField;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const base: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    border: `1px solid #D4B896`,
    borderRadius: "6px",
    fontSize: "13px",
    fontFamily: "inherit",
    background: disabled ? "#F5F0E8" : "#FFFDF7",
    color: "#1A1008",
    outline: "none",
    transition: "border-color 0.15s",
    boxSizing: "border-box",
  };

  if (field.type === "textarea") {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={3}
        style={{ ...base, resize: "vertical", lineHeight: 1.5 }}
        disabled={disabled}
      />
    );
  }

  return (
    <input
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      style={base}
      disabled={disabled}
      min={field.type === "number" ? 1 : undefined}
    />
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Choose Type", "Fill Details", "Download"];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        marginBottom: "32px",
      }}
    >
      {steps.map((label, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        return (
          <React.Fragment key={n}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: done ? GOLD : active ? NAVY : "#E8E0D0",
                  color: done || active ? "#fff" : "#8A7A60",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 15,
                  border: active ? `3px solid ${GOLD}` : "3px solid transparent",
                  transition: "all 0.25s",
                }}
              >
                {done ? "✓" : n}
              </div>
              <span
                style={{
                  fontSize: 11,
                  marginTop: 4,
                  color: active ? NAVY : "#8A7A60",
                  fontWeight: active ? 600 : 400,
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  width: 80,
                  height: 2,
                  background: done ? GOLD : "#E8E0D0",
                  margin: "0 4px",
                  marginBottom: 18,
                  transition: "background 0.25s",
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Type card ────────────────────────────────────────────────────────────────

function TypeCard({
  def,
  selected,
  onSelect,
}: {
  def: CertificateDefinition;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "20px 12px",
        border: selected ? `2px solid ${GOLD}` : "2px solid #E2D9C8",
        borderRadius: "12px",
        background: selected ? "#FFF9EE" : "#FFFDF7",
        cursor: "pointer",
        transition: "all 0.2s",
        boxShadow: selected ? `0 0 0 3px ${GOLD}22` : "0 1px 4px rgba(0,0,0,0.06)",
        outline: "none",
      }}
    >
      <span style={{ fontSize: 28 }}>{def.icon}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: selected ? RED_DEEP : NAVY,
          textAlign: "center",
          lineHeight: 1.3,
          fontFamily: "'Cinzel', serif",
        }}
      >
        {def.title}
      </span>
    </button>
  );
}

// ─── Certificate template picker (swatch grid) ────────────────────────────────

function TemplatePicker({
  templateId,
  onChoose,
  saving,
}: {
  templateId: string;
  onChoose: (id: string) => void;
  saving: boolean;
}) {
  return (
    <div
      style={{
        background: "#FFFDF7",
        border: `1px solid #E2D9C8`,
        borderRadius: 14,
        padding: "18px 20px",
        marginBottom: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 12,
            letterSpacing: "0.08em",
            color: NAVY,
            textTransform: "uppercase",
          }}
        >
          Certificate Template
        </span>
        {saving && <span style={{ fontSize: 11, color: "#8A7A60" }}>Saving…</span>}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
          gap: 10,
        }}
      >
        {CERT_TEMPLATES.map((t) => {
          const selected = t.id === templateId;
          return (
            <button
              key={t.id}
              onClick={() => onChoose(t.id)}
              style={{
                position: "relative",
                borderRadius: 10,
                overflow: "hidden",
                border: selected ? `2px solid ${NAVY}` : "2px solid #E2D9C8",
                cursor: "pointer",
                background: "none",
                padding: 0,
                textAlign: "left",
              }}
            >
              <div
                style={{
                  background: t.bg,
                  padding: "12px 8px",
                  minHeight: 56,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 24,
                    borderRadius: t.ornaments ? 2 : 5,
                    border: `2px solid ${t.borderOuter}`,
                    boxShadow: `inset 0 0 0 2px ${t.bg}, inset 0 0 0 3px ${t.borderInner}`,
                  }}
                />
                <span
                  style={{
                    fontFamily: t.headingFont,
                    color: t.schoolNameColor,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                  }}
                >
                  Aa
                </span>
              </div>
              <div style={{ background: "#fff", padding: "6px 8px", textAlign: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#3A3022" }}>{t.name}</span>
              </div>
              {selected && (
                <div
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: NAVY,
                    color: "#fff",
                    fontSize: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ✓
                </div>
              )}
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 11, color: "#8A7A60", marginTop: 10 }}>
        Applies to every certificate type, printed and downloaded school-wide.
      </p>
    </div>
  );
}

// ─── Button component ─────────────────────────────────────────────────────────

function Btn({
  children,
  onClick,
  variant = "primary",
  disabled,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: NAVY, color: "#fff", border: `2px solid ${NAVY}` },
    secondary: { background: GOLD, color: "#fff", border: `2px solid ${GOLD}` },
    ghost: { background: "transparent", color: NAVY, border: `2px solid ${NAVY}` },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 22px",
        borderRadius: "8px",
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.18s",
        display: "flex",
        alignItems: "center",
        gap: 7,
        fontFamily: "'Cinzel', serif",
        letterSpacing: "0.06em",
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function CertificateGenerator() {
  // Get schoolId from context
  const { settings: schoolSettings } = useSchool();
  const schoolId = schoolSettings?.school_id || '';

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState<CertificateTypeId | null>(null);
  const [formData, setFormData] = useState<CertificateData>({});
  const [settings, setSettings] = useState<SchoolSettings>({
    school_name: "",
    principal_name: "",
    logo_url: null,
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfDone, setPdfDone] = useState(false);

  // ── Certificate visual template (saved permanently per school) ──────────────
  const [templateId, setTemplateId] = useState<string>("gold_classic");
  const [templateSaving, setTemplateSaving] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const certRef = useRef<HTMLDivElement>(null);

  // ── Fetch school settings (incl. saved certificate template) for the CURRENT school ──
  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoadingSettings(true);
      const { data, error } = await supabase
        .from("school_settings")
        .select("school_name, principal_name, logo_url, cert_template_id")
        .eq("school_id", schoolId)
        .single();

      if (!error && data) {
        setSettings({
          school_name: data.school_name || "",
          principal_name: data.principal_name || "",
          logo_url: data.logo_url || null,
        });
        if (data.cert_template_id) setTemplateId(data.cert_template_id);
      }
      setLoadingSettings(false);
    })();
  }, [schoolId]);

  // ── Choose & permanently save the certificate template ──────────────────────
  const chooseTemplate = async (id: string) => {
    setTemplateId(id);
    setTemplateSaving(true);
    await supabase.from("school_settings").update({ cert_template_id: id }).eq("school_id", schoolId);
    setTemplateSaving(false);
  };

  // ── When type is chosen, pre-fill cert number and issue date ───────────────
  const handleSelectType = (id: CertificateTypeId) => {
    setSelectedType(id);
    const def = CERTIFICATE_DEFINITIONS.find((d) => d.id === id)!;
    const initial: CertificateData = {};
    def.fields.forEach((f) => {
      if (f.key === "certificate_number") {
        initial[f.key] = generateCertificateNumber(id);
      } else if (f.key === "issue_date") {
        initial[f.key] = todayString();
      } else {
        initial[f.key] = "";
      }
    });
    setFormData(initial);
    setStep(2);
    setPdfDone(false);
  };

  // ── Field change ───────────────────────────────────────────────────────────
  const handleFieldChange = useCallback((key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ── Print ──────────────────────────────────────────────────────────────────
  const handlePrint = () => {
  // Get the certificate element
  const certElement = certRef.current;
  if (!certElement) {
    alert('No certificate to print');
    return;
  }
  
  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to print');
    return;
  }
  
  // Get the HTML content
  const certHtml = certElement.outerHTML;
  
  // Write to new window
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Certificate</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: white;
          }
          .certificate-container {
            width: 100%;
            max-width: 1100px;
            margin: 0 auto;
          }
          @media print {
            body {
              margin: 0;
              padding: 0;
            }
            .certificate-container {
              margin: 0;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="certificate-container">
          ${certHtml}
        </div>
        <script>
          window.onload = () => {
            window.print();
            window.onafterprint = () => window.close();
          };
        <\/script>
      </body>
    </html>
  `);
  
  printWindow.document.close();
};
  // ── Download PDF ───────────────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
  if (!certRef.current || !selectedType) {
    alert("No certificate to download");
    return;
  }
  
  setPdfLoading(true);
  
  try {
    // Get the certificate element
    const element = certRef.current;
    
    // Set a temporary style for better capture
    const originalStyle = element.style.transform;
    element.style.transform = "none";
    
    // Capture with higher quality
    const canvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      backgroundColor: "#FEFCF3",
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });
    
    // Restore original style
    element.style.transform = originalStyle;
    
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    
    pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
    
    const def = CERTIFICATE_DEFINITIONS.find((d) => d.id === selectedType);
    const isInternship = selectedType === "internship";
    const nameKey = isInternship ? "teacher_name" : "student_name";
    const name = (formData[nameKey] || "certificate").replace(/\s+/g, "_");
    const date = (formData.issue_date || todayString()).replace(/-/g, "");
    const typeName = def?.title.replace(/[\s/]+/g, "_") || "certificate";
    
    pdf.save(`${typeName}_${name}_${date}.pdf`);
    setPdfDone(true);
    
  } catch (err) {
    console.error("PDF generation failed:", err);
    alert("PDF generation failed. Please try again.");
  } finally {
    setPdfLoading(false);
  }
};
  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setStep(1);
    setSelectedType(null);
    setFormData({});
    setPdfDone(false);
  };

  const def = selectedType
    ? CERTIFICATE_DEFINITIONS.find((d) => d.id === selectedType)
    : null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Hidden print target — cloned certificate placed here for @media print */}
      <div id="cert-print-root" style={{ display: "none" }}>
        {selectedType && (
          <CertificatePreview
            typeId={selectedType}
            data={formData}
            settings={settings}
            templateId={templateId}
          />
        )}
      </div>

      <div
        style={{
          minHeight: "100vh",
          background: "#F8F4EC",
          padding: "32px 24px",
          fontFamily: "'Cormorant Garamond', Georgia, serif",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "12px" }}>
          <h1
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: 26,
              fontWeight: 700,
              color: NAVY,
              margin: 0,
              letterSpacing: "0.1em",
            }}
          >
            Certificate Generator
          </h1>
          <p style={{ color: "#7A6A50", fontSize: 14, marginTop: 4 }}>
            Generate formal certificates for students and staff
          </p>
        </div>

        <StepIndicator current={step} />

        {/* ── STEP 1: Choose type ─────────────────────────────────────────── */}
        {step === 1 && (
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <TemplatePicker templateId={templateId} onChoose={chooseTemplate} saving={templateSaving} />
            <h2
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 16,
                color: RED_DEEP,
                letterSpacing: "0.1em",
                marginBottom: 20,
                textAlign: "center",
              }}
            >
              SELECT CERTIFICATE TYPE
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 14,
              }}
            >
              {CERTIFICATE_DEFINITIONS.map((d) => (
                <TypeCard
                  key={d.id}
                  def={d}
                  selected={selectedType === d.id}
                  onSelect={() => handleSelectType(d.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: Form + Live Preview ─────────────────────────────────── */}
        {step === 2 && def && (
          <div
            style={{
              display: "flex",
              gap: 28,
              maxWidth: 1500,
              margin: "0 auto",
              alignItems: "flex-start",
            }}
          >
            {/* Left: form */}
            <div
              style={{
                width: 320,
                flexShrink: 0,
                background: "#FFFDF7",
                border: "1px solid #E2D9C8",
                borderRadius: 14,
                padding: "24px 20px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 22 }}>{def.icon}</span>
                <h3
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: 14,
                    color: NAVY,
                    margin: 0,
                    letterSpacing: "0.06em",
                  }}
                >
                  {def.title}
                </h3>
              </div>

              <button
                onClick={() => setShowTemplatePicker((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: 11,
                  color: "#8A7A60",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                🎨 Template: <strong style={{ color: NAVY }}>{getCertTemplate(templateId).name}</strong> · Change
              </button>
              {showTemplatePicker && (
                <TemplatePicker templateId={templateId} onChoose={chooseTemplate} saving={templateSaving} />
              )}

              {/* Auto-filled info */}
              <div
                style={{
                  background: "#F0EBE0",
                  borderRadius: 8,
                  padding: "10px 12px",
                  marginBottom: 16,
                  fontSize: 12,
                  color: "#6A5A3A",
                  lineHeight: 1.6,
                }}
              >
                <div>
                  <strong>School:</strong>{" "}
                  {loadingSettings ? "Loading…" : settings.school_name || "Not set"}
                </div>
                <div>
                  <strong>Principal:</strong>{" "}
                  {loadingSettings ? "Loading…" : settings.principal_name || "Not set"}
                </div>
              </div>

              {/* Dynamic fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {def.fields.map((field) => (
                  <div key={field.key}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#5A4A2A",
                        marginBottom: 4,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {field.label}
                      {field.required && (
                        <span style={{ color: RED_DEEP, marginLeft: 2 }}>*</span>
                      )}
                    </label>
                    <FormField
                      field={field}
                      value={formData[field.key] ?? ""}
                      onChange={(v) => handleFieldChange(field.key, v)}
                    />
                  </div>
                ))}
              </div>

              {/* Nav buttons */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 24,
                  paddingTop: 16,
                  borderTop: "1px solid #E2D9C8",
                }}
              >
                <Btn variant="ghost" onClick={() => setStep(1)}>
                  ← Back
                </Btn>
                <Btn
                  variant="primary"
                  onClick={() => setStep(3)}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  Continue →
                </Btn>
              </div>
            </div>

            {/* Right: live preview (scaled) */}
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div
                style={{
                  fontSize: 11,
                  color: "#8A7A60",
                  marginBottom: 10,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Live Preview
              </div>
              <div
                style={{
                  overflowX: "auto",
                  borderRadius: 10,
                  boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
                }}
              >
                {/* Scale the 1100px certificate to fit */}
                <div
                  style={{
                    transform: "scale(0.82)",
                    transformOrigin: "top left",
                    width: "1100px",
                    height: "778px",
                    marginBottom: "-138px", // collapse vertical whitespace from scaling
                  }}
                >
                  <CertificatePreview
                    typeId={selectedType!}
                    data={formData}
                    settings={settings}
                    templateId={templateId}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Print / Download ─────────────────────────────────────── */}
        {step === 3 && def && (
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 24,
            }}
          >
            {/* Action bar */}
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <Btn variant="ghost" onClick={() => setStep(2)}>
                ← Edit
              </Btn>
              <Btn variant="ghost" onClick={handlePrint}>
                🖨️ Print
              </Btn>
              <Btn
                variant="secondary"
                onClick={handleDownloadPDF}
                disabled={pdfLoading}
              >
                {pdfLoading ? "⏳ Generating…" : pdfDone ? "✓ Downloaded!" : "⬇️ Download PDF"}
              </Btn>
              <Btn variant="ghost" onClick={handleReset}>
                + New Certificate
              </Btn>
            </div>

            <button
              onClick={() => setShowTemplatePicker((v) => !v)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                fontSize: 11,
                color: "#8A7A60",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              🎨 Template: <strong style={{ color: NAVY }}>{getCertTemplate(templateId).name}</strong> · Change
            </button>
            {showTemplatePicker && (
              <div style={{ width: "100%", maxWidth: 600 }}>
                <TemplatePicker templateId={templateId} onChoose={chooseTemplate} saving={templateSaving} />
              </div>
            )}

            {/* Certificate (full size, captured for PDF) */}
            <div
              style={{
                overflowX: "auto",
                width: "100%",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <div style={{ transform: "scale(0.9)", transformOrigin: "top center" }}>
                <CertificatePreview
                  ref={certRef}
                  typeId={selectedType!}
                  data={formData}
                  settings={settings}
                  templateId={templateId}
                />
              </div>
            </div>

            {pdfDone && (
              <div
                style={{
                  background: "#EEF6EE",
                  border: "1px solid #8BC88A",
                  borderRadius: 8,
                  padding: "12px 20px",
                  color: "#2A6B28",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                ✅ Certificate PDF downloaded successfully!
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}