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
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import AdminPanel from './pages/AdminPanel';
import CertificateGenerator from './pages/CertificateGenerator';
import {
  Menu, X, School, LogOut, AlertTriangle, Clock, Smartphone,
  CreditCard, CheckCircle, Loader
} from 'lucide-react';

const isAdminRoute = window.location.pathname === '/admin';

type Page =
  | 'dashboard' | 'students' | 'profiles' | 'fees' | 'attendance'
  | 'reports' | 'classes' | 'announcements' | 'settings' | 'results' | 'certificates';

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
};

// ── Payment Wall (blocked state) ────────────────────────────────
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
      // Get school_id from subscription
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
            Our team will verify your payment shortly and activate your subscription.
            You'll be notified once confirmed.
          </p>
          <p className="text-xs text-slate-400 animate-pulse">Please wait...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
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

          {/* Payment Method */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Pay via</p>
            <div className="flex gap-2">
              {(['jazzcash', 'easypaisa'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setPayMethod(m)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                    payMethod === m ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  {m === 'jazzcash' ? 'JazzCash' : 'EasyPaisa'}
                </button>
              ))}
            </div>
          </div>

          {/* Instructions */}
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

          {/* Auto-verify notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700">
              <span className="font-semibold">Auto-verified within 2 hours.</span> Submit your details below and your access will restore automatically. No need to wait for manual approval.
            </p>
          </div>

          {/* Form */}
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
            Need help? Contact support at support@campuscore.pk
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Trial Banner ────────────────────────────────────────────────
function TrialBanner() {
  const { subscription, isOnTrial, trialDaysLeft } = useSchool();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (!subscription) return null;

  // Show for trial or pending_payment during trial window
  const showBanner = isOnTrial || subscription.status === 'pending_payment';
  if (!showBanner) return null;

  const isPending = subscription.status === 'pending_payment';

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 text-sm ${isPending ? 'bg-amber-500' : 'bg-blue-600'} text-white`}>
      <Clock className="w-4 h-4 shrink-0" />
      <p className="flex-1 text-xs sm:text-sm">
        {isPending
          ? `Payment under review. Trial ends in ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''}.`
          : `Free trial — ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} remaining. Activate your subscription to keep access.`
        }
      </p>
      <button onClick={() => setDismissed(true)} className="shrink-0 hover:opacity-70 transition-opacity">
        <X className="w-4 h-4" />
      </button>
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

  const { schoolName, schoolLogo, loading: schoolLoading, subscription, subscriptionLoading, isSubscriptionActive, refreshSubscription } = useSchool();

  useEffect(() => {
    supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
  }, []);

  function navigate(page: Page) {
    setCurrentPage(page);
    setSidebarOpen(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setUser(null);
  }

  if (authLoading || schoolLoading) {
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

  // Subscription enforcement: block on expired / suspended
  if (!subscriptionLoading && subscription) {
    const isBlocked =
      subscription.status === 'expired' ||
      subscription.status === 'suspended' ||
      // pending_payment AND trial has expired
      (subscription.status === 'pending_payment' &&
        subscription.trial_ends_at &&
        new Date(subscription.trial_ends_at) < new Date());

    if (isBlocked) {
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
  }

  const pages: Record<Page, JSX.Element> = {
    dashboard: <Dashboard navigateTo={(page) => navigate(page as Page)} />,
    students: <Students />,
    profiles: <StudentProfiles />,
    fees: <Fees />,
    attendance: <Attendance />,
    reports: <Reports />,
    classes: <Classes />,
    announcements: <Announcements />,
    settings: <Settings />,
    results: <Results />,
    certificates: <CertificateGenerator />,
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar
        currentPage={currentPage}
        onNavigate={navigate}
        isOpen={sidebarOpen}
        schoolName={schoolName}
        schoolLogo={schoolLogo}
      />

      <div className="flex-1 lg:ml-64 min-w-0 flex flex-col">
        {/* Trial / Pending Banner */}
        <TrialBanner />

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
            {/* Subscription badge */}
            {subscription && (
              <span className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                subscription.status === 'active' ? 'bg-green-100 text-green-700' :
                subscription.status === 'trial' || subscription.status === 'pending_payment' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {subscription.status === 'active' ? '● Active' :
                 subscription.status === 'pending_payment' ? '● Pending' :
                 subscription.status === 'trial' ? '● Trial' : '● Expired'}
              </span>
            )}
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-700">Principal</span>
              <span className="text-xs text-slate-400">{user?.email?.split('@')[0] || 'Admin'}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
              {user?.email?.charAt(0).toUpperCase() || 'PR'}
            </div>
            <button onClick={handleLogout} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-red-600" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="p-4 lg:p-6 flex-1">
          {pages[currentPage]}
        </main>
      </div>
    </div>
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
  return (
    <SchoolProvider>
      <AppContent />
    </SchoolProvider>
  );
}