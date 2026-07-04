import { useEffect, useState } from 'react';
import { supabase, PLAN_CONFIG } from '../lib/supabase';
import type { SubscriptionPlan } from '../lib/supabase';
import { useSchool } from '../lib/schoolContext';
import { Smartphone, CreditCard, CheckCircle, Loader, Clock, AlertTriangle, CalendarCheck, Check, Users } from 'lucide-react';

const PLAN_ORDER: SubscriptionPlan[] = ['basic', 'standard', 'premium'];

export default function Billing() {
  const { subscription, refreshSubscription } = useSchool();

  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(subscription?.plan ?? 'basic');
  const [payMethod, setPayMethod] = useState<'jazzcash' | 'easypaisa'>('jazzcash');
  const [payPhone, setPayPhone] = useState('');
  const [txnId, setTxnId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (subscription?.plan) setSelectedPlan(subscription.plan);
  }, [subscription?.plan]);

  useEffect(() => {
    async function fetchStudentCount() {
      if (!subscription?.school_id) return;
      const { count } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', subscription.school_id)
        .eq('is_active', true);
      setStudentCount(count ?? 0);
    }
    fetchStudentCount();
  }, [subscription?.school_id]);

  const currentPlanIndex = subscription?.plan ? PLAN_ORDER.indexOf(subscription.plan) : -1;
  const selectedPlanIndex = PLAN_ORDER.indexOf(selectedPlan);
  const isDowngrade = selectedPlanIndex < currentPlanIndex;
  const isUpgrade = selectedPlanIndex > currentPlanIndex;
  const isSamePlan = selectedPlanIndex === currentPlanIndex;

  const newPlanLimit = PLAN_CONFIG[selectedPlan].student_limit;
  const downgradeBlocked = isDowngrade && studentCount !== null && studentCount > newPlanLimit;

  async function handleSubmit() {
    setError('');
    if (!payPhone || !txnId) { setError('Please enter your payment phone number and transaction ID.'); return; }
    if (downgradeBlocked) { setError(`You have ${studentCount} students. The ${PLAN_CONFIG[selectedPlan].label} plan only allows up to ${newPlanLimit}. Please remove students first or choose a higher plan.`); return; }
    setSubmitting(true);
    try {
      if (!subscription) throw new Error('No subscription found.');
      const planInfo = PLAN_CONFIG[selectedPlan];
      const now = new Date();

      // Update the subscription's plan/amount/limit right away so the payment
      // record (and the sms-receiver verification) checks against the NEW plan amount.
      const { error: subUpdateErr } = await supabase
        .from('subscriptions')
        .update({
          plan: selectedPlan,
          amount: planInfo.amount,
          student_limit: planInfo.student_limit,
        })
        .eq('id', subscription.id);
      if (subUpdateErr) throw new Error(subUpdateErr.message);

      const { error: insertErr } = await supabase.from('payments').insert({
        school_id: subscription.school_id,
        subscription_id: subscription.id,
        amount: planInfo.amount,
        method: payMethod,
        transaction_id: txnId,
        phone_number: payPhone,
        status: 'pending',
        payment_month: now.getMonth() + 1,
        payment_year: now.getFullYear(),
        paid_at: now.toISOString(),
      });
      if (insertErr) throw new Error(insertErr.message);

      setSubmitted(true);
      setTxnId('');
      setPayPhone('');
      setTimeout(() => {
        refreshSubscription();
        setSubmitted(false);
      }, 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit payment.');
    } finally {
      setSubmitting(false);
    }
  }

  const status = subscription?.status as string | undefined;
  const daysUntilExpiry = subscription?.current_period_end
    ? Math.ceil((new Date(subscription.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Current subscription status card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <CalendarCheck className="w-5 h-5 text-blue-600" /> Subscription Status
        </h2>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Plan</p>
            <p className="font-semibold text-slate-800 capitalize">{subscription?.plan ?? '—'}</p>
          </div>
          <div>
            <p className="text-slate-500">Amount</p>
            <p className="font-semibold text-slate-800">Rs. {subscription?.amount?.toLocaleString() ?? '—'}/mo</p>
          </div>
          <div>
            <p className="text-slate-500">Status</p>
            <p className={`font-semibold capitalize ${
              status === 'active' ? 'text-green-600' :
              status === 'grace_period' ? 'text-amber-600' :
              status === 'expired' || status === 'suspended' ? 'text-red-600' : 'text-slate-700'
            }`}>
              {status === 'grace_period' ? 'Grace Period' : status ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Renews / Ends</p>
            <p className="font-semibold text-slate-800">
              {subscription?.current_period_end
                ? new Date(subscription.current_period_end).toLocaleDateString()
                : '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-2.5">
          <Users className="w-4 h-4 shrink-0" />
          {studentCount !== null ? (
            <span>{studentCount} active student{studentCount !== 1 ? 's' : ''} · {PLAN_CONFIG[subscription?.plan ?? 'basic'].label} plan allows up to {PLAN_CONFIG[subscription?.plan ?? 'basic'].student_limit.toLocaleString()}</span>
          ) : (
            <span>Loading student count...</span>
          )}
        </div>

        {status === 'active' && daysUntilExpiry !== null && daysUntilExpiry <= 5 && daysUntilExpiry >= 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">
              Renewal due in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}. You can renew early below to avoid any interruption.
            </p>
          </div>
        )}

        {status === 'grace_period' && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <p className="text-xs text-red-800">
              Your payment is overdue. Some features are locked. Please renew now to restore full access.
            </p>
          </div>
        )}
      </div>

      {/* Plan selector + payment form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <h2 className="text-lg font-bold text-slate-800">
          {isUpgrade ? 'Upgrade Plan' : isDowngrade ? 'Change Plan' : 'Renew Subscription'}
        </h2>

        {submitted ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <p className="font-semibold text-green-800">Payment submitted!</p>
            <p className="text-sm text-green-700">It will be verified automatically once we receive your payment confirmation.</p>
          </div>
        ) : (
          <>
            {/* Plan cards */}
            <div className="grid grid-cols-3 gap-3">
              {PLAN_ORDER.map(planKey => {
                const plan = PLAN_CONFIG[planKey];
                const isCurrent = subscription?.plan === planKey;
                return (
                  <button
                    key={planKey}
                    onClick={() => setSelectedPlan(planKey)}
                    className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                      selectedPlan === planKey ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    {isCurrent && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-700 text-white">
                        Current
                      </span>
                    )}
                    <p className={`font-bold text-sm ${selectedPlan === planKey ? 'text-blue-700' : 'text-slate-800'}`}>{plan.label}</p>
                    <p className={`text-xs font-semibold mt-0.5 ${selectedPlan === planKey ? 'text-blue-600' : 'text-slate-500'}`}>Rs. {plan.amount.toLocaleString()}/mo</p>
                    <p className={`text-xs mt-1 ${selectedPlan === planKey ? 'text-blue-500' : 'text-slate-400'}`}>Up to {plan.student_limit.toLocaleString()} students</p>
                  </button>
                );
              })}
            </div>

            {/* Selected plan features */}
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-600 mb-2">Included in {PLAN_CONFIG[selectedPlan].label}:</p>
              <ul className="space-y-1">
                {PLAN_CONFIG[selectedPlan].features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-slate-600">
                    <Check className="w-3 h-3 text-green-500 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Downgrade blocked warning */}
            {downgradeBlocked && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <p className="text-xs text-red-800">
                  <span className="font-semibold">Can't switch to {PLAN_CONFIG[selectedPlan].label}.</span>
                  {' '}You have {studentCount} students, but this plan only allows up to {newPlanLimit.toLocaleString()}.
                  Please remove students first, or choose a higher plan.
                </p>
              </div>
            )}

            {isUpgrade && !downgradeBlocked && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-xs text-green-800">
                Upgrading to {PLAN_CONFIG[selectedPlan].label} takes effect immediately once payment is verified — no data is lost.
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Pay via</p>
              <div className="flex gap-2">
                {(['jazzcash', 'easypaisa'] as const).map(m => (
                  <button key={m} onClick={() => setPayMethod(m)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                      payMethod === m ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'
                    }`}>
                    <Smartphone className="w-4 h-4" />
                    {m === 'jazzcash' ? 'JazzCash' : 'EasyPaisa'}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
              <p className="font-semibold text-amber-800 mb-1.5 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" /> Send payment to:
              </p>
              <p className="font-mono font-bold text-xl text-amber-900">
                {payMethod === 'jazzcash'
                  ? (import.meta.env.VITE_JAZZCASH_NUMBER || 'Not configured')
                  : (import.meta.env.VITE_EASYPAISA_NUMBER || 'Not configured')}
              </p>
              <p className="text-amber-700 text-xs mt-1">
                Account: {import.meta.env.VITE_PAYMENT_ACCOUNT_NAME || 'Campus Core'} · Amount: Rs. {PLAN_CONFIG[selectedPlan].amount.toLocaleString()}
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700">
                <span className="font-semibold">Auto-verified.</span> Submit your details and your subscription updates automatically once payment is confirmed.
              </p>
            </div>

            {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 px-4 py-2 rounded-xl">{error}</p>}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number Used *</label>
                <input value={payPhone} onChange={e => setPayPhone(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="03XXXXXXXXX" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Transaction ID *</label>
                <input value={txnId} onChange={e => setTxnId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. TXN123456789" />
              </div>
            </div>

            <button onClick={handleSubmit} disabled={submitting || downgradeBlocked}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
              {submitting ? <><Loader className="w-4 h-4 animate-spin" /> Submitting...</> :
               isSamePlan ? 'Submit Payment for Verification' :
               isUpgrade ? `Upgrade to ${PLAN_CONFIG[selectedPlan].label}` :
               `Switch to ${PLAN_CONFIG[selectedPlan].label}`}
            </button>

            <p className="text-center text-xs text-slate-400">
              Need help? Call or WhatsApp:{' '}
              <a
                href={`https://wa.me/${(import.meta.env.VITE_SUPPORT_PHONE || '').replace(/\D/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                className="font-semibold text-blue-500 hover:underline"
              >
                {import.meta.env.VITE_SUPPORT_PHONE || 'Not configured'}
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}