'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { API_URL } from '@/lib/api';

export interface PreDebitNotificationModalProps {
  loanId?: number; // Optional: if opened from specific loan page
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PreDebitNotificationModal({ loanId, onClose, onSuccess }: PreDebitNotificationModalProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [items, setItems] = useState<any[]>([]);
  const [daysAhead, setDaysAhead] = useState<number>(2); // 48h default
  const [selectedEmiIds, setSelectedEmiIds] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [cronRunning, setCronRunning] = useState<boolean>(false);
  const [previewItem, setPreviewItem] = useState<any | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtDateTime = (d?: string) => d ? new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
  }) : '—';

  const fetchUpcoming = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/payments/mandates/pre-debit/upcoming?daysAhead=${daysAhead}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        let list = data.items;
        if (loanId) {
          list = list.filter((i: any) => i.loanId === Number(loanId));
        }
        setItems(list);

        // Pre-select pending ones
        const pendingIds = new Set<number>();
        for (const it of list) {
          if (!it.notificationSent) {
            pendingIds.add(it.emiId);
          }
        }
        setSelectedEmiIds(pendingIds);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error('Fetch upcoming pre-debits error:', err);
      setStatusMessage({ type: 'error', text: 'Failed to load upcoming AutoPay accounts.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpcoming();
  }, [daysAhead, loanId]);

  // Counts
  const totalAmount = useMemo(() => items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0), [items]);
  const sentCount = useMemo(() => items.filter(i => i.notificationSent).length, [items]);
  const pendingCount = useMemo(() => items.filter(i => !i.notificationSent).length, [items]);

  const toggleSelect = (emiId: number) => {
    const next = new Set(selectedEmiIds);
    if (next.has(emiId)) next.delete(emiId);
    else next.add(emiId);
    setSelectedEmiIds(next);
  };

  const selectAll = () => {
    const all = new Set(items.map(i => i.emiId));
    setSelectedEmiIds(all);
  };

  const selectPendingOnly = () => {
    const pend = new Set(items.filter(i => !i.notificationSent).map(i => i.emiId));
    setSelectedEmiIds(pend);
  };

  const clearSelection = () => {
    setSelectedEmiIds(new Set());
  };

  // Dispatch selected pre-debit notices
  const handleSendSelected = async () => {
    if (selectedEmiIds.size === 0) {
      setStatusMessage({ type: 'error', text: 'Please select at least one account to issue pre-debit notice.' });
      return;
    }

    const payloadItems = items
      .filter(i => selectedEmiIds.has(i.emiId))
      .map(i => ({ loanId: i.loanId, emiId: i.emiId }));

    const confirmed = window.confirm(
      `🔔 DISPATCH 24-HOUR PRE-DEBIT NOTICES?\n\n• Target Accounts: ${payloadItems.length}\n• Channel: WhatsApp Meta API / SMS\n• Advisory: Reminds borrower of scheduled debit and instructs them to maintain bank balance to prevent bounce fees.\n\nProceed to send now?`
    );
    if (!confirmed) return;

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`${API_URL}/api/payments/mandates/pre-debit/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ items: payloadItems })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to dispatch notices');
      }

      setStatusMessage({
        type: 'success',
        text: `✓ 24-Hour Pre-Debit notices successfully issued for ${data.totalDispatched} accounts! Audit records logged.`
      });

      await fetchUpcoming();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Send error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Error occurred while sending notices.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Run automated 24h cron
  const handleTriggerCron = async () => {
    if (!window.confirm('Run Automated 24-Hour e-Mandate Pre-Debit Cron Job now?\n\nThis scans all active AutoPay loans, finds installments scheduled in the next 48 hours without previous advance notice, and automatically dispatches RBI-compliant pre-debit alerts.')) return;

    setCronRunning(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`${API_URL}/api/payments/mandates/pre-debit/cron`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        }
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Cron execution failed');
      }

      setStatusMessage({
        type: 'success',
        text: data.message || `Automated cron finished! Sent ${data.totalDispatched || 0} notices.`
      });

      await fetchUpcoming();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Cron error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to trigger pre-debit cron' });
    } finally {
      setCronRunning(false);
    }
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
        maxWidth: '1050px',
        width: '100%',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        border: '1px solid #e2e8f0'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
          color: 'white',
          padding: '18px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '26px' }}>⏰</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                  24-Hour Pre-Debit AutoPay Center
                </h3>
                <span style={{
                  background: '#a7f3d0',
                  color: '#064e3b',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  RBI e-MANDATE REGULATION
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#d1fae5', marginTop: '2px' }}>
                Statutory 24-hr advance notification before UPI AutoPay / e-NACH bank deductions • Prevents bank bounce penalties (₹350–₹590)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleTriggerCron}
              disabled={cronRunning}
              style={{
                background: '#064e3b',
                color: '#ecfdf5',
                border: '1px solid #34d399',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: cronRunning ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Runs automated scan and dispatches notices to all unadvised upcoming accounts"
            >
              {cronRunning ? '⏳ Running Cron...' : '⚡ Trigger 24h Cron Job'}
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#a7f3d0',
                fontSize: '24px',
                cursor: 'pointer',
                lineHeight: 1
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Status Alert Banner */}
        {statusMessage && (
          <div style={{
            background: statusMessage.type === 'success' ? '#f0fdf4' : '#fef2f2',
            borderLeft: `4px solid ${statusMessage.type === 'success' ? '#22c55e' : '#ef4444'}`,
            padding: '12px 20px',
            fontSize: '13px',
            color: statusMessage.type === 'success' ? '#15803d' : '#b91c1c',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>{statusMessage.text}</span>
            <button
              onClick={() => setStatusMessage(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Toolbar: KPI Metrics & Time Window Filter */}
        <div style={{
          padding: '16px 24px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          {/* KPI Mini-Cards */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ background: '#ffffff', padding: '8px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Upcoming Debits</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{items.length} Accounts</div>
            </div>

            <div style={{ background: '#ffffff', padding: '8px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Debit Volume</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#047857' }}>{fmt(totalAmount)}</div>
            </div>

            <div style={{ background: '#ffffff', padding: '8px 14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '10px', color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>✅ Notice Sent</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#166534' }}>{sentCount} Compliant</div>
            </div>

            <div style={{ background: '#ffffff', padding: '8px 14px', borderRadius: '8px', border: '1px solid #fed7aa' }}>
              <div style={{ fontSize: '10px', color: '#c2410c', fontWeight: 700, textTransform: 'uppercase' }}>⏳ Pending Notice</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#c2410c' }}>{pendingCount} Accounts</div>
            </div>
          </div>

          {/* Time Window Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Time Horizon:</span>
            {[
              { days: 1, label: 'Next 24 Hours (Immediate)' },
              { days: 2, label: 'Next 48 Hours (Standard)' },
              { days: 7, label: 'Next 7 Days' },
            ].map(w => (
              <button
                key={w.days}
                onClick={() => setDaysAhead(w.days)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  border: daysAhead === w.days ? '1px solid #047857' : '1px solid #cbd5e1',
                  background: daysAhead === w.days ? '#047857' : '#ffffff',
                  color: daysAhead === w.days ? '#ffffff' : '#334155',
                  fontSize: '12px',
                  fontWeight: daysAhead === w.days ? 700 : 500,
                  cursor: 'pointer'
                }}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sub-Toolbar: Selection Helpers */}
        <div style={{
          padding: '10px 24px',
          background: '#ffffff',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={selectPendingOnly}
              style={{
                background: '#fef3c7',
                border: '1px solid #fde68a',
                color: '#92400e',
                padding: '4px 10px',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Select All Pending ({pendingCount})
            </button>
            <button
              onClick={selectAll}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#334155',
                padding: '4px 10px',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Select All ({items.length})
            </button>
            {selectedEmiIds.size > 0 && (
              <button
                onClick={clearSelection}
                style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 600, cursor: 'pointer' }}
              >
                Clear
              </button>
            )}
          </div>

          <div style={{ color: '#64748b' }}>
            <strong style={{ color: '#0f172a' }}>{selectedEmiIds.size}</strong> accounts selected for dispatch
          </div>
        </div>

        {/* Table Content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: '300px', maxHeight: '420px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              ⏳ Scanning active e-Mandates & upcoming EMI installments...
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>🎉</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#334155' }}>
                No AutoPay debits scheduled in the next {daysAhead * 24} hours
              </div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>
                All active mandates are either cleared or scheduled beyond this window.
              </div>
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
                  <th style={{ padding: '10px 14px', width: '36px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={items.length > 0 && items.every(i => selectedEmiIds.has(i.emiId))}
                      onChange={e => e.target.checked ? selectAll() : clearSelection()}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ padding: '10px 12px' }}>Borrower Info</th>
                  <th style={{ padding: '10px 12px' }}>Loan Ref</th>
                  <th style={{ padding: '10px 12px' }}>Mandate UMN & Bank</th>
                  <th style={{ padding: '10px 12px' }}>Scheduled Debit Date</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>RBI Compliance Status</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const isSelected = selectedEmiIds.has(item.emiId);
                  return (
                    <tr
                      key={item.emiId}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isSelected ? '#f0fdf4' : 'transparent',
                        transition: 'background 0.1s'
                      }}
                    >
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.emiId)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>

                      {/* Borrower */}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.customerName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>📞 {item.customerPhone || '—'}</div>
                      </td>

                      {/* Loan Ref */}
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                          {item.loanRef}
                        </span>
                      </td>

                      {/* Mandate & Bank */}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', color: '#064e3b' }}>
                          {item.mandateUmn}
                        </div>
                        <div style={{ fontSize: '11px', color: '#475569' }}>
                          {item.bankName} ({item.maskedAccount})
                        </div>
                      </td>

                      {/* Scheduled Debit Date */}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>
                          {item.dueDateFormatted}
                        </div>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: item.hoursUntilDebit <= 24 ? '#fee2e2' : '#fef3c7',
                          color: item.hoursUntilDebit <= 24 ? '#991b1b' : '#92400e',
                          display: 'inline-block',
                          marginTop: '2px'
                        }}>
                          ⏳ {item.hoursUntilDebit}h remaining
                        </span>
                      </td>

                      {/* Amount */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#047857' }}>
                        {fmt(item.amount)}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {item.notificationSent ? (
                          <div>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              background: '#dcfce7',
                              color: '#166534',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              ✓ Advised (RBI Compliant)
                            </span>
                            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                              {fmtDateTime(item.notificationSentAt)}
                            </div>
                          </div>
                        ) : (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            background: '#ffedd5',
                            color: '#9a3412',
                            padding: '2px 8px',
                            borderRadius: '12px'
                          }}>
                            ⚠️ Notice Pending
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => setPreviewItem(item)}
                            style={{
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              color: '#334155',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            👁️ Preview
                          </button>

                          {item.waLink && (
                            <a
                              href={item.waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                background: '#25D366',
                                color: 'white',
                                textDecoration: 'none',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              📱 WhatsApp
                            </a>
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

        {/* Inline Message Preview Popup */}
        {previewItem && (
          <div style={{
            background: '#f0fdf4',
            borderTop: '2px solid #86efac',
            padding: '14px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '20px'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#166534', marginBottom: '6px' }}>
                WHATSAPP / SMS STATUTORY NOTICE PREVIEW (for {previewItem.customerName} · {previewItem.loanRef}):
              </div>
              <pre style={{
                background: '#ffffff',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px',
                color: '#1e293b',
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                margin: 0,
                maxHeight: '120px',
                overflowY: 'auto'
              }}>
                {previewItem.messagePreview}
              </pre>
            </div>
            <button
              onClick={() => setPreviewItem(null)}
              style={{
                background: '#047857',
                color: 'white',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Hide Preview
            </button>
          </div>
        )}

        {/* Footer Controls */}
        <div style={{
          padding: '16px 24px',
          background: '#ffffff',
          borderTop: '2px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #cbd5e1',
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              color: '#475569'
            }}
          >
            Close
          </button>

          <button
            onClick={handleSendSelected}
            disabled={submitting || selectedEmiIds.size === 0}
            style={{
              background: (submitting || selectedEmiIds.size === 0)
                ? '#cbd5e1'
                : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: 'white',
              border: 'none',
              padding: '12px 28px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 800,
              cursor: (submitting || selectedEmiIds.size === 0) ? 'not-allowed' : 'pointer',
              boxShadow: selectedEmiIds.size === 0 ? 'none' : '0 4px 14px rgba(4, 120, 87, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {submitting ? '⏳ Dispatching Notices...' : `🔔 Dispatch 24-Hr Advance Notice to ${selectedEmiIds.size} Accounts Now`}
          </button>
        </div>
      </div>
    </div>
  );
}
