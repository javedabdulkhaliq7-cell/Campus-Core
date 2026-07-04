// supabase/functions/sms-receiver/index.ts
//
// Receives forwarded SMS from MacroDroid app on your phone.
// Parses JazzCash/EasyPaisa SMS to extract Transaction ID AND Amount.
// STRICT: Amount in SMS must match EXACTLY what school was supposed to pay.
// Even Rs. 1 less or more = rejected.
//
// DEPLOY: supabase functions deploy sms-receiver

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ── Hardcoded Plan Amounts ───────────────────────────────────
// Change these if you change subscription prices
// Must match exactly what schools pay — not a penny more or less
const PLAN_AMOUNTS: Record<string, number> = {
  basic: 1000,
  standard: 2000,
  premium: 5000,
};

// ── Extract Transaction ID from SMS ──────────────────────────
function extractTransactionId(smsText: string): string | null {
  const patterns = [
    /TID[:\s]+([A-Z0-9]+)/i,
    /Transaction\s*ID[:\s]+([A-Z0-9]+)/i,
    /Txn\s*ID[:\s]+([A-Z0-9]+)/i,
    /TRN[:\s]+([A-Z0-9]+)/i,
    /Ref(?:erence)?[:\s#]+([A-Z0-9]+)/i,
    /\b([A-Z]{1,3}[0-9]{8,15})\b/,
    /\b([0-9]{10,15})\b/,
  ];
  for (const pattern of patterns) {
    const match = smsText.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

// ── Extract Amount from SMS ───────────────────────────────────
function extractAmount(smsText: string): number | null {
  const patterns = [
    /Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:received|sent|transferred|debited|credited)/i,
    /(?:received|amount|PKR)[:\s]+Rs\.?\s*([\d,]+)/i,
    /Rs\.?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /PKR\s*([\d,]+)/i,
  ];
  for (const pattern of patterns) {
    const match = smsText.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(amount) && amount > 0) return amount;
    }
  }
  return null;
}

// ── Check if SMS is from JazzCash or EasyPaisa ───────────────
function isPaymentSMS(sender: string, text: string): boolean {
  const knownSenders = ['jazzcash', 'easypaisa', 'jcash', '8500', '3737'];
  const senderLower = sender.toLowerCase();
  const textLower = text.toLowerCase();
  return (
    knownSenders.some(s => senderLower.includes(s)) ||
    textLower.includes('jazzcash') ||
    textLower.includes('easypaisa') ||
    (textLower.includes('received') && textLower.includes('rs'))
  );
}

// ── Main Handler ─────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    const smsText: string = body?.text ?? '';
    const smsSender: string = body?.sender ?? '';

    console.log(`SMS received from: ${smsSender}`);
    console.log(`SMS text: ${smsText}`);

    // Ignore non-payment SMS
    if (!isPaymentSMS(smsSender, smsText)) {
      console.log('Not a payment SMS — ignoring.');
      return new Response(
        JSON.stringify({ status: 'ignored', reason: 'Not a payment SMS' }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Extract transaction ID
    const txnId = extractTransactionId(smsText);
    if (!txnId) {
      console.log('Could not extract transaction ID from SMS.');
      return new Response(
        JSON.stringify({ status: 'ignored', reason: 'No transaction ID found in SMS' }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Extract amount from SMS
    const smsAmount = extractAmount(smsText);
    console.log(`Extracted TxID: ${txnId} | SMS Amount: Rs. ${smsAmount}`);

    if (!smsAmount) {
      console.log('Could not extract amount from SMS.');
      return new Response(
        JSON.stringify({ status: 'ignored', reason: 'No amount found in SMS' }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Find matching pending payment by Transaction ID
    const { data: payment, error: findErr } = await supabase
      .from('payments')
      .select('*')
      .ilike('transaction_id', txnId)
      .eq('status', 'pending')
      .single();

    if (findErr || !payment) {
      console.log(`No matching pending payment found for TxID: ${txnId}`);
      return new Response(
        JSON.stringify({ status: 'not_found', txnId, smsAmount }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── STRICT AMOUNT CHECK ───────────────────────────────────
    // SMS amount must match EXACTLY what the school was supposed to pay
    // Not a single rupee more or less
    const expectedAmount = payment.amount;
    const roundedSmsAmount = Math.round(smsAmount); // handle Rs. 1000.00 vs 1000

    if (roundedSmsAmount !== expectedAmount) {
      console.log(`❌ Amount mismatch! Expected: Rs. ${expectedAmount} | Got: Rs. ${smsAmount}`);

      // Mark payment as failed with reason
      await supabase.from('payments').update({
        status: 'failed',
        verified_by: `amount-mismatch: expected ${expectedAmount} got ${roundedSmsAmount}`,
      }).eq('id', payment.id);

      return new Response(
        JSON.stringify({
          status: 'amount_mismatch',
          expected: expectedAmount,
          received: smsAmount,
          txnId,
          message: `Wrong amount. Expected Rs. ${expectedAmount}, received Rs. ${smsAmount}.`,
        }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── Also verify amount matches the plan ──────────────────
    // Get subscription to check plan
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, amount')
      .eq('id', payment.subscription_id)
      .single();

    if (sub) {
      const planExpected = PLAN_AMOUNTS[sub.plan];
      if (planExpected && roundedSmsAmount !== planExpected) {
        console.log(`❌ Plan amount mismatch! Plan ${sub.plan} requires Rs. ${planExpected} | Got: Rs. ${smsAmount}`);
        await supabase.from('payments').update({
          status: 'failed',
          verified_by: `plan-amount-mismatch: ${sub.plan} requires ${planExpected} got ${roundedSmsAmount}`,
        }).eq('id', payment.id);

        return new Response(
          JSON.stringify({
            status: 'amount_mismatch',
            plan: sub.plan,
            expected: planExpected,
            received: smsAmount,
          }),
          { headers: { 'Content-Type': 'application/json' } },
        );
      }
    }

    // ── All checks passed — verify payment ───────────────────
    const now = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { error: payErr } = await supabase
      .from('payments')
      .update({
        status: 'verified',
        verified_at: now.toISOString(),
        verified_by: 'sms-auto',
      })
      .eq('id', payment.id);

    if (payErr) throw payErr;

    // Activate subscription
    const { error: subErr } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', payment.subscription_id);

    if (subErr) throw subErr;

    // Get school name for logs
    const { data: settings } = await supabase
      .from('school_settings')
      .select('school_name')
      .eq('school_id', payment.school_id)
      .single();

    console.log(`✅ Payment verified for: ${settings?.school_name ?? payment.school_id}`);
    console.log(`   TxID: ${txnId} | Amount: Rs. ${expectedAmount} | Active until: ${periodEnd.toLocaleDateString()}`);

    return new Response(
      JSON.stringify({
        status: 'verified',
        school: settings?.school_name,
        txnId,
        amount: expectedAmount,
        activeUntil: periodEnd.toISOString(),
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('SMS receiver error:', err);
    return new Response(
      JSON.stringify({ status: 'error', message: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});