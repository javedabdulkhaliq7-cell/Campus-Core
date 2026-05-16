import { useState } from 'react';
import { supabase, APP_NAME } from '../lib/supabase';
import { School, AlertCircle, Loader } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
      } else if (data.session) {
        onLoginSuccess();
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <School className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-white">{APP_NAME}</h1>
          <p className="text-blue-100 text-sm mt-1">School Management Platform</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Sign In</h2>
            <p className="text-slate-500 text-sm mt-1">Access your school dashboard</p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="label">Email Address</label>
              <input
                className="input"
                type="email"
                placeholder="you@school.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                onKeyPress={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full btn-primary justify-center py-2.5 disabled:opacity-50"
          >
            {loading ? (
              <><Loader className="w-4 h-4 animate-spin" /> Signing In...</>
            ) : 'Sign In'}
          </button>

          <p className="text-xs text-slate-400 text-center">
            Contact your administrator for school access credentials
          </p>
        </div>
      </div>
    </div>
  );
}
