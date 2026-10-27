'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { API_URL } from '@/lib/api';

interface LoanDisbursalModalProps {
  loan: any;
  onSuccess: (voucher: any) => void;
  onClose: () => void;
}

export default function LoanDisbursalModal({ loan, onSuccess, onClose }: LoanDisbursalModalProps) {
  const [payoutMode, setPayoutMode] = useState<'IMPS' | 'NEFT' | 'UPI'>('IMPS');
  const [notes, setNotes] = useState('Instant RBI-compliant loan disbursement via IMPS payout gateway.');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loan) return null;

  const customer = loan.customer || {};
  const isVerified = customer.bankAccountStatus === 'verified';
  const bankStatus = customer.bankAccountStatus || 'unverified';

  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

  const grossSanctionAmount = Number(loan.amount || 0);
  const processingFee = Number(loan.processingFee || 0);

  // Upfront interest calculation
  let upfrontInterest = 0;
  if (loan.deductUpfront) {
    if (loan.interestType === 'flat') {
      const periodsPerYear = loan.frequency === 'daily' ? 365 : loan.frequency === 'weekly' ? 52 : 12;
      upfrontInterest = Math.round(grossSanctionAmount * ((loan.interestRate || 0) / 100) * ((loan.tenure || 1) / periodsPerYear));
    }
  }

  const totalDeductions = processingFee + upfrontInterest;
  const netCreditAmount = grossSanctionAmount - totalDeductions;

  const handleDisburse = async () => {
    if (!isVerified) {
      setError('Cannot disburse to an unverified bank account. RBI regulations strictly prohibit unverified disbursements.');
      return;
    }

    if (netCreditAmount <= 0) {
      setError('Net disbursal amount must be greater than zero.');
      return;
    }

    const confirmed = window.confirm(
      `⚡ CONFIRM INSTANT DISBURSAL?\n\n• Amount: ${fmt(netCreditAmount)}\n• Beneficiary: ${customer.bankBeneficiaryName || customer.name}\n• Bank: ${customer.bankName || 'Bank'} (${customer.bankAccountNumber || 'A/C'})\n• Mode: ${payoutMode}\n\nProceed to transfer funds now?`
    );

    if (!confirmed) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/loans/${loan.id}/disburse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          payoutMode,
          notes
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Disbursal request failed');
      }

      onSuccess(data.voucher);
    } catch (err: any) {
      console.error('Disbursal error:', err);
      setError(err.message || 'An unexpected error occurred during disbursement.');
    } finally {
      setLoading(false);
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
      zIndex: 9998,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        maxWidth: '680px',
        width: '100%',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              fontSize: '20px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)'
            }}>
              ⚡
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                1-Click Instant Loan Disbursal (IMPS / Payout)
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                Loan Ref: LN{1000 + loan.id} · Borrower: {customer.name}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              border: 'none',
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Body content */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Error Message */}
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              padding: '12px 16px',
              color: '#991b1b',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}>
              <span style={{ fontSize: '18px', lineHeight: 1 }}>⚠️</span>
              <div>
                <strong>Disbursal Blocked:</strong>
                <p style={{ margin: '4px 0 0 0' }}>{error}</p>
              </div>
            </div>
          )}

          {/* Section 1: RBI Digital Lending Compliance & Bank Verification Status */}
          <div style={{
            border: isVerified ? '1px solid #bbf7d0' : '1px solid #fed7aa',
            background: isVerified ? '#f0fdf4' : '#fffbeb',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>🛡️</span>
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                  RBI Digital Lending Compliance: Bank Verification
                </span>
              </div>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '20px',
                background: isVerified ? '#dcfce7' : '#fee2e2',
                color: isVerified ? '#166534' : '#991b1b',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                {isVerified ? '● VERIFIED & APPROVED' : `● ${bankStatus.toUpperCase()}`}
              </span>
            </div>

            {isVerified ? (
              <div style={{
                background: 'white',
                borderRadius: '8px',
                border: '1px solid #dcfce7',
                padding: '12px 14px',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px',
                fontSize: '12px'
              }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Beneficiary Legal Name</span>
                  <strong style={{ color: '#0f172a' }}>{customer.bankBeneficiaryName || customer.name}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Destination Bank</span>
                  <strong style={{ color: '#0f172a' }}>{customer.bankName || 'Borrower Bank'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Masked Account Number</span>
                  <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#0f172a', fontWeight: 600 }}>
                    {customer.bankAccountNumber || '••••••••'}
                  </code>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Bank IFSC</span>
                  <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#0f172a', fontWeight: 600 }}>
                    {customer.bankIfsc || '—'}
                  </code>
                </div>
                {customer.bankNameMatchScore && (
                  <div style={{ gridColumn: 'span 2', fontSize: '11px', color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    ✓ Name Match Score: {customer.bankNameMatchScore}% · Penny Drop Confirmed
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '12px',
                color: '#991b1b'
              }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>
                  🚨 Disbursal is blocked under RBI Digital Lending Guidelines 2022/2026.
                </p>
                <p style={{ margin: '0 0 10px 0', color: '#7f1d1d', lineHeight: 1.4 }}>
                  Loan proceeds can strictly only be transferred to a bank account in the verified name of the primary borrower. Unverified accounts or mismatch accounts cannot receive funds.
                </p>
                <Link
                  href={`/dashboard/customers/${customer.id}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#dc2626',
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    textDecoration: 'none'
                  }}
                >
                  Verify Borrower Bank Account via ₹1 UPI / Penny Drop →
                </Link>
              </div>
            )}
          </div>

          {/* Section 2: Financial Breakdown (Gross Sanction vs Upfront Deductions vs Net Payout) */}
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#f8fafc',
              padding: '10px 16px',
              borderBottom: '1px solid #e2e8f0',
              fontWeight: 700,
              fontSize: '12px',
              color: '#334155',
              textTransform: 'uppercase',
              letterSpacing: '0.4px'
            }}>
              Disbursement Financial Calculation
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Gross Sanction Amount</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{fmt(grossSanctionAmount)}</span>
              </div>

              {processingFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>Less: Processing Fee (Upfront Deduction)</span>
                  <span style={{ fontWeight: 600, color: '#dc2626' }}>- {fmt(processingFee)}</span>
                </div>
              )}

              {upfrontInterest > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>Less: Upfront Interest Deduction</span>
                  <span style={{ fontWeight: 600, color: '#dc2626' }}>- {fmt(upfrontInterest)}</span>
                </div>
              )}

              {totalDeductions > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  fontSize: '12px',
                  borderTop: '1px dashed #cbd5e1',
                  marginTop: '4px'
                }}>
                  <span style={{ color: '#94a3b8' }}>Total Upfront Deductions</span>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>- {fmt(totalDeductions)}</span>
                </div>
              )}

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                marginTop: '10px',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                borderRadius: '8px',
                border: '1px solid #86efac'
              }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block' }}>
                    Net Amount to be Disbursed
                  </span>
                  <span style={{ fontSize: '12px', color: '#15803d' }}>
                    Direct credit to verified bank account
                  </span>
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#166534' }}>
                  {fmt(netCreditAmount)}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Payout Gateway & Settlement Mode */}
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Select Payout Settlement Mode
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
              {[
                { mode: 'IMPS', label: '⚡ IMPS (Instant)', desc: '24x7 Real-time credit' },
                { mode: 'NEFT', label: '🏦 NEFT', desc: 'RBI hourly batch' },
                { mode: 'UPI', label: '📱 UPI Payout', desc: 'Direct VPA credit' }
              ].map(opt => (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => setPayoutMode(opt.mode as any)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: payoutMode === opt.mode ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: payoutMode === opt.mode ? '#eff6ff' : 'white',
                    color: payoutMode === opt.mode ? '#1e40af' : '#475569',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>{opt.label}</div>
                  <div style={{ fontSize: '10px', color: payoutMode === opt.mode ? '#3b82f6' : '#94a3b8', marginTop: '2px' }}>
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>

            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
              Disbursement Notes / Reference Remarks
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g. Instant RBI-compliant loan disbursement"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '16px 24px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'white',
              border: '1px solid #cbd5e1',
              padding: '10px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#475569',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDisburse}
            disabled={!isVerified || loading || netCreditAmount <= 0}
            style={{
              background: !isVerified
                ? '#94a3b8'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              padding: '11px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: !isVerified || loading || netCreditAmount <= 0 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: isVerified && !loading ? '0 4px 12px rgba(16, 185, 129, 0.35)' : 'none',
              opacity: !isVerified || loading ? 0.65 : 1
            }}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                Processing Instant IMPS Transfer & Generating UTR...
              </>
            ) : (
              <>
                <span>⚡</span>
                Confirm & Disburse {fmt(netCreditAmount)} via {payoutMode} Now
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
