import { useEffect, useState } from 'react';
import { supabase, Student, FeeRecord, FeeStructure, MONTHS, GRADES, CURRENT_YEAR, DECADE_YEARS, sendSmsNotification } from '../lib/supabase';
import { useSchool } from '../lib/schoolContext';
import { Search, CreditCard, CheckCircle, AlertCircle, Clock, X, ChevronDown, Plus, Receipt } from 'lucide-react';

interface StudentFee { student: Student; feeRecord?: FeeRecord; feeStructure?: FeeStructure; }

export default function Fees() {
  const { schoolId, schoolName } = useSchool();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<StudentFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payEntry, setPayEntry] = useState<StudentFee | null>(null);
  const [payForm, setPayForm] = useState<Partial<FeeRecord>>({});
  const [saving, setSaving] = useState(false);
  const [smsStatus, setSmsStatus] = useState('');

  async function fetchData() {
    setLoading(true);
    let query = supabase.from('students').select('*').eq('school_id', schoolId).eq('is_active', true);
    if (selectedGrade) query = query.eq('current_grade', parseInt(selectedGrade));
    const { data: students } = await query.order('current_grade').order('roll_number');
    const { data: feeRecords } = await supabase.from('fee_records').select('*').eq('school_id', schoolId).eq('fee_month', selectedMonth).eq('fee_year', selectedYear);
    const grades = [...new Set((students || []).map(s => s.current_grade))];
    const { data: feeStructures } = grades.length > 0 ? await supabase.from('fee_structures').select('*').eq('school_id', schoolId).in('grade', grades).eq('academic_year', selectedYear) : { data: [] };
    const feeMap = Object.fromEntries((feeRecords || []).map(r => [r.student_id, r]));
    const structMap = Object.fromEntries((feeStructures || []).map(s => [s.grade, s]));
    setData((students || []).map(s => ({ student: s, feeRecord: feeMap[s.id], feeStructure: structMap[s.current_grade] })));
    setLoading(false);
  }

  useEffect(() => { if (schoolId) fetchData(); }, [selectedMonth, selectedYear, selectedGrade, schoolId]);

  const filtered = data.filter(d => !search || d.student.full_name.toLowerCase().includes(search.toLowerCase()) || d.student.roll_number.toLowerCase().includes(search.toLowerCase()));
  const stats = {
    total: data.length,
    paid: data.filter(d => d.feeRecord?.status === 'Paid').length,
    unpaid: data.filter(d => !d.feeRecord || d.feeRecord.status !== 'Paid').length,
    collected: data.filter(d => d.feeRecord?.status === 'Paid').reduce((s, d) => s + (d.feeRecord?.amount_paid || 0), 0),
    pending: data.filter(d => !d.feeRecord || d.feeRecord.status !== 'Paid').reduce((s, d) => { const t = d.feeStructure ? d.feeStructure.monthly_tuition + d.feeStructure.lab_fee + d.feeStructure.sports_fee : 0; return s + Math.max(0, t - (d.feeRecord?.amount_paid || 0)); }, 0),
  };

  function openPayModal(entry: StudentFee) {
    setPayEntry(entry);
    const s = entry.feeStructure;
    const total = s ? s.monthly_tuition + s.lab_fee + s.sports_fee + s.other_fee : 0;
    setPayForm({
      student_id: entry.student.id, fee_month: selectedMonth, fee_year: selectedYear,
      tuition_fee: s?.monthly_tuition || 0, lab_fee: s?.lab_fee || 0, sports_fee: s?.sports_fee || 0, other_fee: s?.other_fee || 0, exam_fee: 0, admission_fee: 0,
      total_amount: total, amount_paid: entry.feeRecord?.amount_paid || total, discount: entry.feeRecord?.discount || 0, fine: entry.feeRecord?.fine || 0,
      payment_method: 'Cash', payment_date: new Date().toISOString().split('T')[0], collected_by: 'Principal', status: 'Paid', ...(entry.feeRecord || {}),
    });
    setShowPayModal(true); setSmsStatus('');
  }

  async function saveFee() {
    if (!payForm.student_id || !schoolId) return;
    setSaving(true);
    const total = (payForm.tuition_fee || 0) + (payForm.lab_fee || 0) + (payForm.sports_fee || 0) + (payForm.exam_fee || 0) + (payForm.admission_fee || 0) + (payForm.other_fee || 0) + (payForm.fine || 0) - (payForm.discount || 0);
    const { id: _id, created_at: _ca, updated_at: _ua, ...cleanForm } = payForm as any;
    const record = { ...cleanForm, school_id: schoolId, total_amount: total };
    let error;
    if (payEntry?.feeRecord?.id) {
      ({ error } = await supabase.from('fee_records').update(record).eq('id', payEntry.feeRecord.id));
    } else {
      ({ error } = await supabase.from('fee_records').insert(record));
    }
    if (error) { setSaving(false); alert('Failed to save fee: ' + error.message); return; }
    if (payEntry && record.status === 'Paid' && payEntry.student.parent_phone) {
      setSmsStatus('Sending SMS...');
      await sendSmsNotification(payEntry.student.parent_phone, payEntry.student.full_name, total, schoolName, selectedMonth, selectedYear);
      setSmsStatus('SMS sent to ' + payEntry.student.parent_phone);
    }
    setSaving(false); setShowPayModal(false); fetchData();
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold text-slate-800">Fee Management</h2><p className="text-slate-500 text-sm">Track and collect student fees</p></div></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[{ l: 'Total', v: stats.total, c: 'text-slate-700', b: 'bg-slate-50' }, { l: 'Paid', v: stats.paid, c: 'text-emerald-700', b: 'bg-emerald-50' }, { l: 'Unpaid', v: stats.unpaid, c: 'text-red-700', b: 'bg-red-50' }, { l: 'Collected', v: `Rs. ${stats.collected.toLocaleString()}`, c: 'text-blue-700', b: 'bg-blue-50' }].map(({ l, v, c, b }) => (
          <div key={l} className={`${b} rounded-2xl p-4 border border-slate-100`}><p className="text-xs font-semibold text-slate-500 uppercase">{l}</p><p className={`text-xl font-bold ${c} mt-1`}>{v}</p></div>
        ))}
      </div>

      <div className="card p-4"><div className="flex flex-wrap gap-3">
        <div className="relative"><select className="input pr-8 appearance-none w-40" value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}>{MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select><ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" /></div>
        <div className="relative"><select className="input pr-8 appearance-none w-28" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>{DECADE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select><ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" /></div>
        <div className="relative"><select className="input pr-8 appearance-none w-36" value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}><option value="">All Classes</option>{GRADES.map(g => <option key={g} value={g}>Class {g}</option>)}</select><ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" /></div>
        <div className="relative flex-1 min-w-40"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input className="input pl-9" placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div></div>

      <div className="card p-0 overflow-hidden"><div className="overflow-x-auto"><table className="w-full"><thead><tr>
        <th className="table-header text-left">Student</th><th className="table-header text-left hidden sm:table-cell">Class</th><th className="table-header text-right">Fee</th><th className="table-header text-right">Paid</th><th className="table-header text-left hidden md:table-cell">Date</th><th className="table-header text-left">Status</th><th className="table-header text-left">Action</th>
      </tr></thead><tbody>
        {loading ? <tr><td colSpan={7} className="table-cell text-center py-12 text-slate-400">Loading...</td></tr> :
        filtered.length === 0 ? <tr><td colSpan={7} className="table-cell text-center py-12 text-slate-400">No records</td></tr> :
        filtered.map(({ student: s, feeRecord: fr, feeStructure: fs }) => {
          const totalDue = fs ? fs.monthly_tuition + fs.lab_fee + fs.sports_fee : 0;
          const isPaid = fr?.status === 'Paid';
          const isPartial = fr && !isPaid && (fr.amount_paid || 0) > 0;
          return (<tr key={s.id} className="table-row">
            <td className="table-cell"><div className="flex items-center gap-2.5"><div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">{s.full_name.charAt(0)}</div><div><p className="font-medium text-slate-800 text-sm">{s.full_name}</p><p className="text-xs text-slate-400">{s.roll_number}</p></div></div></td>
            <td className="table-cell hidden sm:table-cell"><span className="badge badge-blue">Class {s.current_grade}-{s.current_section}</span></td>
            <td className="table-cell text-right font-medium text-slate-700">Rs. {(fr?.total_amount || totalDue).toLocaleString()}</td>
            <td className="table-cell text-right font-semibold"><span className={isPaid ? 'text-emerald-600' : 'text-slate-400'}>Rs. {(fr?.amount_paid || 0).toLocaleString()}</span></td>
            <td className="table-cell hidden md:table-cell text-slate-500 text-sm">{fr?.payment_date ? new Date(fr.payment_date).toLocaleDateString('en-PK') : '—'}</td>
            <td className="table-cell">{isPaid ? <span className="badge badge-green flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3" />Paid</span> : isPartial ? <span className="badge badge-yellow flex items-center gap-1 w-fit"><Clock className="w-3 h-3" />Partial</span> : <span className="badge badge-red flex items-center gap-1 w-fit"><AlertCircle className="w-3 h-3" />Unpaid</span>}</td>
            <td className="table-cell"><button onClick={() => openPayModal({ student: s, feeRecord: fr, feeStructure: fs })} className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${isPaid ? 'btn-secondary' : 'btn-primary'}`}>{isPaid ? <><Receipt className="w-3.5 h-3.5" />Edit</> : <><Plus className="w-3.5 h-3.5" />Collect</>}</button></td>
          </tr>);
        })}
      </tbody></table></div></div>

      {showPayModal && payEntry && (
        <div className="modal-backdrop"><div className="modal-box animate-fade-in">
          <div className="flex items-center justify-between p-5 border-b border-slate-100"><div><h3 className="font-semibold text-slate-800">Fee Collection</h3><p className="text-xs text-slate-400 mt-0.5">{payEntry.student.full_name} — {MONTHS[selectedMonth - 1]} {selectedYear}</p></div><button onClick={() => setShowPayModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button></div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[['tuition_fee', 'Tuition Fee'], ['exam_fee', 'Exam Fee'], ['lab_fee', 'Lab Fee'], ['sports_fee', 'Sports Fee'], ['admission_fee', 'Admission Fee'], ['other_fee', 'Other Fee'], ['fine', 'Fine/Penalty'], ['discount', 'Discount']].map(([key, label]) => (
                <div key={key}><label className="label">{label}</label><input type="number" className="input" min={0} value={(payForm as Record<string, number | string>)[key] || 0} onChange={e => setPayForm(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))} /></div>
              ))}
            </div>
            <div className="bg-blue-50 rounded-xl p-3 flex justify-between items-center"><span className="font-semibold text-slate-700">Total Payable</span><span className="text-lg font-bold text-blue-700">Rs. {((payForm.tuition_fee || 0) + (payForm.exam_fee || 0) + (payForm.lab_fee || 0) + (payForm.sports_fee || 0) + (payForm.admission_fee || 0) + (payForm.other_fee || 0) + (payForm.fine || 0) - (payForm.discount || 0)).toLocaleString()}</span></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Amount Received</label><input type="number" className="input" min={0} value={payForm.amount_paid || 0} onChange={e => setPayForm(prev => ({ ...prev, amount_paid: parseInt(e.target.value) || 0 }))} /></div>
              <div><label className="label">Payment Method</label><select className="input" value={payForm.payment_method || 'Cash'} onChange={e => setPayForm(prev => ({ ...prev, payment_method: e.target.value }))}><option>Cash</option><option>Bank Transfer</option><option>Cheque</option><option>Online</option></select></div>
              <div><label className="label">Payment Date</label><input type="date" className="input" value={payForm.payment_date || ''} onChange={e => setPayForm(prev => ({ ...prev, payment_date: e.target.value }))} /></div>
              <div><label className="label">Status</label><select className="input" value={payForm.status || 'Paid'} onChange={e => setPayForm(prev => ({ ...prev, status: e.target.value }))}><option>Paid</option><option>Partial</option><option>Unpaid</option></select></div>
              <div className="col-span-2"><label className="label">Remarks</label><input className="input" value={payForm.remarks || ''} onChange={e => setPayForm(prev => ({ ...prev, remarks: e.target.value }))} /></div>
            </div>
            {smsStatus && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">{smsStatus}</div>}
          </div>
          <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100"><button onClick={() => setShowPayModal(false)} className="btn-secondary">Cancel</button><button onClick={saveFee} disabled={saving} className="btn-success"><CreditCard className="w-4 h-4" />{saving ? 'Saving...' : 'Save & Send SMS'}</button></div>
        </div></div>
      )}
    </div>
  );
}
