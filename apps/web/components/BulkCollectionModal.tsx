'use client';
import React, { useState, useMemo } from 'react';
import { API_URL } from '@/lib/api';

export interface BulkCollectionModalProps {
  emis: any[];
  companyName?: string;
  onSuccess: () => void;
  onClose: () => void;
}

// Converts number to Indian currency words for voucher
function numberToWordsINR(num: number): string {
  if (!num || isNaN(num)) return 'Zero Rupees';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
  }

  return convert(Math.floor(num)) + ' Rupees Only';
}

export default function BulkCollectionModal({
  emis,
  companyName = 'LenQredzo Capital Private Limited',
  onSuccess,
  onClose
}: BulkCollectionModalProps) {
  // Filter states
  const [filterType, setFilterType] = useState<'all' | 'due_today' | 'overdue' | 'daily' | 'weekly' | 'monthly'>('all');
  const [search, setSearch] = useState('');

  // Selected item IDs (EMI IDs)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Custom collection amounts per EMI (defaults to remaining balance)
  const [customAmounts, setCustomAmounts] = useState<Record<number, number>>({});

  // Penalty collection toggles per EMI
  const [collectPenalties, setCollectPenalties] = useState<Record<number, boolean>>({});

  // Payment configuration
  const [method, setMethod] = useState<'cash' | 'upi' | 'bank_transfer'>('cash');
  const [reference, setReference] = useState('');
  const [routeNotes, setRouteNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Voucher view state after successful bulk collection
  const [batchVoucher, setBatchVoucher] = useState<any | null>(null);

  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtDateTime = (d?: string) => d ? new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
  }) : '—';

  // Base list: only uncollected (pending, overdue, partial) EMIs
  const uncollectedList = useMemo(() => {
    return (emis || []).filter(e => e.status !== 'paid');
  }, [emis]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Filtered list
  const filteredList = useMemo(() => {
    return uncollectedList.filter(item => {
      // Frequency / Overdue filters
      if (filterType === 'due_today') {
        const itemDateStr = item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : '';
        if (itemDateStr !== todayStr) return false;
      } else if (filterType === 'overdue') {
        if (item.status !== 'overdue' && (item.daysOverdue || 0) <= 0) return false;
      } else if (filterType === 'daily') {
        if ((item.frequency || '').toLowerCase() !== 'daily') return false;
      } else if (filterType === 'weekly') {
        if ((item.frequency || '').toLowerCase() !== 'weekly') return false;
      } else if (filterType === 'monthly') {
        if ((item.frequency || '').toLowerCase() !== 'monthly') return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = (item.customerName || '').toLowerCase();
        const phone = (item.customerPhone || '').toLowerCase();
        const ref = ('ln' + (1000 + item.loanId)).toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !ref.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [uncollectedList, filterType, search, todayStr]);

  // Counts for pill indicators
  const dueTodayCount = useMemo(() => {
    return uncollectedList.filter(e => {
      const d = e.dueDate ? new Date(e.dueDate).toISOString().slice(0, 10) : '';
      return d === todayStr;
    }).length;
  }, [uncollectedList, todayStr]);

  const overdueCount = useMemo(() => {
    return uncollectedList.filter(e => e.status === 'overdue' || (e.daysOverdue || 0) > 0).length;
  }, [uncollectedList]);

  const dailyCount = useMemo(() => {
    return uncollectedList.filter(e => (e.frequency || '').toLowerCase() === 'daily').length;
  }, [uncollectedList]);

  // Toggle single selection
  const toggleSelect = (id: number, remaining: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      if (customAmounts[id] == null) {
        setCustomAmounts(prev => ({ ...prev, [id]: remaining }));
      }
    }
    setSelectedIds(next);
  };

  // Select all currently filtered
  const selectAllFiltered = () => {
    const next = new Set(selectedIds);
    const updatedAmounts = { ...customAmounts };
    for (const item of filteredList) {
      next.add(item.id);
      if (updatedAmounts[item.id] == null) {
        updatedAmounts[item.id] = item.remaining ?? item.amount;
      }
    }
    setSelectedIds(next);
    setCustomAmounts(updatedAmounts);
  };

  // Select only due today
  const selectDueToday = () => {
    const next = new Set<number>();
    const updatedAmounts = { ...customAmounts };
    for (const item of uncollectedList) {
      const d = item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : '';
      if (d === todayStr) {
        next.add(item.id);
        if (updatedAmounts[item.id] == null) {
          updatedAmounts[item.id] = item.remaining ?? item.amount;
        }
      }
    }
    setSelectedIds(next);
    setCustomAmounts(updatedAmounts);
  };

  // Clear all selections
  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Handle amount change for an EMI
  const handleAmountChange = (id: number, val: string, remaining: number) => {
    const num = Math.round(Number(val));
    if (isNaN(num) || num < 0) {
      setCustomAmounts(prev => ({ ...prev, [id]: 0 }));
    } else if (num > remaining) {
      setCustomAmounts(prev => ({ ...prev, [id]: remaining }));
    } else {
      setCustomAmounts(prev => ({ ...prev, [id]: num }));
    }
  };

  // Toggle penalty collection for an EMI
  const togglePenalty = (id: number) => {
    setCollectPenalties(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Total summary of selected items
  const totalSelectedCount = selectedIds.size;
  const totalBatchAmount = useMemo(() => {
    let sum = 0;
    for (const item of uncollectedList) {
      if (selectedIds.has(item.id)) {
        const remaining = item.remaining ?? item.amount;
        const amt = customAmounts[item.id] != null ? customAmounts[item.id] : remaining;
        const penalty = (collectPenalties[item.id] && item.penalty > 0) ? item.penalty : 0;
        sum += amt + penalty;
      }
    }
    return sum;
  }, [uncollectedList, selectedIds, customAmounts, collectPenalties]);

  // Submit bulk collection to backend
  const handleSubmitBatch = async () => {
    if (totalSelectedCount === 0) {
      setErrorMessage('Please select at least one loan EMI to collect.');
      return;
    }

    if (method !== 'cash' && !reference.trim()) {
      setErrorMessage(`Please enter a payment reference / UTR for ${method === 'upi' ? 'UPI' : 'Bank Transfer'}.`);
      return;
    }

    const payloadCollections = Array.from(selectedIds).map(id => {
      const item = uncollectedList.find(e => e.id === id);
      const remaining = item ? (item.remaining ?? item.amount) : 0;
      const amt = customAmounts[id] != null ? customAmounts[id] : remaining;
      return {
        emiId: id,
        amount: amt,
        collectPenalty: Boolean(collectPenalties[id])
      };
    });

    const confirmed = window.confirm(
      `⚡ CONFIRM BULK COLLECTION?\n\n• Selected Loans: ${totalSelectedCount}\n• Total Amount to Collect: ${fmt(totalBatchAmount)}\n• Payment Mode: ${method.toUpperCase()}\n\nProceed to mark these EMIs as collected now?`
    );
    if (!confirmed) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_URL}/api/loans/collections/bulk-pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          collections: payloadCollections,
          method,
          reference: reference.trim(),
          notes: routeNotes.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Bulk collection transaction failed');
      }

      // Show Voucher View
      setBatchVoucher(data);
      onSuccess();
    } catch (err: any) {
      console.error('Bulk collection error:', err);
      setErrorMessage(err.message || 'Server error occurred during bulk payment.');
    } finally {
      setSubmitting(false);
    }
  };

  // WhatsApp share link for batch voucher
  const getWhatsAppShareUrl = () => {
    if (!batchVoucher) return '';
    const text = `*LenQredzo Capital - Batch Collection Settlement Voucher*\n` +
      `*Batch Ref:* ${batchVoucher.batchVoucherNumber}\n` +
      `*Total Collected:* ${fmt(batchVoucher.totalAmountCollected)}\n` +
      `*Accounts Settled:* ${batchVoucher.totalProcessed} Loans\n` +
      `*Payment Mode:* ${(batchVoucher.method || 'cash').toUpperCase()}\n` +
      `*Date:* ${fmtDateTime(batchVoucher.collectedAt)}\n\n` +
      `All individual EMI ledgers have been credited and verified.`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        maxWidth: batchVoucher ? '780px' : '1100px',
        width: '100%',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        border: '1px solid #e2e8f0'
      }}>
        {/* ============================================================ */}
        {/* VIEW 1: BATCH COLLECTION VOUCHER RECEIPT (POST-SUBMISSION)  */}
        {/* ============================================================ */}
        {batchVoucher ? (
          <>
            {/* Header */}
            <div style={{
              background: '#0f172a',
              color: 'white',
              padding: '16px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '22px' }}>⚡</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '0.5px' }}>
                    BATCH COLLECTION SETTLEMENT VOUCHER
                  </h3>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {companyName} • Vasool Batch Clearance
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    background: '#1e293b',
                    color: '#f8fafc',
                    border: '1px solid #334155',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  🖨️ Print Voucher
                </button>
                <a
                  href={getWhatsAppShareUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: '#25D366',
                    color: 'white',
                    textDecoration: 'none',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  📱 Share via WhatsApp
                </a>
                <button
                  onClick={onClose}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: '22px',
                    cursor: 'pointer',
                    lineHeight: 1
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Voucher Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {/* Success Banner */}
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                marginBottom: '20px'
              }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: '#22c55e',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}>
                  ✓
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#166534' }}>
                    Batch Payment Processed & Audited Successfully!
                  </div>
                  <div style={{ fontSize: '13px', color: '#15803d' }}>
                    {batchVoucher.totalProcessed} loan accounts have been credited. All ledgers, loan balances, and audit records updated in real time.
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                    Batch Ref No
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                    {batchVoucher.batchVoucherNumber}
                  </div>
                </div>
              </div>

              {/* KPI Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>TOTAL COLLECTED</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#15803d' }}>
                    {fmt(batchVoucher.totalAmountCollected)}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>ACCOUNTS CLEARED</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                    {batchVoucher.totalProcessed} Loans
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>PAYMENT METHOD</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' }}>
                    {batchVoucher.method === 'cash' ? '💵 Physical Cash' : batchVoucher.method === 'upi' ? '📱 UPI / QR' : '🏦 Bank Transfer'}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>DATE & TIME</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                    {fmtDateTime(batchVoucher.collectedAt)}
                  </div>
                </div>
              </div>

              {/* Amount in words */}
              <div style={{
                background: '#f1f5f9',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#334155',
                marginBottom: '20px',
                fontStyle: 'italic'
              }}>
                <strong>Amount in words:</strong> {numberToWordsINR(batchVoucher.totalAmountCollected)}
              </div>

              {/* Itemized Table */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px' }}>#</th>
                      <th style={{ padding: '10px 14px' }}>Loan Ref</th>
                      <th style={{ padding: '10px 14px' }}>Borrower</th>
                      <th style={{ padding: '10px 14px' }}>Due Date</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Collected Amount</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center' }}>Result Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(batchVoucher.items || []).map((item: any, idx: number) => (
                      <tr key={item.emiId || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{item.loanRef}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.customerName}</div>
                          {item.customerPhone && (
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{item.customerPhone}</div>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#64748b' }}>{fmtDate(item.dueDate)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                          {fmt(item.totalCollected)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: item.status === 'paid' ? '#dcfce7' : '#fef3c7',
                            color: item.status === 'paid' ? '#166534' : '#92400e'
                          }}>
                            {item.status === 'paid' ? 'CLEARED' : 'PARTIAL'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={onClose}
                style={{
                  background: '#0f172a',
                  color: 'white',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close & Return to Collections
              </button>
            </div>
          </>
        ) : (
          /* ============================================================ */
          /* VIEW 2: FAST BULK COLLECTION TERMINAL & ROUTE ENTRY          */
          /* ============================================================ */
          <>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: 'white',
              padding: '18px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>⚡</span>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                    Fast Bulk EMI Collection Terminal
                  </h3>
                  <span style={{
                    background: '#38bdf8',
                    color: '#0f172a',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '12px'
                  }}>
                    BATCH ENGINE
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
                  Collect up to 100 route EMIs in seconds • Real-time ledger updates • Single audited settlement voucher
                </div>
              </div>

              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '24px',
                  cursor: 'pointer',
                  lineHeight: 1
                }}
              >
                ✕
              </button>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div style={{
                background: '#fef2f2',
                borderLeft: '4px solid #ef4444',
                padding: '12px 20px',
                fontSize: '13px',
                color: '#b91c1c',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>⚠️ {errorMessage}</span>
                <button
                  onClick={() => setErrorMessage(null)}
                  style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontWeight: 700 }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Toolbar: Filters & Quick Actions */}
            <div style={{
              padding: '14px 24px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              {/* Filter Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Filter:</span>
                {[
                  { id: 'all', label: `All Pending (${uncollectedList.length})` },
                  { id: 'due_today', label: `Due Today (${dueTodayCount})` },
                  { id: 'overdue', label: `Overdue (${overdueCount})` },
                  { id: 'daily', label: `Daily Route (${dailyCount})` },
                  { id: 'weekly', label: 'Weekly Route' },
                  { id: 'monthly', label: 'Monthly' },
                ].map(p => {
                  const active = filterType === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setFilterType(p.id as any)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        border: active ? '1px solid #0284c7' : '1px solid #cbd5e1',
                        background: active ? '#0284c7' : '#ffffff',
                        color: active ? '#ffffff' : '#334155',
                        fontSize: '12px',
                        fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Search Box */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Search borrower / LN# / phone..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    width: '230px'
                  }}
                />
              </div>
            </div>

            {/* Sub-Toolbar: Batch Select Actions */}
            <div style={{
              padding: '10px 24px',
              background: '#ffffff',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={selectAllFiltered}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#334155'
                  }}
                >
                  ☑️ Select All Filtered ({filteredList.length})
                </button>

                <button
                  onClick={selectDueToday}
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#166534'
                  }}
                >
                  📅 Select All Due Today ({dueTodayCount})
                </button>

                {selectedIds.size > 0 && (
                  <button
                    onClick={clearSelection}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc2626',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Clear Selection
                  </button>
                )}
              </div>

              <div style={{ color: '#64748b', fontSize: '13px' }}>
                Showing <strong>{filteredList.length}</strong> loans • <strong style={{ color: '#0f172a' }}>{selectedIds.size}</strong> selected
              </div>
            </div>

            {/* Loans Table (High density) */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: '280px', maxHeight: '420px' }}>
              {filteredList.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#475569' }}>No pending collections found for this filter</div>
                  <div style={{ fontSize: '13px', marginTop: '4px' }}>All EMIs in this view have already been settled.</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{
                      background: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      position: 'sticky',
                      top: 0,
                      zIndex: 10,
                      color: '#475569',
                      textAlign: 'left'
                    }}>
                      <th style={{ padding: '10px 14px', width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={filteredList.length > 0 && filteredList.every(i => selectedIds.has(i.id))}
                          onChange={e => {
                            if (e.target.checked) selectAllFiltered();
                            else clearSelection();
                          }}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </th>
                      <th style={{ padding: '10px 12px' }}>Borrower Info</th>
                      <th style={{ padding: '10px 12px' }}>Loan Ref</th>
                      <th style={{ padding: '10px 12px' }}>Frequency</th>
                      <th style={{ padding: '10px 12px' }}>Due Date</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Balance Due</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Late Penalty</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', width: '170px' }}>Amount to Collect (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      const remaining = item.remaining ?? item.amount;
                      const customAmt = customAmounts[item.id] != null ? customAmounts[item.id] : remaining;
                      const hasPenalty = (item.penalty || 0) > 0;
                      const collectPen = Boolean(collectPenalties[item.id]);

                      return (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: isSelected ? '#f0f9ff' : 'transparent',
                            transition: 'background 0.1s'
                          }}
                        >
                          {/* Checkbox */}
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(item.id, remaining)}
                              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                          </td>

                          {/* Borrower Name & Phone */}
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>
                              {item.customerName}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              📞 {item.customerPhone || 'No phone'} • {item.branchName || 'Main'}
                            </div>
                          </td>

                          {/* Loan Ref & Type */}
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                              LN{1000 + item.loanId}
                            </span>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {item.loanType || 'Personal'}
                            </div>
                          </td>

                          {/* Frequency Pill */}
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: item.frequency === 'daily' ? '#fef3c7' : item.frequency === 'weekly' ? '#e0e7ff' : '#f1f5f9',
                              color: item.frequency === 'daily' ? '#92400e' : item.frequency === 'weekly' ? '#3730a3' : '#475569'
                            }}>
                              {item.frequency || 'Monthly'}
                            </span>
                          </td>

                          {/* Due Date & Overdue Badge */}
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 500, color: '#334155' }}>
                              {fmtDate(item.dueDate)}
                            </div>
                            {item.daysOverdue > 0 ? (
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#b91c1c',
                                background: '#fef2f2',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                display: 'inline-block',
                                marginTop: '2px'
                              }}>
                                ⚠️ {item.daysOverdue}d overdue
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#16a34a' }}>On Schedule</span>
                            )}
                          </td>

                          {/* Balance Due */}
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                            {fmt(remaining)}
                          </td>

                          {/* Late Penalty */}
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            {hasPenalty ? (
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '12px', color: '#b91c1c' }}>
                                <input
                                  type="checkbox"
                                  checked={collectPen}
                                  onChange={() => togglePenalty(item.id)}
                                  disabled={!isSelected}
                                />
                                <span>{fmt(item.penalty)}</span>
                              </label>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                            )}
                          </td>

                          {/* Amount to Collect Input */}
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                              <span style={{ fontSize: '12px', color: '#64748b' }}>₹</span>
                              <input
                                type="number"
                                value={customAmt}
                                disabled={!isSelected}
                                onChange={e => handleAmountChange(item.id, e.target.value, remaining)}
                                style={{
                                  width: '95px',
                                  padding: '5px 8px',
                                  textAlign: 'right',
                                  borderRadius: '6px',
                                  border: isSelected ? '1px solid #0284c7' : '1px solid #e2e8f0',
                                  background: isSelected ? '#ffffff' : '#f8fafc',
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: '#0f172a'
                                }}
                              />
                              {customAmt !== remaining && isSelected && (
                                <button
                                  type="button"
                                  onClick={() => handleAmountChange(item.id, String(remaining), remaining)}
                                  title="Reset to full balance"
                                  style={{
                                    border: 'none',
                                    background: '#e0f2fe',
                                    color: '#0369a1',
                                    borderRadius: '4px',
                                    padding: '4px 6px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  FULL
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Sticky Bottom Control Bar: Payment Config & Submission */}
            <div style={{
              background: '#ffffff',
              borderTop: '2px solid #e2e8f0',
              padding: '16px 24px',
              boxShadow: '0 -4px 12px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr 1.3fr', gap: '20px', alignItems: 'center' }}>
                {/* 1. Payment Method Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    COLLECTION METHOD
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { id: 'cash', label: '💵 Cash' },
                      { id: 'upi', label: '📱 UPI' },
                      { id: 'bank_transfer', label: '🏦 Bank' }
                    ].map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMethod(m.id as any)}
                        style={{
                          flex: 1,
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: method === m.id ? '2px solid #0284c7' : '1px solid #cbd5e1',
                          background: method === m.id ? '#f0f9ff' : '#ffffff',
                          color: method === m.id ? '#0284c7' : '#475569',
                          fontWeight: method === m.id ? 700 : 500,
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {method !== 'cash' && (
                    <input
                      type="text"
                      placeholder={`Enter ${method === 'upi' ? 'UPI UTR / Reference ID' : 'Bank Transfer UTR'}`}
                      value={reference}
                      onChange={e => setReference(e.target.value)}
                      style={{
                        width: '100%',
                        marginTop: '8px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px'
                      }}
                    />
                  )}
                </div>

                {/* 2. Batch Summary Display */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      Selected for Batch
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                      {totalSelectedCount} Loan EMIs
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      Total Collection Amount
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: '#15803d' }}>
                      {fmt(totalBatchAmount)}
                    </div>
                  </div>
                </div>

                {/* 3. Action Submit Button */}
                <div>
                  <button
                    onClick={handleSubmitBatch}
                    disabled={submitting || totalSelectedCount === 0}
                    style={{
                      width: '100%',
                      padding: '14px 20px',
                      borderRadius: '10px',
                      background: totalSelectedCount === 0
                        ? '#cbd5e1'
                        : submitting
                        ? '#64748b'
                        : 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
                      color: 'white',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: 800,
                      cursor: (submitting || totalSelectedCount === 0) ? 'not-allowed' : 'pointer',
                      boxShadow: totalSelectedCount === 0 ? 'none' : '0 4px 14px rgba(22, 163, 74, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {submitting ? (
                      <>⏳ Processing Batch Payment...</>
                    ) : (
                      <>⚡ Collect {fmt(totalBatchAmount)} Now</>
                    )}
                  </button>

                  <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '6px' }}>
                    Generates instant audited batch settlement receipt
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
