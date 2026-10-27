'use client';
import React from 'react';

interface CashHandoverVoucherModalProps {
  voucher: any;
  company?: any;
  onClose: () => void;
}

// Converts number to Indian currency words
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

export default function CashHandoverVoucherModal({ voucher, company, onClose }: CashHandoverVoucherModalProps) {
  if (!voucher) return null;

  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDateTime = (d?: string) => d
    ? new Date(d).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata'
      })
    : '—';

  const companyName = company?.name || 'LENQREDZO CAPITAL PRIVATE LIMITED';
  const totalAmount = Number(voucher.totalAmount || 0);
  const denoms = voucher.confirmedDenominations || voucher.denominations || {};

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
        maxWidth: '700px',
        width: '100%',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0'
      }}>
        {/* Top Bar with Print Button */}
        <div style={{
          padding: '14px 24px',
          background: '#0f172a',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🏛️</span>
            <span style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '0.4px' }}>
              OFFICIAL CASH HANDOVER & VAULT DEPOSIT VOUCHER
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => window.print()}
              style={{
                background: '#2563eb',
                color: 'white',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🖨️ Print / Save PDF
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1',
                border: 'none',
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
        </div>

        {/* Printable Voucher Sheet */}
        <div id="printable-cash-handover-voucher" style={{
          padding: '28px',
          overflowY: 'auto',
          background: '#ffffff',
          color: '#0f172a',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        }}>
          {/* Company Letterhead */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid #0f172a',
            paddingBottom: '16px',
            marginBottom: '20px'
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.4px' }}>
                {companyName}
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#64748b' }}>
                Registered NBFC / Lending Operations · Day-End Cash Desk & Vault Division
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                Internal Audit Compliant Cash Settlement System
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{
                background: '#dcfce7',
                color: '#15803d',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                display: 'inline-block',
                marginBottom: '4px'
              }}>
                ● VAULT DEPOSIT SETTLED
              </span>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                Voucher Ref: {voucher.voucherNumber || 'VR-SETTLED'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Handover ID: {voucher.handoverId}
              </div>
            </div>
          </div>

          {/* Settled Cash Amount Callout Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Cash Surrendered & Deposited into Safe
              </span>
              <div style={{ fontSize: '13px', color: '#1e40af', fontWeight: 600, marginTop: '2px' }}>
                {numberToWordsINR(totalAmount)}
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>
              {fmt(totalAmount)}
            </div>
          </div>

          {/* Handover Particulars (Surrendered By vs Received By) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '20px'
          }}>
            {/* Surrendering Staff */}
            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px 14px',
              background: '#ffffff'
            }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '6px' }}>
                Surrendered By (Field Collection Agent)
              </span>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                {voucher.agentName}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Role: {voucher.agentRole || 'Collection Agent'} · ID #{voucher.agentId}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Initiated At: {fmtDateTime(voucher.initiatedAt)}
              </div>
            </div>

            {/* Receiving Cashier / Vault Officer */}
            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px 14px',
              background: '#ffffff'
            }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '6px' }}>
                Accepted & Deposited By (Cashier / Safe In-Charge)
              </span>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                {voucher.acceptedByName || voucher.receiverName}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Role: {voucher.acceptedByRole || voucher.receiverRole || 'Branch Cashier'} · ID #{voucher.acceptedByUserId || voucher.receiverId}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Settled At: {fmtDateTime(voucher.settledAt)}
              </div>
            </div>
          </div>

          {/* Verified Currency Denomination Breakdown */}
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '20px'
          }}>
            <div style={{
              background: '#f8fafc',
              padding: '8px 14px',
              fontWeight: 700,
              fontSize: '11px',
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              borderBottom: '1px solid #e2e8f0'
            }}>
              Physical Currency Denomination Count Verified at Counter
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9', color: '#64748b', textAlign: 'left' }}>
                  <th style={{ padding: '8px 14px' }}>Denomination</th>
                  <th style={{ padding: '8px 14px', textAlign: 'center' }}>Count of Notes</th>
                  <th style={{ padding: '8px 14px', textAlign: 'right' }}>Total Subtotal (₹)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { denom: '₹500 Notes', count: denoms.count500 || 0, val: 500 },
                  { denom: '₹200 Notes', count: denoms.count200 || 0, val: 200 },
                  { denom: '₹100 Notes', count: denoms.count100 || 0, val: 100 },
                  { denom: '₹50 Notes', count: denoms.count50 || 0, val: 50 },
                  { denom: '₹20 Notes', count: denoms.count20 || 0, val: 20 },
                  { denom: '₹10 Notes', count: denoms.count10 || 0, val: 10 },
                  { denom: 'Coins / Small Change', count: denoms.coins || 0, val: 1, isCoin: true }
                ].filter(r => r.count > 0).map((row, idx) => (
                  <tr key={row.denom} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                    <td style={{ padding: '8px 14px', fontWeight: 600, color: '#334155' }}>{row.denom}</td>
                    <td style={{ padding: '8px 14px', textAlign: 'center', color: '#0f172a' }}>{row.count}</td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                      {fmt(row.count * row.val)}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                  <td style={{ padding: '10px 14px', color: '#0f172a' }}>Total Physical Cash Counted</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>—</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#15803d', fontSize: '14px' }}>
                    {fmt(totalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Notes */}
          {voucher.cashierNotes && (
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '24px', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px' }}>
              <strong>Cashier Remarks:</strong> {voucher.cashierNotes}
            </div>
          )}

          {/* Signatures & Disclaimers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '30px',
            marginTop: '30px',
            paddingTop: '20px',
            borderTop: '1px dashed #cbd5e1'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ height: '36px', borderBottom: '1px solid #94a3b8', width: '80%', margin: '0 auto 6px' }} />
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>
                Field Collection Agent Signature
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                {voucher.agentName}
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ height: '36px', borderBottom: '1px solid #94a3b8', width: '80%', margin: '0 auto 6px' }} />
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>
                Branch Cashier / Safe Custodian Signature
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                {voucher.acceptedByName || voucher.receiverName}
              </div>
            </div>
          </div>

          {/* Footer Security Notice */}
          <div style={{
            marginTop: '24px',
            paddingTop: '12px',
            borderTop: '1px solid #f1f5f9',
            fontSize: '9px',
            color: '#94a3b8',
            textAlign: 'center',
            lineHeight: 1.4
          }}>
            This is an electronically generated and cryptographically logged Cash Settlement Voucher under LenQredzo Secure Cash Operations. Once signed and vaulted, custody of funds shifts legally from field staff to the branch cash vault.
          </div>
        </div>
      </div>
    </div>
  );
}
