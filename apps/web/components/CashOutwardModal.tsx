'use client';
import React, { useState, useRef } from 'react';
import { API_URL } from '@/lib/api';

export interface CashOutwardModalProps {
  currentVaultBalance?: number;
  branchName?: string;
  onSuccess: () => void;
  onClose: () => void;
}

const CATEGORY_OPTIONS = [
  { id: 'loan_disbursal', label: '⚡ Loan Cash Disbursal (Borrower Payout)', icon: '💰' },
  { id: 'bank_deposit', label: '🏦 Bank Deposit (Cash to Company Bank Account)', icon: '🏦' },
  { id: 'office_expense', label: '🏢 Office Expense (Rent, Power, Tea, Travel)', icon: '🧾' },
  { id: 'partner_drawings', label: '💼 Owner / Partner Capital Withdrawal', icon: '👤' },
  { id: 'other', label: '📝 Other Cash Outward', icon: '📝' }
];

export default function CashOutwardModal({
  currentVaultBalance = 0,
  branchName = 'Main Branch',
  onSuccess,
  onClose
}: CashOutwardModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('loan_disbursal');
  const [recipientName, setRecipientName] = useState<string>('');
  const [loanRef, setLoanRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdVoucher, setCreatedVoucher] = useState<any | null>(null);

  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDateTime = (d?: string) => d ? new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }) : new Date().toLocaleString('en-IN');

  const storedCompany = typeof window !== 'undefined' ? (() => {
    try {
      const c = localStorage.getItem('company');
      return c ? JSON.parse(c) : null;
    } catch {
      return null;
    }
  })() : null;

  const companyName = storedCompany?.name || 'LENQREDZO CAPITAL PRIVATE LIMITED';
  const rawLogo = storedCompany?.logo;
  const companyLogo = rawLogo
    ? (rawLogo.startsWith('http') || rawLogo.startsWith('data:') ? rawLogo : `${API_URL || ''}${rawLogo}`)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid amount greater than ₹0');
      return;
    }
    if (!recipientName.trim()) {
      setError('Please specify who received the cash');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API_URL}/api/cash-register/outward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: numAmount,
          category,
          recipientName: recipientName.trim(),
          loanRef: loanRef.trim() ? loanRef.trim().toUpperCase() : undefined,
          notes: notes.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to record cash outward');
      }

      setCreatedVoucher(data.outward);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred while saving.');
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
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        maxWidth: createdVoucher ? '650px' : '520px',
        width: '100%',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0'
      }}>
        {/* Top Header */}
        <div style={{
          padding: '16px 20px',
          background: '#0f172a',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>➖</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                {createdVoucher ? 'Official Cash Outward Voucher' : 'Record Cash Out / Vault Withdrawal'}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                Branch Safe Locker · {branchName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#cbd5e1',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        {createdVoucher ? (
          /* Printable Voucher View */
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f8fafc' }}>
            <div
              id="printable-cash-outward-voucher"
              ref={printRef}
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '28px 32px',
                border: '1.5px solid #dc2626',
                fontFamily: 'system-ui, sans-serif',
                color: '#0f172a',
                lineHeight: 1.5,
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
              }}
            >
              {/* Letterhead */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #dc2626', paddingBottom: '14px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {companyLogo && (
                    <img
                      src={companyLogo}
                      alt={companyName}
                      style={{ maxHeight: '44px', maxWidth: '120px', objectFit: 'contain' }}
                    />
                  )}
                  <div>
                    <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                      {companyName}
                    </h2>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                      Registered NBFC · Branch Cash Desk & Vault Division
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    background: '#fef2f2',
                    color: '#dc2626',
                    border: '1px solid #fecaca',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    display: 'inline-block'
                  }}>
                    CASH DISBURSAL / OUTWARD
                  </span>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>
                    Voucher: <strong>{createdVoucher.outwardId}</strong>
                  </p>
                </div>
              </div>

              {/* Amount Highlight Box */}
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '14px 18px',
                marginBottom: '18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#991b1b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Cash Paid Out of Vault
                  </span>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#dc2626', marginTop: '2px' }}>
                    {fmt(createdVoucher.amount)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '11px', color: '#64748b' }}>
                  Date: <strong>{fmtDateTime(createdVoucher.createdAt)}</strong><br />
                  Branch: <strong>{branchName}</strong>
                </div>
              </div>

              {/* Transaction Particulars */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', marginBottom: '24px' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 0', color: '#64748b', width: '38%' }}>Purpose / Category</td>
                    <td style={{ padding: '8px 0', fontWeight: 600, color: '#0f172a' }}>
                      {CATEGORY_OPTIONS.find(c => c.id === createdVoucher.category)?.label || createdVoucher.category}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 0', color: '#64748b' }}>Paid / Handed Over To</td>
                    <td style={{ padding: '8px 0', fontWeight: 700, color: '#0f172a' }}>
                      {createdVoucher.recipientName}
                    </td>
                  </tr>
                  {createdVoucher.loanRef && (
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px 0', color: '#64748b' }}>Loan Reference Ref</td>
                      <td style={{ padding: '8px 0', fontWeight: 700, color: '#1e40af' }}>
                        {createdVoucher.loanRef}
                      </td>
                    </tr>
                  )}
                  {createdVoucher.notes && (
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px 0', color: '#64748b' }}>Remarks / Notes</td>
                      <td style={{ padding: '8px 0', color: '#334155' }}>
                        {createdVoucher.notes}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ padding: '8px 0', color: '#64748b' }}>Authorized Cashier / Manager</td>
                    <td style={{ padding: '8px 0', fontWeight: 600, color: '#0f172a' }}>
                      {createdVoucher.authorizedByName} ({createdVoucher.authorizedByRole || 'Staff'})
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '24px',
                marginTop: '32px',
                paddingTop: '20px',
                borderTop: '1px dashed #cbd5e1'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ height: '44px', borderBottom: '1px solid #94a3b8', marginBottom: '6px' }} />
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '12px' }}>{createdVoucher.recipientName}</p>
                  <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>Receiver Signature / Acknowledgement</p>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ height: '44px', borderBottom: '1px solid #94a3b8', marginBottom: '6px' }} />
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '12px' }}>{createdVoucher.authorizedByName}</p>
                  <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>Authorized Cashier / Vault Keeper</p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  height: '38px',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                🖨️ Print Voucher
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  height: '38px',
                  background: '#0f172a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0 20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ✓ Done
              </button>
            </div>
          </div>
        ) : (
          /* Outward Form */
          <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', color: '#b91c1c', fontSize: '13px' }}>
                ⚠️ {error}
              </div>
            )}

            {/* Vault Balance Indicator */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                Available Vault Balance:
              </span>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#16a34a' }}>
                {fmt(currentVaultBalance)}
              </span>
            </div>

            {/* Amount */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Cash Amount to Deduct (₹) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 50000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#dc2626',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Category / Reason */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Purpose / Category <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
                  background: 'white',
                  boxSizing: 'border-box'
                }}
              >
                {CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Paid / Handed Over To */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Paid / Handed Over To (Name) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Ramesh Kumar (Borrower) / Manager"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                required
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Loan Reference (Optional) */}
            {category === 'loan_disbursal' && (
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Loan Reference ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. LN1005"
                  value={loanRef}
                  onChange={(e) => setLoanRef(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            {/* Remarks / Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Remarks / Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Physical currency counted and handed over"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  height: '38px',
                  padding: '0 18px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
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
                  height: '38px',
                  padding: '0 22px',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  opacity: submitting ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 3px rgba(220, 38, 38, 0.3)'
                }}
              >
                {submitting ? 'Deducting...' : '➖ Confirm & Deduct from Vault'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
