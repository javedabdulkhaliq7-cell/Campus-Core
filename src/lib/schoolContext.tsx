import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import type { Subscription } from './supabase';

// ── Types ────────────────────────────────────────────────────────

interface School {
  id: string;
  name: string;
}

interface SchoolSettings {
  id: string;
  school_id: string;
  school_name: string;
  principal_name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  registration_number: string;
  established_year?: number | null;
  logo_url?: string | null;
  weekly_off_days: number[];
  updated_at?: string;
}

interface SchoolContextType {
  // School
  school: School | null;
  settings: SchoolSettings | null;
  schoolId: string | null;
  schoolName: string;
  schoolLogo: string | null;
  loading: boolean;
  // Subscription
  subscription: Subscription | null;
  subscriptionLoading: boolean;
  isSubscriptionActive: boolean;
  isOnTrial: boolean;
  trialDaysLeft: number;
  // Actions
  updateSettings: (updates: Partial<SchoolSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

// ── Context ──────────────────────────────────────────────────────

const SchoolContext = createContext<SchoolContextType | null>(null);

// ── Provider ─────────────────────────────────────────────────────

export function SchoolProvider({ children }: { children: React.ReactNode }) {
  const [school, setSchool] = useState<School | null>(null);
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  // ── Fetch school + settings ──────────────────────────────────
  const fetchSchoolData = useCallback(async (retryCount = 0) => {
    if (retryCount === 0) setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Use maybeSingle() instead of single() — single() throws a 406
      // when there are 0 rows, which happens right after registration
      // before the school_members row has replicated.
      const { data: member } = await supabase
        .from('school_members')
        .select('school_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!member) {
        if (retryCount < 6) {
          setTimeout(() => fetchSchoolData(retryCount + 1), 1000);
        } else {
          setLoading(false);
        }
        return;
      }

      const [{ data: schoolData }, { data: settingsData }] = await Promise.all([
        supabase.from('schools').select('id, name').eq('id', member.school_id).maybeSingle(),
        supabase.from('school_settings').select('*').eq('school_id', member.school_id).maybeSingle(),
      ]);

      if (schoolData) setSchool(schoolData);
      if (settingsData) setSettings(settingsData);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching school data:', err);
      setLoading(false);
    }
  }, []);

  // ── Fetch subscription ───────────────────────────────────────
  // IMPORTANT: subscriptionLoading stays TRUE across retries so the UI
  // never flashes a "no subscription" error while we're still trying.
  // It only goes to FALSE once we have a definitive answer (found, or
  // genuinely exhausted all retries).
  const fetchSubscription = useCallback(async (retryCount = 0) => {
    if (retryCount === 0) setSubscriptionLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSubscriptionLoading(false); return; }

      const { data: member } = await supabase
        .from('school_members')
        .select('school_id')
        .eq('user_id', user.id)
        .maybeSingle();

      // If member not found yet (just registered, replication delay),
      // retry up to 6 times with increasing delay — keep loading=true.
      if (!member) {
        if (retryCount < 6) {
          setTimeout(() => fetchSubscription(retryCount + 1), 1000);
        } else {
          setSubscriptionLoading(false); // genuinely give up after ~6s
        }
        return;
      }

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('school_id', member.school_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Subscription row not created yet either — retry same as above
      if (!sub) {
        if (retryCount < 6) {
          setTimeout(() => fetchSubscription(retryCount + 1), 1000);
        } else {
          setSubscriptionLoading(false);
        }
        return;
      }

      setSubscription(sub);
      setSubscriptionLoading(false);
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setSubscriptionLoading(false);
    }
  }, []);

  // ── Auth state listener ──────────────────────────────────────
  useEffect(() => {
    fetchSchoolData();
    fetchSubscription();

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        fetchSchoolData();
        fetchSubscription();
      }
      if (event === 'SIGNED_OUT') {
        setSchool(null);
        setSettings(null);
        setSubscription(null);
      }
    });

    return () => authSub.unsubscribe();
  }, [fetchSchoolData, fetchSubscription]);

  // ── Update settings ──────────────────────────────────────────
  const updateSettings = async (updates: Partial<SchoolSettings>) => {
    if (!settings?.id) return;
    const { data } = await supabase
      .from('school_settings')
      .update(updates)
      .eq('id', settings.id)
      .select()
      .single();
    if (data) setSettings(data);
  };

  // ── Computed subscription state ──────────────────────────────
  const now = new Date();

  const isOnTrial =
    !!subscription?.trial_ends_at &&
    new Date(subscription.trial_ends_at) > now &&
    (subscription.status === 'trial' || subscription.status === 'pending_payment');

  const isSubscriptionActive =
    subscription?.status === 'active' || isOnTrial;

  const trialDaysLeft = subscription?.trial_ends_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.trial_ends_at).getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : 0;

  return (
    <SchoolContext.Provider
      value={{
        school,
        settings,
        schoolId: school?.id ?? null,
        schoolName: settings?.school_name ?? school?.name ?? 'Campus Core',
        schoolLogo: settings?.logo_url ?? null,
        loading,
        subscription,
        subscriptionLoading,
        isSubscriptionActive,
        isOnTrial,
        trialDaysLeft,
        updateSettings,
        refreshSettings: fetchSchoolData,
        refreshSubscription: fetchSubscription,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────

export function useSchool(): SchoolContextType {
  const ctx = useContext(SchoolContext);
  if (!ctx) throw new Error('useSchool must be used inside <SchoolProvider>');
  return ctx;
}