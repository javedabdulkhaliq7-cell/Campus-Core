import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, X, Eye, EyeOff, Loader, Trash2, AlertTriangle,
  UserCheck, UserX, Search, RefreshCw, Edit2, GraduationCap, Shield,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────
interface ClassOption { id: string; name: string; grade: number; teacher_user_id: string | null; }

// Roles selectable today. The DB CHECK constraint already allows
// 'cook' | 'canteen' | 'librarian' for future use — add them here
// (and to ROLE_LABELS below) when those roles get their own UI.
type StaffRole = 'teacher' | 'watchman';

const ROLE_LABELS: Record<StaffRole, string> = {
  teacher: 'Teacher',
  watchman: 'Watchman',
};

interface StaffMember {
  id: string;          // school_members.id
  user_id: string;
  full_name: string;
  email: string;
  role: StaffRole;
  status: 'active' | 'inactive';
  permissions: TabPermissions;
  class_id: string | null;
  class_name: string | null;
}

interface TabPermissions {
  tabs: {
    dashboard: boolean;
    students: boolean;
    attendance: boolean;
    results: boolean;
    defaulters: boolean;
  };
  extra: {
    print_results:    boolean;
    certificates:     boolean;
    student_profiles: boolean;
    announcements:    boolean;
    reports:          boolean;
    fee_management:   boolean;
  };
}

const DEFAULT_PERMISSIONS: TabPermissions = {
  tabs: { dashboard: true, students: true, attendance: true, results: true, defaulters: true },
  extra: {
    print_results:    false,
    certificates:     false,
    student_profiles: false,
    announcements:    false,
    reports:          false,
    fee_management:   false,
  },
};

const TAB_LABELS: { key: keyof TabPermissions['tabs']; label: string; desc: string; locked?: boolean }[] = [
  { key: 'dashboard',   label: 'Dashboard',      desc: 'Class stats overview',             locked: true },
  { key: 'students',    label: 'Students',        desc: 'View class student list',          locked: false },
  { key: 'attendance',  label: 'Attendance',      desc: 'Mark & view daily attendance',     locked: false },
  { key: 'results',     label: 'Results',         desc: 'Enter & view exam results',        locked: false },
  { key: 'defaulters',  label: 'Fee Defaulters',  desc: 'View unpaid fees, notify parents', locked: false },
];

const EXTRA_LABELS: { key: keyof TabPermissions['extra']; label: string; desc: string; icon: string }[] = [
  { key: 'print_results',    label: 'Print Results',          desc: 'Print result cards & marksheets',    icon: '🖨️' },
  { key: 'certificates',     label: 'Certificates',           desc: 'Issue leaving & achievement certs',  icon: '📜' },
  { key: 'student_profiles', label: 'Student Profiles',       desc: 'Full student profile management',    icon: '👤' },
  { key: 'announcements',    label: 'Notices & Announcements',desc: 'Post & view school notices',         icon: '📢' },
  { key: 'reports',          label: 'Reports',                desc: 'View school reports & analytics',    icon: '📊' },
  { key: 'fee_management',   label: 'Fee Management',         desc: 'View & manage fee records',          icon: '💰' },
];

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY      = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ── Main Component ───────────────────────────────────────────────
export default function Staff() {
  const [schoolId, setSchoolId]       = useState<string | null>(null);
  const [staff, setStaff]             = useState<StaffMember[]>([]);
  const [classes, setClasses]         = useState<ClassOption[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');

  // Modal state
  const [showModal, setShowModal]     = useState(false);
  const [editTarget, setEditTarget]   = useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [permTarget, setPermTarget]   = useState<StaffMember | null>(null);
  const [permEdit, setPermEdit]       = useState<TabPermissions>(DEFAULT_PERMISSIONS);
  const [permSaving, setPermSaving]   = useState(false);

  // Form state
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', role: 'teacher' as StaffRole,
    class_id: '', status: 'active' as 'active' | 'inactive',
  });
  const [permissions, setPermissions] = useState<TabPermissions>(DEFAULT_PERMISSIONS);
  const [showPass, setShowPass]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [message, setMessage]         = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const isCreatingRef                 = useRef(false);

  useEffect(() => { fetchSchoolId(); }, []);
  useEffect(() => { if (schoolId) { fetchStaff(); fetchClasses(); } }, [schoolId]);

  // ── Fetch school ID ─────────────────────────────────────────
  async function fetchSchoolId() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('school_members')
      .select('school_id')
      .eq('user_id', user.id)
      .single();
    if (data) setSchoolId(data.school_id);
  }

  // ── Fetch staff (teachers + watchmen) ───────────────────────
  async function fetchStaff() {
    if (!schoolId) return;
    setLoading(true);
    try {
      const { data: members } = await supabase
        .from('school_members')
        .select('id, user_id, full_name, role, status, permissions')
        .eq('school_id', schoolId)
        .in('role', ['teacher', 'watchman']);

      if (!members?.length) { setStaff([]); setLoading(false); return; }

      // Get emails from auth — we store them in school_members or fetch from classes
      const { data: classData } = await supabase
        .from('classes')
        .select('id, name, teacher_user_id')
        .eq('school_id', schoolId);

      const classMap = Object.fromEntries((classData || []).map(c => [c.teacher_user_id, c]));

      const enriched: StaffMember[] = members.map(m => {
        const assignedClass = classMap[m.user_id];
        return {
          id:          m.id,
          user_id:     m.user_id,
          full_name:   m.full_name || 'Unknown',
          email:       '',
          role:        (m.role as StaffRole) || 'teacher',
          status:      (m.status as 'active' | 'inactive') || 'active',
          permissions: m.permissions || DEFAULT_PERMISSIONS,
          class_id:    assignedClass?.id || null,
          class_name:  assignedClass?.name || null,
        };
      });

      setStaff(enriched);
    } finally {
      setLoading(false);
    }
  }

  // ── Fetch classes ───────────────────────────────────────────
  async function fetchClasses() {
    if (!schoolId) return;
    const { data, error } = await supabase
      .from('classes')
      .select('id, name, grade, teacher_user_id')
      .eq('school_id', schoolId)
      .order('grade', { ascending: true });
    if (error) console.error('fetchClasses error:', error.message);
    setClasses(data || []);
  }

  // ── Open Add Modal ──────────────────────────────────────────
  function openAddModal() {
    setEditTarget(null);
    setForm({ full_name: '', email: '', password: '', role: 'teacher', class_id: '', status: 'active' });
    setPermissions(DEFAULT_PERMISSIONS);
    setShowPass(false);
    setShowModal(true);
  }

  // ── Open Edit Modal ─────────────────────────────────────────
  function openEditModal(member: StaffMember) {
    setEditTarget(member);
    setForm({
      full_name: member.full_name,
      email:     member.email,
      password:  '',
      role:      member.role,
      class_id:  member.class_id || '',
      status:    member.status,
    });
    setPermissions({
      tabs:  { ...DEFAULT_PERMISSIONS.tabs,  ...(member.permissions?.tabs  || {}) },
      extra: { ...DEFAULT_PERMISSIONS.extra, ...(member.permissions?.extra || {}) },
    });
    setShowPass(false);
    setShowModal(true);
  }

  // ── Toggle permission ───────────────────────────────────────
  function togglePerm(key: keyof TabPermissions['tabs']) {
    if (key === 'dashboard') return; // always ON
    setPermissions(prev => ({
      ...prev,
      tabs: { ...prev.tabs, [key]: !prev.tabs[key] },
    }));
  }

  function toggleExtra(key: keyof TabPermissions['extra']) {
    setPermissions(prev => ({
      ...prev,
      extra: { ...(prev.extra || DEFAULT_PERMISSIONS.extra), [key]: !prev.extra?.[key] },
    }));
  }

  // ── Create Staff Member ──────────────────────────────────────
  async function createStaffMember() {
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    setSaving(true);
    setMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Call edge function to create auth user.
      // NOTE: the `create-teacher` edge function needs a small update server-side
      // to read `role` from this body and write it to school_members.role
      // (instead of hardcoding 'teacher'), and to skip class_id/permissions
      // handling when role !== 'teacher'.
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-teacher`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': ANON_KEY,
        },
        body: JSON.stringify({
          email:       form.email,
          password:    form.password,
          full_name:   form.full_name,
          school_id:   schoolId,
          role:        form.role,
          class_id:    form.role === 'teacher' ? (form.class_id || null) : null,
          status:      form.status,
          permissions: form.role === 'teacher' ? permissions : null,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to create staff member');

      setMessage({ type: 'success', text: `✅ ${ROLE_LABELS[form.role]} "${form.full_name}" created successfully.` });
      setShowModal(false);
      fetchStaff();
      fetchClasses();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: '❌ ' + (err instanceof Error ? err.message : 'Failed to create staff member') });
    } finally {
      setSaving(false);
      isCreatingRef.current = false;
    }
  }

  // ── Update Staff Member ──────────────────────────────────────
  async function updateStaffMember() {
    if (!editTarget) return;
    setSaving(true);
    setMessage(null);
    try {
      // Update school_members
      await supabase
        .from('school_members')
        .update({
          full_name:   form.full_name,
          role:        form.role,
          status:      form.status,
          // permissions is NOT NULL in this schema — {} for non-teacher roles, not null.
          permissions: form.role === 'teacher' ? permissions : {},
        })
        .eq('id', editTarget.id);

      // Update class assignment (teacher-only concept)
      if (editTarget.class_id && (form.role !== 'teacher' || editTarget.class_id !== form.class_id)) {
        await supabase
          .from('classes')
          .update({ teacher_user_id: null })
          .eq('id', editTarget.class_id);
      }
      if (form.role === 'teacher' && form.class_id) {
        await supabase
          .from('classes')
          .update({ teacher_user_id: editTarget.user_id })
          .eq('id', form.class_id);
      }

      // Reset password if provided
      if (form.password) {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch(`${SUPABASE_URL}/functions/v1/reset-teacher-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': ANON_KEY,
          },
          body: JSON.stringify({ user_id: editTarget.user_id, password: form.password }),
        });
      }

      setMessage({ type: 'success', text: `✅ "${form.full_name}" updated successfully.` });
      setShowModal(false);
      fetchStaff();
      fetchClasses();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: '❌ ' + (err instanceof Error ? err.message : 'Update failed') });
    } finally {
      setSaving(false);
    }
  }

  // ── Delete Staff Member ──────────────────────────────────────
  async function deleteStaffMember() {
    if (!deleteTarget) return;
    setDeleting(true);
    setMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Unassign from class first
      if (deleteTarget.class_id) {
        await supabase.from('classes').update({ teacher_id: null }).eq('id', deleteTarget.class_id);
      }

      // Delete school_members row
      await supabase.from('school_members').delete().eq('id', deleteTarget.id);

      // Delete auth user via edge function
      await fetch(`${SUPABASE_URL}/functions/v1/delete-teacher`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': ANON_KEY,
        },
        body: JSON.stringify({ user_id: deleteTarget.user_id }),
      });

      setMessage({ type: 'success', text: `✅ "${deleteTarget.full_name}" has been removed.` });
      setDeleteTarget(null);
      fetchStaff();
      fetchClasses();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: '❌ ' + (err instanceof Error ? err.message : 'Delete failed') });
    } finally {
      setDeleting(false);
    }
  }

  // ── Filtered staff ───────────────────────────────────────────
  const filtered = staff.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase())
  );

  // Available classes:
  // - All unassigned classes
  // - The class currently assigned to THIS teacher (so it stays selected in edit)
  // - If adding new teacher: show all unassigned classes
  function availableClasses(currentUserID?: string) {
    return classes.filter(c =>
      !c.teacher_user_id || (currentUserID && c.teacher_user_id === currentUserID)
    );
  }

  const enabledTabCount = (p: TabPermissions) =>
    Object.values(p.tabs).filter(Boolean).length;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Staff Management</h2>
          <p className="text-slate-500 text-sm">{staff.length} staff member{staff.length !== 1 ? 's' : ''} registered</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { fetchStaff(); fetchClasses(); }} className="btn-secondary">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Staff
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search staff..."
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-2" /> Loading staff...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-14">
          <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-600">No staff yet</p>
          <p className="text-sm text-slate-400 mt-1">Click "Add Staff" to get started.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase hidden sm:table-cell">Assigned Class</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Tabs</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                        {m.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{m.full_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      m.role === 'watchman'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {m.role === 'watchman' ? <Shield className="w-3 h-3" /> : <GraduationCap className="w-3 h-3" />}
                      {ROLE_LABELS[m.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {m.role !== 'teacher' ? (
                      <span className="text-slate-400 text-xs">—</span>
                    ) : m.class_name ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                        <GraduationCap className="w-3 h-3" /> {m.class_name}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">Not assigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {m.role === 'teacher' ? (
                      <div className="space-y-0.5">
                        <span className="text-xs text-slate-600 font-medium block">
                          {enabledTabCount(m.permissions)}/5 tabs
                        </span>
                        {Object.values(m.permissions?.extra || {}).some(Boolean) && (
                          <span className="text-xs text-emerald-600 font-medium block">
                            +{Object.values(m.permissions?.extra || {}).filter(Boolean).length} extra
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      m.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {m.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      {m.role === 'teacher' && (
                        <button
                          onClick={() => {
                            setPermTarget(m);
                            setPermEdit({
                              tabs:  { ...DEFAULT_PERMISSIONS.tabs,  ...(m.permissions?.tabs  || {}) },
                              extra: { ...DEFAULT_PERMISSIONS.extra, ...(m.permissions?.extra || {}) },
                            });
                          }}
                          className="p-1.5 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors"
                          title="Manage Access"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(m)}
                        className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(m)}
                        className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}


      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
              <h3 className="font-bold text-slate-800 text-lg">
                {editTarget ? 'Edit Staff' : 'Add New Staff'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name *</label>
                <input
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="e.g. Muhammad Ali Khan"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Role *</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as StaffRole }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {/* Add cook / canteen / librarian options here once those roles get their own portal */}
                  <option value="teacher">Teacher</option>
                  <option value="watchman">Watchman</option>
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  {form.role === 'watchman'
                    ? 'Watchman gets a minimal portal: Scan QR, Scan Face, Today\'s Attendance.'
                    : 'Teacher gets access to their assigned class and the tabs selected below.'}
                </p>
              </div>

              {/* Email — only for new staff */}
              {!editTarget && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="teacher@school.com"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {editTarget ? 'New Password (leave blank to keep)' : 'Password *'}
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder={editTarget ? 'Leave blank to keep current' : 'Min 8 characters'}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Assign Class — teacher only */}
              {form.role === 'teacher' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Assign to Class</label>
                  <select
                    value={form.class_id}
                    onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— No class assigned —</option>
                    {availableClasses(editTarget?.user_id).map(c => (
                      <option key={c.id} value={c.id}>{c.name} — Grade {c.grade}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">Only unassigned classes are shown.</p>
                </div>
              )}

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
                <div className="flex gap-2">
                  {(['active', 'inactive'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setForm(f => ({ ...f, status: s }))}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                        form.status === s
                          ? s === 'active'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-slate-400 bg-slate-50 text-slate-600'
                          : 'border-slate-200 text-slate-400'
                      }`}
                    >
                      {s === 'active'
                        ? <><UserCheck className="w-4 h-4" /> Active</>
                        : <><UserX className="w-4 h-4" /> Inactive</>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Permissions — teacher only */}
              {form.role === 'teacher' ? (
                <div className="space-y-4">
                  {/* Teacher Portal Tabs */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Teacher Portal Tabs</label>
                    <p className="text-xs text-slate-400 mb-2">Which tabs appear in the teacher's sidebar</p>
                    <div className="space-y-2">
                      {TAB_LABELS.map(({ key, label, desc, locked }) => (
                        <div key={key}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                            permissions.tabs[key] ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-slate-50'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-700">{label}</span>
                              {locked && <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Always ON</span>}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                          </div>
                          <button onClick={() => togglePerm(key)} disabled={locked}
                            className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ml-3 ${permissions.tabs[key] ? 'bg-blue-500' : 'bg-slate-300'} disabled:opacity-60`}>
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${permissions.tabs[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Extra Admin Features */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Extra Admin Features</label>
                    <p className="text-xs text-slate-400 mb-2">Grant access to additional school features</p>
                    <div className="space-y-2">
                      {EXTRA_LABELS.map(({ key, label, desc, icon }) => (
                        <div key={key}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                            permissions.extra?.[key] ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-slate-50'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base">{icon}</span>
                              <span className="text-sm font-medium text-slate-700">{label}</span>
                              {permissions.extra?.[key] && (
                                <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">ON</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 ml-6">{desc}</p>
                          </div>
                          <button onClick={() => toggleExtra(key)}
                            className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ml-3 ${permissions.extra?.[key] ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${permissions.extra?.[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-amber-100 bg-amber-50 text-xs text-amber-700">
                  Watchmen get a fixed portal (Scan QR, Scan Face, Today's Attendance) — there's nothing to configure here.
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={editTarget ? updateStaffMember : createStaffMember}
                disabled={saving || !form.full_name || (!editTarget && (!form.email || !form.password))}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
              >
                {saving
                  ? <><Loader className="w-4 h-4 animate-spin" /> Saving...</>
                  : editTarget ? 'Save Changes' : 'Create Staff'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center gap-3 p-6 border-b border-red-100 bg-red-50 rounded-t-2xl">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-red-800">Remove Staff Member</h3>
                <p className="text-red-500 text-xs mt-0.5">This will remove their access permanently</p>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600">
                Are you sure you want to remove <strong className="text-slate-800">{deleteTarget.full_name}</strong>?
                They will lose access immediately.
                {deleteTarget.class_name && (
                  <span className="block mt-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs">
                    ⚠️ {deleteTarget.class_name} will have no assigned teacher.
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={deleteStaffMember}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
              >
                {deleting
                  ? <><Loader className="w-4 h-4 animate-spin" /> Removing...</>
                  : <><Trash2 className="w-4 h-4" /> Remove Staff</>}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Quick Permissions Modal ── */}
      {permTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h3 className="font-bold text-slate-800">Manage Access</h3>
                <p className="text-xs text-slate-400 mt-0.5">{permTarget.full_name}</p>
              </div>
              <button onClick={() => setPermTarget(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Teacher Portal Tabs */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Teacher Portal Tabs</p>
                <div className="space-y-2">
                  {TAB_LABELS.map(({ key, label, desc, locked }) => (
                    <div key={key}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        permEdit.tabs[key] ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-700">{label}</span>
                          {locked && <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Always ON</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                      </div>
                      <button
                        onClick={() => {
                          if (locked) return;
                          setPermEdit(prev => ({ ...prev, tabs: { ...prev.tabs, [key]: !prev.tabs[key] } }));
                        }}
                        disabled={locked}
                        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ml-3 ${permEdit.tabs[key] ? 'bg-blue-500' : 'bg-slate-300'} disabled:opacity-60`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${permEdit.tabs[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Extra Admin Features */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Extra Admin Features</p>
                <div className="space-y-2">
                  {EXTRA_LABELS.map(({ key, label, desc, icon }) => (
                    <div key={key}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        permEdit.extra?.[key] ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span>{icon}</span>
                          <span className="text-sm font-medium text-slate-700">{label}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 ml-5">{desc}</p>
                      </div>
                      <button
                        onClick={() => setPermEdit(prev => ({
                          ...prev,
                          extra: { ...(prev.extra || DEFAULT_PERMISSIONS.extra), [key]: !prev.extra?.[key] }
                        }))}
                        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ml-3 ${permEdit.extra?.[key] ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${permEdit.extra?.[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setPermTarget(null)}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-sm">
                Cancel
              </button>
              <button
                onClick={async () => {
                  setPermSaving(true);
                  await supabase
                    .from('school_members')
                    .update({ permissions: permEdit })
                    .eq('id', permTarget.id);
                  setPermSaving(false);
                  setPermTarget(null);
                  setMessage({ type: 'success', text: `✅ Access updated for ${permTarget.full_name}` });
                  fetchStaff();
                }}
                disabled={permSaving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
              >
                {permSaving
                  ? <><Loader className="w-4 h-4 animate-spin" /> Saving...</>
                  : <><UserCheck className="w-4 h-4" /> Save Access</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}