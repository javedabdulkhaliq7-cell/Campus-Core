// supabase/functions/register-school/index.ts
//
// Handles the ENTIRE school registration server-side using the service role key.
// This bypasses all RLS race conditions because the service role ignores RLS.
// If ANY step fails, everything created so far is rolled back (deleted) —
// no orphan schools/members/subscriptions/payments are ever left behind.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!;

const PLAN_CONFIG: Record<string, { student_limit: number; amount: number }> = {
  basic: { student_limit: 200, amount: 1000 },
  standard: { student_limit: 500, amount: 2000 },
  premium: { student_limit: 999999, amount: 5000 },
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Service-role client — bypasses RLS completely, no race conditions possible
  console.log('SERVICE_ROLE_KEY present:', !!SERVICE_ROLE_KEY, 'length:', SERVICE_ROLE_KEY?.length);
  console.log('SUPABASE_URL:', SUPABASE_URL);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let createdUserId: string | null = null;
  let createdSchoolId: string | null = null;

  try {
    const body = await req.json();
    const {
      schoolName, principalName, address, phone, regNumber,
      fullName, adminEmail, password,
      selectedPlan, payMethod, payPhone, txnId,
    } = body;

    if (!schoolName || !adminEmail || !password || !selectedPlan || !payPhone || !txnId) {
      return new Response(JSON.stringify({ error: 'Missing required fields.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const plan = PLAN_CONFIG[selectedPlan];
    if (!plan) {
      return new Response(JSON.stringify({ error: 'Invalid plan selected.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 1. Create auth user (service role — no session juggling needed) ──
    const { data: userData, error: userErr } = await admin.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (userErr) throw new Error('Account creation failed: ' + userErr.message);
    createdUserId = userData.user.id;

    // ── 2. Create school ──────────────────────────────────────────────
    const { data: schoolData, error: schoolErr } = await admin
      .from('schools')
      .insert({ name: schoolName })
      .select()
      .single();
    if (schoolErr) throw new Error('School creation failed: ' + schoolErr.message);
    createdSchoolId = schoolData.id;

    // ── 3. Add school member ──────────────────────────────────────────
    const { error: memberErr } = await admin
      .from('school_members')
      .insert({ user_id: createdUserId, school_id: createdSchoolId, role: 'admin' });
    if (memberErr) throw new Error('Member creation failed: ' + memberErr.message);

    // ── 4. School settings (non-fatal if it fails) ─────────────────────
    const { error: settingsErr } = await admin.from('school_settings').insert({
      school_id: createdSchoolId,
      school_name: schoolName,
      principal_name: principalName,
      address,
      phone,
      email: adminEmail,
      website: '',
      registration_number: regNumber ?? '',
      weekly_off_days: [0],
    });
    if (settingsErr) console.warn('Settings error (non-fatal):', settingsErr.message);

    // ── 5. Subscription ─────────────────────────────────────────────
    const { data: subData, error: subErr } = await admin
      .from('subscriptions')
      .insert({
        school_id: createdSchoolId,
        plan: selectedPlan,
        status: 'pending_payment',
        student_limit: plan.student_limit,
        amount: plan.amount,
      })
      .select()
      .single();
    if (subErr) throw new Error('Subscription creation failed: ' + subErr.message);

    // ── 6. Payment record ───────────────────────────────────────────
    const now = new Date();
    const { data: paymentData, error: payErr } = await admin
      .from('payments')
      .insert({
        school_id: createdSchoolId,
        subscription_id: subData.id,
        amount: plan.amount,
        method: payMethod,
        transaction_id: txnId,
        phone_number: payPhone,
        status: 'pending',
        payment_month: now.getMonth() + 1,
        payment_year: now.getFullYear(),
        paid_at: now.toISOString(),
      })
      .select()
      .single();
    if (payErr) throw new Error('Payment record failed: ' + payErr.message);

    // ── Success — return everything the frontend needs ────────────────
    return new Response(
      JSON.stringify({
        success: true,
        schoolId: createdSchoolId,
        userId: createdUserId,
        subscriptionId: subData.id,
        paymentId: paymentData.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    // ── Rollback everything created so far ─────────────────────────────
    console.error('Registration failed, rolling back:', err);

    if (createdSchoolId) {
      await admin.from('payments').delete().eq('school_id', createdSchoolId);
      await admin.from('subscriptions').delete().eq('school_id', createdSchoolId);
      await admin.from('school_settings').delete().eq('school_id', createdSchoolId);
      await admin.from('school_members').delete().eq('school_id', createdSchoolId);
      await admin.from('schools').delete().eq('id', createdSchoolId);
    }
    if (createdUserId) {
      await admin.auth.admin.deleteUser(createdUserId);
    }

    const message = err instanceof Error ? err.message : 'Registration failed.';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});