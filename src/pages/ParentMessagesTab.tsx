// src/pages/ParentMessagesTab.tsx
import { useEffect, useState, useRef } from 'react';
import { parentSupabase } from '../lib/parentSupabaseClient';
import { Send, MessageSquare } from 'lucide-react';

interface Message {
  id: string;
  message: string;
  sender_id: string;
  sender_role: string;
  receiver_id: string;
  receiver_role: string;
  is_read: boolean;
  created_at: string;
}

interface Props {
  studentId: string;
  studentName: string;
  schoolId: string;
}

export default function ParentMessagesTab({ studentId, studentName, schoolId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!studentId || !schoolId) return;
    init();
  }, [studentId, schoolId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function init() {
    setLoading(true);

    // Get current parent auth user
    const { data: { user } } = await parentSupabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setParentId(user.id);

    // Get school admin user_id
    const { data: adminData } = await parentSupabase
      .from('school_members')
      .select('user_id')
      .eq('school_id', schoolId)
      .eq('role', 'admin')
      .maybeSingle();
    const adminId = adminData?.user_id ?? null;
    setAdminUserId(adminId);

    // Load messages for this student
    const { data: msgs, error } = await parentSupabase
      .from('parent_teacher_messages')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: true });

    if (error) console.error('Messages fetch error:', error);
    setMessages(msgs || []);

    // Mark unread messages from school as read
    if (user.id && msgs && msgs.length > 0) {
      const unreadIds = msgs
        .filter(m => m.receiver_id === user.id && !m.is_read)
        .map(m => m.id);
      if (unreadIds.length > 0) {
        await parentSupabase
          .from('parent_teacher_messages')
          .update({ is_read: true })
          .in('id', unreadIds);
      }
    }

    setLoading(false);
  }

  async function sendMessage() {
    if (!text.trim() || !parentId || !adminUserId || sending) return;
    setSending(true);

    const { data, error } = await parentSupabase
      .from('parent_teacher_messages')
      .insert({
        student_id: studentId,
        sender_id: parentId,
        sender_role: 'parent',
        receiver_id: adminUserId,
        receiver_role: 'admin',
        message: text.trim(),
        is_read: false,
        notification_type: 'message',
      })
      .select()
      .single();

    if (error) {
      console.error('Send error:', error);
    } else if (data) {
      setMessages(prev => [...prev, data]);
      setText('');
    }
    setSending(false);
  }

  function formatTime(ts: string) {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }) +
      ' ' + d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  }

  // Group messages by date
  function groupByDate(msgs: Message[]) {
    const groups: { date: string; msgs: Message[] }[] = [];
    let lastDate = '';
    msgs.forEach(m => {
      const d = new Date(m.created_at);
      const dateStr = d.toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' });
      if (dateStr !== lastDate) {
        groups.push({ date: dateStr, msgs: [] });
        lastDate = dateStr;
      }
      groups[groups.length - 1].msgs.push(m);
    });
    return groups;
  }

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  );

  const groups = groupByDate(messages);

  return (
    <div className="flex flex-col" style={{ height: '520px' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3 flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">School Administration</p>
          <p className="text-xs text-slate-400">Re: {studentName}</p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium text-sm">No messages yet</p>
            <p className="text-slate-400 text-xs max-w-xs">
              Send a message to the school administration below.
            </p>
          </div>
        )}

        {groups.map(group => (
          <div key={group.date}>
            {/* Date separator */}
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{group.date}</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <div className="space-y-2">
              {group.msgs.map(m => {
                const isParent = m.sender_role === 'parent';
                return (
                  <div key={m.id} className={`flex ${isParent ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] ${isParent ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isParent
                          ? 'bg-emerald-600 text-white rounded-br-sm'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
                      }`}>
                        {m.message}
                      </div>
                      <div className={`flex items-center gap-1.5 px-1 ${isParent ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="text-xs text-slate-400">{formatTime(m.created_at)}</span>
                        {isParent && (
                          <span className={`text-xs ${m.is_read ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {m.is_read ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-slate-100 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 max-h-24 overflow-y-auto"
            style={{ minHeight: '42px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!text.trim() || sending || !adminUserId}
            className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending
              ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5 px-1">Press Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
