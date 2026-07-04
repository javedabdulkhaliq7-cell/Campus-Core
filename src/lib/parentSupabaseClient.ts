// src/lib/parentSupabaseClient.ts
//
// A SEPARATE Supabase client just for the parent portal, so its session
// never collides with the admin/staff session your app already manages.
//
// Storage behavior implements "Remember Me":
//   - checked   -> session persists across browser restarts (localStorage)
//   - unchecked -> session disappears when the browser/tab closes (sessionStorage)
//
// How: a tiny preference flag (not the session itself) lives in
// localStorage and tells getItem/setItem/removeItem which real storage
// to read and write. Call setRememberMe(...) BEFORE auth.setSession(...)
// so the session lands in the right place the first time.

import { createClient } from "@supabase/supabase-js";

const REMEMBER_FLAG_KEY = "parent_remember_me";
const SESSION_STORAGE_KEY = "parent-portal-auth";

function activeStorage(): Storage {
  return localStorage.getItem(REMEMBER_FLAG_KEY) === "false" ? sessionStorage : localStorage;
}

const parentAuthStorage = {
  getItem: (key: string) => activeStorage().getItem(key),
  setItem: (key: string, value: string) => activeStorage().setItem(key, value),
  removeItem: (key: string) => activeStorage().removeItem(key),
};

export function setRememberMe(remember: boolean) {
  localStorage.setItem(REMEMBER_FLAG_KEY, remember ? "true" : "false");
  // Clear any stale session sitting in the OTHER storage from a past choice.
  (remember ? sessionStorage : localStorage).removeItem(SESSION_STORAGE_KEY);
}

export function clearParentSession() {
  activeStorage().removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(REMEMBER_FLAG_KEY);
}

// Adjust these two env var names to whatever your build tool uses
// (Vite: import.meta.env.VITE_*, CRA/Next: process.env.NEXT_PUBLIC_*, etc.)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const parentSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: parentAuthStorage,
    storageKey: SESSION_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
  },
});
