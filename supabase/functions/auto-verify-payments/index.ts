// supabase/functions/auto-verify-payments/index.ts
//
// Called by the "Run Auto-Verify" button in AdminPanel.
// Re-checks all pending payments and activates subscriptions for any
// that are already marked 'verified' (e.g. by the sms-receiver function)
// but whose subscription status hasn't been updated yet for some reason.
// Safe to run anytime — it only acts on payments already verified.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Find verified payments whose subscription is still not active
    const { data: verifiedPayments, error: fetchErr } = await admin
      .from('payments')
      .select('id, school_id, subscription_id, status')
      .eq('status', 'verified');

    if (fetchErr) throw new Error('Failed to fetch payments: ' + fetchErr.message);

    let activatedCount = 0;

    for (const payment of verifiedPayments ?? []) {
      const { data: sub } = await admin
        .from('subscriptions')
        .select('id, status')
        .eq('id', payment.subscription_id)
        .maybeSingle();

      if (sub && sub.status !== 'active') {
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await admin
          .from('subscriptions')
          .update({
            status: 'active',
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
          })
          .eq('id', sub.id);

        activatedCount++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, checked: verifiedPayments?.length ?? 0, activated: activatedCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Auto-verify failed.';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
