import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase, School, SchoolSettings } from './supabase';

interface SchoolContextType {
  school: School | null;
  settings: SchoolSettings | null;
  schoolId: string | null;
  schoolName: string;
  loading: boolean;
  updateSettings: (newSettings: Partial<SchoolSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export function SchoolProvider({ children }: { children: ReactNode }) {
  const [school, setSchool] = useState<School | null>(null);
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchSchoolData = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const { data: member, error: memberError } = await supabase
        .from('school_members')
        .select('school_id')
        .eq('user_id', uid)
        .maybeSingle();

      if (memberError) { console.error('school_members error:', memberError); setLoading(false); return; }
      if (!member) { console.warn('No school member found for user:', uid); setLoading(false); return; }

      const { data: schoolData, error: schoolError } = await supabase
        .from('schools')
        .select('*')
        .eq('id', member.school_id)
        .maybeSingle();

      if (schoolError) { console.error('schools error:', schoolError); }
      if (schoolData) setSchool(schoolData);

      const { data: settingsData, error: settingsError } = await supabase
        .from('school_settings')
        .select('*')
        .eq('school_id', member.school_id)
        .maybeSingle();

      if (settingsError) { console.error('school_settings error:', settingsError); }
      if (settingsData) setSettings(settingsData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Get current session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        fetchSchoolData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Also listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        fetchSchoolData(session.user.id);
      } else {
        setUserId(null);
        setSchool(null);
        setSettings(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchSchoolData]);

  const updateSettings = async (newSettings: Partial<SchoolSettings>) => {
    if (!settings) return;
    const { data, error } = await supabase
      .from('school_settings')
      .update({ ...newSettings, updated_at: new Date().toISOString() })
      .eq('id', settings.id)
      .select()
      .single();
    if (!error && data) setSettings(data);
  };

  return (
    <SchoolContext.Provider value={{
      school,
      settings,
      schoolId: school?.id || null,
      schoolName: settings?.school_name || school?.name || 'My School',
      loading,
      updateSettings,
      refreshSettings: () => userId ? fetchSchoolData(userId) : Promise.resolve(),
    }}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  const context = useContext(SchoolContext);
  if (!context) throw new Error('useSchool must be used within SchoolProvider');
  return context;
}
