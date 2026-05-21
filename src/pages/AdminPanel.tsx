import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { Shield, Plus, School, Users, Ban, CheckCircle, LogOut, Eye, EyeOff, X, Loader, Trash2, AlertTriangle } from 'lucide-react';

interface SchoolRecord {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  student_count?: number;
  member_email?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
const adminSupabase = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

interface Props { onLogout: () => void; }

export default function AdminPanel({ onLogout }: Props) {
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({
    school_name: '', principal_name: '', city: '', email: '', password: '',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Delete confirmation state ─────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<SchoolRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  useEffect(() => { fetchSchools(); }, []);

  async function fetchSchools() {
    setLoading(true);
    const { data: schoolList } = await supabase
      .from('schools')
      .select('*')
      .order('created_at', { ascending: false });
    if (!schoolList) { setLoading(false); return; }

    const enriched: SchoolRecord[] = await Promise.all(schoolList.map(async (s) => {
      const { count } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', s.id);
      return { ...s, student_count: count || 0 };
    }));
    setSchools(enriched);
    setLoading(false);
  }

  // ── Delete school — removes school record + auth user ─────
  async function deleteSchool() {
    if (!deleteTarget || !adminSupabase) return;
    if (deleteConfirmName.trim() !== deleteTarget.name.trim()) {
      setMessage({ type: 'error', text: '❌ School name does not match. Please type it exactly.' });
      return;
    }

    setDeleting(true);
    setMessage(null);

    try {
      // Step 1: Get all user_ids linked to this school
      const { data: members } = await supabase
        .from('school_members')
        .select('user_id')
        .eq('school_id', deleteTarget.id);

      // Step 2: Delete the school record
      // This cascades and deletes: school_members, school_settings,
      // students, classes, fee_records, attendance_records,
      // announcements, school_holidays automatically
      const { error: schoolDeleteError } = await supabase
        .from('schools')
        .delete()
        .eq('id', deleteTarget.id);

      if (schoolDeleteError) throw new Error('Failed to delete school: ' + schoolDeleteError.message);

      // Step 3: Delete auth users (login credentials)
      // Done AFTER school deletion so cascade works first
      if (members && members.length > 0) {
        for (const member of members) {
          await adminSupabase.auth.admin.deleteUser(member.user_id);
        }
      }

      setMessage({
        type: 'success',
        text: `✅ "${deleteTarget.name}" and all its data has been permanently deleted.`,
      });
      setDeleteTarget(null);
      setDeleteConfirmName('');
      fetchSchools();
    } catch (err: any) {
      setMessage({ type: 'error', text: '❌ ' + err.message });
    }

    setDeleting(false);
  }

  async function createSchool() {
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
          email: form.email,
          password: form.password,
          schoolName: form.school_name,
          principalName: form.principal_name,
          city: form.city,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to create user');
      const userId = result.id;

      const slug = form.school_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
      const { data: schoolData, error: schoolError } = await supabase
        .from('schools')
        .insert({ name: form.school_name, slug, is_active: true })
        .select().single();
      if (schoolError) throw new Error(schoolError.message);

      await supabase.from('school_settings').insert({
        school_id: schoolData.id,
        school_name: form.school_name,
        principal_name: form.principal_name,
        address: form.city,
      });

      await supabase.from('school_members').insert({
        school_id: schoolData.id,
        user_id: userId,
        role: 'admin',
      });

      setMessage({ type: 'success', text: `✅ School "${form.school_name}" created! Login: ${form.email}` });
      setForm({ school_name: '', principal_name: '', city: '', email: '', password: '' });
      setShowModal(false);
      fetchSchools();
    } catch (err: any) {
      setMessage({ type: 'error', text: '❌ ' + err.message });
    }
    setSaving(false);
  }

  async function toggleSchool(school: SchoolRecord) {
    await supabase.from('schools').update({ is_active: !school.is_active }).eq('id', school.id);
    fetchSchools();
  }

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

      <div className="max-w-6xl mx-auto p-6">
        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.text}
            <button onClick={() => setMessage(null)} className="float-right"><X className="w-4 h-4" /></button>
          </div>
        )}

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
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> Add New School
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <Loader className="w-8 h-8 animate-spin mx-auto mb-2" />
              Loading schools...
            </div>
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
                      <p className="text-slate-400 text-xs mt-0.5">
                        {school.student_count} students · Added {new Date(school.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${school.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {school.is_active ? 'Active' : 'Disabled'}
                    </span>
                    <button
                      onClick={() => toggleSchool(school)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${school.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                    >
                      {school.is_active ? <><Ban className="w-3 h-3" /> Disable</> : <><CheckCircle className="w-3 h-3" /> Enable</>}
                    </button>
                    {/* ── Delete button ── */}
                    <button
                      onClick={() => { setDeleteTarget(school); setDeleteConfirmName(''); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                      title="Permanently delete this school"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Delete Confirmation Modal ──────────────────────── */}
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
                You are about to permanently delete <strong className="text-slate-800">{deleteTarget.name}</strong> and all its data including:
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
                type="text"
                value={deleteConfirmName}
                onChange={e => setDeleteConfirmName(e.target.value)}
                placeholder={`Type "${deleteTarget.name}" to confirm`}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                autoFocus
              />
            </div>

            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteConfirmName(''); }}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={deleteSchool}
                disabled={deleting || deleteConfirmName.trim() !== deleteTarget.name.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
              >
                {deleting
                  ? <><Loader className="w-4 h-4 animate-spin" /> Deleting...</>
                  : <><Trash2 className="w-4 h-4" /> Delete Permanently</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add School Modal — unchanged */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-lg">Add New School</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">School Name *</label>
                <input value={form.school_name} onChange={e => setForm(f => ({ ...f, school_name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g. Javed Public School" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Principal Name *</label>
                <input value={form.principal_name} onChange={e => setForm(f => ({ ...f, principal_name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g. Muhammad Ali" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g. Quetta" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Login Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="school@example.com" />
              </div>
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
              <button onClick={() => setShowModal(false)} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                Cancel
              </button>
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
