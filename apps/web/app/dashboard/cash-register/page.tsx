'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { getAuthUser } from '@/lib/authUser';
import { API_URL } from '@/lib/api';
import CashHandoverModal from '@/components/CashHandoverModal';
import CashHandoverVoucherModal from '@/components/CashHandoverVoucherModal';
import BranchVaultDenominationModal from '@/components/BranchVaultDenominationModal';

type UserAuth = {
  userId: number;
  role: string;
  name?: string;
  companyId: number | null;
  branchId: number | null;
} | null;

export default function CashRegisterPage() {
  const [me, setMe] = useState<UserAuth>(null);
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().slice(0, 10);
  });
  const [activeTab, setActiveTab] = useState<'agent' | 'cashier' | 'history' | 'statement'>('agent');

  // Modals
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showDenominationModal, setShowDenominationModal] = useState(false);
  const [activeVoucher, setActiveVoucher] = useState<any>(null);

  // Cashier verification state
  const [acceptingHandover, setAcceptingHandover] = useState<any>(null);
  const [verificationCodeInput, setVerificationCodeInput] = useState('');
  const [cashierNotesInput, setCashierNotesInput] = useState('');
  const [acceptingLoading, setAcceptingLoading] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    const user = getAuthUser();
    setMe(user);
    if (user && ['owner', 'admin', 'Super Admin', 'branch_manager', 'accountant', 'cashier'].includes(user.role)) {
      setActiveTab('cashier');
    }
  }, []);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/cash-register/summary?date=${selectedDate}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSummaryData(data);
      }

      // Load history
      const histRes = await fetch(`${API_URL}/api/cash-register/handovers/history`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const histData = await histRes.json();
      if (histRes.ok && histData.success) {
        setHistoryData(histData.handovers || []);
      }
    } catch (err) {
      console.error('Failed to load cash register:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [selectedDate]);

  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDateTimeIST = (d?: string) => d
    ? new Date(d).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata'
      })
    : '—';

  const handleAcceptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptingHandover) return;
    setAcceptingLoading(true);
    setAcceptError(null);

    try {
      const res = await fetch(`${API_URL}/api/cash-register/handover/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          handoverId: acceptingHandover.handoverId,
          verificationCode: verificationCodeInput.trim(),
          cashierNotes: cashierNotesInput.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to accept handover');
      }

      setAcceptingHandover(null);
      setVerificationCodeInput('');
      setCashierNotesInput('');
      setActiveVoucher(data.voucher);
      setShowVoucherModal(true);
      await loadSummary();
    } catch (err: any) {
      setAcceptError(err.message || 'Verification failed');
    } finally {
      setAcceptingLoading(false);
    }
  };

  const isManagerOrOwner = me && ['owner', 'admin', 'Super Admin', 'branch_manager', 'accountant', 'cashier'].includes(me.role);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '24px' }}>

        {/* Page Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>💼</span> Day-End Cash Register & Vault Reconciliation
            </h2>
            <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: '13px' }}>
              Physical cash handover, currency denomination tracking, and tamper-proof vault custody transfer
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '4px 10px' }}>
              <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>Date (IST):</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: '13px', fontWeight: 600, color: '#111827', cursor: 'pointer' }}
              />
            </div>

            <button
              onClick={() => setShowDenominationModal(true)}
              style={{
                background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(6, 78, 59, 0.25)'
              }}
            >
              🔐 Physical Denomination & Vault Counter
            </button>

            <button
              onClick={loadSummary}
              style={{
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px 14px',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#374151',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e5e7eb', marginBottom: '24px' }}>
          {[
            { id: 'agent', label: '💼 My Cash In-Hand & Handover', icon: '👤' },
            { id: 'cashier', label: `🏦 Branch Vault & Cashier Desk ${summaryData?.branchMetrics?.pendingHandoversCount ? `(${summaryData.branchMetrics.pendingHandoversCount} Pending)` : ''}`, icon: '🏛️' },
            { id: 'history', label: '📜 Settlement History & Vouchers', icon: '📑' },
            { id: 'statement', label: '📊 Day-End Closing Statement', icon: '🖨️' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '10px 18px',
                border: 'none',
                background: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #1e40af' : '2px solid transparent',
                color: activeTab === tab.id ? '#1e40af' : '#6b7280',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            Loading cash register & vault balance...
          </div>
        ) : (
          <>
            {/* TAB 1: My Cash In-Hand & Handover (Field Staff / Agent View) */}
            {activeTab === 'agent' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Stat Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  {[
                    { label: 'Cash in My Custody', value: fmt(summaryData?.agentMetrics?.cashInHand), color: '#d97706', note: 'Pending handover to cashier' },
                    { label: 'Collected Today', value: fmt(summaryData?.agentMetrics?.collectedToday), color: '#111827', note: 'Total physical cash collected' },
                    { label: 'Settled to Vault Today', value: fmt(summaryData?.agentMetrics?.settledToday), color: '#16a34a', note: 'Accepted & deposited into safe' },
                    { label: 'Pending in Handover', value: fmt(summaryData?.agentMetrics?.pendingHandoverAmount), color: '#2563eb', note: summaryData?.agentMetrics?.activeHandover ? 'Awaiting cashier acceptance' : 'No active handover' },
                  ].map((c) => (
                    <div key={c.label} style={{ background: 'white', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 6px', fontWeight: 600 }}>{c.label}</p>
                      <p style={{ color: c.color, fontSize: '22px', fontWeight: '800', margin: '0 0 4px' }}>{c.value}</p>
                      <p style={{ color: '#9ca3af', fontSize: '11px', margin: 0 }}>{c.note}</p>
                    </div>
                  ))}
                </div>

                {/* Active Pending Handover Alert (Shows large OTP code for cashier) */}
                {summaryData?.agentMetrics?.activeHandover && (
                  <div style={{
                    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    border: '1px solid #93c5fd',
                    borderRadius: '14px',
                    padding: '20px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '32px' }}>⏳</span>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '16px', color: '#1e3a8a' }}>
                          Handover of {fmt(summaryData.agentMetrics.activeHandover.totalAmount)} Awaiting Cashier Acceptance
                        </div>
                        <div style={{ fontSize: '13px', color: '#1e40af', marginTop: '3px' }}>
                          Target Receiver: <strong>{summaryData.agentMetrics.activeHandover.receiverName}</strong> ({summaryData.agentMetrics.activeHandover.receiverRole}) · Ref: <code>{summaryData.agentMetrics.activeHandover.handoverId}</code>
                        </div>
                        <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '2px' }}>
                          Initiated at {fmtDateTimeIST(summaryData.agentMetrics.activeHandover.initiatedAt)}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      background: 'white',
                      border: '2px dashed #2563eb',
                      borderRadius: '12px',
                      padding: '10px 20px',
                      textAlign: 'center'
                    }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block' }}>
                        Show Code to Cashier
                      </span>
                      <span style={{ fontSize: '28px', fontWeight: 900, color: '#1e40af', letterSpacing: '6px', fontFamily: 'monospace' }}>
                        {summaryData.agentMetrics.activeHandover.verificationCode}
                      </span>
                    </div>
                  </div>
                )}

                {/* Handover Action Banner */}
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  padding: '20px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                      Ready to Surrender Today's Field Cash?
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                      Break down notes by denomination (₹500, ₹200, ₹100, etc.) and transfer custody to the branch safe.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowHandoverModal(true)}
                    disabled={summaryData?.agentMetrics?.cashInHand <= 0}
                    style={{
                      background: summaryData?.agentMetrics?.cashInHand > 0
                        ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                        : '#cbd5e1',
                      color: 'white',
                      border: 'none',
                      padding: '11px 22px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: summaryData?.agentMetrics?.cashInHand > 0 ? 'pointer' : 'not-allowed',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: summaryData?.agentMetrics?.cashInHand > 0 ? '0 2px 8px rgba(245, 158, 11, 0.35)' : 'none'
                    }}
                  >
                    <span>💼</span>
                    Initiate Handover ({fmt(summaryData?.agentMetrics?.cashInHand || 0)})
                  </button>
                </div>

                {/* Today's Cash Collections Table */}
                <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#111827' }}>
                      📋 Today's Physical Cash Collections ({summaryData?.agentMetrics?.myCollections?.length || 0})
                    </h3>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      Date: {summaryData?.date}
                    </span>
                  </div>

                  {(!summaryData?.agentMetrics?.myCollections || summaryData.agentMetrics.myCollections.length === 0) ? (
                    <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      No cash collections recorded yet for this date.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '12px 18px' }}>Loan Ref</th>
                          <th style={{ padding: '12px 18px' }}>Borrower</th>
                          <th style={{ padding: '12px 18px' }}>Time (IST)</th>
                          <th style={{ padding: '12px 18px' }}>Payment Mode</th>
                          <th style={{ padding: '12px 18px', textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summaryData.agentMetrics.myCollections.map((col: any) => (
                          <tr key={col.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px 18px', fontWeight: 700, color: '#1e40af' }}>{col.loanRef}</td>
                            <td style={{ padding: '12px 18px', color: '#111827' }}>
                              <div style={{ fontWeight: 600 }}>{col.customerName}</div>
                              {col.customerPhone && <div style={{ fontSize: '11px', color: '#6b7280' }}>{col.customerPhone}</div>}
                            </td>
                            <td style={{ padding: '12px 18px', color: '#6b7280' }}>{fmtDateTimeIST(col.paidAt)}</td>
                            <td style={{ padding: '12px 18px' }}>
                              <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                                💵 Cash
                              </span>
                            </td>
                            <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                              {fmt(col.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Branch Vault & Cashier Desk (Cashier & Manager View) */}
            {activeTab === 'cashier' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Branch Vault Overview */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  {[
                    { label: 'Cumulative Vault Cash', value: fmt(summaryData?.branchMetrics?.cumulativeVaultBalance), color: '#15803d', note: 'Total physical cash settled in safe' },
                    { label: 'Branch Cash Collected Today', value: fmt(summaryData?.branchMetrics?.branchTotalCashCollectedToday), color: '#111827', note: 'Across all field agents & desk' },
                    { label: 'Settled to Vault Today', value: fmt(summaryData?.branchMetrics?.totalSettledToVaultToday), color: '#1e40af', note: 'Confirmed received into safe today' },
                    { label: 'Pending Handovers', value: `${summaryData?.branchMetrics?.pendingHandoversCount || 0} (${fmt(summaryData?.branchMetrics?.pendingHandoversAmount)})`, color: '#d97706', note: 'Waiting for cashier verification' },
                  ].map((c) => (
                    <div key={c.label} style={{ background: 'white', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                      <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 6px', fontWeight: 600 }}>{c.label}</p>
                      <p style={{ color: c.color, fontSize: '22px', fontWeight: '800', margin: '0 0 4px' }}>{c.value}</p>
                      <p style={{ color: '#9ca3af', fontSize: '11px', margin: 0 }}>{c.note}</p>
                    </div>
                  ))}
                </div>

                {/* Pending Handovers Queue */}
                <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '18px' }}>📥</span>
                      <div>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#111827' }}>
                          Incoming Cash Handovers Waiting for Vault Acceptance
                        </h3>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
                          Verify notes against denomination count, enter agent's 4-digit code, and deposit into vault
                        </p>
                      </div>
                    </div>
                    <span style={{
                      background: summaryData?.branchMetrics?.pendingHandoversCount > 0 ? '#fef3c7' : '#f3f4f6',
                      color: summaryData?.branchMetrics?.pendingHandoversCount > 0 ? '#92400e' : '#6b7280',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 700
                    }}>
                      {summaryData?.branchMetrics?.pendingHandoversCount || 0} Pending
                    </span>
                  </div>

                  {(!summaryData?.branchMetrics?.pendingHandovers || summaryData.branchMetrics.pendingHandovers.length === 0) ? (
                    <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      ✅ No pending handovers waiting for acceptance. All collected cash has been reconciled!
                    </div>
                  ) : (
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {summaryData.branchMetrics.pendingHandovers.map((h: any) => (
                        <div
                          key={h.handoverId}
                          style={{
                            border: '1px solid #cbd5e1',
                            borderRadius: '10px',
                            padding: '16px 20px',
                            background: '#fafafa',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>
                                {h.agentName}
                              </span>
                              <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>
                                {h.agentRole}
                              </span>
                              <span style={{ fontSize: '12px', color: '#64748b' }}>
                                · Initiated {fmtDateTimeIST(h.initiatedAt)}
                              </span>
                            </div>

                            <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px' }}>
                              Ref: <code>{h.handoverId}</code> · Notes: {h.notes || 'End of day handover'}
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
                              <span>₹500: <strong>{h.denominations?.count500 || 0}</strong></span> ·
                              <span>₹200: <strong>{h.denominations?.count200 || 0}</strong></span> ·
                              <span>₹100: <strong>{h.denominations?.count100 || 0}</strong></span> ·
                              <span>₹50: <strong>{h.denominations?.count50 || 0}</strong></span> ·
                              <span>Coins: <strong>{fmt(h.denominations?.coins || 0)}</strong></span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '20px', fontWeight: 800, color: '#15803d' }}>
                                {fmt(h.totalAmount)}
                              </div>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>
                                Physical Cash
                              </span>
                            </div>

                            <button
                              onClick={() => {
                                setAcceptingHandover(h);
                                setVerificationCodeInput('');
                                setCashierNotesInput('');
                                setAcceptError(null);
                              }}
                              style={{
                                background: '#16a34a',
                                color: 'white',
                                border: 'none',
                                padding: '10px 18px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
                              }}
                            >
                              ✓ Verify & Accept into Safe
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Today's Settled Handovers */}
                <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#111827' }}>
                      ✅ Handovers Deposited into Vault Today ({summaryData?.branchMetrics?.settledTodayHandovers?.length || 0})
                    </h3>
                  </div>

                  {(!summaryData?.branchMetrics?.settledTodayHandovers || summaryData.branchMetrics.settledTodayHandovers.length === 0) ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      No handovers settled yet for this date.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '12px 18px' }}>Voucher Ref</th>
                          <th style={{ padding: '12px 18px' }}>Surrendered By</th>
                          <th style={{ padding: '12px 18px' }}>Accepted By</th>
                          <th style={{ padding: '12px 18px' }}>Settled At (IST)</th>
                          <th style={{ padding: '12px 18px', textAlign: 'right' }}>Amount</th>
                          <th style={{ padding: '12px 18px', textAlign: 'center' }}>Voucher</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summaryData.branchMetrics.settledTodayHandovers.map((s: any) => (
                          <tr key={s.handoverId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px 18px', fontWeight: 700, color: '#1e40af' }}>
                              {s.voucherNumber || s.handoverId}
                            </td>
                            <td style={{ padding: '12px 18px', color: '#111827', fontWeight: 600 }}>{s.agentName}</td>
                            <td style={{ padding: '12px 18px', color: '#475569' }}>{s.acceptedByName || s.receiverName}</td>
                            <td style={{ padding: '12px 18px', color: '#64748b' }}>{fmtDateTimeIST(s.settledAt)}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                              {fmt(s.totalAmount)}
                            </td>
                            <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                              <button
                                onClick={() => {
                                  setActiveVoucher(s);
                                  setShowVoucherModal(true);
                                }}
                                style={{
                                  background: 'white',
                                  border: '1px solid #cbd5e1',
                                  color: '#1e40af',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                📄 View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Settlement History & Vouchers */}
            {activeTab === 'history' && (
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#111827' }}>
                    📜 Cash Handover & Vault Settlement Audit Trail ({historyData.length})
                  </h3>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    Permanent tamper-proof ledger entries
                  </span>
                </div>

                {historyData.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                    No handover history recorded yet.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '12px 18px' }}>Ref / Voucher</th>
                        <th style={{ padding: '12px 18px' }}>Agent (Surrendered)</th>
                        <th style={{ padding: '12px 18px' }}>Cashier (Accepted)</th>
                        <th style={{ padding: '12px 18px' }}>Status</th>
                        <th style={{ padding: '12px 18px' }}>Timestamp</th>
                        <th style={{ padding: '12px 18px', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '12px 18px', textAlign: 'center' }}>Voucher</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.map((h: any) => (
                        <tr key={h.handoverId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 18px', fontWeight: 700, color: '#1e40af' }}>
                            {h.voucherNumber || h.handoverId}
                          </td>
                          <td style={{ padding: '12px 18px', fontWeight: 600, color: '#111827' }}>{h.agentName}</td>
                          <td style={{ padding: '12px 18px', color: '#475569' }}>{h.acceptedByName || h.receiverName}</td>
                          <td style={{ padding: '12px 18px' }}>
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: h.status === 'settled' ? '#dcfce7' : '#fef3c7',
                              color: h.status === 'settled' ? '#15803d' : '#92400e'
                            }}>
                              {h.status === 'settled' ? '● SETTLED' : '● PENDING'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 18px', color: '#6b7280' }}>
                            {fmtDateTimeIST(h.settledAt || h.initiatedAt)}
                          </td>
                          <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                            {fmt(h.totalAmount)}
                          </td>
                          <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                setActiveVoucher(h);
                                setShowVoucherModal(true);
                              }}
                              style={{
                                background: 'white',
                                border: '1px solid #cbd5e1',
                                color: '#1e40af',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              📄 Voucher
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* TAB 4: Day-End Closing Statement */}
            {activeTab === 'statement' && (
              <div style={{
                background: 'white',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '28px',
                maxWidth: '850px',
                margin: '0 auto'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  borderBottom: '2px solid #0f172a',
                  paddingBottom: '16px',
                  marginBottom: '20px'
                }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                      DAY-END CASHIER RECONCILIATION & VAULT REGISTER
                    </h2>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                      Branch Daily Cash Settlement & Closing Balance Statement
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                      Settlement Date: <strong>{summaryData?.date}</strong> · Generated by: {me?.name || 'Operations'}
                    </p>
                  </div>

                  <button
                    onClick={() => window.print()}
                    style={{
                      background: '#1e40af',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    🖨️ Print Statement
                  </button>
                </div>

                {/* Reconciliation Metrics Table */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Cash Inflow Today</span>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                      {fmt(summaryData?.branchMetrics?.branchTotalCashCollectedToday)}
                    </div>
                    <span style={{ fontSize: '11px', color: '#15803d' }}>From all EMI cash collections</span>
                  </div>

                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Cash Deposited into Vault Today</span>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>
                      {fmt(summaryData?.branchMetrics?.totalSettledToVaultToday)}
                    </div>
                    <span style={{ fontSize: '11px', color: '#15803d' }}>Confirmed & physically counted in safe</span>
                  </div>

                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Cash Remaining in Agent Custody</span>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>
                      {fmt(Math.max(0, (summaryData?.branchMetrics?.branchTotalCashCollectedToday || 0) - (summaryData?.branchMetrics?.totalSettledToVaultToday || 0)))}
                    </div>
                    <span style={{ fontSize: '11px', color: '#92400e' }}>Pending field handover</span>
                  </div>

                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Cumulative Safe / Vault Balance</span>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#1e40af', marginTop: '4px' }}>
                      {fmt(summaryData?.branchMetrics?.cumulativeVaultBalance)}
                    </div>
                    <span style={{ fontSize: '11px', color: '#2563eb' }}>Physical safe cash on hand</span>
                  </div>
                </div>

                {/* Signatures */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '40px',
                  marginTop: '40px',
                  paddingTop: '20px',
                  borderTop: '1px dashed #cbd5e1'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ height: '40px', borderBottom: '1px solid #94a3b8', width: '80%', margin: '0 auto 8px' }} />
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                      Branch Cashier Signature
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Date & Stamp
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ height: '40px', borderBottom: '1px solid #94a3b8', width: '80%', margin: '0 auto 8px' }} />
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                      Branch Manager / Auditor Signature
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Date & Stamp
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {/* Handover Initiation Modal */}
      {showHandoverModal && (
        <CashHandoverModal
          maxAmount={summaryData?.agentMetrics?.cashInHand || 0}
          receivers={summaryData?.eligibleReceivers || []}
          onClose={() => setShowHandoverModal(false)}
          onSuccess={async () => {
            await loadSummary();
          }}
        />
      )}

      {/* Cashier Acceptance / Verification Modal */}
      {acceptingHandover && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '520px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              padding: '16px 20px',
              background: '#0f172a',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                Accept Cash into Vault & Verify Notes
              </h3>
              <button
                onClick={() => setAcceptingHandover(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAcceptSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {acceptError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', color: '#b91c1c', fontSize: '13px' }}>
                  ⚠️ {acceptError}
                </div>
              )}

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>SURRENDERING AGENT</span>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                      {acceptingHandover.agentName} ({acceptingHandover.agentRole})
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>TOTAL AMOUNT</span>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#15803d' }}>
                      {fmt(acceptingHandover.totalAmount)}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1', fontSize: '11px', color: '#475569', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                  <span>₹500: {acceptingHandover.denominations?.count500 || 0}</span>
                  <span>₹200: {acceptingHandover.denominations?.count200 || 0}</span>
                  <span>₹100: {acceptingHandover.denominations?.count100 || 0}</span>
                  <span>₹50: {acceptingHandover.denominations?.count50 || 0}</span>
                  <span>₹20: {acceptingHandover.denominations?.count20 || 0}</span>
                  <span>Coins: {fmt(acceptingHandover.denominations?.coins || 0)}</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Enter 4-Digit Verification Code (From Agent's Screen) *
                </label>
                <input
                  type="text"
                  maxLength={4}
                  required
                  value={verificationCodeInput}
                  onChange={(e) => setVerificationCodeInput(e.target.value)}
                  placeholder="E.g. 6429"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '2px solid #2563eb',
                    fontSize: '22px',
                    fontWeight: 800,
                    textAlign: 'center',
                    letterSpacing: '8px',
                    fontFamily: 'monospace',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  This guarantees the agent is physically present at the cashier window.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Cashier Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={cashierNotesInput}
                  onChange={(e) => setCashierNotesInput(e.target.value)}
                  placeholder="Notes counted & deposited into safe"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setAcceptingHandover(null)}
                  disabled={acceptingLoading}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: 'white',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={acceptingLoading || verificationCodeInput.length !== 4}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: verificationCodeInput.length === 4 ? '#16a34a' : '#94a3b8',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: verificationCodeInput.length === 4 ? 'pointer' : 'not-allowed',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {acceptingLoading ? 'Verifying...' : '✅ Confirm & Deposit into Vault'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Settlement Voucher Modal */}
      {showVoucherModal && (
        <CashHandoverVoucherModal
          voucher={activeVoucher}
          company={summaryData?.company}
          onClose={() => setShowVoucherModal(false)}
        />
      )}

    </div>
  );
}
