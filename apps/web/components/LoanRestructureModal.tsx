'use client';
import React, { useState, useMemo } from 'react';
import { API_URL } from '@/lib/api';

export interface LoanRestructureModalProps {
  loan: any;
  onSuccess: (addendum: any) => void;
  onClose: () => void;
}

export default function LoanRestructureModal({ loan, onSuccess, onClose }: LoanRestructureModalProps) {
  const [restructuringType, setRestructuringType] = useState<'moratorium' | 'tenure_extension' | 'custom_plan'>('tenure_extension');
  const [moratoriumMonths, setMoratoriumMonths] = useState<number>(2);
  const [additionalInstallments, setAdditionalInstallments] = useState<number>(6);
  const [penaltyAction, setPenaltyAction] = useState<'waive' | 'capitalize' | 'keep'>('waive');
  const [reason, setReason] = useState<string>('Temporary Business Slowdown / Cashflow Crunch');
  const [customReason, setCustomReason] = useState<string>('');
  const [officerNotes, setOfficerNotes] = useState<string>('Approved under RBI Resolution Framework following borrower hardship assessment.');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!loan) return null;

  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const customer = loan.customer || {};
  const emis = loan.emis || [];
  const clearedEmis = emis.filter((e: any) => e.status === 'paid');
  const unpaidEmis = emis.filter((e: any) => e.status !== 'paid');

  const outstandingBalance = useMemo(() => {
    return unpaidEmis.reduce((sum: number, e: any) => sum + (e.amount - (e.paidAmount || 0)), 0);
  }, [unpaidEmis]);

  const totalPenalties = useMemo(() => {
    return unpaidEmis.reduce((sum: number, e: any) => sum + (e.penalty || 0), 0);
  }, [unpaidEmis]);

  const oldEmi = emis[0]?.amount || 0;
  const currentRemainingCount = unpaidEmis.length;

  // Real-time calculation of new restructured terms
  const capitalizedPenalty = penaltyAction === 'capitalize' ? totalPenalties : 0;
  const waivedPenalty = penaltyAction === 'waive' ? totalPenalties : 0;
  const newPrincipal = outstandingBalance + capitalizedPenalty;

  const effectiveMoratorium = restructuringType === 'tenure_extension' ? 0 : moratoriumMonths;
  const effectiveAdditional = restructuringType === 'moratorium' ? 0 : additionalInstallments;
  const newRemainingCount = currentRemainingCount + effectiveAdditional;

  const revisedEmi = useMemo(() => {
    if (restructuringType === 'moratorium') {
      return oldEmi;
    }
    if (newRemainingCount <= 0) return oldEmi;
    return Math.round(newPrincipal / newRemainingCount);
  }, [restructuringType, oldEmi, newPrincipal, newRemainingCount]);

  const emiDifference = oldEmi - revisedEmi;

  // Projected dates
  const today = new Date();
  const projectedResumptionDate = useMemo(() => {
    const d = new Date(today);
    if (effectiveMoratorium > 0) {
      d.setMonth(d.getMonth() + effectiveMoratorium);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    return d;
  }, [today, effectiveMoratorium]);

  const projectedMaturityDate = useMemo(() => {
    const d = new Date(projectedResumptionDate);
    d.setMonth(d.getMonth() + newRemainingCount);
    return d;
  }, [projectedResumptionDate, newRemainingCount]);

  const handleSubmit = async () => {
    const finalReason = reason === 'Other' ? customReason.trim() : reason;
    if (!finalReason) {
      setError('Please select or specify a valid hardship reason for restructuring.');
      return;
    }

    const confirmText =
      `🔄 CONFIRM LOAN RESTRUCTURING?\n\n` +
      `• Loan Ref: LN${1000 + loan.id} (${customer.name})\n` +
      `• Restructure Type: ${restructuringType.toUpperCase().replace('_', ' ')}\n` +
      `• Current Outstanding: ${fmt(outstandingBalance)}\n` +
      `• Old EMI: ${fmt(oldEmi)} ➔ New EMI: ${fmt(revisedEmi)}\n` +
      `• Moratorium: ${effectiveMoratorium} Months\n` +
      `• Total New Remaining EMIs: ${newRemainingCount} Installments\n\n` +
      `Proceed to reschedule the loan schedule and execute this legal restructuring addendum?`;

    if (!window.confirm(confirmText)) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/loans/${loan.id}/restructure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          restructuringType,
          moratoriumMonths: effectiveMoratorium,
          additionalInstallments: effectiveAdditional,
          capitalizePenalty: penaltyAction === 'capitalize',
          waivePenalty: penaltyAction === 'waive',
          reason: finalReason,
          officerNotes: officerNotes.trim(),
          revisedStartDate: projectedResumptionDate.toISOString().slice(0, 10)
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to restructure loan');
      }

      onSuccess(data.addendum);
    } catch (err: any) {
      console.error('Restructure error:', err);
      setError(err.message || 'Server error while executing restructuring');
    } finally {
      setSubmitting(false);
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
        maxWidth: '920px',
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
          background: 'linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)',
          color: 'white',
          padding: '18px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '26px' }}>🔄</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                Loan Restructuring & Moratorium Engine
              </h3>
              <div style={{ fontSize: '12px', color: '#c7d2fe', marginTop: '2px' }}>
                RBI Resolution Framework • Reschedule Schedule • Tenure Extension • Supplementary Addendum
              </div>
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

        {/* Error Alert */}
        {error && (
          <div style={{
            background: '#fef2f2',
            borderLeft: '4px solid #ef4444',
            padding: '12px 20px',
            color: '#b91c1c',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontWeight: 700 }}>✕</button>
          </div>
        )}

        {/* Body Content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Info Banner: Account Overview */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px'
          }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>BORROWER ACCOUNT</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>{customer.name}</div>
              <div style={{ fontSize: '12px', color: '#475569', fontFamily: 'monospace' }}>
                LN{1000 + loan.id} • {loan.type || 'Personal Loan'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>ORIGINAL SANCTION</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>{fmt(loan.amount)}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {clearedEmis.length} of {loan.tenure} EMIs Cleared
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>CURRENT OUTSTANDING</div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#b91c1c' }}>{fmt(outstandingBalance)}</div>
              <div style={{ fontSize: '12px', color: '#dc2626' }}>
                {currentRemainingCount} EMIs Due / Pending
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>ACCRUED PENALTIES</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: totalPenalties > 0 ? '#dc2626' : '#16a34a' }}>
                {totalPenalties > 0 ? fmt(totalPenalties) : '₹0 (Nil)'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {totalPenalties > 0 ? 'Late payment penalty' : 'In good standing'}
              </div>
            </div>
          </div>

          {/* Section 1: Restructuring Type Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
              STEP 1: SELECT RESTRUCTURING MECHANISM
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                {
                  id: 'tenure_extension',
                  title: '📈 Tenure Extension',
                  desc: 'Add extra installments to immediately lower the monthly EMI burden for the borrower.',
                  tag: 'Most Popular'
                },
                {
                  id: 'moratorium',
                  title: '🏖️ Grace Period / Moratorium',
                  desc: 'Freeze repayments for 1 to 6 months. Shifts future EMIs without altering installment amount.',
                  tag: 'Disaster / Medical'
                },
                {
                  id: 'custom_plan',
                  title: '⚙️ Comprehensive Plan',
                  desc: 'Combine both a grace period (moratorium) AND extended tenure to maximize borrower relief.',
                  tag: 'Custom Hybrid'
                }
              ].map(opt => {
                const active = restructuringType === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setRestructuringType(opt.id as any)}
                    style={{
                      border: active ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                      borderRadius: '10px',
                      padding: '14px',
                      cursor: 'pointer',
                      background: active ? '#eef2ff' : '#ffffff',
                      transition: 'all 0.15s',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: active ? '#312e81' : '#0f172a' }}>
                        {opt.title}
                      </div>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: active ? '#4f46e5' : '#f1f5f9',
                        color: active ? '#ffffff' : '#475569'
                      }}>
                        {opt.tag}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                      {opt.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Tuning Parameters */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Left: Moratorium & Tenure Inputs */}
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '12px' }}>
                STEP 2: REVISED TENURE & TIMELINE
              </div>

              {/* Moratorium Duration (if applicable) */}
              {(restructuringType === 'moratorium' || restructuringType === 'custom_plan') && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Grace Period / Moratorium Duration:
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[1, 2, 3, 6].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMoratoriumMonths(m)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: moratoriumMonths === m ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                          background: moratoriumMonths === m ? '#4f46e5' : '#ffffff',
                          color: moratoriumMonths === m ? '#ffffff' : '#334155',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {m} Month{m > 1 ? 's' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Installments (if applicable) */}
              {(restructuringType === 'tenure_extension' || restructuringType === 'custom_plan') && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Additional Tenure to Add:
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[3, 6, 12, 24].map(ext => (
                      <button
                        key={ext}
                        type="button"
                        onClick={() => setAdditionalInstallments(ext)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: additionalInstallments === ext ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                          background: additionalInstallments === ext ? '#4f46e5' : '#ffffff',
                          color: additionalInstallments === ext ? '#ffffff' : '#334155',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        +{ext} EMIs
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Penalty Treatment */}
              {totalPenalties > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Overdue Late Penalty Treatment ({fmt(totalPenalties)}):
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { id: 'waive', label: '✅ Waive (100% Relief)' },
                      { id: 'capitalize', label: '➕ Capitalize into Principal' },
                      { id: 'keep', label: 'Keep Separate' }
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPenaltyAction(p.id as any)}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: penaltyAction === p.id ? '2px solid #16a34a' : '1px solid #cbd5e1',
                          background: penaltyAction === p.id ? '#f0fdf4' : '#ffffff',
                          color: penaltyAction === p.id ? '#166534' : '#475569',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Regulatory Reason & Notes */}
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '12px' }}>
                STEP 3: STATUTORY JUSTIFICATION & AUDIT
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Regulatory Grounds for Restructuring *
                </label>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option>Temporary Business Slowdown / Cashflow Crunch</option>
                  <option>Medical Emergency / Critical Illness of Borrower/Family</option>
                  <option>Crop Damage / Natural Calamity / Flood / Drought</option>
                  <option>Loss of Employment / Reduction in Income</option>
                  <option>Borrower Written Hardship Request (RBI Resolution Framework)</option>
                  <option>Other</option>
                </select>

                {reason === 'Other' && (
                  <input
                    type="text"
                    placeholder="Specify exact ground..."
                    value={customReason}
                    onChange={e => setCustomReason(e.target.value)}
                    style={{ width: '100%', marginTop: '6px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Credit Committee / Approver Assessment Notes
                </label>
                <textarea
                  rows={2}
                  value={officerNotes}
                  onChange={e => setOfficerNotes(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Real-Time Comparative Impact Simulator */}
          <div style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
            border: '2px solid #86efac',
            borderRadius: '12px',
            padding: '16px 20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🎯</span>
                <span>PROJECTED RESTRUCTURING IMPACT & BORROWER RELIEF</span>
              </div>
              {emiDifference > 0 && (
                <span style={{
                  background: '#22c55e',
                  color: 'white',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '20px'
                }}>
                  💰 Saves Borrower {fmt(emiDifference)} / month!
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>MONTHLY EMI</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#15803d' }}>
                  {fmt(revisedEmi)}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Old: <del>{fmt(oldEmi)}</del>
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>REMAINING EMIS</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
                  {newRemainingCount} Months
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Old: {currentRemainingCount} EMIs
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>NEXT PAYMENT DUE</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  {fmtDate(projectedResumptionDate.toISOString())}
                </div>
                <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                  {effectiveMoratorium > 0 ? `⏸️ ${effectiveMoratorium}m Moratorium` : 'Regular Cycle'}
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>NEW MATURITY DATE</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  {fmtDate(projectedMaturityDate.toISOString())}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Extended by {effectiveAdditional + effectiveMoratorium} Months
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Bar */}
        <div style={{
          padding: '16px 24px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'transparent',
              border: '1px solid #cbd5e1',
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              color: '#475569'
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              background: submitting ? '#64748b' : 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)',
              color: 'white',
              border: 'none',
              padding: '12px 28px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 800,
              cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(49, 46, 129, 0.35)'
            }}
          >
            {submitting ? '⏳ Executing Restructuring...' : '⚡ Execute Restructuring & Issue Addendum'}
          </button>
        </div>
      </div>
    </div>
  );
}
