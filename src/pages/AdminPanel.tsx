import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import {
  Shield, Plus, School, Users, Ban, CheckCircle, LogOut, Eye, EyeOff,
  X, Loader, Trash2, AlertTriangle, CreditCard, Clock, Filter,
  RefreshCw, CheckSquare, XCircle,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────
interface SchoolRecord {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  student_count?: number;
}

interface SubscriptionRecord {
  id: string;
  school_id: string;
  school_name: string;
  plan: 'basic' | 'standard' | 'premium';
  status: 'trial' | 'active' | 'pending_payment' | 'expired' | 'suspended';
  student_limit: number;
  amount: number;
  trial_ends_at: string | null;
  current_period_end: string | null;
  created_at: string;
  // joined
  latest_payment?: PaymentRecord | null;
}

interface PaymentRecord {
  id: string;
  school_id: string;
  subscription_id: string;
  amount: number;
  method: 'jazzcash' | 'easypaisa';
  transaction_id: string | null;
  phone_number: string | null;
  status: 'pending' | 'verified' | 'failed';
  payment_month: number | null;
  payment_year: number | null;
  paid_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
}

// ── Supabase admin client ───────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY;

// Force a client with the service key
const adminSupabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Always use adminSupabase for admin panel queries
const db = adminSupabase;

interface Props { onLogout: () => void; }

type AdminTab = 'schools' | 'subscriptions';

// ── Status badge helper ─────────────────────────────────────────
function SubStatusBadge({ status }: { status: SubscriptionRecord['status'] }) {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    trial: 'bg-blue-100 text-blue-700',
    pending_payment: 'bg-amber-100 text-amber-700',
    expired: 'bg-red-100 text-red-700',
    suspended: 'bg-slate-200 text-slate-600',
  };
  const labels: Record<string, string> = {
    active: 'Active',
    trial: 'Trial',
    pending_payment: 'Pending Payment',
    expired: 'Expired',
    suspended: 'Suspended',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {labels[status] ?? status}
    </span>
  );
}

// ── Main Component ──────────────────────────────────────────────
export default function AdminPanel({ onLogout }: Props) {
  const [tab, setTab] = useState<AdminTab>('schools');

  // Schools state
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ school_name: '', principal_name: '', city: '', email: '', password: '' });
  const [deleteTarget, setDeleteTarget] = useState<SchoolRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const isCreatingRef = useRef(false);

  // Subscriptions state
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [verifyTarget, setVerifyTarget] = useState<{ sub: SubscriptionRecord; payment: PaymentRecord } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<SubscriptionRecord | null>(null);
  const [suspending, setSuspending] = useState(false);
  const [autoVerifying, setAutoVerifying] = useState(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { fetchSchools(); fetchSubscriptions(); }, []);

  // ── Run Auto-Verify ──────────────────────────────────────────
  async function runAutoVerify() {
    setAutoVerifying(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/auto-verify-payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Auto-verify failed');
      setMessage({
        type: 'success',
        text: `✅ Auto-verify complete: ${data.verified} of ${data.total} pending payment(s) verified and activated.`,
      });
      fetchSubscriptions();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: '❌ ' + (err instanceof Error ? err.message : 'Auto-verify failed') });
    }
    setAutoVerifying(false);
  }

  // ── Fetch Schools ─────────────────────────────────────────────
  async function fetchSchools() {
    setSchoolsLoading(true);
    const { data: schoolList } = await supabase.from('schools').select('*').order('created_at', { ascending: false });
    if (!schoolList) { setSchoolsLoading(false); return; }
    const enriched: SchoolRecord[] = await Promise.all(schoolList.map(async (s) => {
      const { count } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', s.id);
      return { ...s, student_count: count || 0 };
    }));
    setSchools(enriched);
    setSchoolsLoading(false);
  }

  // ── Fetch Subscriptions ───────────────────────────────────────
  async function fetchSubscriptions() {
    setSubsLoading(true);
    try {
      const { data: subs, error: subsErr } = await db
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (subsErr) throw new Error(subsErr.message);
      if (!subs || subs.length === 0) {
        setSubscriptions([]);
        setSubsLoading(false);
        return;
      }

      const enriched: SubscriptionRecord[] = await Promise.all(subs.map(async (sub) => {
        const { data: settings } = await db
          .from('school_settings')
          .select('school_name')
          .eq('school_id', sub.school_id)
          .maybeSingle();

        const { data: schoolRow } = await db
          .from('schools')
          .select('name')
          .eq('id', sub.school_id)
          .maybeSingle();

        const { data: payments } = await db
          .from('payments')
          .select('*')
          .eq('subscription_id', sub.id)
          .order('created_at', { ascending: false })
          .limit(1);

        return {
          ...sub,
          school_name: settings?.school_name ?? schoolRow?.name ?? 'Unknown School',
          latest_payment: payments?.[0] ?? null,
        };
      }));

      setSubscriptions(enriched);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
      setMessage({ type: 'error', text: '❌ ' + (err instanceof Error ? err.message : 'Failed to fetch subscriptions') });
    }
    setSubsLoading(false);
  }

  // ── Verify Payment ────────────────────────────────────────────
  async function verifyPayment() {
    if (!verifyTarget) return;
    setVerifying(true);
    try {
      const now = new Date();
      const periodStart = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      // Update payment
      await db.from('payments')
        .update({ status: 'verified', verified_at: now.toISOString(), verified_by: 'admin' })
        .eq('id', verifyTarget.payment.id);

      // Update subscription
      await db.from('subscriptions')
        .update({
          status: 'active',
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', verifyTarget.sub.id);

      setMessage({ type: 'success', text: `✅ Payment verified for "${verifyTarget.sub.school_name}". Subscription is now active.` });
      setVerifyTarget(null);
      fetchSubscriptions();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: '❌ ' + (err instanceof Error ? err.message : 'Verification failed') });
    }
    setVerifying(false);
  }

  // ── Suspend Subscription ──────────────────────────────────────
  async function suspendSubscription() {
    if (!suspendTarget) return;
    setSuspending(true);
    try {
      await db.from('subscriptions')
        .update({ status: 'suspended', updated_at: new Date().toISOString() })
        .eq('id', suspendTarget.id);
      setMessage({ type: 'success', text: `⚠️ "${suspendTarget.school_name}" has been suspended.` });
      setSuspendTarget(null);
      fetchSubscriptions();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: '❌ ' + (err instanceof Error ? err.message : 'Suspend failed') });
    }
    setSuspending(false);
  }

  // ── Create School ─────────────────────────────────────────────
  async function createSchool() {
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    setSaving(true);
    setMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/Create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email: form.email, password: form.password,
          schoolName: form.school_name, principalName: form.principal_name, city: form.city,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to create school');
      setMessage({ type: 'success', text: `✅ School "${form.school_name}" created! Login: ${form.email}` });
      setForm({ school_name: '', principal_name: '', city: '', email: '', password: '' });
      setShowModal(false);
      fetchSchools();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: '❌ ' + (err instanceof Error ? err.message : 'Error') });
    } finally {
      setSaving(false);
      isCreatingRef.current = false;
    }
  }

  // ── Delete School ─────────────────────────────────────────────
  async function deleteSchool() {
    if (!deleteTarget || !adminSupabase) return;
    if (deleteConfirmName.trim() !== deleteTarget.name.trim()) {
      setMessage({ type: 'error', text: '❌ School name does not match. Please type it exactly.' }); return;
    }
    setDeleting(true);
    setMessage(null);
    try {
      const { data: members } = await supabase.from('school_members').select('user_id').eq('school_id', deleteTarget.id);
      const { error: schoolDeleteError } = await supabase.from('schools').delete().eq('id', deleteTarget.id);
      if (schoolDeleteError) throw new Error('Failed to delete school: ' + schoolDeleteError.message);
      if (members && members.length > 0) {
        for (const member of members) { await adminSupabase.auth.admin.deleteUser(member.user_id); }
      }
      setMessage({ type: 'success', text: `✅ "${deleteTarget.name}" and all its data has been permanently deleted.` });
      setDeleteTarget(null);
      setDeleteConfirmName('');
      fetchSchools();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: '❌ ' + (err instanceof Error ? err.message : 'Error') });
    }
    setDeleting(false);
  }

  async function toggleSchool(school: SchoolRecord) {
    await supabase.from('schools').update({ is_active: !school.is_active }).eq('id', school.id);
    fetchSchools();
  }

  // ── Filter subscriptions ──────────────────────────────────────
  const filteredSubs = statusFilter === 'all'
    ? subscriptions
    : subscriptions.filter(s => s.status === statusFilter);

  const pendingCount = subscriptions.filter(s => s.latest_payment?.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-700 to-purple-900 text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Campus Core Admin</h1>
            <p className="text-purple-200 text-xs">Super Administrator Panel</p>
          </div>
        </div>
        <button onClick={onLogout} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm transition-colors">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-200 bg-white px-6">
        <div className="flex gap-0 max-w-6xl mx-auto">
          {([
            { key: 'schools' as AdminTab, label: 'Schools', icon: School, badge: null as number | null },
            { key: 'subscriptions' as AdminTab, label: 'Subscriptions', icon: CreditCard, badge: (pendingCount > 0 ? pendingCount : null) as number | null },
          ]).map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key as AdminTab)}
              className={`relative flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                tab === key
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {badge && (
                <span className="absolute -top-0.5 right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center font-bold">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.text}
            <button onClick={() => setMessage(null)} className="float-right"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* ── SCHOOLS TAB ── */}
        {tab === 'schools' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <School className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{schools.length}</p>
                    <p className="text-slate-500 text-sm">Total Schools</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{schools.filter(s => s.is_active).length}</p>
                    <p className="text-slate-500 text-sm">Active Schools</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{schools.reduce((a, s) => a + (s.student_count || 0), 0)}</p>
                    <p className="text-slate-500 text-sm">Total Students</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Schools List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <h2 className="font-bold text-slate-800 text-lg">All Schools</h2>
                <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  <Plus className="w-4 h-4" /> Add New School
                </button>
              </div>

              {schoolsLoading ? (
                <div className="p-12 text-center text-slate-400"><Loader className="w-8 h-8 animate-spin mx-auto mb-2" />Loading schools...</div>
              ) : schools.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <School className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No schools yet. Add your first school!</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {schools.map(school => (
                    <div key={school.id} className="flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm ${school.is_active ? 'bg-purple-600' : 'bg-slate-300'}`}>
                          {school.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{school.name}</p>
                          <p className="text-slate-400 text-xs mt-0.5">{school.student_count} students · Added {new Date(school.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${school.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {school.is_active ? 'Active' : 'Disabled'}
                        </span>
                        <button onClick={() => toggleSchool(school)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${school.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                          {school.is_active ? <><Ban className="w-3 h-3" /> Disable</> : <><CheckCircle className="w-3 h-3" /> Enable</>}
                        </button>
                        <button onClick={() => { setDeleteTarget(school); setDeleteConfirmName(''); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── SUBSCRIPTIONS TAB ── */}
        {tab === 'subscriptions' && (
          <>
            {/* Sub Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Active', value: subscriptions.filter(s => s.status === 'active').length, color: 'green' },
                { label: 'Pending Payment', value: subscriptions.filter(s => s.status === 'pending_payment').length, color: 'amber' },
                { label: 'Expired', value: subscriptions.filter(s => s.status === 'expired').length, color: 'red' },
                { label: 'Suspended', value: subscriptions.filter(s => s.status === 'suspended').length, color: 'slate' },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                  <p className={`text-2xl font-bold text-${stat.color}-600`}>{stat.value}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Filter + Refresh */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-slate-100">
                <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-600" /> Subscriptions
                </h2>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Filter className="w-4 h-4" />
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending_payment">Pending Payment</option>
                      <option value="active">Active</option>
                      <option value="trial">Trial</option>
                      <option value="expired">Expired</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                  <button onClick={fetchSubscriptions} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500" title="Refresh">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={runAutoVerify}
                    disabled={autoVerifying}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50"
                    title="Auto-verify all pending payments older than 2 hours"
                  >
                    {autoVerifying
                      ? <><Loader className="w-3 h-3 animate-spin" /> Running...</>
                      : <><CheckSquare className="w-3 h-3" /> Run Auto-Verify</>}
                  </button>
                </div>
              </div>

              {subsLoading ? (
                <div className="p-12 text-center text-slate-400"><Loader className="w-8 h-8 animate-spin mx-auto mb-2" />Loading subscriptions...</div>
              ) : filteredSubs.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No subscriptions found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">School</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Plan</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Trial Ends</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Payment</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredSubs.map(sub => (
                        <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-700 font-bold text-xs">
                                {sub.school_name.charAt(0)}
                              </div>
                              <p className="font-medium text-slate-800">{sub.school_name}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="capitalize font-semibold text-slate-700">{sub.plan}</span>
                            <p className="text-xs text-slate-400">Rs. {sub.amount.toLocaleString()}/mo</p>
                          </td>
                          <td className="px-4 py-4">
                            <SubStatusBadge status={sub.status} />
                          </td>
                          <td className="px-4 py-4 text-slate-500">
                            {sub.trial_ends_at ? (
                              <span className={`flex items-center gap-1 text-xs ${new Date(sub.trial_ends_at) < new Date() ? 'text-red-500' : 'text-slate-500'}`}>
                                <Clock className="w-3 h-3" />
                                {new Date(sub.trial_ends_at).toLocaleDateString()}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-4">
                            {sub.latest_payment ? (
                              <div>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                  sub.latest_payment.status === 'verified' ? 'bg-green-100 text-green-700' :
                                  sub.latest_payment.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {sub.latest_payment.status}
                                </span>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {sub.latest_payment.method === 'jazzcash' ? 'JazzCash' : 'EasyPaisa'}
                                  {sub.latest_payment.paid_at ? ` · ${new Date(sub.latest_payment.paid_at).toLocaleDateString()}` : ''}
                                </p>
                              </div>
                            ) : <span className="text-slate-400 text-xs">No payment yet</span>}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              {sub.latest_payment?.status === 'pending' && (
                                <button
                                  onClick={() => setVerifyTarget({ sub, payment: sub.latest_payment! })}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                                >
                                  <CheckSquare className="w-3 h-3" /> Verify
                                </button>
                              )}
                              {sub.status !== 'suspended' && (
                                <button
                                  onClick={() => setSuspendTarget(sub)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                >
                                  <XCircle className="w-3 h-3" /> Suspend
                                </button>
                              )}
                              {sub.status === 'suspended' && (
                                <span className="text-xs text-slate-400 italic">Suspended</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Verify Payment Modal ── */}
      {verifyTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center gap-3 p-6 border-b border-green-100 bg-green-50 rounded-t-2xl">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckSquare className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-green-800">Verify Payment</h3>
                <p className="text-green-600 text-xs mt-0.5">{verifyTarget.sub.school_name}</p>
              </div>
            </div>

            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500">Method</p>
                  <p className="font-semibold text-slate-800 capitalize">{verifyTarget.payment.method}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500">Amount</p>
                  <p className="font-semibold text-slate-800">Rs. {verifyTarget.payment.amount.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500">Phone Number</p>
                  <p className="font-semibold text-slate-800 font-mono">{verifyTarget.payment.phone_number || '—'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500">Submitted</p>
                  <p className="font-semibold text-slate-800">
                    {verifyTarget.payment.paid_at ? new Date(verifyTarget.payment.paid_at).toLocaleDateString() : '—'}
                  </p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500">Transaction ID</p>
                <p className="font-mono font-bold text-slate-800 text-lg">{verifyTarget.payment.transaction_id || '—'}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                Verifying will mark this payment as verified and set the subscription to <strong>Active</strong> for the next 30 days.
              </div>
            </div>

            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setVerifyTarget(null)} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-sm">
                Cancel
              </button>
              <button onClick={verifyPayment} disabled={verifying}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm">
                {verifying ? <><Loader className="w-4 h-4 animate-spin" /> Verifying...</> : <><CheckCircle className="w-4 h-4" /> Confirm & Activate</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Suspend Confirmation Modal ── */}
      {suspendTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Suspend Subscription</h3>
                <p className="text-slate-500 text-xs">{suspendTarget.school_name}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              This will suspend <strong>{suspendTarget.school_name}</strong>'s access to Campus Core immediately.
              They will see a payment wall until their subscription is reactivated.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setSuspendTarget(null)} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-sm">Cancel</button>
              <button onClick={suspendSubscription} disabled={suspending}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm">
                {suspending ? <><Loader className="w-4 h-4 animate-spin" /> Suspending...</> : 'Suspend Access'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete School Modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center gap-3 p-6 border-b border-red-100 bg-red-50 rounded-t-2xl">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-red-800">Delete School Permanently</h3>
                <p className="text-red-500 text-xs mt-0.5">This action cannot be undone</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                You are about to permanently delete <strong className="text-slate-800">{deleteTarget.name}</strong> and all its data.
              </p>
              <ul className="text-sm text-slate-500 space-y-1 ml-4 list-disc">
                <li>All students ({deleteTarget.student_count} records)</li>
                <li>All classes, fees, attendance records</li>
                <li>All notices and settings</li>
                <li>The school's login credentials</li>
              </ul>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                To confirm, type the school name exactly: <strong>{deleteTarget.name}</strong>
              </div>
              <input
                type="text" value={deleteConfirmName} onChange={e => setDeleteConfirmName(e.target.value)}
                placeholder={`Type "${deleteTarget.name}" to confirm`}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                autoFocus
              />
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => { setDeleteTarget(null); setDeleteConfirmName(''); }}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-sm">Cancel</button>
              <button onClick={deleteSchool} disabled={deleting || deleteConfirmName.trim() !== deleteTarget.name.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm">
                {deleting ? <><Loader className="w-4 h-4 animate-spin" /> Deleting...</> : <><Trash2 className="w-4 h-4" /> Delete Permanently</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add School Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-lg">Add New School</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: 'School Name *', key: 'school_name', placeholder: 'e.g. Javed Public School' },
                { label: 'Principal Name *', key: 'principal_name', placeholder: 'e.g. Muhammad Ali' },
                { label: 'City', key: 'city', placeholder: 'e.g. Quetta' },
                { label: 'Login Email *', key: 'email', placeholder: 'school@example.com', type: 'email' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
                  <input
                    type={field.type ?? 'text'}
                    value={form[field.key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Min 8 characters" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-slate-400">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
              <button
                onClick={createSchool}
                disabled={saving || !form.school_name || !form.email || !form.password}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <><Loader className="w-4 h-4 animate-spin" /> Creating...</> : 'Create School'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}