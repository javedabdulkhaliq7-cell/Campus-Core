import { useEffect, useState } from 'react';
import { supabase, APP_NAME } from './lib/supabase';
import { SchoolProvider, useSchool } from './lib/schoolContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import StudentProfiles from './pages/StudentProfiles';
import Fees from './pages/Fees';
import Attendance from './pages/Attendance';
import Reports from './pages/Reports';
import Classes from './pages/Classes';
import Announcements from './pages/Announcements';
import Settings from './pages/Settings';
import Results from './pages/Results';
import Billing from './pages/Billing';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import AdminPanel from './pages/AdminPanel';
import CertificateGenerator from './pages/CertificateGenerator';
import Staff from './pages/Staff';
import AdminMessages from './pages/AdminMessages';
import TeacherApp from './pages/TeacherApp';
import WatchmanApp from './pages/WatchmanApp';
import ParentDashboard from './pages/ParentDashboard';
import { parentSupabase } from './lib/parentSupabaseClient';
import {
  Menu, X, School, LogOut, AlertTriangle, Clock, Smartphone,
  CreditCard, CheckCircle, Loader, RefreshCw, AlertCircle, Lock
} from 'lucide-react';

const isAdminRoute = window.location.pathname === '/admin';

type Page =
  | 'dashboard' | 'students' | 'profiles' | 'fees' | 'attendance'
  | 'reports' | 'classes' | 'announcements' | 'settings' | 'results' | 'certificates' | 'billing' | 'staff' | 'messages';

const PAGE_TITLES: Record<Page, string> = {
  dashboard: 'Principal Dashboard',
  students: 'Student Management',
  profiles: 'Student Profiles',
  fees: 'Fee Management',
  attendance: 'Daily Attendance',
  reports: 'Reports & Analytics',
  classes: 'Classes & Fees',
  announcements: 'Notices',
  settings: 'Settings',
  results: 'Exam Results',
  certificates: 'Certificate Generator',
  billing: 'Billing & Subscription',
  staff: 'Staff Management',
  messages: 'Parent Messages',
};

// ── Payment Pending Wall ────────────────────────────────
function PendingPaymentWall({ onVerified, onLogout }: { onVerified: () => void; onLogout: () => void }) {
  const { subscription, refreshSubscription } = useSchool();
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<'verified' | 'still_pending' | null>(null);

  const supportPhone = import.meta.env.VITE_SUPPORT_PHONE || '';

  async function checkNow() {
    setChecking(true);
    setCheckResult(null);
    await refreshSubscription();
    // After refresh, check the latest subscription status
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('id', subscription?.id)
      .maybeSingle();

    if (sub?.status === 'active') {
      setCheckResult('verified');
      setTimeout(() => onVerified(), 1500);
    } else {
      setCheckResult('still_pending');
    }
    setChecking(false);
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-amber-500 px-6 py-5 text-white text-center">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-90" />
          <h2 className="text-lg font-bold">Payment Pending Verification</h2>
          <p className="text-amber-100 text-sm mt-1">Your access will activate once payment is confirmed</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> Your payment is being verified
            </p>
            <ul className="text-xs text-blue-700 space-y-1.5">
              <li>• Verification happens automatically when our system receives the JazzCash/EasyPaisa SMS.</li>
              <li>• This usually takes a few minutes after your payment goes through.</li>
              <li>• If your payment hasn't been received yet, please send it now and check again.</li>
              <li>• If you're having trouble, contact us using the number below.</li>
            </ul>
          </div>

          {/* Subscription details */}
          {subscription && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Plan</span>
                <span className="font-semibold text-slate-800 capitalize">{subscription.plan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount</span>
                <span className="font-semibold text-slate-800">Rs. {subscription.amount?.toLocaleString()}/mo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className="font-semibold text-amber-600">⏳ Awaiting Verification</span>
              </div>
            </div>
          )}

          {/* Check result feedback */}
          {checkResult === 'verified' && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 font-semibold text-center flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" /> Payment verified! Entering dashboard...
            </div>
          )}
          {checkResult === 'still_pending' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 text-center">
              Not verified yet. Please wait a few minutes and try again.
            </div>
          )}

          {/* Check Again */}
          <button
            onClick={checkNow}
            disabled={checking || checkResult === 'verified'}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {checking
              ? <><Loader className="w-4 h-4 animate-spin" /> Checking...</>
              : <><RefreshCw className="w-4 h-4" /> Check Verification Status</>}
          </button>

          <button
            onClick={onLogout}
            className="w-full border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium py-2.5 rounded-xl transition-colors text-sm"
          >
            Sign Out
          </button>

          <p className="text-center text-xs text-slate-400">
            Need help? Call or WhatsApp:{' '}
            <a
              href={`https://wa.me/${supportPhone.replace(/\D/g, '')}`}
              target="_blank" rel="noopener noreferrer"
              className="font-semibold text-blue-500 hover:underline"
            >
              {supportPhone || 'Not configured'}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Payment Wall (subscription expired) ─────────────────────────
function PaymentWall({ onSubmitted }: { onSubmitted: () => void }) {
  const { schoolName, subscription } = useSchool();
  const [payMethod, setPayMethod] = useState<'jazzcash' | 'easypaisa'>('jazzcash');
  const [payPhone, setPayPhone] = useState('');
  const [txnId, setTxnId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    if (!payPhone || !txnId) { setError('Please fill in all fields.'); return; }
    setSubmitting(true);
    try {
      if (!subscription) throw new Error('No subscription found.');
      const now = new Date();
      await supabase.from('payments').insert({
        school_id: subscription.school_id,
        subscription_id: subscription.id,
        amount: subscription.amount,
        method: payMethod,
        transaction_id: txnId,
        phone_number: payPhone,
        status: 'pending',
        payment_month: now.getMonth() + 1,
        payment_year: now.getFullYear(),
        paid_at: now.toISOString(),
      });
      setSubmitted(true);
      setTimeout(() => onSubmitted(), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit payment.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Payment Submitted!</h2>
          <p className="text-slate-600 text-sm">
            Your payment will be verified automatically. Access will restore once confirmed.
          </p>
          <p className="text-xs text-slate-400 animate-pulse">Please wait...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-red-600 px-6 py-5 text-white text-center">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-90" />
          <h2 className="text-lg font-bold">Subscription Expired</h2>
          <p className="text-red-200 text-sm mt-1">{schoolName}</p>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Plan</p>
              <p className="font-semibold text-slate-800 capitalize">{subscription?.plan ?? '—'}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Amount Due</p>
              <p className="font-bold text-red-600 text-lg">Rs. {subscription?.amount?.toLocaleString() ?? '—'}</p>
            </div>
          </div>

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
              Account: {import.meta.env.VITE_PAYMENT_ACCOUNT_NAME || 'Campus Core'} · Amount: Rs. {subscription?.amount?.toLocaleString()}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700">
              <span className="font-semibold">Auto-verified.</span> Submit your details and access restores automatically once payment is confirmed. No manual approval needed.
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

          <button onClick={handleSubmit} disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
            {submitting ? <><Loader className="w-4 h-4 animate-spin" /> Submitting...</> : 'Submit Payment for Verification'}
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
      </div>
    </div>
  );
}

// ── Locked Feature (shown during grace period for blocked pages) ──
function LockedFeature({ featureName }: { featureName: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm max-w-md w-full p-8 text-center space-y-4">
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7 text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">{featureName} is locked</h2>
        <p className="text-slate-500 text-sm">
          Your subscription payment is overdue. Please renew now to regain access to {featureName.toLowerCase()} and other features.
        </p>
        <p className="text-xs text-slate-400">
          Fees, Attendance, Classes, and Announcements remain available during this grace period.
        </p>
      </div>
    </div>
  );
}

// ── Main App Content ────────────────────────────────────────────
function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [paymentWallKey, setPaymentWallKey] = useState(0);
  const [userRole, setUserRole] = useState<'admin' | 'teacher' | 'super_admin' | 'watchman' | null>(null);
  const [userStatus, setUserStatus] = useState<'active' | 'inactive' | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const { schoolName, schoolLogo, loading: schoolLoading, subscription, subscriptionLoading, refreshSubscription } = useSchool();

  useEffect(() => {
    supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
        setUserStatus(null);
      }
    });
  }, []);

  async function fetchUserRole(uid: string) {
    setRoleLoading(true);
    const { data } = await supabase
      .from('school_members')
      .select('role, status')
      .eq('user_id', uid)
      .maybeSingle();
    setUserRole((data?.role as 'admin' | 'teacher' | 'super_admin' | 'watchman') ?? 'admin');
    setUserStatus((data?.status as 'active' | 'inactive') ?? 'active');
    setRoleLoading(false);
  }

  function navigate(page: Page) {
    setCurrentPage(page);
    setSidebarOpen(false);
  }

  useEffect(() => {
    fetchUnreadMessages();
  }, [currentPage]);

  async function fetchUnreadMessages() {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    const { count } = await supabase
      .from('parent_teacher_messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', authUser.id)
      .eq('is_read', false);
    setUnreadMessages(count ?? 0);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setUser(null);
    setUserRole(null);
    setUserStatus(null);
  }

  // Loading gate
  if (authLoading || schoolLoading || subscriptionLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <School className="w-6 h-6 text-blue-600 animate-pulse" />
          </div>
          <p className="text-slate-600 font-medium">Loading {APP_NAME}...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  // ── Inactive staff block (teacher / watchman) ────────────────
  if ((userRole === 'teacher' || userRole === 'watchman') && userStatus === 'inactive') {
    const roleLabel = userRole === 'watchman' ? 'watchman' : 'teacher';
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 max-w-md w-full p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7 text-amber-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Your Account is Inactive</h2>
          <p className="text-slate-500 text-sm">
            Your {roleLabel} account has been deactivated. Please contact your school admin to restore access.
          </p>
          <button
            onClick={handleLogout}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // ── Teacher portal ───────────────────────────────────────────
  if (userRole === 'teacher') {
    return <TeacherApp user={user} onLogout={handleLogout} />;
  }

  // ── Watchman portal ───────────────────────────────────────────
  if (userRole === 'watchman') {
    return <WatchmanApp user={user} onLogout={handleLogout} />;
  }

  // ── Subscription gates (admin only below) ───────────────────

  // No subscription row at all (shouldn't normally happen)
  if (!subscription) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">No Subscription Found</h2>
          <p className="text-slate-600 text-sm">
            Your account has no subscription record. Please contact support or register again.
          </p>
          <button onClick={handleLogout}
            className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition-colors">
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Pending payment — show 72-hour waiting screen
  if (subscription.status === 'pending_payment') {
    return (
      <PendingPaymentWall
        onVerified={() => {
          refreshSubscription();
          setPaymentWallKey(k => k + 1);
        }}
        onLogout={handleLogout}
      />
    );
  }

  // Expired or suspended — show payment wall to renew
  if (subscription.status === 'expired' || subscription.status === 'suspended') {
    return (
      <PaymentWall
        key={paymentWallKey}
        onSubmitted={() => {
          refreshSubscription();
          setPaymentWallKey(k => k + 1);
        }}
      />
    );
  }

  // Grace period — limited access, locked pages handled in the pages map below
  const subStatus = subscription.status as string;
  const isGracePeriod = subStatus === 'grace_period';
  const graceDaysLeft = isGracePeriod && subscription.grace_period_started_at
    ? Math.max(0, 3 - Math.floor((Date.now() - new Date(subscription.grace_period_started_at).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  // Days until expiry (for the 5-day pre-expiry warning banner)
  const daysUntilExpiry = subscription.status === 'active' && subscription.current_period_end
    ? Math.ceil((new Date(subscription.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const showExpiryWarning = daysUntilExpiry !== null && daysUntilExpiry <= 5 && daysUntilExpiry >= 0;

  // ── Active or grace_period subscription — render full app ────
  const LOCKED_PAGES: Page[] = ['students', 'profiles', 'results', 'certificates', 'reports'];
  const pages: Record<Page, JSX.Element> = {
    dashboard: <Dashboard navigateTo={(page) => navigate(page as Page)} />,
    students: isGracePeriod && LOCKED_PAGES.includes('students') ? <LockedFeature featureName="Student Management" /> : <Students />,
    profiles: isGracePeriod && LOCKED_PAGES.includes('profiles') ? <LockedFeature featureName="Student Profiles" /> : <StudentProfiles />,
    fees: <Fees />,
    attendance: <Attendance />,
    reports: isGracePeriod && LOCKED_PAGES.includes('reports') ? <LockedFeature featureName="Reports" /> : <Reports />,
    classes: <Classes />,
    announcements: <Announcements />,
    settings: <Settings />,
    results: isGracePeriod && LOCKED_PAGES.includes('results') ? <LockedFeature featureName="Exam Results" /> : <Results />,
    certificates: isGracePeriod && LOCKED_PAGES.includes('certificates') ? <LockedFeature featureName="Certificate Generator" /> : <CertificateGenerator />,
    billing: <Billing />,
    staff: <Staff />,
    messages: <AdminMessages />,
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar
        currentPage={currentPage}
        onNavigate={navigate}
        isOpen={sidebarOpen}
        schoolName={schoolName}
        schoolLogo={schoolLogo}
        billingNeedsAttention={showExpiryWarning || isGracePeriod}
        unreadMessages={unreadMessages}
      />

      <div className="flex-1 lg:ml-64 min-w-0 flex flex-col">
        <header className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 lg:px-6 py-3.5 flex items-center gap-4">
          <button className="lg:hidden p-1.5 hover:bg-slate-100 rounded-lg" onClick={() => setSidebarOpen(o => !o)}>
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="lg:hidden flex items-center gap-2">
            {schoolLogo ? (
              <img src={schoolLogo} alt="Logo" className="w-7 h-7 rounded-lg object-cover" />
            ) : (
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                <School className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <span className="font-bold text-slate-800 text-sm">{schoolName}</span>
          </div>
          <h1 className="hidden lg:block font-semibold text-slate-700 text-sm">{PAGE_TITLES[currentPage]}</h1>
          <div className="ml-auto flex items-center gap-3">
            {subscription && (
              <span className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                subscription.status === 'active' ? 'bg-green-100 text-green-700' :
                subStatus === 'grace_period' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {subscription.status === 'active' ? '● Active' :
                 subStatus === 'grace_period' ? `● Grace Period (${graceDaysLeft}d left)` :
                 '● ' + subscription.status}
              </span>
            )}
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-700">Principal</span>
              <span className="text-xs text-slate-400">{user?.email?.split('@')[0] || 'Admin'}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
              {user?.email?.charAt(0).toUpperCase() || 'P'}
            </div>
            <button onClick={handleLogout}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-red-600" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Pre-expiry warning banner (5 days before, still active) */}
        {showExpiryWarning && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 lg:px-6 py-2.5 flex items-center gap-2.5 flex-wrap">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-xs sm:text-sm text-amber-800 flex-1">
              <span className="font-semibold">Subscription renewal due in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}.</span>
              {' '}Please renew soon to avoid interruption.
            </p>
            <button
              onClick={() => navigate('billing')}
              className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg transition-colors shrink-0"
            >
              Renew Now
            </button>
          </div>
        )}

        {/* Grace period warning banner */}
        {isGracePeriod && (
          <div className="bg-red-50 border-b border-red-200 px-4 lg:px-6 py-2.5 flex items-center gap-2.5 flex-wrap">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <p className="text-xs sm:text-sm text-red-800 flex-1">
              <span className="font-semibold">Payment overdue — {graceDaysLeft} day{graceDaysLeft !== 1 ? 's' : ''} left before access is blocked.</span>
              {' '}Some features are already locked.
            </p>
            <button
              onClick={() => navigate('billing')}
              className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors shrink-0"
            >
              Renew Now
            </button>
          </div>
        )}

        <main className="p-4 lg:p-6 flex-1">
          {pages[currentPage]}
        </main>
      </div>
    </div>
  );
}

// ── Root Router ───────────────────────────────────────────────────
// No separate parent URL anymore — Login.tsx now has a "Parent" option
// right alongside Sign In / Register. This component just checks which
// session exists (parent vs. staff) and renders accordingly. A parent
// session lives on a totally separate Supabase client (parentSupabase),
// so it can never collide with the staff session inside SchoolProvider.
function RootRouter() {
  const [parentSession, setParentSession] = useState<import('@supabase/supabase-js').Session | null>(null);
  const [checkingParentSession, setCheckingParentSession] = useState(true);

  useEffect(() => {
    parentSupabase.auth.getSession().then(({ data }) => {
      setParentSession(data.session);
      setCheckingParentSession(false);
    });
    const { data: listener } = parentSupabase.auth.onAuthStateChange((_event, newSession) => {
      setParentSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (checkingParentSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    );
  }

  if (parentSession) {
    return (
      <ParentDashboard
        onLogout={async () => {
          await parentSupabase.auth.signOut();
        }}
      />
    );
  }

  return (
    <SchoolProvider>
      <AppContent />
    </SchoolProvider>
  );
}

// ── Admin App ───────────────────────────────────────────────────
function AdminApp() {
  const [adminAuthed, setAdminAuthed] = useState(sessionStorage.getItem('admin_auth') === 'true');
  if (!adminAuthed) return <AdminLogin onSuccess={() => setAdminAuthed(true)} />;
  return <AdminPanel onLogout={() => { sessionStorage.removeItem('admin_auth'); setAdminAuthed(false); }} />;
}

export default function App() {
  if (isAdminRoute) return <AdminApp />;
  return <RootRouter />;
}