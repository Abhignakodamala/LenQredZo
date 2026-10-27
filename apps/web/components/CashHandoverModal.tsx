'use client';
import React, { useState } from 'react';
import { API_URL } from '@/lib/api';

interface CashHandoverModalProps {
  maxAmount: number;
  receivers: Array<{ id: number; name: string; role: string }>;
  onSuccess: (handover: any) => void;
  onClose: () => void;
}

export default function CashHandoverModal({ maxAmount, receivers, onSuccess, onClose }: CashHandoverModalProps) {
  const [receiverId, setReceiverId] = useState<number>(receivers[0]?.id || 0);
  const [totalAmount, setTotalAmount] = useState<number>(maxAmount);
  const [notes, setNotes] = useState('Evening field cash collection handover to branch vault.');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Denominations state
  const [d500, setD500] = useState<number>(0);
  const [d200, setD200] = useState<number>(0);
  const [d100, setD100] = useState<number>(0);
  const [d50, setD50] = useState<number>(0);
  const [d20, setD20] = useState<number>(0);
  const [d10, setD10] = useState<number>(0);
  const [coins, setCoins] = useState<number>(0);

  // Success state showing OTP
  const [initiatedHandover, setInitiatedHandover] = useState<any>(null);

  const calculatedTotal =
    (d500 * 500) +
    (d200 * 200) +
    (d100 * 100) +
    (d50 * 50) +
    (d20 * 20) +
    (d10 * 10) +
    coins;

  const diff = calculatedTotal - totalAmount;

  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiverId) {
      setError('Please select a receiving Branch Cashier or Manager.');
      return;
    }
    if (!totalAmount || totalAmount <= 0) {
      setError('Total amount must be greater than zero.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/cash-register/handover/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          receiverId,
          totalAmount,
          denominations: {
            count500: d500,
            count200: d200,
            count100: d100,
            count50: d50,
            count20: d20,
            count10: d10,
            coins
          },
          notes
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to initiate cash handover');
      }

      setInitiatedHandover(data.handover);
      onSuccess(data.handover);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error initiating cash handover');
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
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        maxWidth: '640px',
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
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)'
            }}>
              💼
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {initiatedHandover ? 'Handover Initiated — Verification Code' : 'Initiate Cash Handover to Vault'}
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                End-of-day physical cash surrender & denomination breakdown
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
          {initiatedHandover ? (
            /* Waiting for Cashier state with large OTP code */
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#dcfce7',
                color: '#15803d',
                fontSize: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                ✓
              </div>

              <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
                Handover of {fmt(initiatedHandover.totalAmount)} Awaiting Acceptance
              </h4>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 20px', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                Hand the physical currency to <strong>{initiatedHandover.receiverName}</strong> ({initiatedHandover.receiverRole}). Share the 4-digit verification code below:
              </p>

              {/* OTP Card */}
              <div style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                border: '2px dashed #94a3b8',
                borderRadius: '16px',
                padding: '24px',
                maxWidth: '320px',
                margin: '0 auto 24px',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Verification Code / OTP
                </span>
                <div style={{
                  fontSize: '44px',
                  fontWeight: 900,
                  letterSpacing: '10px',
                  color: '#1e40af',
                  fontFamily: 'monospace',
                  margin: '8px 0'
                }}>
                  {initiatedHandover.verificationCode}
                </div>
                <span style={{ fontSize: '12px', color: '#475569' }}>
                  Reference: <code>{initiatedHandover.handoverId}</code>
                </span>
              </div>

              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '12px',
                color: '#1e40af',
                textAlign: 'left',
                marginBottom: '20px'
              }}>
                ℹ️ <strong>Next Step:</strong> The cashier will verify your physical notes against your denomination breakdown, enter this 4-digit code into their terminal, and generate an official Vault Deposit Receipt for you.
              </div>

              <button
                type="button"
                onClick={onClose}
                style={{
                  background: '#1e40af',
                  color: 'white',
                  border: 'none',
                  padding: '10px 28px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Close & Return to Dashboard
              </button>
            </div>
          ) : (
            /* Initiation Form */
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', color: '#b91c1c', fontSize: '13px' }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Handover Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Receiving Cashier / Manager *
                  </label>
                  <select
                    value={receiverId}
                    onChange={(e) => setReceiverId(Number(e.target.value))}
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      background: 'white'
                    }}
                  >
                    {receivers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Total Handover Amount (₹) *
                  </label>
                  <input
                    type="number"
                    value={totalAmount || ''}
                    onChange={(e) => setTotalAmount(Number(e.target.value))}
                    required
                    placeholder="E.g. 45000"
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
                  {maxAmount > 0 && (
                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'block' }}>
                      Cash in custody: {fmt(maxAmount)}
                    </span>
                  )}
                </div>
              </div>

              {/* Interactive Currency Denomination Calculator */}
              <div style={{
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                <div style={{
                  background: '#f8fafc',
                  padding: '10px 16px',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontWeight: 700, fontSize: '12px', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Indian Currency Denomination Breakdown
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: diff === 0 ? '#dcfce7' : diff > 0 ? '#fef3c7' : '#fee2e2',
                    color: diff === 0 ? '#15803d' : diff > 0 ? '#92400e' : '#b91c1c'
                  }}>
                    {diff === 0 ? '✓ Exact Match' : diff > 0 ? `+${fmt(diff)} Excess` : `-${fmt(Math.abs(diff))} Shortage`}
                  </span>
                </div>

                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { label: '₹500 Note', value: 500, count: d500, set: setD500 },
                    { label: '₹200 Note', value: 200, count: d200, set: setD200 },
                    { label: '₹100 Note', value: 100, count: d100, set: setD100 },
                    { label: '₹50 Note', value: 50, count: d50, set: setD50 },
                    { label: '₹20 Note', value: 20, count: d20, set: setD20 },
                    { label: '₹10 Note', value: 10, count: d10, set: setD10 },
                  ].map((d) => (
                    <div key={d.value} style={{ display: 'grid', gridTemplateColumns: '120px 100px 1fr', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                        {d.label}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>×</span>
                        <input
                          type="number"
                          min="0"
                          value={d.count || ''}
                          onChange={(e) => d.set(Math.max(0, parseInt(e.target.value) || 0))}
                          placeholder="0"
                          style={{
                            width: '70px',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '13px',
                            textAlign: 'right',
                            outline: 'none'
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', textAlign: 'right' }}>
                        = {fmt(d.count * d.value)}
                      </span>
                    </div>
                  ))}

                  {/* Coins row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 100px 1fr', alignItems: 'center', gap: '12px', borderTop: '1px dashed #e2e8f0', paddingTop: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                      Coins Total
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>₹</span>
                      <input
                        type="number"
                        min="0"
                        value={coins || ''}
                        onChange={(e) => setCoins(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="0"
                        style={{
                          width: '70px',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          textAlign: 'right',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', textAlign: 'right' }}>
                      = {fmt(coins)}
                    </span>
                  </div>

                  {/* Total Calculated Banner */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#f8fafc',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    marginTop: '8px',
                    border: '1px solid #cbd5e1'
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                      Calculated Denomination Sum:
                    </span>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: diff === 0 ? '#15803d' : '#0f172a' }}>
                      {fmt(calculatedTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Handover Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="E.g. Field collection for East Zone"
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

              {/* Action Buttons */}
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
                  disabled={loading || totalAmount <= 0}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'white',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {loading ? 'Initiating Handover...' : `💼 Surrender ${fmt(totalAmount)} & Generate OTP`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
