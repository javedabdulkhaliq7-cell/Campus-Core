import { useState } from 'react';
import { supabase, APP_NAME } from '../lib/supabase';
import { School, Eye, EyeOff, ChevronRight, ChevronLeft, Check, Loader, Smartphone, CreditCard, Clock } from 'lucide-react';

// ── Plan config ────────────────────────────────────────────────
const PLANS = [
  {
    key: 'basic' as const,
    label: 'Basic',
    amount: 1000,
    student_limit: 200,
    badge: null,
    description: 'Perfect for small schools',
    features: ['Up to 200 students', 'Fee management', 'Attendance tracking', 'Exam results', 'Basic reports'],
  },
  {
    key: 'standard' as const,
    label: 'Standard',
    amount: 2000,
    student_limit: 500,
    badge: 'Popular',
    description: 'Ideal for growing schools',
    features: ['Up to 500 students', 'All Basic features', 'Advanced reports', 'Document management', 'Leaving certificates'],
  },
  {
    key: 'premium' as const,
    label: 'Premium',
    amount: 5000,
    student_limit: 999999,
    badge: 'Unlimited',
    description: 'For large institutions',
    features: ['Unlimited students', 'All Standard features', 'Priority support', 'Custom branding', 'Future API integrations'],
  },
];

interface Props { onLoginSuccess: () => void; }

type Mode = 'signin' | 'register';
type Plan = 'basic' | 'standard' | 'premium';
type PayMethod = 'jazzcash' | 'easypaisa';

export default function Login({ onLoginSuccess }: Props) {
  const [mode, setMode] = useState<Mode>('signin');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/30">
            <School className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">{APP_NAME}</h1>
          <p className="text-blue-300 text-sm mt-1">School Management System</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-white/10 rounded-xl p-1 mb-6">
          <button
            onClick={() => setMode('signin')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === 'signin' ? 'bg-white text-blue-900' : 'text-white/70 hover:text-white'}`}
          >
            Sign In
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === 'register' ? 'bg-white text-blue-900' : 'text-white/70 hover:text-white'}`}
          >
            Register School
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {mode === 'signin' ? (
            <SignInForm onSuccess={onLoginSuccess} />
          ) : (
            <RegisterWizard onSuccess={onLoginSuccess} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sign In Form ────────────────────────────────────────────────
function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { setError(err.message); setLoading(false); }
    else onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="p-8 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Welcome back</h2>
        <p className="text-slate-500 text-sm mt-1">Sign in to your school account</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
        <input
          type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="school@example.com" required autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
        <div className="relative">
          <input
            type={show ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Your password" required
          />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit" disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <><Loader className="w-4 h-4 animate-spin" /> Signing in...</> : 'Sign In'}
      </button>
    </form>
  );
}

// ── Registration Wizard ────────────────────────────────────────
function RegisterWizard({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Step 1 fields
  const [schoolName, setSchoolName] = useState('');
  const [principalName, setPrincipalName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [regNumber, setRegNumber] = useState('');

  // Step 2 fields
  const [fullName, setFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Step 3 fields
  const [selectedPlan, setSelectedPlan] = useState<Plan>('basic');
  const [payMethod, setPayMethod] = useState<PayMethod>('jazzcash');
  const [payPhone, setPayPhone] = useState('');
  const [txnId, setTxnId] = useState('');

  // Sync admin email from step 1
  function goStep2() {
    setError('');
    if (!schoolName || !principalName || !address || !phone || !email) {
      setError('Please fill in all required fields.'); return;
    }
    setAdminEmail(email);
    setStep(2);
  }

  function goStep3() {
    setError('');
    if (!fullName || !adminEmail || !password) { setError('Please fill all fields.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setStep(3);
  }

  async function handleSubmit() {
    setError('');
    if (!payPhone || !txnId) { setError('Please enter your payment phone number and transaction ID.'); return; }
    setSubmitting(true);

    try {
      // 1. Create auth user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: adminEmail,
        password,
        options: { data: { full_name: fullName } },
      });
      if (authErr) throw new Error(authErr.message);
      const userId = authData.user?.id;
      if (!userId) throw new Error('Failed to create user account.');

      // 2. Create school
      const { data: schoolData, error: schoolErr } = await supabase
        .from('schools')
        .insert({ name: schoolName })
        .select()
        .single();
      if (schoolErr) throw new Error(schoolErr.message);
      const schoolId = schoolData.id;

      // 3. Add member
      const { error: memberErr } = await supabase
        .from('school_members')
        .insert({ user_id: userId, school_id: schoolId, role: 'admin' });
      if (memberErr) throw new Error(memberErr.message);

      // 4. School settings
      await supabase.from('school_settings').insert({
        school_id: schoolId,
        school_name: schoolName,
        principal_name: principalName,
        address,
        phone,
        email: adminEmail,
        website: '',
        registration_number: regNumber,
        weekly_off_days: [0], // Sunday off by default
      });

      // 5. Subscription — trial for 14 days
      const plan = PLANS.find(p => p.key === selectedPlan)!;
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);

      const { data: subData, error: subErr } = await supabase
        .from('subscriptions')
        .insert({
          school_id: schoolId,
          plan: selectedPlan,
          status: 'pending_payment',
          student_limit: plan.student_limit,
          amount: plan.amount,
          trial_ends_at: trialEnd.toISOString(),
        })
        .select()
        .single();
      if (subErr) throw new Error(subErr.message);

      // 6. Payment record
      const now = new Date();
      await supabase.from('payments').insert({
        school_id: schoolId,
        subscription_id: subData.id,
        amount: plan.amount,
        method: payMethod,
        transaction_id: txnId,
        phone_number: payPhone,
        status: 'pending',
        payment_month: now.getMonth() + 1,
        payment_year: now.getFullYear(),
        paid_at: now.toISOString(),
      });

      setSuccess(true);

      // Auto sign-in then redirect after 3s
      await supabase.auth.signInWithPassword({ email: adminEmail, password });
      setTimeout(() => onSuccess(), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    const plan = PLANS.find(p => p.key === selectedPlan)!;
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    return (
      <div className="p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Registration Submitted!</h2>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left space-y-2">
          <p className="text-sm text-blue-800 font-semibold">🎉 Your 14-day free trial starts now</p>
          <p className="text-sm text-blue-700">Trial ends: <strong>{trialEnd.toLocaleDateString()}</strong></p>
          <p className="text-sm text-blue-700">Plan: <strong>{plan.label} — Rs. {plan.amount.toLocaleString()}/mo</strong></p>
        </div>
        <p className="text-sm text-slate-600">
          Your payment is being verified by our team. You'll get full access once confirmed.
          During your trial, all features are available.
        </p>
        <p className="text-xs text-slate-400 animate-pulse">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Step Indicator */}
      <div className="px-8 pt-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                step > s ? 'bg-green-500 text-white' :
                step === s ? 'bg-blue-600 text-white' :
                'bg-slate-100 text-slate-400'
              }`}>
                {step > s ? <Check className="w-3.5 h-3.5" /> : s}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${step === s ? 'text-blue-600' : step > s ? 'text-green-600' : 'text-slate-400'}`}>
                {s === 1 ? 'School Info' : s === 2 ? 'Admin Account' : 'Plan & Payment'}
              </span>
              {s < 3 && <div className={`h-0.5 flex-1 rounded ${step > s ? 'bg-green-400' : 'bg-slate-100'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="p-8">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">School Information</h2>
              <p className="text-slate-500 text-sm">Tell us about your school</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">School Name *</label>
                <input value={schoolName} onChange={e => setSchoolName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Al-Falah Public School" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Principal Name *</label>
                <input value={principalName} onChange={e => setPrincipalName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Muhammad Ali" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number *</label>
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="03001234567" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">City / Address *</label>
                <input value={address} onChange={e => setAddress(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Street 5, Satellite Town, Quetta" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="school@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Registration No. <span className="text-slate-400">(optional)</span></label>
                <input value={regNumber} onChange={e => setRegNumber(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. EDU-2024-001" />
              </div>
            </div>
            <button onClick={goStep2}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
              Next: Admin Account <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Create Admin Account</h2>
              <p className="text-slate-500 text-sm">This will be your login credentials</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name *</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your full name" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address *</label>
              <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="school@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password *</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Min 8 characters" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password *</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Re-enter password" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex items-center gap-1 px-5 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={goStep3}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                Next: Choose Plan <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Choose Plan & Pay</h2>
              <p className="text-slate-500 text-sm">14-day free trial on all plans · Cancel anytime</p>
            </div>

            {/* Plan Cards */}
            <div className="grid grid-cols-3 gap-3">
              {PLANS.map(plan => (
                <button
                  key={plan.key}
                  onClick={() => setSelectedPlan(plan.key)}
                  className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                    selectedPlan === plan.key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  {plan.badge && (
                    <span className={`absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-bold ${
                      plan.badge === 'Popular' ? 'bg-orange-500 text-white' : 'bg-purple-500 text-white'
                    }`}>
                      {plan.badge}
                    </span>
                  )}
                  <p className={`font-bold text-sm ${selectedPlan === plan.key ? 'text-blue-700' : 'text-slate-800'}`}>{plan.label}</p>
                  <p className={`text-xs font-semibold mt-0.5 ${selectedPlan === plan.key ? 'text-blue-600' : 'text-slate-500'}`}>Rs. {plan.amount.toLocaleString()}/mo</p>
                  <p className={`text-xs mt-1 ${selectedPlan === plan.key ? 'text-blue-500' : 'text-slate-400'}`}>{plan.description}</p>
                </button>
              ))}
            </div>

            {/* Selected plan features */}
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-600 mb-2">Included in {PLANS.find(p => p.key === selectedPlan)?.label}:</p>
              <ul className="space-y-1">
                {PLANS.find(p => p.key === selectedPlan)?.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-slate-600">
                    <Check className="w-3 h-3 text-green-500 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Payment Section */}
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Payment Method</p>
                <div className="flex gap-2">
                  {(['jazzcash', 'easypaisa'] as PayMethod[]).map(m => (
                    <button
                      key={m}
                      onClick={() => setPayMethod(m)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                        payMethod === m ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Smartphone className="w-4 h-4" />
                      {m === 'jazzcash' ? 'JazzCash' : 'EasyPaisa'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Instructions */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
                <p className="font-semibold text-amber-800 mb-1.5 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4" />
                  {payMethod === 'jazzcash' ? 'JazzCash' : 'EasyPaisa'} Payment Instructions
                </p>
                <div className="space-y-1 text-amber-700 text-xs">
                  <p>Send <strong>Rs. {PLANS.find(p => p.key === selectedPlan)?.amount.toLocaleString()}</strong> to:</p>
                  <p className="font-mono font-bold text-base text-amber-900">
                    {payMethod === 'jazzcash'
                      ? (import.meta.env.VITE_JAZZCASH_NUMBER || 'Not configured')
                      : (import.meta.env.VITE_EASYPAISA_NUMBER || 'Not configured')}
                  </p>
                  <p className="text-amber-600">Account Name: <strong>{import.meta.env.VITE_PAYMENT_ACCOUNT_NAME || 'Campus Core'}</strong></p>
                  <p className="mt-2 text-amber-600">After sending, enter your details below. Your payment will be <strong>auto-verified within 2 hours</strong>.</p>
                </div>
              </div>

              {/* Auto-verify notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-700">
                  <p className="font-semibold">Auto-verification in 2 hours</p>
                  <p className="mt-0.5">Your access activates automatically after verification. No waiting for manual approval — you can start using Campus Core immediately on your 14-day trial.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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

              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-green-800">Amount Due</span>
                <span className="font-bold text-green-800">Rs. {PLANS.find(p => p.key === selectedPlan)?.amount.toLocaleString()}/mo</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)}
                className="flex items-center gap-1 px-5 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                {submitting ? <><Loader className="w-4 h-4 animate-spin" /> Submitting...</> : 'Complete Registration'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}