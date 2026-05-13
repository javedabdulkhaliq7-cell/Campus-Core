import { useEffect, useState } from 'react';
import { supabase, Class, FeeStructure, GRADES, SECTIONS, CURRENT_YEAR, DECADE_YEARS } from '../lib/supabase';
import { useSchool } from '../lib/schoolContext';
import { Plus, Save, X, ChevronDown, GraduationCap, DollarSign } from 'lucide-react';

export default function Classes() {
  const { schoolId } = useSchool();
  const [classes, setClasses] = useState<Class[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [editClass, setEditClass] = useState<Partial<Class>>({});
  const [editFee, setEditFee] = useState<Partial<FeeStructure>>({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'classes' | 'fees'>('classes');

  async function fetchData() {
    const [{ data: cls }, { data: fees }] = await Promise.all([
      supabase.from('classes').select('*').eq('school_id', schoolId).eq('academic_year', selectedYear).order('grade'),
      supabase.from('fee_structures').select('*').eq('school_id', schoolId).eq('academic_year', selectedYear).order('grade'),
    ]);
    setClasses(cls || []); setFeeStructures(fees || []);
  }

  useEffect(() => { if (schoolId) fetchData(); }, [selectedYear, schoolId]);

  async function saveClass() {
    setSaving(true);
    const { id, ...rest } = editClass as any;
    const payload = { ...rest, school_id: schoolId, academic_year: selectedYear, name: `Class ${editClass.grade}` };
    let error;
    if (editClass.id) ({ error } = await supabase.from('classes').update(payload).eq('id', editClass.id));
    else ({ error } = await supabase.from('classes').insert(payload));
    setSaving(false);
    if (error) { alert('Failed to save class: ' + error.message); return; }
    setShowClassModal(false); fetchData();
  }

  async function saveFee() {
    setSaving(true);
    const { id, ...rest } = editFee as any;
    const payload = { ...rest, school_id: schoolId, academic_year: selectedYear };
    let error;
    if (editFee.id) ({ error } = await supabase.from('fee_structures').update(payload).eq('id', editFee.id));
    else ({ error } = await supabase.from('fee_structures').insert(payload));
    setSaving(false);
    if (error) { alert('Failed to save fee structure: ' + error.message); return; }
    setShowFeeModal(false); fetchData();
  }

  const totalAnnualFee = (fs: FeeStructure) => fs.monthly_tuition * 12 + fs.admission_fee + fs.exam_fee * 2 + fs.lab_fee + fs.sports_fee;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold text-slate-800">Classes & Fee Structure</h2><p className="text-slate-500 text-sm">Manage classes and define fee structures</p></div>
        <div className="flex items-center gap-3"><div className="relative"><select className="input pr-8 appearance-none w-28" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>{DECADE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select><ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" /></div>
          <button onClick={() => { if (activeTab === 'classes') { setEditClass({ grade: 1, section: 'A' }); setShowClassModal(true); } else { setEditFee({ grade: 1, monthly_tuition: 0, admission_fee: 0, exam_fee: 0, lab_fee: 0, sports_fee: 0, other_fee: 0 }); setShowFeeModal(true); } }} className="btn-primary"><Plus className="w-4 h-4" />Add {activeTab === 'classes' ? 'Class' : 'Fee'}</button></div>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">{(['classes', 'fees'] as const).map(t => (<button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>{t === 'classes' ? 'Classes' : 'Fee Structures'}</button>))}</div>

      {activeTab === 'classes' && (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {classes.map(cls => (<div key={cls.id} className="card hover:shadow-md transition-shadow"><div className="flex items-start justify-between mb-3"><div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><GraduationCap className="w-5 h-5 text-blue-600" /></div><button onClick={() => { setEditClass(cls); setShowClassModal(true); }} className="p-1.5 hover:bg-slate-100 rounded-lg"><Plus className="w-3.5 h-3.5 text-slate-400" /></button></div><h3 className="font-semibold text-slate-800">Class {cls.grade} — Section {cls.section}</h3><p className="text-xs text-slate-500 mt-1">{cls.class_teacher || 'No teacher assigned'}</p><div className="mt-3 pt-3 border-t border-slate-100"><span className="badge badge-blue">{selectedYear}</span></div></div>))}
        {classes.length === 0 && <div className="col-span-full text-center py-12 text-slate-400"><GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>No classes for {selectedYear}</p></div>}
      </div>)}

      {activeTab === 'fees' && (<div className="card p-0 overflow-hidden"><div className="overflow-x-auto"><table className="w-full"><thead><tr><th className="table-header text-left">Class</th><th className="table-header text-right">Monthly Tuition</th><th className="table-header text-right hidden sm:table-cell">Admission</th><th className="table-header text-right hidden sm:table-cell">Exam</th><th className="table-header text-right hidden md:table-cell">Lab</th><th className="table-header text-right hidden md:table-cell">Sports</th><th className="table-header text-right">Annual Total</th><th className="table-header text-left">Action</th></tr></thead><tbody>
        {feeStructures.map(fs => (<tr key={fs.id} className="table-row"><td className="table-cell font-medium text-slate-800">Class {fs.grade}</td><td className="table-cell text-right text-blue-600 font-semibold">Rs. {fs.monthly_tuition.toLocaleString()}</td><td className="table-cell text-right text-slate-600 hidden sm:table-cell">Rs. {fs.admission_fee.toLocaleString()}</td><td className="table-cell text-right text-slate-600 hidden sm:table-cell">Rs. {fs.exam_fee.toLocaleString()}</td><td className="table-cell text-right text-slate-600 hidden md:table-cell">Rs. {fs.lab_fee.toLocaleString()}</td><td className="table-cell text-right text-slate-600 hidden md:table-cell">Rs. {fs.sports_fee.toLocaleString()}</td><td className="table-cell text-right font-bold text-slate-800">Rs. {totalAnnualFee(fs).toLocaleString()}</td><td className="table-cell"><button onClick={() => { setEditFee(fs); setShowFeeModal(true); }} className="p-1.5 hover:bg-blue-50 rounded-lg"><Plus className="w-4 h-4 text-blue-500" /></button></td></tr>))}
        {feeStructures.length === 0 && <tr><td colSpan={8} className="table-cell text-center py-12 text-slate-400"><DollarSign className="w-6 h-6 mx-auto mb-2 opacity-30" />No fee structures for {selectedYear}</td></tr>}
      </tbody></table></div></div>)}

      {showClassModal && (<div className="modal-backdrop"><div className="modal-box animate-fade-in"><div className="flex items-center justify-between p-5 border-b border-slate-100"><h3 className="font-semibold text-slate-800">{editClass.id ? 'Edit Class' : 'Add Class'}</h3><button onClick={() => setShowClassModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button></div><div className="p-5 grid grid-cols-2 gap-4"><div><label className="label">Grade</label><select className="input" value={editClass.grade || 1} onChange={e => setEditClass({ ...editClass, grade: parseInt(e.target.value) })}>{GRADES.map(g => <option key={g} value={g}>Class {g}</option>)}</select></div><div><label className="label">Section</label><select className="input" value={editClass.section || 'A'} onChange={e => setEditClass({ ...editClass, section: e.target.value })}>{SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div><div className="col-span-2"><label className="label">Class Teacher</label><input className="input" value={editClass.class_teacher || ''} onChange={e => setEditClass({ ...editClass, class_teacher: e.target.value })} /></div></div><div className="flex justify-end gap-3 p-5 border-t border-slate-100"><button onClick={() => setShowClassModal(false)} className="btn-secondary">Cancel</button><button onClick={saveClass} disabled={saving} className="btn-primary"><Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save'}</button></div></div></div>)}

      {showFeeModal && (<div className="modal-backdrop"><div className="modal-box animate-fade-in"><div className="flex items-center justify-between p-5 border-b border-slate-100"><h3 className="font-semibold text-slate-800">{editFee.id ? 'Edit Fee Structure' : 'Add Fee Structure'}</h3><button onClick={() => setShowFeeModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button></div><div className="p-5"><div className="mb-4"><label className="label">Class</label><select className="input" value={editFee.grade || 1} onChange={e => setEditFee({ ...editFee, grade: parseInt(e.target.value) })}>{GRADES.map(g => <option key={g} value={g}>Class {g}</option>)}</select></div><div className="grid grid-cols-2 gap-4">{[['monthly_tuition', 'Monthly Tuition (Rs.)'], ['admission_fee', 'Admission Fee (Rs.)'], ['exam_fee', 'Exam Fee (Rs.)'], ['lab_fee', 'Lab Fee (Rs.)'], ['sports_fee', 'Sports Fee (Rs.)'], ['other_fee', 'Other Fee (Rs.)']].map(([key, label]) => (<div key={key}><label className="label">{label}</label><input type="number" className="input" min={0} value={(editFee as Record<string, number | string>)[key] || 0} onChange={e => setEditFee(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))} /></div>))}</div></div><div className="flex justify-end gap-3 p-5 border-t border-slate-100"><button onClick={() => setShowFeeModal(false)} className="btn-secondary">Cancel</button><button onClick={saveFee} disabled={saving} className="btn-primary"><Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save'}</button></div></div></div>)}
    </div>
  );
}
