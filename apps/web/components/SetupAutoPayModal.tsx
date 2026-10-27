'use client';
import React, { useState } from 'react';
import { API_URL } from '@/lib/api';

interface SetupAutoPayModalProps {
  loan: any;
  onSuccess: (mandate: any) => void;
  onClose: () => void;
}

export default function SetupAutoPayModal({ loan, onSuccess, onClose }: SetupAutoPayModalProps) {
  const [mandateType, setMandateType] = useState<'UPI_AUTOPAY' | 'E_NACH'>('UPI_AUTOPAY');
  const [maxAmount, setMaxAmount] = useState<number>(() => Math.round(Number(loan?.emiAmount || 0) * 1.2));
  const [notes, setNotes] = useState('Recurring monthly EMI collection via NPCI UPI AutoPay.');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdMandate, setCreatedMandate] = useState<any>(null);
  const [whatsappSent, setWhatsappSent] = useState(false);

  if (!loan) return null;

  const customer = loan.customer || {};
  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

  const handleCreateMandate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/payments/mandates/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          loanId: loan.id,
          mandateType,
          maxAmount,
          frequency: loan.frequency || 'monthly',
          notes
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to register mandate');
      }

      setCreatedMandate(data.mandate);
      onSuccess(data.mandate);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error registering mandate');
    } finally {
      setLoading(false);
    }
  };

  const handleSendWhatsApp = () => {
    if (!createdMandate) return;
    const msg = `Dear ${customer.name},\n\nPlease authorize your recurring UPI AutoPay mandate of ${fmt(loan.emiAmount)} for Loan LN${1000 + loan.id} with ${loan.company?.name || 'LenQredzo Capital'}.\n\n👉 Click to Authorize via PhonePe/GPay:\n${createdMandate.authLink}\n\nOnce authorized, your monthly EMIs will be automatically paid on due dates with zero hassle!\n\nNPCI UMN: ${createdMandate.umn}`;
    const cleanPhone = String(customer.phone || '').replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
    const waUrl = `https://web.whatsapp.com/send?phone=${phoneWithCountry}&text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
    setWhatsappSent(true);
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
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        maxWidth: '620px',
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
              🔄
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {createdMandate ? 'UPI AutoPay Mandate Registered' : 'Setup UPI AutoPay / e-NACH Mandate'}
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                Automated recurring EMI collections via PhonePe, GPay & NPCI
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              border: 'none',
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              cursor: 'pointer',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto' }}>
          {createdMandate ? (
            /* Mandate Registered & Active State */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px'
              }}>
                <span style={{ fontSize: '28px' }}>✅</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#166534' }}>
                    Mandate Active with NPCI (UMN: {createdMandate.umn})
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#15803d' }}>
                    Auto-debit authorization is registered for {customer.name} · Max recurring limit: {fmt(createdMandate.maxAmount)}.
                  </p>
                </div>
              </div>

              {/* Mandate Particulars */}
              <div style={{
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px 18px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                fontSize: '12px',
                background: '#f8fafc'
              }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>NPCI UMN Reference</span>
                  <code style={{ fontWeight: 700, color: '#1e40af', background: '#dbeafe', padding: '2px 6px', borderRadius: '4px' }}>
                    {createdMandate.umn}
                  </code>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Mandate Type</span>
                  <strong style={{ color: '#0f172a' }}>{createdMandate.mandateType}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Monthly EMI Due</span>
                  <strong style={{ color: '#15803d' }}>{fmt(loan.emiAmount)}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Max Auto-Debit Cap</span>
                  <strong style={{ color: '#0f172a' }}>{fmt(createdMandate.maxAmount)}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Destination Bank</span>
                  <strong style={{ color: '#0f172a' }}>{createdMandate.bankName}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Account Number</span>
                  <code style={{ color: '#0f172a' }}>{createdMandate.maskedAccount}</code>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  style={{
                    background: '#25d366',
                    color: 'white',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)'
                  }}
                >
                  <span>💬</span>
                  {whatsappSent ? '✓ Sent on WhatsApp (Send Again)' : 'Send Mandate Link to Borrower on WhatsApp'}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: '#1e40af',
                    color: 'white',
                    border: 'none',
                    padding: '11px 20px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Done & Return to Loan Details
                </button>
              </div>
            </div>
          ) : (
            /* Creation Form */
            <form onSubmit={handleCreateMandate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', color: '#b91c1c', fontSize: '13px' }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Borrower Summary */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '12px',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px'
              }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Borrower</span>
                  <strong style={{ color: '#0f172a' }}>{customer.name} ({customer.phone || 'No phone'})</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>EMI Amount</span>
                  <strong style={{ color: '#16a34a', fontSize: '14px' }}>{fmt(loan.emiAmount)} / month</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Verified Bank Account</span>
                  <strong style={{ color: '#0f172a' }}>{customer.bankName || 'Bank'} ({customer.bankAccountNumber || '••••'})</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>IFSC</span>
                  <strong style={{ color: '#0f172a' }}>{customer.bankIfsc || '—'}</strong>
                </div>
              </div>

              {/* Mandate Type Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Select Recurring Mandate Type
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {[
                    { id: 'UPI_AUTOPAY', label: '⚡ UPI AutoPay', desc: 'PhonePe, GPay, Paytm, BHIM UPI' },
                    { id: 'E_NACH', label: '🏦 e-NACH Mandate', desc: 'NetBanking / Debit Card / NPCI' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setMandateType(opt.id as any)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        border: mandateType === opt.id ? '2px solid #10b981' : '1px solid #cbd5e1',
                        background: mandateType === opt.id ? '#f0fdf4' : 'white',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '13px', color: mandateType === opt.id ? '#166534' : '#1e293b' }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: '11px', color: mandateType === opt.id ? '#15803d' : '#64748b', marginTop: '2px' }}>
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Recurring Limit */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Maximum Recurring Auto-Debit Limit (₹) *
                </label>
                <input
                  type="number"
                  required
                  value={maxAmount || ''}
                  onChange={(e) => setMaxAmount(Number(e.target.value))}
                  placeholder="E.g. 5000"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'block' }}>
                  Under RBI rules, auto-debits cannot exceed this max cap. Set slightly above EMI ({fmt(loan.emiAmount)}) to cover late fees.
                </span>
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Mandate Notes / Purpose
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
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

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: 'white',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#475569',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || maxAmount <= 0}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'white',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {loading ? 'Registering NPCI Mandate...' : '🔄 Register Mandate & Generate Link'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
