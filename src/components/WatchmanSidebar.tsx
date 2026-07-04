import {
  QrCode, Smile, ClipboardList, Settings, Lock,
  School,
} from 'lucide-react';

// Mirrors components/Sidebar.tsx (the admin sidebar) — same shell, mobile
// slide-in behavior, and `sidebar-link` / `active` classes — just with the
// watchman's three destinations instead of the full admin nav. Verify Pickup
// is intentionally not listed (out of scope per current build instructions).

export type WatchmanMode = 'qr' | 'face' | 'attendance';

interface WatchmanSidebarProps {
  currentMode: WatchmanMode;
  onNavigate: (mode: WatchmanMode) => void;
  isOpen: boolean;
  schoolName: string;
  schoolLogo?: string | null;
  watchmanEmail?: string;
}

const navItems = [
  { id: 'qr', label: 'Scan QR', icon: QrCode },
  { id: 'face', label: 'Scan Face', icon: Smile },
  { id: 'attendance', label: "Today's Attendance", icon: ClipboardList },
] as const;

export default function WatchmanSidebar({
  currentMode, onNavigate, isOpen, schoolName, schoolLogo, watchmanEmail,
}: WatchmanSidebarProps) {
  const initial = (watchmanEmail?.charAt(0) || 'W').toUpperCase();

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" />}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-100 z-30 flex flex-col transition-transform duration-300 shadow-xl lg:shadow-none lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md overflow-hidden bg-white">
              {schoolLogo ? (
                <img src={schoolLogo} alt="School Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
                  <School className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-sm leading-tight">{schoolName}</h1>
              <p className="text-xs text-slate-400 leading-tight">Watchman Panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-thin">
          <p className="px-4 pt-3 pb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-widest">Main Menu</p>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => onNavigate(id)}
              className={`sidebar-link w-full ${currentMode === id ? 'active' : 'text-slate-600'}`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">{label}</span>
            </button>
          ))}

          <p className="px-4 pt-5 pb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-widest">System</p>
          <div
            title="Only school admins can change settings"
            className="sidebar-link w-full text-slate-300 cursor-not-allowed select-none"
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">Settings</span>
            <Lock className="w-3.5 h-3.5 flex-shrink-0" />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-blue-50">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{watchmanEmail?.split('@')[0] || 'Watchman'}</p>
              <p className="text-xs text-slate-400">Watchman</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
