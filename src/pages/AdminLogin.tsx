import { useState } from 'react';
import { Shield, Eye, EyeOff } from 'lucide-react';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'CampusCore@Admin2026';

interface Props { onSuccess: () => void; }

export default function AdminLogin({ onSuccess }: Props) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_auth', 'true');
      onSuccess();
    } else {
      setError('Invalid admin password');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Super Admin</h1>
          <p className="text-slate-500 text-sm mt-1">Campus Core Control Panel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Admin Password</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                className="w-full border border-slate-200 rounded-lg px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter admin password"
                autoFocus
              />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-3.5 text-slate-400">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>
          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Access Admin Panel
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          🔒 This panel is only for Campus Core administrators
        </p>
      </div>
    </div>
  );
}
