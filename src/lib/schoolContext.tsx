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
  const fetchSchoolData = useCallback(async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from('school_members')
        .select('school_id')
        .eq('user_id', user.id)
        .single();

      if (!member) return;

      const [{ data: schoolData }, { data: settingsData }] = await Promise.all([
        supabase.from('schools').select('id, name').eq('id', member.school_id).single(),
        supabase.from('school_settings').select('*').eq('school_id', member.school_id).single(),
      ]);

      if (schoolData) setSchool(schoolData);
      if (settingsData) setSettings(settingsData);
    } catch (err) {
      console.error('Error fetching school data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch subscription ───────────────────────────────────────
  const fetchSubscription = useCallback(async () => {
    try {
      setSubscriptionLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from('school_members')
        .select('school_id')
        .eq('user_id', user.id)
        .single();

      if (!member) return;

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('school_id', member.school_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (sub) setSubscription(sub);
    } catch (err) {
      console.error('Error fetching subscription:', err);
    } finally {
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