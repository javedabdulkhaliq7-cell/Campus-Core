import { useEffect, useState } from 'react';
import { supabase, Announcement } from '../lib/supabase';
import { useSchool } from '../lib/schoolContext';
import { Plus, Bell, X, Save, AlertCircle, Info, CheckCircle, Megaphone, Eye, EyeOff } from 'lucide-react';

const TYPE_CFG: Record<string, { color: string; icon: typeof Info }> = {
  General: { color: 'badge-blue', icon: Info },
  Urgent: { color: 'badge-red', icon: AlertCircle },
  Holiday: { color: 'badge-green', icon: CheckCircle },
  Exam: { color: 'badge-yellow', icon: Megaphone },
};

export default function Announcements() {
  const { schoolId } = useSchool();
  const [notices, setNotices] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Partial<Announcement>>({});
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    setNotices(data || []);
    setLoading(false);
  }

  useEffect(() => { if (schoolId) fetchData(); }, [schoolId]);

  async function saveNotice() {
    setSaving(true);
    if (editItem.id) {
      await supabase.from('announcements').update(editItem).eq('id', editItem.id);
    } else {
      await supabase.from('announcements').insert({
        ...editItem,
        school_id: schoolId,
        is_active: true,
        parent_visible: editItem.parent_visible ?? false,
      });
    }
    setSaving(false);
    setShowModal(false);
    setEditItem({});
    fetchData();
  }

  async function toggleActive(n: Announcement) {
    await supabase.from('announcements').update({ is_active: !n.is_active }).eq('id', n.id);
    fetchData();
  }

  async function toggleParentVisible(n: Announcement) {
    setTogglingId(n.id);
    await supabase.from('announcements').update({ parent_visible: !n.parent_visible }).eq('id', n.id);
    await fetchData();
    setTogglingId(null);
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Notices & Announcements</h2>
          <p className="text-slate-500 text-sm">Manage school-wide notices</p>
        </div>
        <button
          onClick={() => { setEditItem({ type: 'General', is_active: true, parent_visible: false }); setShowModal(true); }}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" /> New Notice
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : notices.length === 0 ? (
        <div className="card text-center py-16 text-slate-400">
          <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No notices yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map(n => {
            const cfg = TYPE_CFG[n.type] || TYPE_CFG.General;
            const Icon = cfg.icon;
            return (
              <div key={n.id} className={`card transition-all ${!n.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      n.type === 'Urgent' ? 'bg-red-100' :
                      n.type === 'Holiday' ? 'bg-emerald-100' :
                      n.type === 'Exam' ? 'bg-amber-100' : 'bg-blue-100'
                    }`}>
                      <Icon className={`w-4 h-4 ${
                        n.type === 'Urgent' ? 'text-red-600' :
                        n.type === 'Holiday' ? 'text-emerald-600' :
                        n.type === 'Exam' ? 'text-amber-600' : 'text-blue-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-800">{n.title}</h3>
                        <span className={`badge ${cfg.color}`}>{n.type}</span>
                        {!n.is_active && <span className="badge badge-gray">Inactive</span>}
                        {n.parent_visible && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                            <Eye className="w-3 h-3" /> Visible to Parents
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{n.content}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        {new Date(n.created_at).toLocaleDateString('en-PK', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Share with Parents toggle */}
                    <button
                      onClick={() => toggleParentVisible(n)}
                      disabled={togglingId === n.id}
                      title={n.parent_visible ? 'Hide from Parents' : 'Share with Parents'}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        n.parent_visible
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
                      } disabled:opacity-50`}
                    >
                      {togglingId === n.id ? (
                        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      ) : n.parent_visible ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" />
                      )}
                      {n.parent_visible ? 'Shared' : 'Share'}
                    </button>

                    {/* Edit button */}
                    <button
                      onClick={() => { setEditItem(n); setShowModal(true); }}
                      className="p-1.5 hover:bg-slate-100 rounded-lg"
                      title="Edit"
                    >
                      <Plus className="w-4 h-4 text-slate-400" />
                    </button>

                    {/* Active toggle */}
                    <button
                      onClick={() => toggleActive(n)}
                      className="p-1.5 hover:bg-slate-100 rounded-lg"
                      title={n.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {n.is_active
                        ? <X className="w-4 h-4 text-red-400" />
                        : <CheckCircle className="w-4 h-4 text-emerald-500" />
                      }
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-box animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">{editItem.id ? 'Edit Notice' : 'New Notice'}</h3>
              <button onClick={() => { setShowModal(false); setEditItem({}); }} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Title *</label>
                <input className="input" value={editItem.title || ''} onChange={e => setEditItem({ ...editItem, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={editItem.type || 'General'} onChange={e => setEditItem({ ...editItem, type: e.target.value })}>
                  {Object.keys(TYPE_CFG).map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Content *</label>
                <textarea className="input min-h-28 resize-none" value={editItem.content || ''} onChange={e => setEditItem({ ...editItem, content: e.target.value })} />
              </div>
              {/* Share with Parents toggle in modal */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="text-sm font-medium text-slate-700">Share with Parents</p>
                  <p className="text-xs text-slate-400 mt-0.5">Parents will see this notice in their portal</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditItem({ ...editItem, parent_visible: !editItem.parent_visible })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${editItem.parent_visible ? 'bg-emerald-500' : 'bg-slate-200'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editItem.parent_visible ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-100">
              <button onClick={() => { setShowModal(false); setEditItem({}); }} className="btn-secondary">Cancel</button>
              <button onClick={saveNotice} disabled={saving} className="btn-primary">
                <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Post Notice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}