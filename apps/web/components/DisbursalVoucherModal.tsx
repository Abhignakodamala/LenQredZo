'use client';
import React from 'react';

interface DisbursalVoucherModalProps {
  voucher: any;
  company?: any;
  onClose: () => void;
}

export default function DisbursalVoucherModal({ voucher, company, onClose }: DisbursalVoucherModalProps) {
  if (!voucher) return null;

  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtDateTime = (d?: string) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—';

  const companyName = company?.name || 'LENQREDZO CAPITAL PRIVATE LIMITED';

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
        maxWidth: '720px',
        width: '100%',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0'
      }}>
        {/* Modal Top Bar (Actions) */}
        <div style={{
          padding: '14px 24px',
          background: '#0f172a',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>⚡</span>
            <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.3px' }}>
              OFFICIAL LOAN DISBURSEMENT ADVICE
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

        {/* Printable Voucher Body */}
        <div id="printable-disbursal-voucher" style={{
          flex: 1,
          overflowY: 'auto',
          padding: '32px 36px',
          background: '#ffffff',
          color: '#0f172a',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '18px', marginBottom: '24px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                {companyName}
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#475569', fontWeight: 500 }}>
                RBI Registered Non-Banking Financial Company (NBFC) · Digital Lending Division
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                Reg. Office: Corporate Financial Tower, Bangalore, Karnataka - 560001
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{
                background: '#dcfce7',
                color: '#15803d',
                border: '1px solid #86efac',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                display: 'inline-block'
              }}>
                ✓ Payment Settled
              </span>
              <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>
                Date: <strong>{fmtDateTime(voucher.disbursedAt)}</strong>
              </p>
            </div>
          </div>

          {/* Transaction Reference Hero Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            padding: '14px 18px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                Bank UTR / Transaction Reference Number
              </span>
              <div style={{ fontSize: '17px', fontWeight: 800, color: '#1e40af', fontFamily: 'monospace', marginTop: '2px' }}>
                {voucher.utr}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Loan Reference
                </span>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                  {voucher.loanReference}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Transfer Gateway
                </span>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                  {voucher.payoutMode || 'IMPS 24x7'}
                </div>
              </div>
            </div>
          </div>

          {/* Two Columns: Borrower & Bank Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            {/* Borrower Details */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', background: '#fafafa' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                👤 Borrower Particulars
              </h4>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                {voucher.borrowerName}
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                Borrower ID: #{voucher.borrowerId}
              </p>
              {voucher.borrowerPhone && (
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Contact: +91 {voucher.borrowerPhone}
                </p>
              )}
            </div>

            {/* Recipient Bank Details */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', background: '#fafafa' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🏦 Credit Destination Account
              </h4>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                {voucher.bankName}
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#334155', fontFamily: 'monospace' }}>
                A/C: <strong>{voucher.maskedAccount}</strong>
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                IFSC: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{voucher.bankIfsc}</span>
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                ✓ Verified Beneficiary: {voucher.beneficiaryName}
              </p>
            </div>
          </div>

          {/* Disbursal Financial Breakdown Table */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', marginBottom: '24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ textAlign: 'left', padding: '10px 16px', color: '#475569', fontWeight: 700 }}>Item Description</th>
                  <th style={{ textAlign: 'right', padding: '10px 16px', color: '#475569', fontWeight: 700 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600 }}>Gross Loan Sanction Amount</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{fmt(voucher.grossSanctionAmount)}</td>
                </tr>
                {voucher.processingFee > 0 && (
                  <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#dc2626' }}>
                    <td style={{ padding: '8px 16px' }}>Less: Upfront Processing & Documentation Fee</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600 }}>- {fmt(voucher.processingFee)}</td>
                  </tr>
                )}
                {voucher.upfrontInterest > 0 && (
                  <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#dc2626' }}>
                    <td style={{ padding: '8px 16px' }}>Less: Interest Deducted Upfront</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600 }}>- {fmt(voucher.upfrontInterest)}</td>
                  </tr>
                )}
                <tr style={{ background: '#f0fdf4', borderTop: '2px solid #86efac' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: '#166534', fontSize: '14px' }}>
                    Net Amount Credited to Borrower (Transferred)
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#166534', fontSize: '17px' }}>
                    {fmt(voucher.netCreditAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* RBI Compliance Notice & Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '30px', paddingTop: '18px', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ maxWidth: '380px' }}>
              <p style={{ margin: 0, fontSize: '10px', color: '#64748b', lineHeight: '1.4' }}>
                * This is a system-generated electronic loan disbursement advice issued pursuant to RBI Master Directions on Digital Lending. The net loan proceeds have been electronically transferred via NPCI IMPS direct beneficiary credit to the borrower&apos;s verified bank account.
              </p>
              <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#0f172a', fontWeight: 600 }}>
                Disbursed By: {voucher.disbursedBy} ({voucher.disbursedByRole})
              </p>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '120px',
                height: '45px',
                borderBottom: '1px dashed #94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 4px'
              }}>
                <span style={{ fontSize: '20px' }}>✍️</span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>
                Authorized Signatory
              </span>
              <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>
                LenQredzo Operations
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
