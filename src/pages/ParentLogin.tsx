// src/pages/ParentLogin.tsx
//
// Adjust SUPABASE_FUNCTIONS_URL / school name to your project before use.

import { useState, FormEvent } from "react";
import { Phone, KeyRound, Loader2 } from "lucide-react";
import { parentSupabase, setRememberMe } from "../lib/parentSupabaseClient";

const SUPABASE_FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parent-login`;

export default function ParentLogin({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCodeChange(value: string) {
    setCode(value.replace(/\D/g, "").slice(0, 6));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(SUPABASE_FUNCTIONS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Login failed.");

      // Choose storage BEFORE writing the session, so it lands in the right place.
      setRememberMe(remember);

      const { error: sessionErr } = await parentSupabase.auth.setSession(data.session);
      if (sessionErr) throw sessionErr;

      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <h1 className="text-xl font-bold text-slate-800 text-center mb-1">Parent Login</h1>
        <p className="text-sm text-slate-500 text-center mb-6">Community School</p>

        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm font-medium bg-red-50 text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Father's Phone Number
            </label>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 focus-within:border-blue-400">
              <Phone className="w-4 h-4 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0300-1234567"
                className="flex-1 outline-none text-sm text-slate-800 bg-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Access Code
            </label>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 focus-within:border-blue-400">
              <KeyRound className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="482915"
                className="flex-1 outline-none text-sm text-slate-800 bg-transparent tracking-widest font-mono"
                required
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">Given to you by the school office.</p>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="rounded border-slate-300"
            />
            Remember me on this device
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 text-white text-sm font-medium py-2.5 hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Logging in…
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}