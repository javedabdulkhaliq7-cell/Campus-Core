// src/pages/ParentNoticesTab.tsx
import { useEffect, useState } from 'react';
import { parentSupabase } from '../lib/parentSupabaseClient';
import { Bell, AlertCircle, Info, CheckCircle, Megaphone } from 'lucide-react';

interface Notice {
  id: string;
  title: string;
  content: string;
  type: string;
  created_at: string;
}

interface Props {
  schoolId: string;
}

const TYPE_CFG: Record<string, { bg: string; iconColor: string; badge: string; icon: typeof Info }> = {
  General: { bg: 'bg-blue-100',    iconColor: 'text-blue-600',    badge: 'bg-blue-50 text-blue-700 border-blue-200',       icon: Info },
  Urgent:  { bg: 'bg-red-100',     iconColor: 'text-red-600',     badge: 'bg-red-50 text-red-700 border-red-200',           icon: AlertCircle },
  Holiday: { bg: 'bg-emerald-100', iconColor: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
  Exam:    { bg: 'bg-amber-100',   iconColor: 'text-amber-600',   badge: 'bg-amber-50 text-amber-700 border-amber-200',     icon: Megaphone },
};

function getCfg(type: string) {
  return TYPE_CFG[type] ?? TYPE_CFG.General;
}

export default function ParentNoticesTab({ schoolId }: Props) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    loadData();
  }, [schoolId]);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await parentSupabase.auth.getUser();
    const parentId = user?.id;

    const [noticesRes, readsRes] = await Promise.all([
      parentSupabase
        .from('announcements')
        .select('id, title, content, type, created_at')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .eq('parent_visible', true)
        .order('created_at', { ascending: false }),
      parentId
        ? parentSupabase
            .from('parent_notice_reads')
            .select('notice_id')
            .eq('parent_id', parentId)
        : Promise.resolve({ data: [] }),
    ]);

    setNotices(noticesRes.data || []);
    setReadIds(new Set((readsRes.data || []).map((r: any) => r.notice_id)));
    setLoading(false);
  }

  async function markRead(noticeId: string) {
    const { data: { user } } = await parentSupabase.auth.getUser();
    if (!user) return;
    if (readIds.has(noticeId)) return;
    await parentSupabase.from('parent_notice_reads').upsert({
      parent_id: user.id,
      notice_id: noticeId,
      read_at: new Date().toISOString(),
    }, { onConflict: 'parent_id,notice_id' });
    setReadIds(prev => new Set([...prev, noticeId]));
  }

  function toggleExpand(id: string) {
    const isOpening = expanded !== id;
    setExpanded(isOpening ? id : null);
    if (isOpening) markRead(id);
  }

  const unreadCount = notices.filter(n => !readIds.has(n.id)).length;

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  );

  if (notices.length === 0) return (
    <div className="flex flex-col items-center justify-center py-14 px-4 text-center gap-3">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
        <Bell className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-slate-600 font-medium text-sm">No notices yet</p>
      <p className="text-slate-400 text-xs max-w-xs">The school will post notices here when available.</p>
    </div>
  );

  return (
    <div className="space-y-3 p-4">
      {/* Header with unread badge */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          {notices.length} Notice{notices.length !== 1 ? 's' : ''}
        </p>
        {unreadCount > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500 text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            {unreadCount} Unread
          </span>
        )}
        {unreadCount === 0 && notices.length > 0 && (
          <span className="text-xs text-emerald-600 font-medium">All caught up ✓</span>
        )}
      </div>

      {notices.map(n => {
        const cfg = getCfg(n.type);
        const Icon = cfg.icon;
        const isOpen = expanded === n.id;
        const isRead = readIds.has(n.id);
        const isUrgent = n.type === 'Urgent';

        return (
          <button
            key={n.id}
            onClick={() => toggleExpand(n.id)}
            className={`w-full text-left bg-white border rounded-xl overflow-hidden transition-all shadow-sm ${
              isUrgent ? 'border-red-200' : isRead ? 'border-slate-100' : 'border-blue-200'
            }`}
          >
            {/* Urgent top strip */}
            {isUrgent && <div className="h-1 bg-red-500 w-full" />}

            <div className="px-4 py-3 flex items-start gap-3">
              {/* Icon */}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`font-semibold text-sm ${isRead ? 'text-slate-700' : 'text-slate-900'}`}>
                    {n.title}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.badge}`}>
                    {n.type}
                  </span>
                  {!isRead && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                </div>
                {isOpen ? (
                  <p className="text-sm text-slate-600 leading-relaxed mt-1">{n.content}</p>
                ) : (
                  <p className="text-sm text-slate-500 truncate">{n.content}</p>
                )}
                <p className="text-xs text-slate-400 mt-2">
                  {new Date(n.created_at).toLocaleDateString('en-PK', {
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                  })}
                  {isRead && <span className="ml-2 text-emerald-500">· Seen</span>}
                </p>
              </div>

              <span className="text-slate-400 text-xs flex-shrink-0 mt-1">{isOpen ? '▲' : '▼'}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}