import { useState } from 'react';
import { useSchool } from '../lib/schoolContext';
import { APP_NAME } from '../lib/supabase';
import { Save, School, Shield, Database, CheckCircle } from 'lucide-react';

export default function Settings() {
  const { settings, updateSettings } = useSchool();
  const [schoolName, setSchoolName] = useState(settings?.school_name || '');
  const [principalName, setPrincipalName] = useState(settings?.principal_name || '');
  const [address, setAddress] = useState(settings?.address || '');
  const [phone, setPhone] = useState(settings?.phone || '');
  const [email, setEmail] = useState(settings?.email || '');
  const [website, setWebsite] = useState(settings?.website || '');
  const [registrationNumber, setRegistrationNumber] = useState(settings?.registration_number || '');
  const [establishedYear, setEstablishedYear] = useState(settings?.established_year || new Date().getFullYear());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await updateSettings({
      school_name: schoolName, principal_name: principalName, address, phone, email, website,
      registration_number: registrationNumber, established_year: establishedYear,
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">
      <div><h2 className="text-2xl font-bold text-slate-800">Settings</h2><p className="text-slate-500 text-sm">Configure your school information</p></div>

      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-2"><School className="w-4 h-4 text-blue-600" /><h3 className="font-semibold text-slate-800">School Information</h3></div>
        <div><label className="label">School Name *</label><input className="input" value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Your school name" /><p className="text-xs text-slate-400 mt-1">This name appears throughout {APP_NAME}</p></div>
        <div><label className="label">Principal Name</label><input className="input" value={principalName} onChange={e => setPrincipalName(e.target.value)} placeholder="Full name of principal" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Established Year</label><input type="number" className="input" value={establishedYear} onChange={e => setEstablishedYear(parseInt(e.target.value))} min="1900" max={new Date().getFullYear()} /></div>
          <div><label className="label">Registration Number</label><input className="input" value={registrationNumber} onChange={e => setRegistrationNumber(e.target.value)} /></div>
        </div>
        <div><label className="label">Address</label><input className="input" value={address} onChange={e => setAddress(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Phone</label><input className="input" value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <div><label className="label">Email</label><input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} /></div>
        </div>
        <div><label className="label">Website</label><input className="input" value={website} onChange={e => setWebsite(e.target.value)} /></div>
        <button onClick={handleSave} disabled={saving} className="btn-primary"><Save className="w-4 h-4" />{saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}</button>
        {saved && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2"><CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" /><span className="text-sm text-emerald-700">Settings updated! School name is now "{schoolName}" across the app.</span></div>}
      </div>

      <div className="card space-y-3">
        <div className="flex items-center gap-2 mb-2"><Database className="w-4 h-4 text-emerald-600" /><h3 className="font-semibold text-slate-800">System Information</h3></div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[['Platform', APP_NAME], ['Current School', schoolName || 'My School'], ['Data Coverage', '10-Year History'], ['Version', 'v2.0']].map(([l, v]) => (
            <div key={l as string} className="bg-slate-50 rounded-xl p-3"><p className="text-slate-400 text-xs">{l}</p><p className="font-medium text-slate-700 mt-0.5">{v}</p></div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800"><p className="font-medium">Multi-Tenant Security</p><p className="mt-0.5">Your school data is completely isolated from other schools on {APP_NAME}. Each login is linked to your specific school database.</p></div>
      </div>
    </div>
  );
}
