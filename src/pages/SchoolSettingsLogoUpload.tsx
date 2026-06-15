// ─── SchoolSettingsLogoUpload.tsx ────────────────────────────────────────────
//
// Drop this component anywhere inside your existing Settings page.
// It handles:
//   • Displaying the current logo (or a fallback seal)
//   • Drag-and-drop + click-to-browse upload
//   • Upload to Supabase Storage bucket `school-assets`
//   • Saving the public URL back to `school_settings.logo_url`
//   • Removing the current logo
//
// ─── SUPABASE SETUP (run once in Supabase Dashboard) ─────────────────────────
//
//  1. Storage → Create bucket: name = "school-assets", Public = true
//
//  2. Storage → Policies → school-assets → New policy (for authenticated users):
//     Allowed operations: SELECT, INSERT, UPDATE, DELETE
//     Target roles: authenticated
//     Policy definition (using the helper):
//       bucket_id = 'school-assets'
//
//  3. Ensure `school_settings` table has a `logo_url` text column:
//     ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
//
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// ── Supabase client ───────────────────────────────────────────────────────────
// Uses your existing VITE_ env vars — no extra config needed
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

const BUCKET = "school-assets";
const LOGO_PATH = "logo/school-logo"; // fixed path — always overwrites previous logo

// ─── Fallback SVG seal ────────────────────────────────────────────────────────

function SealPlaceholder() {
  return (
    <svg width="90" height="90" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="38" fill="#FEFCF3" stroke="#8B6914" strokeWidth="2" />
      <circle cx="40" cy="40" r="32" fill="none" stroke="#C5973A" strokeWidth="1" />
      <rect x="22" y="44" width="36" height="18" fill="#1B3A6B" opacity="0.85" />
      <polygon points="40,22 18,44 62,44" fill="#1B3A6B" opacity="0.85" />
      <rect x="35" y="50" width="10" height="12" fill="#FEFCF3" />
      <rect x="23" y="46" width="7" height="6" fill="#FEFCF3" opacity="0.6" />
      <rect x="50" y="46" width="7" height="6" fill="#FEFCF3" opacity="0.6" />
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

// ─── Status message ───────────────────────────────────────────────────────────

type StatusType = "idle" | "uploading" | "success" | "error";

// ─── Component ────────────────────────────────────────────────────────────────

export default function SchoolSettingsLogoUpload() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null); // local preview before upload
  const [status, setStatus] = useState<StatusType>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load existing logo_url ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("school_settings")
        .select("logo_url")
        .limit(1)
        .single();
      if (!error && data?.logo_url) {
        setLogoUrl(data.logo_url);
      }
    })();
  }, []);

  // ── File validation ────────────────────────────────────────────────────────
  const validateFile = (file: File): string | null => {
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      return "Only PNG, JPG, WebP, or SVG files are allowed.";
    }
    if (file.size > 2 * 1024 * 1024) {
      return "File must be under 2 MB.";
    }
    return null;
  };

  // ── Handle file selection ──────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    const err = validateFile(file);
    if (err) {
      setStatus("error");
      setStatusMsg(err);
      return;
    }

    // Local preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setStatus("uploading");
    setStatusMsg("Uploading…");

    try {
      // Determine extension
      const ext = file.name.split(".").pop() || "png";
      const filePath = `${LOGO_PATH}.${ext}`;

      // Upload (upsert = overwrite previous)
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`; // cache-bust

      // Persist to school_settings
      // Upsert approach — adjust if your table uses a different PK strategy
      const { error: dbError } = await supabase
        .from("school_settings")
        .update({ logo_url: publicUrl })
        .not("id", "is", null); // updates the (single) settings row

      if (dbError) throw dbError;

      setLogoUrl(publicUrl);
      setPreview(null);
      setStatus("success");
      setStatusMsg("Logo updated successfully!");
    } catch (e: unknown) {
      console.error(e);
      setPreview(null);
      setStatus("error");
      setStatusMsg(
        e instanceof Error ? e.message : "Upload failed. Please try again."
      );
    }
  }, []);

  // ── Remove logo ────────────────────────────────────────────────────────────
  const handleRemove = async () => {
    setRemoving(true);
    try {
      // Remove from storage (best-effort — ignore if file not found)
      await supabase.storage.from(BUCKET).remove([
        `${LOGO_PATH}.png`,
        `${LOGO_PATH}.jpg`,
        `${LOGO_PATH}.jpeg`,
        `${LOGO_PATH}.webp`,
        `${LOGO_PATH}.svg`,
      ]);

      // Clear DB column
      await supabase
        .from("school_settings")
        .update({ logo_url: null })
        .not("id", "is", null);

      setLogoUrl(null);
      setPreview(null);
      setStatus("success");
      setStatusMsg("Logo removed. Certificates will show the default seal.");
    } catch (e) {
      setStatus("error");
      setStatusMsg("Failed to remove logo. Please try again.");
    } finally {
      setRemoving(false);
    }
  };

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const displayUrl = preview || logoUrl;
  const isUploading = status === "uploading";

  return (
    <div
      style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        maxWidth: 480,
      }}
    >
      {/* Section heading */}
      <h3
        style={{
          fontFamily: "'Cinzel', serif",
          fontSize: 14,
          letterSpacing: "0.1em",
          color: "#1B3A6B",
          marginBottom: 4,
          marginTop: 0,
        }}
      >
        SCHOOL LOGO
      </h3>
      <p style={{ fontSize: 13, color: "#7A6A50", marginBottom: 16, marginTop: 0 }}>
        Shown at the top of every certificate. Accepted formats: PNG, JPG, WebP, SVG (max 2 MB).
      </p>

      {/* Current logo display */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 90,
            height: 90,
            borderRadius: "50%",
            border: "2px solid #C5973A",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#FEFCF3",
            flexShrink: 0,
            position: "relative",
          }}
        >
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="School Logo"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <SealPlaceholder />
          )}
          {isUploading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(254,252,243,0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
              }}
            >
              ⏳
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 13, color: "#5A4A2A", fontWeight: 600 }}>
            {logoUrl ? "Current logo" : "No logo uploaded"}
          </div>
          <div style={{ fontSize: 12, color: "#8A7A60" }}>
            {logoUrl
              ? "Upload a new image to replace it."
              : "Upload your school logo to display on certificates."}
          </div>
          {logoUrl && (
            <button
              onClick={handleRemove}
              disabled={removing || isUploading}
              style={{
                background: "none",
                border: "1px solid #E2A0A0",
                borderRadius: 6,
                padding: "4px 12px",
                fontSize: 12,
                color: "#8B2020",
                cursor: removing ? "wait" : "pointer",
                fontFamily: "inherit",
                width: "fit-content",
              }}
            >
              {removing ? "Removing…" : "✕ Remove Logo"}
            </button>
          )}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "#C5973A" : "#D4C4A0"}`,
          borderRadius: 12,
          padding: "28px 20px",
          textAlign: "center",
          cursor: isUploading ? "wait" : "pointer",
          background: dragging ? "#FFF9EE" : "#FFFDF7",
          transition: "all 0.2s",
          userSelect: "none",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>
          {isUploading ? "⏳" : "📁"}
        </div>
        <div style={{ fontSize: 14, color: "#5A4A2A", fontWeight: 600, marginBottom: 4 }}>
          {isUploading ? "Uploading…" : "Drop image here, or click to browse"}
        </div>
        <div style={{ fontSize: 12, color: "#8A7A60" }}>
          PNG, JPG, WebP, SVG · max 2 MB · Circular crop applied on certificates
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = ""; // reset so same file can be re-selected
        }}
      />

      {/* Status message */}
      {status !== "idle" && statusMsg && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            background:
              status === "success"
                ? "#EEF6EE"
                : status === "error"
                ? "#FFF0EE"
                : "#FFF9EE",
            color:
              status === "success"
                ? "#2A6B28"
                : status === "error"
                ? "#8B2020"
                : "#7A5A20",
            border: `1px solid ${
              status === "success"
                ? "#8BC88A"
                : status === "error"
                ? "#E2A0A0"
                : "#D4C48A"
            }`,
          }}
        >
          {status === "success" ? "✅ " : status === "error" ? "❌ " : "⏳ "}
          {statusMsg}
        </div>
      )}

      {/* Tips */}
      <div
        style={{
          marginTop: 18,
          padding: "12px 14px",
          background: "#F5EFE0",
          borderRadius: 8,
          fontSize: 12,
          color: "#6A5A3A",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: "#5A4A2A" }}>💡 Tips for best results:</strong>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          <li>Use a square image (1:1 ratio) — e.g. 400×400 px or larger</li>
          <li>PNG with transparent background looks cleanest on certificates</li>
          <li>The logo is displayed as a circle (80 px) at the top of every certificate</li>
          <li>If no logo is set, a generic school seal is used as fallback</li>
        </ul>
      </div>
    </div>
  );
}
