'use client';
import React, { useState } from 'react';
import { API_URL } from '@/lib/api';

type ForeclosureModalProps = {
  loan: any;
  onClose: () => void;
  onSuccess: (updatedLoan: any) => void;
};

export default function ForeclosureModal({ loan, onClose, onSuccess }: ForeclosureModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Unpaid calculations
  const unpaidEmis = (loan?.emis || []).filter((e: any) => e.status !== 'paid');
  const unpaidEmiTotal = unpaidEmis.reduce((s: number, e: any) => s + (e.amount - (e.paidAmount || 0)), 0);
  const unpaidPenaltyTotal = unpaidEmis.reduce((s: number, e: any) => s + (e.penaltyPaid ? 0 : (e.penalty || 0)), 0);

  // Settlement Form State
  const [discount, setDiscount] = useState<string>('0');
  const [charges, setCharges] = useState<string>('0');
  const [method, setMethod] = useState<string>('cash');
  const [reference, setReference] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('Pre-closure lump sum settlement');

  const discountNum = Number(discount) || 0;
  const chargesNum = Number(charges) || 0;

  const calculatedSettlement = Math.max(0, Math.round(unpaidEmiTotal + unpaidPenaltyTotal + chargesNum - discountNum));
  const [customAmount, setCustomAmount] = useState<string>('');

  const finalSettlementAmount = customAmount !== '' ? Number(customAmount) : calculatedSettlement;

  const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (finalSettlementAmount <= 0 && unpaidEmiTotal > 0) {
      if (!confirm('The final settlement amount is ₹0. Are you sure you want to write off the remaining dues and close this loan?')) {
        return;
      }
    }

    if (method !== 'cash' && !reference.trim()) {
      setError(`A Transaction Reference / UTR ID is required for ${method.toUpperCase()} payments.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/loans/${loan.id}/foreclose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          settlementAmount: finalSettlementAmount,
          discount: discountNum,
          charges: chargesNum,
          method,
          reference: reference.trim(),
          remarks: remarks.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Failed to foreclose loan.');
        setSubmitting(false);
        return;
      }

      onSuccess(data.loan);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Network error while foreclosing loan.');
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '580px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#fef3c7'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚡ Foreclose / Pre-Close Loan
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#78350f' }}>
              Loan A/C: LN{1000 + loan.id} · {loan.customer?.name}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              color: '#92400e',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#dc2626' }}>
                ⚠️ {error}
              </div>
            )}

            {/* Current Loan Dues Summary */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px 18px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px'
            }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Unpaid EMIs</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{unpaidEmis.length} Installments</span>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>EMI Dues</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#dc2626' }}>{fmt(unpaidEmiTotal)}</span>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Accrued Penalty</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: unpaidPenaltyTotal > 0 ? '#dc2626' : '#64748b' }}>
                  {fmt(unpaidPenaltyTotal)}
                </span>
              </div>
            </div>

            {/* Pre-closure Adjustments */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                  Interest Rebate / Discount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px'
                  }}
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>Waives unaccrued future interest</span>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                  Pre-Closure Admin Charges (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={charges}
                  onChange={(e) => setCharges(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px'
                  }}
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>Lender early-closure fee</span>
              </div>
            </div>

            {/* Final Settlement Amount Highlight */}
            <div style={{
              background: '#ecfdf5',
              border: '2px solid #10b981',
              borderRadius: '10px',
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#065f46', textTransform: 'uppercase' }}>
                  Final Settlement Amount to Collect
                </span>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#047857' }}>
                  Includes all remaining balance minus rebate
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '22px', fontWeight: 800, color: '#065f46' }}>
                  {fmt(finalSettlementAmount)}
                </span>
              </div>
            </div>

            {/* Payment Mode & Reference */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                  Settlement Payment Mode *
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    background: 'white'
                  }}
                >
                  <option value="cash">Cash (Counter / Field)</option>
                  <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="bank_transfer">Bank Transfer (IMPS / NEFT)</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                  Reference / UTR / Cheque No {method !== 'cash' ? '*' : '(Optional)'}
                </label>
                <input
                  type="text"
                  placeholder={method === 'cash' ? 'Optional note' : '12-digit UTR or Txn ID'}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px'
                  }}
                />
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                Closure Remarks / Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Lump sum pre-closure requested by borrower"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '13px'
                }}
              />
            </div>

            {/* Legal Notice */}
            <div style={{
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: '6px',
              padding: '10px 12px',
              fontSize: '11px',
              color: '#475569',
              lineHeight: 1.4
            }}>
              ℹ️ <strong>Permanent Action:</strong> Clicking "Confirm Foreclosure & Settle" will mark all {unpaidEmis.length} unpaid installments as paid, record the settlement payment in the company ledger, set the loan status to <strong>Completed</strong>, and immediately unlock the official <strong>No-Objection Certificate (NOC)</strong>.
            </div>

          </div>

          {/* Modal Actions */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #e5e7eb',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                background: 'white',
                color: '#374151',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '8px 20px',
                borderRadius: '6px',
                border: 'none',
                background: '#059669',
                color: 'white',
                fontSize: '13px',
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {submitting ? 'Settling...' : `✓ Settle ${fmt(finalSettlementAmount)} & Close Loan`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
