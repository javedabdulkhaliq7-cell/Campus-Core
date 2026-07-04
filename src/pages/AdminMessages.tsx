// src/pages/AdminMessages.tsx
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useSchool } from '../lib/schoolContext';
import { Send, MessageSquare, User, Search } from 'lucide-react';

interface Message {
  id: string;
  message: string;
  sender_id: string;
  sender_role: string;
  receiver_id: string;
  receiver_role: string;
  is_read: boolean;
  created_at: string;
  student_id: string;
}

interface Conversation {
  studentId: string;
  studentName: string;
  studentGrade: string;
  lastMessage: string;
  lastTime: string;
  unreadCount: number;
  parentId: string;
}

export default function AdminMessages() {
  const { schoolId } = useSchool();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!schoolId) return;
    initAdmin();
  }, [schoolId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function initAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setAdminId(user.id);
    await loadConversations(user.id);
  }

  async function loadConversations(currentAdminId: string) {
    setLoading(true);

    // Get all messages for this school
    const { data: msgs } = await supabase
      .from('parent_teacher_messages')
      .select('*')
      .or(`receiver_id.eq.${currentAdminId},sender_id.eq.${currentAdminId}`)
      .order('created_at', { ascending: false });

    if (!msgs || msgs.length === 0) { setLoading(false); return; }

    // Get unique student IDs
    const studentIds = [...new Set(msgs.map((m: Message) => m.student_id))];

    // Fetch student details
    const { data: students } = await supabase
      .from('students')
      .select('id, full_name, current_grade, current_section')
      .in('id', studentIds)
      .eq('school_id', schoolId);

    const studentMap = new Map((students || []).map((s: any) => [s.id, s]));

    // Build conversation list — one per student
    const convMap = new Map<string, Conversation>();
    msgs.forEach((m: Message) => {
      if (convMap.has(m.student_id)) return;
      const student = studentMap.get(m.student_id);
      const unread = msgs.filter((msg: Message) =>
        msg.student_id === m.student_id && !msg.is_read && msg.receiver_id === currentAdminId
      ).length;
      const parentId = msgs.find((msg: Message) =>
        msg.student_id === m.student_id && msg.sender_role === 'parent'
      )?.sender_id ?? '';

      convMap.set(m.student_id, {
        studentId: m.student_id,
        studentName: student?.full_name ?? 'Unknown',
        studentGrade: student ? `Class ${student.current_grade}${student.current_section ?? ''}` : '',
        lastMessage: m.message,
        lastTime: m.created_at,
        unreadCount: unread,
        parentId,
      });
    });

    setConversations(Array.from(convMap.values()));
    setLoading(false);
  }

  async function openConversation(conv: Conversation) {
    setSelectedConv(conv);
    setText('');

    const { data: msgs } = await supabase
      .from('parent_teacher_messages')
      .select('*')
      .eq('student_id', conv.studentId)
      .order('created_at', { ascending: true });

    setMessages(msgs || []);

    // Mark as read
    if (adminId) {
      const unreadIds = (msgs || [])
        .filter((m: Message) => m.receiver_id === adminId && !m.is_read)
        .map((m: Message) => m.id);
      if (unreadIds.length > 0) {
        await supabase.from('parent_teacher_messages').update({ is_read: true }).in('id', unreadIds);
        setConversations(prev => prev.map(c =>
          c.studentId === conv.studentId ? { ...c, unreadCount: 0 } : c
        ));
      }
    }
  }

  async function sendMessage() {
    if (!text.trim() || !adminId || !selectedConv || sending) return;
    setSending(true);

    const { data, error } = await supabase
      .from('parent_teacher_messages')
      .insert({
        student_id: selectedConv.studentId,
        sender_id: adminId,
        sender_role: 'admin',
        receiver_id: selectedConv.parentId,
        receiver_role: 'parent',
        message: text.trim(),
        is_read: false,
        notification_type: 'message',
      })
      .select()
      .single();

    if (!error && data) {
      setMessages(prev => [...prev, data]);
      setConversations(prev => prev.map(c =>
        c.studentId === selectedConv.studentId
          ? { ...c, lastMessage: text.trim(), lastTime: new Date().toISOString() }
          : c
      ));
      setText('');
    }
    setSending(false);
  }

  function formatTime(ts: string) {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
  }

  const filtered = conversations.filter(c =>
    c.studentName.toLowerCase().includes(search.toLowerCase()) ||
    c.studentGrade.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  return (
    <div className="flex h-[calc(100vh-120px)] bg-white rounded-2xl border border-slate-200 overflow-hidden">

      {/* Left panel — conversation list */}
      <div className="w-72 border-r border-slate-100 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800">Parent Messages</h2>
            {totalUnread > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {totalUnread}
              </span>
            )}
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by student..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No messages yet</p>
              <p className="text-xs text-slate-300 mt-1">Parent messages will appear here</p>
            </div>
          ) : (
            filtered.map(conv => (
              <button
                key={conv.studentId}
                onClick={() => openConversation(conv)}
                className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                  selectedConv?.studentId === conv.studentId ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800 truncate">{conv.studentName}</span>
                      <span className="text-xs text-slate-400 flex-shrink-0 ml-1">{formatTime(conv.lastTime)}</span>
                    </div>
                    <p className="text-xs text-slate-500">{conv.studentGrade}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{conv.lastMessage}</p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-1">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel — chat */}
      {!selectedConv ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
            <MessageSquare className="w-7 h-7 text-blue-500" />
          </div>
          <p className="font-semibold text-slate-700">Select a conversation</p>
          <p className="text-sm text-slate-400 mt-1">Choose a parent message from the left to start replying</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="px-5 py-3.5 border-b border-slate-100 bg-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Parent of {selectedConv.studentName}</p>
              <p className="text-xs text-slate-400">{selectedConv.studentGrade}</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50">
            {messages.map(m => {
              const isAdmin = m.sender_role === 'admin';
              return (
                <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] flex flex-col gap-1 ${isAdmin ? 'items-end' : 'items-start'}`}>
                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isAdmin
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
                    }`}>
                      {m.message}
                    </div>
                    <div className={`flex items-center gap-1.5 px-1 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                      <span className="text-xs text-slate-400">{formatTime(m.created_at)}</span>
                      {!isAdmin && (
                        <span className="text-xs text-slate-400 font-medium">Parent</span>
                      )}
                      {isAdmin && (
                        <span className={`text-xs ${m.is_read ? 'text-blue-500' : 'text-slate-400'}`}>
                          {m.is_read ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-5 py-3 border-t border-slate-100 bg-white">
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                placeholder={`Reply to parent of ${selectedConv.studentName}...`}
                rows={1}
                className="flex-1 resize-none border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 max-h-24"
                style={{ minHeight: '42px' }}
              />
              <button
                onClick={sendMessage}
                disabled={!text.trim() || sending}
                className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-40"
              >
                {sending
                  ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Send className="w-4 h-4" />
                }
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1.5 px-1">Enter to send · Shift+Enter for new line</p>
          </div>
        </div>
      )}
    </div>
  );
}