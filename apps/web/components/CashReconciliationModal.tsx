'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { API_URL } from '@/lib/api';

type CashReconciliationModalProps = {
  companyName?: string;
  branchName?: string;
  onClose: () => void;
};

export default function CashReconciliationModal({
  companyName = 'LenQredzo Capital Pvt Ltd',
  branchName = 'Headquarters Branch',
  onClose
}: CashReconciliationModalProps) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Default to today's date in local YYYY-MM-DD format
  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Cash drawer input states
  const [openingFloat, setOpeningFloat] = useState<number>(0);
  const [cashDisbursed, setCashDisbursed] = useState<number>(0);
  const [pettyExpenses, setPettyExpenses] = useState<number>(0);
  const [cashierNotes, setCashierNotes] = useState<string>('');

  // Physical denomination note counts
  const [denominations, setDenominations] = useState<{ [key: string]: number }>({
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    coins: 0
  });

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/loans/payments/all`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPayments(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => '₹' + Math.round(Number(n || 0)).toLocaleString('en-IN');
  const fmtTime = (d: string) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  // Filter payments for the selected calendar date
  const dayPayments = useMemo(() => {
    return payments.filter(p => {
      const pDate = p.paidAt || p.createdAt;
      if (!pDate) return false;
      const d = new Date(pDate);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const pDateStr = `${year}-${month}-${day}`;
      return pDateStr === selectedDate;
    });
  }, [payments, selectedDate]);

  // Aggregate collections by mode
  const cashPayments = useMemo(() => dayPayments.filter(p => (p.method || '').toLowerCase() === 'cash'), [dayPayments]);
  const digitalPayments = useMemo(() => dayPayments.filter(p => (p.method || '').toLowerCase() !== 'cash'), [dayPayments]);

  const totalCashCollected = cashPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalDigitalCollected = digitalPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalCollectionsAllModes = totalCashCollected + totalDigitalCollected;

  // Expected Physical Cash in Counter
  const expectedClosingCash = (openingFloat + totalCashCollected) - cashDisbursed - pettyExpenses;

  // Actual Physical Cash Counted
  const physicalCashCounted =
    (denominations[500] * 500) +
    (denominations[200] * 200) +
    (denominations[100] * 100) +
    (denominations[50] * 50) +
    (denominations[20] * 20) +
    (denominations[10] * 10) +
    (Number(denominations.coins) || 0);

  const variance = physicalCashCounted - expectedClosingCash;

  const handleDenomChange = (denom: string, val: string) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setDenominations(prev => ({ ...prev, [denom]: num }));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['#', 'Time', 'Loan Ref', 'Customer Name', 'Receipt / Ref #', 'Payment Mode', 'Amount (INR)'];
    const rows = dayPayments.map((p, idx) => [
      idx + 1,
      `"${fmtTime(p.paidAt || p.createdAt)}"`,
      `"LN${1000 + p.loanId}"`,
      `"${p.loan?.customer?.name || 'Customer'}"`,
      `"${p.reference || p.razorpayPaymentId || `RCP-${p.id}`}"`,
      `"${(p.method || 'CASH').toUpperCase()}"`,
      p.amount
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' +
      [
        `Day-End Counter Cash Drawer & Tally Sheet - ${companyName}`,
        `Branch: ${branchName}`,
        `Reconciliation Date: ${selectedDate}`,
        '',
        `Opening Cash Float:,${openingFloat}`,
        `Total Cash Collections:,${totalCashCollected}`,
        `Total Digital Collections (UPI/Bank):,${totalDigitalCollected}`,
        `Cash Disbursed:,${cashDisbursed}`,
        `Counter Petty Expenses:,${pettyExpenses}`,
        `Expected Closing Cash:,${expectedClosingCash}`,
        `Physical Cash Counted:,${physicalCashCounted}`,
        `Reconciliation Variance:,${variance}`,
        '',
        headers.join(','),
        ...rows.map(e => e.join(','))
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Cash_Tally_${branchName.replace(/\s+/g, '_')}_${selectedDate}.csv`);
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
          #printable-cash-reconciliation, #printable-cash-reconciliation * {
            visibility: visible;
          }
          #printable-cash-reconciliation {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div style={{
        background: 'white',
        borderRadius: '16px',
        maxWidth: '960px',
        width: '100%',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Top Control Bar (Hidden on Print) */}
        <div className="no-print" style={{
          padding: '14px 24px',
          background: '#0f172a',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #1e293b'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>💵</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                Day-End Counter Cash Drawer & Tally Sheet (Roznamcha)
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                Cashier handover · Physical denomination count · Closing cash reconciliation
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleExportCSV}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#334155',
                color: 'white',
                border: 'none',
                padding: '7px 14px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
              title="Export Cash Tally to Excel CSV"
            >
              📥 Export CSV
            </button>

            <button
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                padding: '7px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.3)'
              }}
            >
              🖨️ Print Day-End Tally (PDF)
            </button>

            <button
              onClick={onClose}
              style={{
                background: '#1e293b',
                color: '#cbd5e1',
                border: 'none',
                padding: '7px 12px',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Date Filter & Branch Bar (Hidden on Print) */}
        <div className="no-print" style={{
          padding: '10px 24px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: '#475569', fontWeight: 600 }}>Tally Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: 'white',
                fontSize: '13px',
                fontWeight: 600,
                color: '#0f172a'
              }}
            />
            {selectedDate !== todayStr && (
              <button
                onClick={() => setSelectedDate(todayStr)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Reset to Today
              </button>
            )}
          </div>

          <div style={{ color: '#64748b', fontSize: '12px' }}>
            <strong>{dayPayments.length}</strong> collections recorded on {fmtDate(selectedDate)}
          </div>
        </div>

        {/* Scrollable Printable Statement Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '28px' }}>
          <div id="printable-cash-reconciliation" style={{
            maxWidth: '900px',
            margin: '0 auto',
            background: 'white',
            color: '#0f172a',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
          }}>

            {/* Official Letterhead */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '2.5px solid #0f172a',
              paddingBottom: '14px',
              marginBottom: '20px'
            }}>
              <div>
                <h1 style={{
                  margin: 0,
                  fontSize: '22px',
                  fontWeight: 800,
                  color: '#0f172a',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {companyName}
                </h1>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#475569', fontWeight: 600 }}>
                  {branchName} · Daily Cash Drawer & Cashier Handover Register
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                  Statutory Cash Settlement & Counter Balance Audit Under RBI NBFC Standards
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block',
                  background: '#0f172a',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '11px',
                  padding: '3px 10px',
                  borderRadius: '4px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  marginBottom: '5px'
                }}>
                  Day-End Tally Sheet
                </span>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                  Date: <span style={{ fontWeight: 800, color: '#0f172a' }}>{fmtDate(selectedDate)}</span>
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                  Reconciliation Time: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </p>
              </div>
            </div>

            {/* Reconciliation Status Badge Banner */}
            <div style={{
              background: variance === 0 ? '#f0fdf4' : variance > 0 ? '#fffbeb' : '#fef2f2',
              border: `1.5px solid ${variance === 0 ? '#86efac' : variance > 0 ? '#fde68a' : '#fca5a5'}`,
              borderRadius: '8px',
              padding: '12px 18px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: 800,
                  color: variance === 0 ? '#166534' : variance > 0 ? '#92400e' : '#991b1b',
                  textTransform: 'uppercase'
                }}>
                  {variance === 0
                    ? '✓ PERFECT TALLY — ZERO VARIANCE (BALANCED)'
                    : variance > 0
                    ? `⚠️ CASH OVERAGE / SURPLUS DETECTED: +${fmt(variance)}`
                    : `🚨 CASH SHORTAGE / DEFICIT DETECTED: -${fmt(Math.abs(variance))}`
                  }
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#475569' }}>
                  Expected Cash: <strong>{fmt(expectedClosingCash)}</strong> | Counted Cash: <strong>{fmt(physicalCashCounted)}</strong>
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: variance === 0 ? '#166534' : variance > 0 ? '#b45309' : '#dc2626'
                }}>
                  {variance === 0 ? '₹0 Difference' : (variance > 0 ? `+${fmt(variance)}` : `-${fmt(Math.abs(variance))}`)}
                </div>
              </div>
            </div>

            {/* Core Financial KPI Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Opening Cash Float</div>
                <div className="no-print" style={{ marginTop: '4px' }}>
                  <input
                    type="number"
                    value={openingFloat || ''}
                    placeholder="0"
                    onChange={(e) => setOpeningFloat(Math.max(0, Number(e.target.value) || 0))}
                    style={{
                      width: '100%',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#0f172a',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div className="only-print" style={{ display: 'none', fontSize: '16px', fontWeight: 800, marginTop: '4px' }}>
                  {fmt(openingFloat)}
                </div>
              </div>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>Cash Inflow (Collected)</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
                  {fmt(totalCashCollected)}
                </div>
                <div style={{ fontSize: '10px', color: '#166534', marginTop: '2px' }}>
                  {cashPayments.length} cash receipts
                </div>
              </div>

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600 }}>Digital Collections (UPI/Bank)</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#1d4ed8', marginTop: '4px' }}>
                  {fmt(totalDigitalCollected)}
                </div>
                <div style={{ fontSize: '10px', color: '#1e40af', marginTop: '2px' }}>
                  {digitalPayments.length} digital receipts
                </div>
              </div>

              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: 600 }}>Disbursed / Petty Cash Out</div>
                <div className="no-print" style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  <input
                    type="number"
                    value={pettyExpenses || ''}
                    placeholder="Expenses"
                    title="Petty office/counter expenses"
                    onChange={(e) => setPettyExpenses(Math.max(0, Number(e.target.value) || 0))}
                    style={{
                      width: '100%',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#991b1b',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div className="only-print" style={{ display: 'none', fontSize: '16px', fontWeight: 800, color: '#991b1b', marginTop: '4px' }}>
                  {fmt(pettyExpenses + cashDisbursed)}
                </div>
              </div>
            </div>

            {/* Denomination Sheet & Cash Summary Split Layout */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: '20px',
              marginBottom: '24px'
            }}>

              {/* Physical Denominations Table */}
              <div style={{
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
                padding: '14px 16px',
                background: '#ffffff'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                  borderBottom: '1px solid #e2e8f0',
                  paddingBottom: '8px'
                }}>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' }}>
                    Physical Cash Denomination Count
                  </h4>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Currency Notes (INR)</span>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>Note Value</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>Count (Pcs)</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>Subtotal (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[500, 200, 100, 50, 20, 10].map(val => {
                      const count = denominations[val] || 0;
                      const subtotal = count * val;
                      return (
                        <tr key={val} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0f172a' }}>
                            ₹{val}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <input
                              type="number"
                              min="0"
                              value={count === 0 ? '' : count}
                              placeholder="0"
                              onChange={(e) => handleDenomChange(String(val), e.target.value)}
                              style={{
                                width: '70px',
                                textAlign: 'center',
                                padding: '3px 6px',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                fontSize: '12px',
                                fontWeight: 600
                              }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: subtotal > 0 ? '#0f172a' : '#94a3b8' }}>
                            {fmt(subtotal)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0f172a' }}>
                        Coins (All)
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          value={denominations.coins === 0 ? '' : denominations.coins}
                          placeholder="0"
                          onChange={(e) => handleDenomChange('coins', e.target.value)}
                          style={{
                            width: '70px',
                            textAlign: 'center',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                            fontWeight: 600
                          }}
                        />
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>
                        {fmt(denominations.coins || 0)}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid #0f172a' }}>
                      <td colSpan={2} style={{ padding: '8px', color: '#0f172a' }}>
                        TOTAL PHYSICAL CASH COUNTED:
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#0f172a', fontSize: '13px' }}>
                        {fmt(physicalCashCounted)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Cash Reconciliation Calculation & Remarks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  background: '#f8fafc'
                }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' }}>
                    Tally Calculation Summary
                  </h4>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0', borderBottom: '1px dashed #e2e8f0' }}>
                    <span style={{ color: '#475569' }}>Opening Counter Float (+)</span>
                    <span style={{ fontWeight: 600 }}>{fmt(openingFloat)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0', borderBottom: '1px dashed #e2e8f0' }}>
                    <span style={{ color: '#166534' }}>Total Physical Cash Inflow (+)</span>
                    <span style={{ fontWeight: 700, color: '#166534' }}>{fmt(totalCashCollected)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0', borderBottom: '1px dashed #e2e8f0' }}>
                    <span style={{ color: '#991b1b' }}>Petty Expenses / Outflow (-)</span>
                    <span style={{ fontWeight: 600, color: '#991b1b' }}>{fmt(pettyExpenses)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '8px 0 4px', fontWeight: 800, borderBottom: '2px solid #0f172a' }}>
                    <span style={{ color: '#0f172a' }}>Expected Closing Cash</span>
                    <span style={{ color: '#0f172a' }}>{fmt(expectedClosingCash)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0 4px', fontWeight: 800 }}>
                    <span style={{ color: '#0f172a' }}>Actual Cash Counted</span>
                    <span style={{ color: '#0f172a' }}>{fmt(physicalCashCounted)}</span>
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    padding: '8px 10px',
                    marginTop: '6px',
                    borderRadius: '6px',
                    background: variance === 0 ? '#dcfce7' : variance > 0 ? '#fef3c7' : '#fee2e2',
                    fontWeight: 800,
                    color: variance === 0 ? '#15803d' : variance > 0 ? '#b45309' : '#b91c1c'
                  }}>
                    <span>Net Reconciliation Variance</span>
                    <span>{variance === 0 ? '₹0 (Exact Match)' : (variance > 0 ? `+${fmt(variance)} (Overage)` : `-${fmt(Math.abs(variance))} (Shortage)`)}</span>
                  </div>
                </div>

                {/* Cashier Closing Notes */}
                <div style={{
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  background: 'white'
                }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Cashier Closing Notes & Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={cashierNotes}
                    onChange={(e) => setCashierNotes(e.target.value)}
                    placeholder="E.g., All physical cash tallied and locked in branch safe. Petty cash ₹250 spent on office supplies with voucher attached."
                    style={{
                      width: '100%',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '8px',
                      fontSize: '12px',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Itemized Collections List for the Day */}
            <div style={{
              border: '1.5px solid #cbd5e1',
              borderRadius: '8px',
              overflow: 'hidden',
              marginBottom: '24px'
            }}>
              <div style={{
                background: '#0f172a',
                color: 'white',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>ITEMIZED COLLECTIONS REGISTER — {fmtDate(selectedDate)}</span>
                <span>Total Received: {fmt(totalCollectionsAllModes)}</span>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', color: '#334155', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', width: '30px' }}>#</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', width: '75px' }}>Time</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', width: '70px' }}>Loan Ref</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Borrower Name</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', width: '110px' }}>Receipt / Ref #</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', width: '70px' }}>Mode</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', width: '90px' }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {dayPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>
                        No payment collections recorded for this date.
                      </td>
                    </tr>
                  ) : (
                    dayPayments.map((p, idx) => {
                      const isCash = (p.method || '').toLowerCase() === 'cash';
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                          <td style={{ padding: '6px 8px', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{fmtTime(p.paidAt || p.createdAt)}</td>
                          <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontWeight: 600, color: '#1e3a8a' }}>
                            LN{1000 + p.loanId}
                          </td>
                          <td style={{ padding: '6px 8px', fontWeight: 600 }}>
                            {p.loan?.customer?.name || 'Customer'}
                          </td>
                          <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: '10px', color: '#64748b' }}>
                            {p.reference || p.razorpayPaymentId || `RCP-${p.id}`}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 700,
                              background: isCash ? '#fef3c7' : '#e0e7ff',
                              color: isCash ? '#92400e' : '#3730a3'
                            }}>
                              {(p.method || 'CASH').toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: isCash ? '#166534' : '#1e40af' }}>
                            {fmt(p.amount)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Official Signatures Block */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '24px',
              marginTop: '24px',
              paddingTop: '16px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '40px' }}></div>
                <div style={{ borderTop: '1.5px dashed #64748b', paddingTop: '6px' }}>
                  <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>Counter Cashier</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Cash Prepared & Handed Over</div>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '40px' }}></div>
                <div style={{ borderTop: '1.5px dashed #64748b', paddingTop: '6px' }}>
                  <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>Head Cashier / Auditor</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Denominations Verified</div>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '40px' }}></div>
                <div style={{ borderTop: '1.5px dashed #64748b', paddingTop: '6px' }}>
                  <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>Branch Manager</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Approved & Safekept (Seal)</div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
