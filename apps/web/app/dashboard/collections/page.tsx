'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import FaceCaptureModal from '@/components/FaceCaptureModal';
import CollectionRunSheetModal from '@/components/CollectionRunSheetModal';
import CashReconciliationModal from '@/components/CashReconciliationModal';
import BulkCollectionModal from '@/components/BulkCollectionModal';
import PreDebitNotificationModal from '@/components/PreDebitNotificationModal';
import BranchVaultDenominationModal from '@/components/BranchVaultDenominationModal';
import ThermalReceiptModal from '@/components/ThermalReceiptModal';
import WhatsAppDueReminderModal from '@/components/WhatsAppDueReminderModal';
import { getAuthUser, can } from '@/lib/authUser';
import { API_URL } from '@/lib/api';

export default function CollectionsPage() {
  const [emis, setEmis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showRunSheet, setShowRunSheet] = useState(false);
  const [showCashReconciliation, setShowCashReconciliation] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showPreDebitModal, setShowPreDebitModal] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [showWhatsAppReminderModal, setShowWhatsAppReminderModal] = useState(false);
  const [thermalReceiptData, setThermalReceiptData] = useState<any | null>(null);

  // Collect dialog state
  const [dialog, setDialog] = useState<any>(null); // { emi, collectPenalty }
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [waivePenalty, setWaivePenalty] = useState(false);
  const [waiveReason, setWaiveReason] = useState('');
  const [me, setMe] = useState<any>(null);
  const [showPaymentCapture, setShowPaymentCapture] = useState(false);
  const [pendingPaymentData, setPendingPaymentData] = useState<any>(null);
  const [runningAccrual, setRunningAccrual] = useState(false);
  const [accrualResult, setAccrualResult] = useState<any>(null);

  useEffect(() => { fetchCollections(); setMe(getAuthUser()); }, []);

  const handleRunAccrual = async () => {
    if (!confirm('Run Automated Midnight Overdue & Late Fee Accrual now?\\n\\nThis will scan all active loans, mark past-due EMIs as "Overdue", calculate fixed/daily late penalty fees, and log an audit record.')) return;
    setRunningAccrual(true);
    try {
      const res = await fetch(`${API_URL}/api/loans/cron/accrue-penalties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        }
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.message || 'Failed to execute penalty accrual');
      } else {
        const data = await res.json();
        setAccrualResult(data);
        await fetchCollections();
      }
    } catch (err) {
      console.error('Accrual error:', err);
      alert('Network error while running accrual.');
    } finally {
      setRunningAccrual(false);
    }
  };

  const fetchCollections = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/loans/collections/all`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      setEmis(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const openDialog = (emi: any, collectPenalty: boolean) => {
    setDialog({ emi, collectPenalty });
    setMethod('cash');
    setReference('');
    setPayAmount(String(emi.remaining ?? emi.amount));
    setDialogError('');
    setWaivePenalty(false);
    setWaiveReason('');
  };

  const closeDialog = () => {
    setDialog(null);
    setSubmitting(false);
    setDialogError('');
    setShowPaymentCapture(false);
    setPendingPaymentData(null);
  };

  const canWaive = can(me, 'penalty:waive');

  const submitCollection = async () => {
    if (!dialog) return;
    const ref = reference.trim();
    const amt = Math.round(Number(payAmount));
    const remaining = dialog.emi.remaining ?? dialog.emi.amount;

    if (!amt || amt <= 0) { setDialogError('Please enter a valid amount.'); return; }
    if (amt > remaining) { setDialogError('Amount cannot exceed the remaining balance of ₹' + remaining.toLocaleString('en-IN') + '.'); return; }
    if (method !== 'cash' && !ref) {
      setDialogError('A reference / transaction ID is required for ' + method.toUpperCase() + ' payments.');
      return;
    }
    if (waivePenalty && !waiveReason.trim()) { setDialogError('Please enter a reason for waiving the penalty.'); return; }

    const clearsEmi = amt >= remaining;
    setSubmitting(true);
    setDialogError('');
    setPendingPaymentData({
      emiId: dialog.emi.id,
      payload: {
        amount: amt,
        collectPenalty: dialog.collectPenalty && clearsEmi,
        method,
        reference: ref,
        waivePenalty: waivePenalty && clearsEmi,
        waiveReason: waiveReason.trim()
      }
    });
    setShowPaymentCapture(true);
  };

  const submitCollectionWithPhoto = async (photoBase64: string) => {
    if (!pendingPaymentData) return;
    setShowPaymentCapture(false);
    try {
      const res = await fetch(`${API_URL}/api/loans/emi/${pendingPaymentData.emiId}/pay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ ...pendingPaymentData.payload, verificationPhoto: photoBase64 })
      });
      const data = await res.json();
      if (!res.ok) {
        setDialogError(data.message || 'Failed to record payment');
        setSubmitting(false);
        setPendingPaymentData(null);
        return;
      }
      closeDialog();
      fetchCollections();
    } catch (err) {
      console.error(err);
      setDialogError('Server error. Please try again.');
      setSubmitting(false);
      setPendingPaymentData(null);
    }
  };

  const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const badge = (status: string) => {
    if (status === 'paid') return { background: '#dcfce7', color: '#16a34a' };
    if (status === 'overdue') return { background: '#fee2e2', color: '#dc2626' };
    if (status === 'partial') return { background: '#dbeafe', color: '#1e40af' };
    return { background: '#fef3c7', color: '#d97706' };
  };

  const totalPending = emis.filter(e => e.status !== 'paid').reduce((s, e) => s + (e.remaining ?? e.amount), 0);
  const totalPenalty = emis.filter(e => e.status === 'overdue').reduce((s, e) => s + (e.penalty || 0), 0);
  const paidCount = emis.filter(e => e.status === 'paid').length;
  const overdueCount = emis.filter(e => e.status === 'overdue').length;
  const pendingCount = emis.filter(e => e.status === 'pending').length;
  const partialCount = emis.filter(e => e.status === 'partial').length;

  let filtered = [...emis];
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(e =>
      (e.customerName || '').toLowerCase().includes(q) ||
      ('ln' + (1000 + e.loanId)).includes(q)
    );
  }
  if (statusFilter !== 'all') filtered = filtered.filter(e => e.status === statusFilter);
  filtered.sort((a, b) => {
    const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    return sortOrder === 'asc' ? diff : -diff;
  });

  const tabs = [
    { label: 'All', value: 'all', count: emis.length },
    { label: 'Paid', value: 'paid', count: paidCount },
    { label: 'Partial', value: 'partial', count: partialCount },
    { label: 'Pending', value: 'pending', count: pendingCount },
    { label: 'Overdue', value: 'overdue', count: overdueCount },
  ];

  const inp = { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as any };
  const lbl = { display: 'block' as any, fontSize: '13px', fontWeight: '500' as any, marginBottom: '6px', color: '#374151' };

  const dialogRemaining = dialog ? (dialog.emi.remaining ?? dialog.emi.amount) : 0;
  const dialogAmt = Math.round(Number(payAmount)) || 0;
  const isPartial = dialog ? (dialogAmt > 0 && dialogAmt < dialogRemaining) : false;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '24px' }}>
        {/* Clean, Modern Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                Collections
              </h2>
              <span style={{ fontSize: '12px', background: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontWeight: '700', border: '1px solid #bfdbfe' }}>
                Daily Ledger
              </span>
            </div>
            <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '13.5px' }}>
              Track due installments, collect EMIs, and monitor overdue accounts
            </p>
          </div>

          {/* Decluttered Actions Toolbar - Purely Collections Specific */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowRunSheet(true)}
              style={{
                height: '38px',
                background: '#1e40af',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0 16px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 3px rgba(30, 64, 175, 0.25)',
                transition: 'all 0.15s ease'
              }}
              title="Print morning field collection sheet (Vasool List) for recovery agents"
            >
              <span>📋</span>
              <span>Print Vasool List</span>
            </button>

            <a
              href="/dashboard/cash-register"
              style={{
                height: '38px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0 14px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#334155',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}
              title="View physical vault denomination counter and daily cash register"
            >
              <span>🏦</span>
              <span>Vault & Cash Register</span>
            </a>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Total EMI Pending', value: fmt(totalPending), color: '#0f172a', note: `${pendingCount + overdueCount} EMIs due`, badge: null },
            { label: 'Total Penalty Due', value: fmt(totalPenalty), color: '#dc2626', note: 'Late fee accruals', badge: overdueCount > 0 ? `${overdueCount} accounts` : null },
            { label: 'Overdue EMIs', value: overdueCount, color: '#dc2626', note: 'Requires doorstep follow-up', badge: overdueCount > 0 ? 'Action Needed' : null },
            { label: 'Collected EMIs', value: paidCount, color: '#16a34a', note: 'Recovered & verified', badge: `${partialCount} partial` },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <p style={{ color: '#64748b', fontSize: '12px', margin: 0, fontWeight: 600 }}>{s.label}</p>
                {s.badge && (
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: s.color === '#dc2626' ? '#fee2e2' : '#f0fdf4', color: s.color }}>
                    {s.badge}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 4px', color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
              <p style={{ color: '#94a3af', fontSize: '11px', margin: 0 }}>{s.note}</p>
            </div>
          ))}
        </div>

        {/* Table Container */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontWeight: '700', margin: 0, fontSize: '15px', color: '#0f172a' }}>EMI Collections</h3>
                <span style={{ fontSize: '12px', background: '#f1f5f9', color: '#475569', padding: '1px 8px', borderRadius: '10px', fontWeight: 600 }}>
                  {filtered.length} records
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="🔍 Search customer or loan ID..."
                  style={{ height: '38px', padding: '0 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', width: '260px', boxSizing: 'border-box', outline: 'none' }} />
                <button onClick={() => setSortOrder(s => s === 'asc' ? 'desc' : 'asc')}
                  style={{ height: '38px', padding: '0 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'white', color: '#334155', whiteSpace: 'nowrap', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span>📅</span>
                  <span>{sortOrder === 'asc' ? 'Oldest Due ↑' : 'Newest Due ↓'}</span>
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {tabs.map(tab => {
                const active = statusFilter === tab.value;
                return (
                  <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
                    style={{
                      height: '32px',
                      padding: '0 14px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: active ? '#1e40af' : '#e2e8f0',
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      fontWeight: active ? 700 : 500,
                      background: active ? '#1e40af' : '#ffffff',
                      color: active ? '#ffffff' : '#475569',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}>
                    <span>{tab.label}</span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '10px',
                      background: active ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                      color: active ? '#ffffff' : '#64748b'
                    }}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading collections ledger...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No records found matching current filters.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Customer</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Loan Ref</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Due Date</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>EMI Amount</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Paid</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Penalty</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Due</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Status</th>
                    <th style={{ textAlign: 'right', padding: '12px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600, minWidth: '160px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e: any) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{e.customerName}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1e40af', fontWeight: 600 }}>LN{1000 + e.loanId}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>{fmtDate(e.dueDate)}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, textAlign: 'right' }}>{fmt(e.amount)}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: e.paidAmount > 0 ? '#16a34a' : '#94a3b8', fontWeight: e.paidAmount > 0 ? 600 : 400, textAlign: 'right' }}>
                        {e.paidAmount > 0 ? fmt(e.paidAmount) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: e.penalty > 0 ? '#dc2626' : '#94a3b8', fontWeight: e.penalty > 0 ? 700 : 400, textAlign: 'right' }}>
                        {e.penalty > 0 ? fmt(e.penalty) : '—'}
                        {e.daysOverdue > 0 && <span style={{ display: 'block', fontSize: '10px', color: '#dc2626', fontWeight: 700 }}>{e.daysOverdue}d late</span>}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 800, color: e.penalty > 0 ? '#dc2626' : '#0f172a', textAlign: 'right' }}>
                        {fmt(e.totalDue)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{ ...badge(e.status), padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, textTransform: 'capitalize' }}>
                          {e.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {e.status === 'paid' && (
                          <button
                            onClick={() => setThermalReceiptData({
                              receiptNo: `RCT-${e.id}-${Date.now().toString().slice(-4)}`,
                              date: e.paidAt || new Date().toISOString(),
                              companyName: me?.companyName || 'LenQredzo Capital Pvt Ltd',
                              branchName: me?.branchName || 'Main Branch',
                              collectorName: me?.name || 'Field Officer',
                              borrowerName: e.customerName,
                              borrowerPhone: e.customerPhone,
                              loanRef: `LN${1000 + e.loanId}`,
                              emiAmount: e.paidAmount || e.amount,
                              penaltyAmount: e.penalty || 0,
                              totalPaid: (e.paidAmount || e.amount) + (e.penalty || 0),
                              remainingBalance: 0,
                              paymentMethod: e.paymentMethod || 'cash',
                              referenceUtr: e.reference || ''
                            })}
                            style={{
                              height: '30px',
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              color: '#0f172a',
                              padding: '0 10px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                            }}
                            title="Print 58mm Bluetooth thermal POS receipt slip"
                          >
                            <span>🖨️</span>
                            <span>Slip</span>
                          </button>
                        )}
                        {e.status !== 'paid' && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            {e.penalty > 0 ? (
                              <>
                                <button onClick={() => openDialog(e, true)}
                                  style={{
                                    height: '30px',
                                    background: '#dc2626',
                                    color: 'white',
                                    border: 'none',
                                    padding: '0 10px',
                                    borderRadius: '6px',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    boxShadow: '0 1px 2px rgba(220, 38, 38, 0.2)'
                                  }}>
                                  Collect + ₹{e.penalty}
                                </button>
                                <button onClick={() => openDialog(e, false)}
                                  style={{
                                    height: '30px',
                                    background: '#ffffff',
                                    color: '#1e40af',
                                    border: '1px solid #bfdbfe',
                                    padding: '0 9px',
                                    borderRadius: '6px',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                  }}>
                                  EMI Only
                                </button>
                              </>
                            ) : (
                              <button onClick={() => openDialog(e, false)}
                                style={{
                                  height: '30px',
                                  background: '#1e40af',
                                  color: 'white',
                                  border: 'none',
                                  padding: '0 16px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  boxShadow: '0 1px 2px rgba(30, 64, 175, 0.2)'
                                }}>
                                Collect
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Collect dialog */}
      {dialog && (
        <div onClick={closeDialog} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div onClick={ev => ev.stopPropagation()} style={{ background: 'white', borderRadius: '12px', width: '440px', maxWidth: '100%', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '700', color: '#111827' }}>Collect Payment</h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#6b7280' }}>
              {dialog.emi.customerName} · LN{1000 + dialog.emi.loanId}
            </p>

            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: '#6b7280' }}>EMI Amount</span>
                <span style={{ fontWeight: '600' }}>{fmt(dialog.emi.amount)}</span>
              </div>
              {dialog.emi.paidAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span style={{ color: '#6b7280' }}>Already Paid</span>
                  <span style={{ fontWeight: '600', color: '#16a34a' }}>{fmt(dialog.emi.paidAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#6b7280' }}>Remaining</span>
                <span style={{ fontWeight: '700', color: '#0369a1' }}>{fmt(dialogRemaining)}</span>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={lbl}>Amount Paying Now</label>
              <input type="number" value={payAmount}
                onChange={ev => { setPayAmount(ev.target.value); setDialogError(''); }}
                style={inp} />
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <button onClick={() => setPayAmount(String(dialogRemaining))}
                  style={{ flex: 1, padding: '6px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>
                  Full ({fmt(dialogRemaining)})
                </button>
                <button onClick={() => setPayAmount(String(Math.round(dialogRemaining / 2)))}
                  style={{ flex: 1, padding: '6px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>
                  Half
                </button>
              </div>
              {isPartial && (
                <p style={{ fontSize: '12px', color: '#1e40af', margin: '8px 0 0' }}>
                  ℹ️ Partial payment — ₹{(dialogRemaining - dialogAmt).toLocaleString('en-IN')} will remain due on this EMI.
                  {dialog.collectPenalty ? ' Penalty will be collected later when the EMI is fully cleared.' : ''}
                </p>
              )}
            </div>
              {dialog.collectPenalty && dialog.emi.penalty > 0 && canWaive && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#92400e' }}>
                  <input type="checkbox" checked={waivePenalty} onChange={ev => { setWaivePenalty(ev.target.checked); setDialogError(''); }} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  Waive the ₹{Number(dialog.emi.penalty).toLocaleString('en-IN')} penalty (manager approval)
                </label>
                {waivePenalty && (
                  <div style={{ marginTop: '10px' }}>
                    <input value={waiveReason} onChange={ev => { setWaiveReason(ev.target.value); setDialogError(''); }}
                      placeholder="Reason for waiving (required) — e.g. family medical emergency"
                      style={{ ...inp, background: 'white' }} />
                    <p style={{ fontSize: '11px', color: '#92400e', margin: '6px 0 0' }}>
                      Applies only when the EMI is fully cleared. This action is logged.
                    </p>
                  </div>
                )}
              </div>
            )}
            <div style={{ marginBottom: '14px' }}>
              <label style={lbl}>Payment Method</label>
              <select value={method} onChange={ev => { setMethod(ev.target.value); setDialogError(''); }} style={inp}>
                <option value="cash">Cash (hand-to-hand)</option>
                <option value="upi">UPI (Paytm / GPay / PhonePe)</option>
                <option value="bank">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="card">Card</option>
              </select>
            </div>

            {method !== 'cash' && (
              <div style={{ marginBottom: '14px' }}>
                <label style={lbl}>
                  {method === 'upi' ? 'UPI Reference / Txn ID' : method === 'bank' ? 'Bank Ref / UTR Number' : method === 'cheque' ? 'Cheque Number' : 'Card Txn Reference'} *
                </label>
                <input value={reference} onChange={ev => { setReference(ev.target.value); setDialogError(''); }}
                  placeholder="Enter the reference from the receipt / SMS"
                  style={inp} />
              </div>
            )}

            {method === 'cash' && (
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#92400e' }}>
                  ⚠️ Cash has no digital proof — it will be recorded as <b>unverified</b>.
                </p>
              </div>
            )}

            {dialogError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' }}>
                {dialogError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={submitCollection} disabled={submitting}
                style={{ flex: 1, background: '#1e40af', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Recording...' : (isPartial ? 'Record Partial Payment' : 'Confirm Payment')}
              </button>
              <button onClick={closeDialog} disabled={submitting}
                style={{ background: 'white', color: '#374151', border: '1px solid #d1d5db', padding: '10px 18px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showPaymentCapture && (
        <FaceCaptureModal
          title="Verify before collecting payment"
          message="A quick photo is logged with every payment collection."
          onCapture={submitCollectionWithPhoto}
          onCancel={() => {
            setShowPaymentCapture(false);
            setPendingPaymentData(null);
            setSubmitting(false);
          }}
        />
      )}
      {showRunSheet && (
        <CollectionRunSheetModal
          emis={emis}
          companyName={me?.companyName || 'LenQredzo Capital Pvt Ltd'}
          onClose={() => setShowRunSheet(false)}
        />
      )}

      {/* Midnight Penalty Accrual Result Modal */}
      {accrualResult && (
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
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '640px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#111827' }}>
                  ⚡ Midnight Penalty & Overdue Accrual Summary
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                  Automated core engine ran at {new Date(accrualResult.runAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              </div>
              <button
                onClick={() => setAccrualResult(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6b7280' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Loans Scanned</p>
                <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{accrualResult.totalLoansChecked}</p>
              </div>
              <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#991b1b', fontWeight: 600 }}>Overdue EMIs Updated</p>
                <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 800, color: '#dc2626' }}>{accrualResult.overdueEmisCount}</p>
              </div>
              <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#1e40af', fontWeight: 600 }}>Penalties Accrued</p>
                <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 800, color: '#2563eb' }}>₹{accrualResult.totalPenaltyAccrued.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {accrualResult.updatedRecords && accrualResult.updatedRecords.length > 0 ? (
              <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <tr>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Borrower</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Loan</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Overdue Days</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Late Fee Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accrualResult.updatedRecords.map((r: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.customerName}</td>
                        <td style={{ padding: '8px 10px', color: '#1e40af' }}>{r.loanRef}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#dc2626' }}>{r.daysOverdue} days</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>+₹{r.penaltyAccruedThisRun}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', color: '#15803d', fontSize: '13px', fontWeight: 500, marginBottom: '20px' }}>
                ✓ All installments are currently in good standing or already accrued. No new overdue penalties required at this time.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setAccrualResult(null)}
                style={{
                  background: '#0f172a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day-End Counter Cash Drawer & Tally Modal */}
      {showBulkModal && (
        <BulkCollectionModal
          emis={emis}
          companyName={emis[0]?.companyName || me?.companyName || 'LenQredzo Capital Private Limited'}
          onSuccess={fetchCollections}
          onClose={() => setShowBulkModal(false)}
        />
      )}

      {showPreDebitModal && (
        <PreDebitNotificationModal
          onClose={() => setShowPreDebitModal(false)}
          onSuccess={fetchCollections}
        />
      )}

      {showCashReconciliation && (
        <CashReconciliationModal
          companyName={me?.companyName || 'LenQredzo Capital Pvt Ltd'}
          branchName={me?.branchName || 'Headquarters Branch'}
          onClose={() => setShowCashReconciliation(false)}
        />
      )}

      {showWhatsAppReminderModal && (
        <WhatsAppDueReminderModal
          onClose={() => setShowWhatsAppReminderModal(false)}
        />
      )}

      {showVaultModal && (
        <BranchVaultDenominationModal
          expectedAmount={emis.filter(e => e.status === 'paid').reduce((s, e) => s + (e.paidAmount || e.amount || 0), 0)}
          branchName={me?.branchName || 'Headquarters Branch'}
          cashierName={me?.name || 'Branch Cashier'}
          onClose={() => setShowVaultModal(false)}
          onSuccess={() => {
            setShowVaultModal(false);
            fetchCollections();
          }}
        />
      )}

      {thermalReceiptData && (
        <ThermalReceiptModal
          receipt={thermalReceiptData}
          onClose={() => setThermalReceiptData(null)}
        />
      )}
    </div>
  );
}