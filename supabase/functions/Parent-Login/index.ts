// supabase/functions/parent-login/index.ts
//
// Verifies (father_phone + parent_access_code) against `students`, then
// mints a real Supabase Auth session for the parent — no SMS, no email,
// no password. Each parent gets one synthetic auth identity per phone
// number (siblings share one identity, linked to multiple students).
//
// Deploy with: supabase functions deploy parent-login

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function sanitizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return json({ error: "Phone number and access code are required." }, 400);
    }
    if (!/^\d{6}$/.test(code)) {
      return json({ error: "Access code must be 6 digits." }, 400);
    }

    const cleanPhone = sanitizePhone(phone);
    if (cleanPhone.length < 7) {
      return json({ error: "Enter a valid phone number." }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ── 1. Check lockout ────────────────────────────────────────────────
    const { data: attemptRow } = await admin
      .from("parent_login_attempts")
      .select("*")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (attemptRow?.locked_until && new Date(attemptRow.locked_until) > new Date()) {
      const minutesLeft = Math.ceil(
        (new Date(attemptRow.locked_until).getTime() - Date.now()) / 60000
      );
      return json(
        { error: `Too many attempts. Try again in ${minutesLeft} minute(s).` },
        429
      );
    }

    // ── 2. Look up the student by access code, then verify phone matches ──
    // parent_access_code is UNIQUE, so this returns at most one row.
    const { data: student, error: studentErr } = await admin
      .from("students")
      .select("id, full_name, father_phone, parent_access_code, school_id")
      .eq("parent_access_code", code)
      .maybeSingle();

    if (studentErr) throw studentErr;

    const phoneMatches =
      student && sanitizePhone(student.father_phone ?? "") === cleanPhone;

    if (!student || !phoneMatches) {
      await recordFailedAttempt(admin, cleanPhone, attemptRow);
      // Deliberately generic — don't reveal which field was wrong.
      return json({ error: "Phone number or access code is incorrect." }, 401);
    }

    // ── 3. Success — clear any attempt history for this phone ─────────────
    await admin.from("parent_login_attempts").delete().eq("phone", cleanPhone);

    // ── 4. Find-or-create the synthetic auth identity for this phone ──────
    const syntheticEmail = `p${cleanPhone}@parent.internal`;

    const { data: identity } = await admin
      .from("parent_auth_identities")
      .select("auth_user_id")
      .eq("phone", cleanPhone)
      .maybeSingle();

    let userId: string;

    if (identity) {
      userId = identity.auth_user_id;
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        email_confirm: true,
        user_metadata: { role: "parent", phone: cleanPhone },
      });

      if (createErr) {
        // Recover from an orphaned auth user left over from an earlier failed
        // attempt (e.g. this same step succeeded once before, but a later
        // step crashed before the identity mapping got saved).
        if (createErr.message?.toLowerCase().includes("already been registered")) {
          const { data: list, error: listErr } = await admin.auth.admin.listUsers();
          if (listErr) throw listErr;
          const existing = list.users.find((u) => u.email === syntheticEmail);
          if (!existing) throw createErr; // genuinely unexpected — surface the real error
          userId = existing.id;
        } else {
          throw createErr;
        }
      } else {
        userId = created.user.id;
      }

      // Upsert (not plain insert) so a retry after a partial failure doesn't
      // throw on a duplicate row — this whole block is now safe to re-run.
      await admin
        .from("parent_auth_identities")
        .upsert({ phone: cleanPhone, auth_user_id: userId }, { onConflict: "phone" });
    }

    // ── 5. Link this parent to the student (idempotent) ───────────────────
    const { error: linkStudentErr } = await admin
      .from("parent_students")
      .upsert({ parent_id: userId, student_id: student.id }, { onConflict: "parent_id,student_id" });
    if (linkStudentErr) {
      console.error("Failed to link parent to student:", linkStudentErr);
      throw linkStudentErr;
    }

    // ── 6. Mint a session without ever sending an email ────────────────────
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: syntheticEmail,
    });
    if (linkErr) throw linkErr;

    const hashedToken = linkData.properties?.hashed_token;
    if (!hashedToken) throw new Error("Could not generate session token.");

    const publicClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: sessionData, error: verifyErr } = await publicClient.auth.verifyOtp({
      token_hash: hashedToken,
      type: "email",
    });
    if (verifyErr) throw verifyErr;

    return json({
      session: sessionData.session,
      student: { id: student.id, full_name: student.full_name },
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});

async function recordFailedAttempt(
  admin: ReturnType<typeof createClient>,
  phone: string,
  existingRow: { failed_count?: number } | null
) {
  const newCount = (existingRow?.failed_count ?? 0) + 1;
  const lockedUntil =
    newCount >= MAX_ATTEMPTS
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString()
      : null;

  await admin.from("parent_login_attempts").upsert({
    phone,
    failed_count: lockedUntil ? 0 : newCount, // reset counter once locked
    last_attempt_at: new Date().toISOString(),
    locked_until: lockedUntil,
  });
}