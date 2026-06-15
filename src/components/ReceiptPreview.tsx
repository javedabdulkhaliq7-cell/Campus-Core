import { useRef, useEffect } from 'react';
import { Printer, X, School } from 'lucide-react';

interface ReceiptData {
  receiptNumber: string;
  schoolName: string;
  schoolLogo: string | null;
  schoolAddress: string;
  schoolPhone: string;
  schoolEmail: string;
  studentName: string;
  rollNumber: string;
  className: string;
  fatherName: string;
  feeMonth: number;
  feeYear: number;
  totalAmount: number;
  amountPaid: number;
  previousBalance: number;
  remainingBalance: number;
  paymentDate: string;
  paymentMethod: string;
  receivedBy: string;
}

interface ReceiptPreviewProps {
  data: ReceiptData;
  onClose: () => void;
  onPrint?: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function ReceiptPreview({ data, onClose, onPrint }: ReceiptPreviewProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  // Helper to get receipt content HTML for printing
  const getReceiptHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fee Receipt - ${data.receiptNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: #e2e8f0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
          }
          .receipt {
            max-width: 500px;
            width: 100%;
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .receipt-inner { padding: 24px; }
          .school-header { text-align: center; border-bottom: 2px solid #1d4ed8; padding-bottom: 16px; margin-bottom: 16px; }
          .logo { width: 60px; height: 60px; margin: 0 auto 8px; border-radius: 50%; overflow: hidden; background: #f1f5f9; display: flex; align-items: center; justify-content: center; }
          .logo img { width: 100%; height: 100%; object-fit: cover; }
          .school-name { font-size: 18px; font-weight: 800; color: #0f172a; }
          .school-address { font-size: 10px; color: #64748b; margin-top: 4px; }
          .receipt-title { text-align: center; margin-bottom: 20px; }
          .receipt-title h3 { font-size: 16px; font-weight: 700; color: #1d4ed8; border-bottom: 2px solid #fbbf24; display: inline-block; padding-bottom: 4px; }
          .receipt-info { display: flex; justify-content: space-between; font-size: 11px; background: #f8fafc; padding: 10px 12px; border-radius: 8px; margin-bottom: 16px; }
          .info-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; margin-bottom: 16px; }
          .info-label { color: #64748b; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
          .info-value { font-weight: 600; color: #1e293b; margin-top: 2px; }
          table { width: 100%; font-size: 12px; border-collapse: collapse; margin: 16px 0; }
          th, td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #e2e8f0; }
          th { background: #f8fafc; font-weight: 700; color: #475569; }
          td:last-child, th:last-child { text-align: right; }
          .total-row { background: #f0f9ff; font-weight: 700; }
          .total-row td { border-bottom: none; }
          .payment-details { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; padding: 12px; border-radius: 8px; margin: 16px 0; }
          .footer { text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 16px; }
          @media print {
            body { background: white; padding: 0; }
            .no-print { display: none; }
            .receipt { box-shadow: none; border-radius: 0; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="receipt-inner">
            <div class="school-header">
              <div class="logo">
                ${data.schoolLogo ? `<img src="${data.schoolLogo}" alt="Logo" />` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3L3 8l9 5 9-5-9-5z"/><path d="M3 8v8l9 5 9-5V8"/></svg></div>'}
              </div>
              <div class="school-name">${data.schoolName}</div>
              <div class="school-address">${data.schoolAddress || ''} ${data.schoolPhone ? `Tel: ${data.schoolPhone}` : ''}</div>
            </div>
            <div class="receipt-title"><h3>FEE RECEIPT</h3></div>
            <div class="receipt-info">
              <span><strong>Receipt No:</strong> ${data.receiptNumber}</span>
              <span><strong>Date:</strong> ${data.paymentDate}</span>
            </div>
            <div class="info-row">
              <div><div class="info-label">Student Name</div><div class="info-value">${data.studentName}</div></div>
              <div><div class="info-label">Roll Number</div><div class="info-value">${data.rollNumber || '—'}</div></div>
              <div><div class="info-label">Class</div><div class="info-value">${data.className}</div></div>
              <div><div class="info-label">Father's Name</div><div class="info-value">${data.fatherName || '—'}</div></div>
            </div>
            <table>
              <thead><tr><th>Particulars</th><th>Amount (Rs.)</th></tr></thead>
              <tbody>
                <tr><td>Fee for ${MONTH_NAMES[data.feeMonth-1]} ${data.feeYear}</td><td>${data.totalAmount.toLocaleString()}</td></tr>
                ${data.previousBalance > 0 ? `<tr style="background:#fef2f2;"><td>Previous Balance (Unpaid)</td><td style="color:#dc2626;">+ ${data.previousBalance.toLocaleString()}</td></tr>` : ''}
                <tr style="background:#eff6ff;"><td><strong>Total Payable</strong></td><td><strong>${(data.totalAmount + data.previousBalance).toLocaleString()}</strong></td></tr>
                <tr style="background:#f0fdf4;"><td><strong>Amount Paid</strong></td><td><strong style="color:#16a34a;">${data.amountPaid.toLocaleString()}</strong></td></tr>
                <tr><td>Remaining Balance</td><td style="color:#d97706;">${data.remainingBalance.toLocaleString()}</td></tr>
              </tbody>
            </table>
            <div class="payment-details">
              <div><div class="info-label">Payment Method</div><div class="info-value">${data.paymentMethod}</div></div>
              <div><div class="info-label">Received By</div><div class="info-value">${data.receivedBy}</div></div>
            </div>
            <div class="footer">This is a computer generated receipt – no signature required.</div>
          </div>
        </div>
        <div class="no-print" style="text-align:center;margin-top:16px;">
          <button onclick="window.print()" style="padding:10px 24px;background:#1d4ed8;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">🖨️ Print / Save as PDF</button>
          <button onclick="window.close()" style="margin-left:12px;padding:10px 24px;background:#f1f5f9;color:#475569;border:none;border-radius:8px;cursor:pointer;">Close</button>
        </div>
      </body>
      </html>
    `;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(getReceiptHTML());
      printWindow.document.close();
      printWindow.focus();
    } else {
      alert('Please allow pop-ups to print the receipt.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-slate-800">Receipt Preview</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Content */}
        <div ref={receiptRef} className="p-5">
          <div className="text-center border-b pb-3 mb-3">
            {data.schoolLogo ? (
              <img src={data.schoolLogo} alt="School Logo" className="w-14 h-14 rounded-full object-cover mx-auto mb-2" />
            ) : (
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <School className="w-7 h-7 text-blue-600" />
              </div>
            )}
            <h2 className="text-lg font-bold text-slate-800">{data.schoolName}</h2>
            <p className="text-xs text-slate-400">{data.schoolAddress}</p>
            {data.schoolPhone && <p className="text-xs text-slate-400">Tel: {data.schoolPhone}</p>}
          </div>

          <div className="text-center mb-4">
            <h3 className="text-md font-bold text-blue-700 border-b-2 border-amber-400 inline-block pb-1 px-3">FEE RECEIPT</h3>
          </div>

          <div className="flex justify-between text-xs bg-slate-50 p-2 rounded-lg mb-3">
            <span className="font-semibold">Receipt No: <span className="font-mono">{data.receiptNumber}</span></span>
            <span className="font-semibold">Date: {data.paymentDate}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div><span className="text-slate-400">Student Name:</span><br /><span className="font-semibold">{data.studentName}</span></div>
            <div><span className="text-slate-400">Roll No:</span><br /><span className="font-semibold">{data.rollNumber || '—'}</span></div>
            <div><span className="text-slate-400">Class:</span><br /><span className="font-semibold">{data.className}</span></div>
            <div><span className="text-slate-400">Father's Name:</span><br /><span className="font-semibold">{data.fatherName || '—'}</span></div>
          </div>

          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="p-2 text-left border">Particulars</th>
                <th className="p-2 text-right border">Amount (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border">Fee for {MONTH_NAMES[data.feeMonth-1]} {data.feeYear}</td>
                <td className="p-2 text-right border">{data.totalAmount.toLocaleString()}</td>
              </tr>
              {data.previousBalance > 0 && (
                <tr className="bg-red-50">
                  <td className="p-2 border">Previous Balance (Unpaid)</td>
                  <td className="p-2 text-right border text-red-600">+ {data.previousBalance.toLocaleString()}</td>
                </tr>
              )}
              <tr className="bg-blue-50">
                <td className="p-2 border font-semibold">Total Payable</td>
                <td className="p-2 text-right border font-bold">{(data.totalAmount + data.previousBalance).toLocaleString()}</td>
              </tr>
              <tr className="bg-green-50">
                <td className="p-2 border font-semibold">Amount Paid</td>
                <td className="p-2 text-right border font-bold text-green-700">{data.amountPaid.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="p-2 border font-semibold">Remaining Balance</td>
                <td className="p-2 text-right border font-bold text-amber-600">{data.remainingBalance.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-3 text-xs mt-3">
            <div><span className="text-slate-400">Payment Method:</span><br /><span className="font-semibold">{data.paymentMethod}</span></div>
            <div><span className="text-slate-400">Received By:</span><br /><span className="font-semibold">{data.receivedBy}</span></div>
          </div>

          <div className="text-center text-xs text-slate-400 mt-4 pt-3 border-t">
            This is a computer generated receipt – no signature required.
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-white p-4 border-t flex gap-3">
          <button onClick={handlePrint} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Printer className="w-4 h-4" />
            Print / Save as PDF
          </button>
          <button onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
}