'use client';
import React, { useState, useRef } from 'react';

type CollectionItem = {
  id: number;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  branchName?: string;
  companyName?: string;
  loanId: number;
  loanType?: string;
  frequency?: string;
  tenure?: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  remaining: number;
  penalty: number;
  totalDue: number;
  daysOverdue: number;
  status: string;
};

type RunSheetProps = {
  emis: CollectionItem[];
  companyName?: string;
  onClose: () => void;
};

export default function CollectionRunSheetModal({ emis, companyName = 'LenQredzo Capital Pvt Ltd', onClose }: RunSheetProps) {
  const printRef = useRef<HTMLDivElement>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState<'today' | 'tomorrow' | 'week' | 'all_pending'>('today');
  const [freqFilter, setFreqFilter] = useState<string>('all');
  const [agentName, setAgentName] = useState<string>('Field Agent (Route 1)');

  const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  // Filter items
  const filtered = emis.filter(item => {
    // Only collect on pending, overdue, or partial
    if (item.status === 'paid') return false;

    // Frequency filter
    if (freqFilter !== 'all' && (item.frequency || 'monthly') !== freqFilter) {
      return false;
    }

    const itemDate = new Date(item.dueDate);
    itemDate.setHours(0, 0, 0, 0);

    if (dateFilter === 'today') {
      return itemDate <= today; // Include overdue up to today
    }
    if (dateFilter === 'tomorrow') {
      return itemDate.getTime() === tomorrow.getTime();
    }
    if (dateFilter === 'week') {
      return itemDate <= nextWeek;
    }
    return true; // all_pending
  });

  // Calculate totals
  const totalDemand = filtered.reduce((sum, item) => sum + (item.remaining || item.amount), 0);
  const totalPenalties = filtered.reduce((sum, item) => sum + (item.penalty || 0), 0);
  const totalTarget = totalDemand + totalPenalties;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [
      'Sl No',
      'Customer Name',
      'Phone',
      'Address',
      'Loan ID',
      'Loan Type',
      'Frequency',
      'Due Date',
      'EMI Amount (INR)',
      'Penalty (INR)',
      'Total Due (INR)',
      'Status'
    ];

    const rows = filtered.map((item, idx) => [
      idx + 1,
      `"${item.customerName || ''}"`,
      `"${item.customerPhone || ''}"`,
      `"${(item.customerAddress || '').replace(/"/g, '""')}"`,
      `"LN${1000 + item.loanId}"`,
      `"${item.loanType || ''}"`,
      `"${item.frequency || ''}"`,
      `"${fmtDate(item.dueDate)}"`,
      item.remaining || item.amount,
      item.penalty || 0,
      item.totalDue,
      item.status
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Collection_Run_Sheet_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-run-sheet, #printable-run-sheet * {
            visibility: visible;
          }
          #printable-run-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 16px !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
        }
      `}</style>

      <div style={{
        background: 'white',
        borderRadius: '16px',
        maxWidth: '1100px',
        width: '100%',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Top Control Bar */}
        <div className="no-print" style={{
          padding: '14px 24px',
          background: '#0f172a',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #334155',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <span style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              📋 Morning Field Collection Run Sheet (Vasool List)
            </span>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              {filtered.length} borrower accounts · Target Demand: {fmt(totalTarget)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={handleExportCSV}
              style={{
                background: '#334155',
                color: 'white',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📥 Export CSV
            </button>
            <button
              onClick={handlePrint}
              style={{
                background: '#2563eb',
                color: 'white',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
            >
              🖨️ Print Run Sheet (PDF)
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#cbd5e1',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Filters Row (Hidden in Print) */}
        <div className="no-print" style={{
          padding: '12px 24px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>
              Date Range:
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: 'white' }}
            >
              <option value="today">Today & Overdue</option>
              <option value="tomorrow">Tomorrow Only</option>
              <option value="week">This Week (Next 7 Days)</option>
              <option value="all_pending">All Pending & Overdue</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>
              Frequency:
            </label>
            <select
              value={freqFilter}
              onChange={(e) => setFreqFilter(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: 'white' }}
            >
              <option value="all">All Frequencies</option>
              <option value="daily">Daily Market Only (Daily Vasool)</option>
              <option value="weekly">Weekly Only</option>
              <option value="monthly">Monthly Only</option>
            </select>
          </div>

          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>
              Assigned Field Agent / Route:
            </label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="e.g. Ramesh (Market Route 1)"
              style={{ width: '100%', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
            />
          </div>
        </div>

        {/* Scrollable Printable Document Container */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#f1f5f9', padding: '24px' }}>
          <div
            id="printable-run-sheet"
            ref={printRef}
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '28px 32px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              border: '1px solid #e2e8f0',
              fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              color: '#0f172a',
              lineHeight: 1.4,
              fontSize: '12px',
              margin: '0 auto'
            }}
          >
            {/* Header Letterhead */}
            <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1e40af', margin: '0 0 2px 0' }}>
                  {companyName}
                </h1>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#0f172a', letterSpacing: '0.5px' }}>
                  DAILY FIELD COLLECTION RUN SHEET (VASOOL LIST)
                </p>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                  Route / Collector: <strong>{agentName}</strong> · Branch: <strong>Headquarters (Hyderabad)</strong>
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block',
                  background: '#eff6ff',
                  color: '#1e40af',
                  border: '1px solid #bfdbfe',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontWeight: 700,
                  fontSize: '11px'
                }}>
                  DATE: {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#64748b' }}>
                  Generated: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST
                </p>
              </div>
            </div>

            {/* Target Summary Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '10px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '10px 14px',
              marginBottom: '16px'
            }}>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Accounts on Route</span>
                <p style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{filtered.length}</p>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Total EMI Demand</span>
                <p style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: 800, color: '#1e40af' }}>{fmt(totalDemand)}</p>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Overdue Late Fees</span>
                <p style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: 800, color: totalPenalties > 0 ? '#dc2626' : '#64748b' }}>{fmt(totalPenalties)}</p>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Total Route Target</span>
                <p style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: 800, color: '#16a34a' }}>{fmt(totalTarget)}</p>
              </div>
            </div>

            {/* Field Table */}
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', background: '#fafafa', borderRadius: '6px', border: '1px dashed #d1d5db' }}>
                No pending or overdue collections matching this filter.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid #cbd5e1' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #94a3b8' }}>
                    <th style={{ padding: '6px 8px', borderRight: '1px solid #cbd5e1', textAlign: 'center', width: '28px' }}>#</th>
                    <th style={{ padding: '6px 8px', borderRight: '1px solid #cbd5e1', textAlign: 'left', width: '140px' }}>Borrower & Contact</th>
                    <th style={{ padding: '6px 8px', borderRight: '1px solid #cbd5e1', textAlign: 'left', width: '170px' }}>Address / Landmark</th>
                    <th style={{ padding: '6px 8px', borderRight: '1px solid #cbd5e1', textAlign: 'center', width: '70px' }}>Loan A/C</th>
                    <th style={{ padding: '6px 8px', borderRight: '1px solid #cbd5e1', textAlign: 'center', width: '65px' }}>Due Date</th>
                    <th style={{ padding: '6px 8px', borderRight: '1px solid #cbd5e1', textAlign: 'right', width: '70px' }}>EMI (₹)</th>
                    <th style={{ padding: '6px 8px', borderRight: '1px solid #cbd5e1', textAlign: 'right', width: '60px' }}>Late Fee</th>
                    <th style={{ padding: '6px 8px', borderRight: '1px solid #cbd5e1', textAlign: 'right', width: '75px' }}>Total Due</th>
                    <th style={{ padding: '6px 8px', borderRight: '1px solid #cbd5e1', textAlign: 'center', width: '85px', background: '#fef3c7' }}>Collected (₹)</th>
                    <th style={{ padding: '6px 8px', borderRight: '1px solid #cbd5e1', textAlign: 'center', width: '85px' }}>Mode</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', width: '95px' }}>Customer Sign</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? 'white' : '#fcfcfd' }}>
                      <td style={{ padding: '6px 8px', borderRight: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                      <td style={{ padding: '6px 8px', borderRight: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.customerName}</div>
                        <div style={{ color: '#475569', fontSize: '10px' }}>📞 +91 {item.customerPhone || '—'}</div>
                      </td>
                      <td style={{ padding: '6px 8px', borderRight: '1px solid #e2e8f0', color: '#334155', fontSize: '10px' }}>
                        {item.customerAddress || 'Address on record'}
                      </td>
                      <td style={{ padding: '6px 8px', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, color: '#1e40af' }}>LN{1000 + item.loanId}</div>
                        <div style={{ fontSize: '9px', textTransform: 'capitalize', color: '#64748b' }}>{item.frequency || 'mo'}</div>
                      </td>
                      <td style={{ padding: '6px 8px', borderRight: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 500 }}>
                        {fmtDate(item.dueDate)}
                        {item.daysOverdue > 0 && (
                          <div style={{ fontSize: '9px', color: '#dc2626', fontWeight: 700 }}>{item.daysOverdue}d late</div>
                        )}
                      </td>
                      <td style={{ padding: '6px 8px', borderRight: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600 }}>
                        {fmt(item.remaining || item.amount)}
                      </td>
                      <td style={{ padding: '6px 8px', borderRight: '1px solid #e2e8f0', textAlign: 'right', color: item.penalty > 0 ? '#dc2626' : '#94a3b8', fontWeight: item.penalty > 0 ? 700 : 400 }}>
                        {item.penalty > 0 ? fmt(item.penalty) : '—'}
                      </td>
                      <td style={{ padding: '6px 8px', borderRight: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                        {fmt(item.totalDue)}
                      </td>
                      {/* Physical pen entry box */}
                      <td style={{ padding: '4px 6px', borderRight: '1px solid #e2e8f0', textAlign: 'center', background: '#fffbeb' }}>
                        <div style={{ height: '24px', border: '1px dashed #d97706', borderRadius: '4px', background: 'white' }}></div>
                      </td>
                      {/* Mode selection tick boxes */}
                      <td style={{ padding: '4px 6px', borderRight: '1px solid #e2e8f0', textAlign: 'center', fontSize: '10px' }}>
                        <span style={{ display: 'inline-block', marginRight: '6px' }}>[ ] Cash</span>
                        <span>[ ] UPI</span>
                      </td>
                      {/* Customer Signature Box */}
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                        <div style={{ height: '24px', borderBottom: '1px solid #94a3b8' }}></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Handover & Reconciliation Signatures */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '20px',
              marginTop: '28px',
              paddingTop: '16px',
              borderTop: '1px dashed #94a3b8',
              alignItems: 'flex-end'
            }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                  Total Physical Cash Collected:
                </span>
                <div style={{ borderBottom: '1px solid #0f172a', height: '26px', fontSize: '13px', fontWeight: 700, paddingLeft: '4px' }}>
                  ₹ 
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '1px solid #0f172a', height: '26px', marginBottom: '4px' }}></div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '11px' }}>{agentName}</p>
                <p style={{ margin: 0, fontSize: '9px', color: '#64748b' }}>Collection Agent Signature & Date</p>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '1px solid #0f172a', height: '26px', marginBottom: '4px' }}></div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '11px' }}>Branch Cashier / Manager</p>
                <p style={{ margin: 0, fontSize: '9px', color: '#64748b' }}>Cash Verified & Handover Accepted</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
