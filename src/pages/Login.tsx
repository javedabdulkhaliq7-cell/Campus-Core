import { useState } from 'react';
import { supabase, APP_NAME } from '../lib/supabase';
import { parentSupabase, setRememberMe } from '../lib/parentSupabaseClient';
import { School, Eye, EyeOff, ChevronRight, ChevronLeft, Check, Loader, Smartphone, CreditCard, Clock, AlertCircle, RefreshCw, Phone, KeyRound } from 'lucide-react';

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

type Mode = 'signin' | 'register' | 'parent';
type Plan = 'basic' | 'standard' | 'premium';
type PayMethod = 'jazzcash' | 'easypaisa';

export default function Login({ onLoginSuccess }: Props) {
  const [mode, setMode] = useState<Mode>('parent');

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
            onClick={() => setMode('parent')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === 'parent' ? 'bg-white text-blue-900' : 'text-white/70 hover:text-white'}`}
          >
            Parent
          </button>
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
          {mode === 'parent' ? (
            <ParentLoginForm />
          ) : mode === 'signin' ? (
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

// ── Parent Login Form ──────────────────────────────────────────
// Note: this does NOT call any onSuccess prop. Setting the parentSupabase
// session here is enough — the top-level RootRouter in App.tsx listens for
// that session and automatically swaps the whole page to ParentDashboard.
function ParentLoginForm() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleCodeChange(value: string) {
    setCode(value.replace(/\D/g, '').slice(0, 6));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parent-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed.');

      setRememberMe(remember);
      const { error: sessionErr } = await parentSupabase.auth.setSession(data.session);
      if (sessionErr) throw sessionErr;
      // No navigation call needed — App.tsx's session listener takes it from here.
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-8 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Parent Login</h2>
        <p className="text-slate-500 text-sm mt-1">View your child's attendance, fees, and results</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Father's Phone Number</label>
        <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
          <Phone className="w-4 h-4 text-slate-400" />
          <input
            type="tel" value={phone} onChange={e => { setPhone(e.target.value); setError(''); }}
            className="flex-1 outline-none text-sm bg-transparent"
            placeholder="0300-1234567" required autoFocus
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Access Code</label>
        <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
          <KeyRound className="w-4 h-4 text-slate-400" />
          <input
            type="text" inputMode="numeric" value={code} onChange={e => { handleCodeChange(e.target.value); setError(''); }}
            className="flex-1 outline-none text-sm bg-transparent tracking-widest font-mono"
            placeholder="482915" required
          />
        </div>
        <p className="text-xs text-slate-400 mt-1">Given to you by the school office.</p>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="rounded border-slate-300" />
        Remember me on this device
      </label>

      <button
        type="submit" disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <><Loader className="w-4 h-4 animate-spin" /> Logging in...</> : 'Login'}
      </button>
    </form>
  );
}

// ── Registration Wizard ────────────────────────────────────────
function RegisterWizard({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');

  // After registration — show pending screen
  const [registeredPaymentId, setRegisteredPaymentId] = useState<string | null>(null);
  const [registeredTxnId, setRegisteredTxnId] = useState('');
  const [registeredPlan, setRegisteredPlan] = useState<Plan>('basic');
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [checkResult, setCheckResult] = useState<'verified' | 'still_pending' | null>(null);

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
      // ── Call the edge function — does EVERYTHING server-side with the   ──
      // ── service role key, so there's no RLS race condition possible.    ──
      // ── If any step fails server-side, it rolls back everything itself.──
      const { data, error: fnError } = await supabase.functions.invoke('register-school', {
        body: {
          schoolName, principalName, address, phone, regNumber,
          fullName, adminEmail, password,
          selectedPlan, payMethod, payPhone, txnId,
        },
      });

      if (fnError) {
        // Try to surface the specific error message returned by the function
        let message = fnError.message || 'Registration failed. Please try again.';
        try {
          const ctx = (fnError as any).context;
          if (ctx) {
            const parsed = typeof ctx === 'string' ? JSON.parse(ctx) : await ctx.json?.();
            if (parsed?.error) message = parsed.error;
          }
        } catch { /* fall back to default message */ }
        throw new Error(message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Registration failed. Please try again.');
      }

      const paymentId = data.paymentId;

      // ── Now sign in as the newly created admin (server already made the user) ──
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password,
      });
      if (signInErr) throw new Error('Account created but could not sign in: ' + signInErr.message);

      // ── 10-second confirming window ──────────────────────────
      setSubmitting(false);
      setConfirming(true);

      const messages = [
        'Confirming payment details...',
        'Checking transaction record...',
        'Validating amount...',
        'Contacting payment network...',
        'Almost there...',
      ];

      let paymentVerified = false;

      for (let i = 0; i < messages.length; i++) {
        setConfirmMessage(messages[i]);
        await new Promise(resolve => setTimeout(resolve, 2000));

        const { data: checkPayment } = await supabase
          .from('payments')
          .select('status')
          .eq('id', paymentId)
          .maybeSingle();

        if (checkPayment?.status === 'verified') {
          paymentVerified = true;
          setConfirmMessage('Payment verified! ✅');
          await new Promise(resolve => setTimeout(resolve, 1000));
          break;
        }
      }

      setConfirming(false);

      if (paymentVerified) {
        // Instantly verified — go straight into the app
        setTimeout(() => onSuccess(), 1500);
      } else {
        // Not verified in 10s — show the pending waiting screen
        setRegisteredPaymentId(paymentId);
        setRegisteredTxnId(txnId);
        setRegisteredPlan(selectedPlan);
      }

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
      setSubmitting(false);
      setConfirming(false);
    }
  }

  // Manual "Check Again" button on the pending screen
  async function checkPaymentNow() {
    if (!registeredPaymentId) return;
    setCheckingPayment(true);
    setCheckResult(null);
    const { data } = await supabase
      .from('payments')
      .select('status')
      .eq('id', registeredPaymentId)
      .maybeSingle();
    if (data?.status === 'verified') {
      setCheckResult('verified');
      setTimeout(() => onSuccess(), 2000);
    } else {
      setCheckResult('still_pending');
    }
    setCheckingPayment(false);
  }

  // ── Confirming screen ──────────────────────────────────────
  if (confirming) {
    return (
      <div className="p-12 text-center space-y-6">
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
          <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <CreditCard className="w-7 h-7 text-blue-600" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Confirming Payment</h2>
          <p className="text-slate-500 text-sm mt-2 transition-all">{confirmMessage}</p>
        </div>
        <div className="flex justify-center gap-1.5">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
        <p className="text-xs text-slate-400">Please don't close this window</p>
      </div>
    );
  }

  // ── Payment Pending screen ─────────────────────────────────
  if (registeredPaymentId) {
    const planInfo = PLANS.find(p => p.key === registeredPlan)!;
    return (
      <div className="p-8 space-y-5">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Payment Pending Verification</h2>
          <p className="text-slate-500 text-sm">
            Your registration is complete. We're waiting to confirm your payment via our automated system.
          </p>
        </div>

        {/* Payment details box */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Transaction ID</span>
            <span className="font-mono font-semibold text-slate-800">{registeredTxnId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Plan</span>
            <span className="font-semibold text-slate-800 capitalize">{planInfo.label} — Rs. {planInfo.amount.toLocaleString()}/mo</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Status</span>
            <span className="font-semibold text-amber-600">⏳ Awaiting Verification</span>
          </div>
        </div>

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> What happens next?
          </p>
          <ul className="text-xs text-blue-700 space-y-1.5">
            <li>• Your payment is verified automatically when our system receives the JazzCash/EasyPaisa confirmation SMS.</li>
            <li>• This usually happens within a few minutes if the payment went through.</li>
            <li>• Once verified, you can sign in and access Campus Core immediately.</li>
            <li>• If you're having trouble, contact us using the number below.</li>
          </ul>
        </div>

        {/* Check result feedback */}
        {checkResult === 'verified' && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 font-semibold text-center">
            ✅ Payment verified! Redirecting to dashboard...
          </div>
        )}
        {checkResult === 'still_pending' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 text-center">
            Payment not verified yet. Please wait a few minutes and try again.
          </div>
        )}

        {/* Check Again button */}
        <button
          onClick={checkPaymentNow}
          disabled={checkingPayment || checkResult === 'verified'}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {checkingPayment
            ? <><Loader className="w-4 h-4 animate-spin" /> Checking...</>
            : <><RefreshCw className="w-4 h-4" /> Check Verification Status</>}
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
      </div>
    );
  }

  // ── Wizard steps ───────────────────────────────────────────
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
              <p className="text-slate-500 text-sm">Access is granted after payment verification</p>
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
                  <p className="mt-2 text-amber-600">After sending, enter your details below. Your payment will be <strong>auto-verified</strong> once our system receives the confirmation SMS.</p>
                </div>
              </div>

              {/* Auto-verify notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-700">
                  <p className="font-semibold">Automatic verification</p>
                  <p className="mt-0.5">Your access activates automatically once we receive your payment confirmation. No manual approval needed.</p>
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