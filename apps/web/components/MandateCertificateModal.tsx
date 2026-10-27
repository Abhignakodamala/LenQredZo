'use client';
import React from 'react';

interface MandateCertificateModalProps {
  mandate: any;
  company?: any;
  onClose: () => void;
}

export default function MandateCertificateModal({ mandate, company, onClose }: MandateCertificateModalProps) {
  if (!mandate) return null;

  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
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
        maxWidth: '680px',
        width: '100%',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0'
      }}>
        {/* Top Actions */}
        <div style={{
          padding: '14px 24px',
          background: '#0f172a',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🛡️</span>
            <span style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '0.4px' }}>
              OFFICIAL NPCI / RBI E-MANDATE REGISTRATION CERTIFICATE
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

        {/* Certificate Body */}
        <div id="printable-mandate-certificate" style={{
          padding: '30px',
          overflowY: 'auto',
          background: '#ffffff',
          color: '#0f172a',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid #0f172a',
            paddingBottom: '16px',
            marginBottom: '20px'
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                {companyName}
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#64748b' }}>
                Registered NBFC · Digital Collections & NPCI Mandate Processing Cell
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                NPCI UPI AutoPay / e-NACH Standing Instruction Mandate
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{
                background: '#dcfce7',
                color: '#166534',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                display: 'inline-block',
                marginBottom: '4px'
              }}>
                ● ACTIVE WITH NPCI
              </span>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                UMN: {mandate.umn}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Type: {mandate.mandateType}
              </div>
            </div>
          </div>

          {/* Certificate Title */}
          <div style={{ textAlign: 'center', margin: '20px 0' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#1e3a8a' }}>
              Certificate of e-Mandate Registration
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              Issued in compliance with RBI Digital Recurring Payments Circulars & NPCI AutoPay Guidelines
            </p>
          </div>

          {/* Particulars Table */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 16px', color: '#64748b', width: '35%', background: '#f8fafc', fontWeight: 600 }}>Unique Mandate Number (UMN)</td>
                  <td style={{ padding: '10px 16px', fontWeight: 700, color: '#1e40af' }}>{mandate.umn}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 16px', color: '#64748b', background: '#f8fafc', fontWeight: 600 }}>Borrower (Payer Name)</td>
                  <td style={{ padding: '10px 16px', fontWeight: 700, color: '#0f172a' }}>{mandate.customerName}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 16px', color: '#64748b', background: '#f8fafc', fontWeight: 600 }}>Destination Bank & IFSC</td>
                  <td style={{ padding: '10px 16px', color: '#0f172a' }}>{mandate.bankName} (IFSC: {mandate.bankIfsc})</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 16px', color: '#64748b', background: '#f8fafc', fontWeight: 600 }}>Masked Bank Account</td>
                  <td style={{ padding: '10px 16px', color: '#0f172a', fontFamily: 'monospace' }}>{mandate.maskedAccount}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 16px', color: '#64748b', background: '#f8fafc', fontWeight: 600 }}>Loan Reference</td>
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: '#0f172a' }}>{mandate.loanRef}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 16px', color: '#64748b', background: '#f8fafc', fontWeight: 600 }}>Scheduled Monthly EMI</td>
                  <td style={{ padding: '10px 16px', fontWeight: 700, color: '#16a34a' }}>{fmt(mandate.emiAmount)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 16px', color: '#64748b', background: '#f8fafc', fontWeight: 600 }}>Maximum Auto-Debit Limit</td>
                  <td style={{ padding: '10px 16px', fontWeight: 700, color: '#0f172a' }}>{fmt(mandate.maxAmount)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 16px', color: '#64748b', background: '#f8fafc', fontWeight: 600 }}>Frequency & Recurrence</td>
                  <td style={{ padding: '10px 16px', color: '#0f172a' }}>Monthly Auto-Debit</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 16px', color: '#64748b', background: '#f8fafc', fontWeight: 600 }}>Validity Period</td>
                  <td style={{ padding: '10px 16px', color: '#0f172a' }}>
                    From {fmtDate(mandate.startDate)} until {fmtDate(mandate.endDate)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Statutory Disclaimer */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '11px',
            color: '#64748b',
            lineHeight: 1.5,
            marginBottom: '24px'
          }}>
            <strong>Statutory Terms:</strong> This mandate authorizes {companyName} to present recurring automated debits through the National Automated Clearing House (NACH) / Unified Payments Interface (UPI) system up to the maximum cap stated above. Pre-debit notifications will be issued 24 hours prior to each deduction as mandated by the Reserve Bank of India.
          </div>

          {/* Signatures */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '30px',
            marginTop: '20px',
            paddingTop: '20px',
            borderTop: '1px dashed #cbd5e1'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ height: '32px', borderBottom: '1px solid #94a3b8', width: '80%', margin: '0 auto 6px' }} />
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>
                Borrower E-Authorization
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                Authenticated via UPI PIN / NetBanking
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ height: '32px', borderBottom: '1px solid #94a3b8', width: '80%', margin: '0 auto 6px' }} />
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>
                Authorized NBFC Signatory
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                {companyName}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
