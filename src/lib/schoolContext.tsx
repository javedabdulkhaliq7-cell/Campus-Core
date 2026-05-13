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

  const fetchSchoolData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: member } = await supabase
        .from('school_members')
        .select('school_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!member) { setLoading(false); return; }

      const { data: schoolData } = await supabase
        .from('schools')
        .select('*')
        .eq('id', member.school_id)
        .maybeSingle();

      if (schoolData) setSchool(schoolData);

      const { data: settingsData } = await supabase
        .from('school_settings')
        .select('*')
        .eq('school_id', member.school_id)
        .maybeSingle();

      if (settingsData) setSettings(settingsData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSchoolData(); }, [fetchSchoolData]);

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
      refreshSettings: fetchSchoolData,
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
