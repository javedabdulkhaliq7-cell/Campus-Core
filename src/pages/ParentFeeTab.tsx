// src/components/ParentFeeTab.tsx
import { useEffect, useState } from 'react';
import { parentSupabase } from '../lib/parentSupabaseClient';
import ReceiptPreview from '../components/ReceiptPreview';

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface FeeRecord {
  id: string;
  fee_month: number;
  fee_year: number;
  tuition_fee: number;
  admission_fee: number;
  exam_fee: number;
  lab_fee: number;
  sports_fee: number;
  other_fee: number;
  total_amount: number;
  amount_paid: number;
  discount: number;
  fine: number;
  status: string;
  payment_date: string | null;
  payment_method: string | null;
  receipt_number: string | null;
  remarks: string | null;
  collected_by: string | null;
  receipt_snapshot: any | null;
}

interface Props {
  studentId: string;
}

export default function ParentFeeTab({ studentId }: Props) {
  const [records, setRecords] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<number | 'all'>('all');
  const [filterMonth, setFilterMonth] = useState<number | 'all'>('all');
  const [viewingReceipt, setViewingReceipt] = useState<any | null>(null);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    parentSupabase
      .from('fee_records')
      .select('*')
      .eq('student_id', studentId)
      .order('fee_year', { ascending: false })
      .order('fee_month', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('Fee fetch error:', error);
        else setRecords(data || []);
        setLoading(false);
      });
  }, [studentId]);

  const statusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid': return 'bg-emerald-100 text-emerald-700';
      case 'partial': return 'bg-yellow-100 text-yellow-700';
      case 'unpaid':
      case 'pending': return 'bg-red-100 text-red-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const totalPaid = records.filter(r => r.status?.toLowerCase() === 'paid').length;
  const totalPending = records.filter(r => ['unpaid', 'pending'].includes(r.status?.toLowerCase())).length;
  const totalDue = records.reduce((sum, r) => sum + ((r.total_amount ?? 0) - (r.amount_paid ?? 0)), 0);

  const availableYears = Array.from(new Set(records.map(r => r.fee_year))).sort((a, b) => b - a);

  const filteredRecords = records.filter(r =>
    (filterYear === 'all' || r.fee_year === filterYear) &&
    (filterMonth === 'all' || r.fee_month === filterMonth)
  );

  // When the dropdowns narrow things down to exactly one receipt, open it
  // automatically — that's the whole point of picking a specific month.
  useEffect(() => {
    if (filteredRecords.length === 1) setExpanded(filteredRecords[0].id);
  }, [filterYear, filterMonth]);

  const isFiltering = filterYear !== 'all' || filterMonth !== 'all';
  const filterLabel = `${filterMonth !== 'all' ? MONTHS[filterMonth as number] : ''} ${filterYear !== 'all' ? filterYear : ''}`.trim();

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  );

  if (records.length === 0) return (
    <div className="text-center py-12 text-slate-400 text-sm">No fee records found.</div>
  );

  return (
    <div className="space-y-4 p-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-emerald-700">{totalPaid}</div>
          <div className="text-xs text-emerald-600 mt-1">Paid</div>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{totalPending}</div>
          <div className="text-xs text-red-500 mt-1">Pending</div>
        </div>
        <div className="bg-orange-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-orange-600">
            Rs {totalDue > 0 ? totalDue.toLocaleString() : '0'}
          </div>
          <div className="text-xs text-orange-500 mt-1">Total Due</div>
        </div>
      </div>

      {/* Month / Year Filter */}
      <div className="flex gap-2">
        <select
          value={filterYear}
          onChange={e => setFilterYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700"
        >
          <option value="all">All Years</option>
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700"
        >
          <option value="all">All Months</option>
          {MONTHS.slice(1).map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
      </div>

      {/* Fee Records List */}
      {isFiltering && filteredRecords.length === 0 ? (
        <div className="text-center py-10 text-sm text-slate-400">
          Fees for {filterLabel} have not been collected yet.
        </div>
      ) : (
      <div className="space-y-3">
        {filteredRecords.map(r => {
          const isOpen = expanded === r.id;
          const balance = (r.total_amount ?? 0) - (r.amount_paid ?? 0);

          const feeBreakdown = [
            ['Tuition', r.tuition_fee],
            ['Admission', r.admission_fee],
            ['Exam', r.exam_fee],
            ['Lab', r.lab_fee],
            ['Sports', r.sports_fee],
            ['Other', r.other_fee],
            ['Discount', r.discount],
            ['Fine', r.fine],
          ].filter(([, v]) => (v as number) > 0);

          return (
            <div key={r.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              {/* Header Row */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                onClick={() => setExpanded(isOpen ? null : r.id)}
              >
                <div>
                  <div className="font-semibold text-slate-800">
                    {MONTHS[r.fee_month]} {r.fee_year}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Total: Rs {r.total_amount?.toLocaleString() ?? '0'}
                    {r.receipt_number ? ` · #${r.receipt_number}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(r.status)}`}>
                    {r.status || 'Unknown'}
                  </span>
                  <span className="text-slate-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {/* Expanded Detail */}
              {isOpen && (
                <div className="border-t border-slate-100 px-4 py-3 space-y-3 bg-slate-50">
                  {/* Fee Breakdown */}
                  {feeBreakdown.length > 0 && (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                      {feeBreakdown.map(([label, value]) => (
                        <div key={label as string} className="flex justify-between">
                          <span className="text-slate-500">{label}</span>
                          <span className="text-slate-700">Rs {(value as number).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Payment Summary */}
                  <div className="border-t border-slate-200 pt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Amount Paid</span>
                      <span className="text-emerald-700 font-medium">
                        Rs {r.amount_paid?.toLocaleString() ?? '0'}
                      </span>
                    </div>
                    {balance > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Balance Due</span>
                        <span className="text-red-600 font-medium">Rs {balance.toLocaleString()}</span>
                      </div>
                    )}
                    {r.payment_date && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Paid On</span>
                        <span className="text-slate-700">{r.payment_date}</span>
                      </div>
                    )}
                    {r.payment_method && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Method</span>
                        <span className="text-slate-700">{r.payment_method}</span>
                      </div>
                    )}
                    {r.collected_by && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Collected By</span>
                        <span className="text-slate-700">{r.collected_by}</span>
                      </div>
                    )}
                    {r.remarks && (
                      <div className="text-xs text-slate-400 pt-1 italic">"{r.remarks}"</div>
                    )}
                  </div>

                  {/* Receipt — identical to the one the school's office sees */}
                  {r.status?.toLowerCase() === 'paid' && (
                    r.receipt_snapshot ? (
                      <button
                        onClick={() => setViewingReceipt(r.receipt_snapshot)}
                        className="w-full text-sm font-medium bg-blue-600 text-white rounded-lg py-2.5 hover:bg-blue-700 transition-colors"
                      >
                        View / Download Receipt
                      </button>
                    ) : (
                      <p className="text-xs text-slate-400 text-center pt-1">
                        Receipt not available for this payment — ask the school office to reprint it once to generate one.
                      </p>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {viewingReceipt && (
        <ReceiptPreview data={viewingReceipt} onClose={() => setViewingReceipt(null)} />
      )}
    </div>
  );
}