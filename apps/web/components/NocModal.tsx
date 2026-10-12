'use client';
import React, { useRef } from 'react';

type NocModalProps = {
  loan: any;
  onClose: () => void;
};

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

export default function NocModal({ loan, onClose }: NocModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!loan) return null;

  const companyName = loan.company?.name || 'ABHI FINANCE';
  const customer = loan.customer || {};
  const guarantors = loan.guarantors || [];
  const payments = loan.payments || [];

  const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const totalPaid = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const lastPayment = payments.length > 0 ? payments[payments.length - 1] : null;
  const closureDate = lastPayment?.paidAt || loan.updatedAt || new Date().toISOString();

  const nocRefNo = `NOC-${companyName.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()}-2026-LN${1000 + loan.id}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-noc-certificate, #printable-noc-certificate * {
            visibility: visible;
          }
          #printable-noc-certificate {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 30px !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div style={{
        background: 'white',
        borderRadius: '16px',
        maxWidth: '860px',
        width: '100%',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Top Action Bar */}
        <div className="no-print" style={{
          padding: '14px 24px',
          background: '#064e3b',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #047857'
        }}>
          <div>
            <span style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              📜 Official No-Objection Certificate (NOC) & Loan Clearance
            </span>
            <span style={{ fontSize: '12px', color: '#a7f3d0' }}>
              Ref: {nocRefNo} · Loan LN{1000 + loan.id} · Status: FULLY SETTLED / CLOSED
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handlePrint}
              style={{
                background: '#10b981',
                color: 'white',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
            >
              🖨️ Print / Save as PDF
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                color: '#ecfdf5',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Container */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', padding: '24px' }}>
          <div
            id="printable-noc-certificate"
            ref={printRef}
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '44px 48px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              border: '2px solid #059669',
              fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              color: '#0f172a',
              lineHeight: 1.6,
              fontSize: '13px',
              maxWidth: '780px',
              margin: '0 auto',
              position: 'relative'
            }}
          >
            {/* Watermark in background */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-30deg)',
              fontSize: '80px',
              fontWeight: 900,
              color: 'rgba(16, 185, 129, 0.06)',
              letterSpacing: '8px',
              userSelect: 'none',
              pointerEvents: 'none',
              whiteSpace: 'nowrap'
            }}>
              LOAN CLOSED · ZERO DUES
            </div>

            {/* Letterhead */}
            <div style={{ borderBottom: '2px solid #059669', paddingBottom: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#065f46', margin: '0 0 2px 0', letterSpacing: '-0.5px' }}>
                  {companyName}
                </h1>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                  Private Lending & Financial Services
                </p>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                  Registered Office: Madhapur / Hyderabad, Telangana · Phone: +91 8247798075
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block',
                  background: '#ecfdf5',
                  color: '#065f46',
                  border: '1px solid #a7f3d0',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontWeight: 800,
                  fontSize: '11px',
                  letterSpacing: '0.8px'
                }}>
                  NO OBJECTION CERTIFICATE (NOC)
                </span>
                <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                  Date of Issue: <strong>{fmtDate(new Date().toISOString())}</strong>
                </p>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                  Certificate Ref: <strong>{nocRefNo}</strong>
                </p>
              </div>
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h2 style={{
                fontSize: '17px',
                fontWeight: 800,
                color: '#064e3b',
                margin: '0 0 4px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                NO OBJECTION & LOAN CLOSURE CERTIFICATE
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#475569', fontStyle: 'italic' }}>
                To Whomsoever It May Concern · Full & Final Settlement
              </p>
            </div>

            {/* Recipient Details */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 18px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', fontSize: '12px' }}>
                <div><strong>Borrower Name:</strong> {customer.name}</div>
                <div><strong>Mobile Number:</strong> +91 {customer.phone}</div>
                <div><strong>Aadhaar Number:</strong> {customer.aadhar ? `XXXX-XXXX-${customer.aadhar.slice(-4)}` : 'Verified on KYC record'}</div>
                <div><strong>PAN:</strong> {customer.pan || 'Provided'}</div>
                <div style={{ gridColumn: 'span 2' }}>
                  <strong>Address:</strong> {customer.address || customer.street || customer.city || 'Address verified as per records'}
                </div>
                {guarantors.length > 0 && (
                  <div style={{ gridColumn: 'span 2', paddingTop: '6px', borderTop: '1px dashed #cbd5e1' }}>
                    <strong>Guarantor / Surety:</strong> {guarantors[0].name} ({guarantors[0].relationship || 'Guarantor'}) · Contact: {guarantors[0].phone}
                  </div>
                )}
              </div>
            </div>

            {/* Loan Facility Details Table */}
            <h4 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Facility & Settlement Summary
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '22px', fontSize: '12px' }}>
              <tbody>
                {[
                  ['Loan Account Number', `LN${1000 + loan.id}`, 'Loan Facility Type', loan.type],
                  ['Sanctioned Loan Amount', fmt(loan.amount), 'Sanction Date', fmtDate(loan.createdAt)],
                  ['Total Amount Repaid', fmt(totalPaid > 0 ? totalPaid : loan.amount), 'Closure / Clearance Date', fmtDate(closureDate)],
                  ['Facility Status', 'CLOSED & FULLY SETTLED', 'Outstanding Dues as on Date', '₹0.00 (NIL)']
                ].map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#f8fafc' : 'white' }}>
                    <td style={{ padding: '6px 10px', fontWeight: 600, color: '#475569', width: '25%' }}>{row[0]}</td>
                    <td style={{ padding: '6px 10px', fontWeight: 700, color: idx === 3 ? '#059669' : '#0f172a', width: '25%' }}>{row[1]}</td>
                    <td style={{ padding: '6px 10px', fontWeight: 600, color: '#475569', width: '25%' }}>{row[2]}</td>
                    <td style={{ padding: '6px 10px', fontWeight: 700, color: idx === 3 ? '#059669' : '#0f172a', width: '25%' }}>{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Official Legal Clearance Declaration */}
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '8px',
              padding: '16px 20px',
              marginBottom: '22px',
              fontSize: '12px',
              color: '#064e3b',
              lineHeight: 1.6
            }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: 800, fontSize: '12px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                DECLARATION OF FULL DISCHARGE & RELEASE
              </p>
              <p style={{ margin: '0 0 8px 0' }}>
                1. This is to officially certify that <strong>{customer.name}</strong> (Borrower){guarantors.length > 0 ? ` along with ${guarantors[0].name} (Guarantor)` : ''} has paid and satisfied the entire outstanding dues, principal, interest, penal charges, and administrative expenses towards Loan Account No. <strong>LN{1000 + loan.id}</strong>.
              </p>
              <p style={{ margin: '0 0 8px 0' }}>
                2. As on <strong>{fmtDate(new Date().toISOString())}</strong>, there are <strong>NIL / ZERO OUTSTANDING DUES</strong> against this loan account.
              </p>
              <p style={{ margin: '0 0 8px 0' }}>
                3. <strong>{companyName}</strong> confirms that it has NO OBJECTION to the Borrower or Guarantor and unequivocally discharges all personal guarantees, surety bonds, demand promissory notes, and releases any post-dated security cheques or physical title deeds held as collateral in respect of this credit facility.
              </p>
              <p style={{ margin: 0 }}>
                4. The Borrower and Guarantor are hereby unconditionally absolved and released from all legal, civil, and financial obligations under the loan agreement.
              </p>
            </div>

            {/* Security Verification & Signatures */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: '24px',
              paddingTop: '20px',
              borderTop: '1px dashed #cbd5e1',
              alignItems: 'flex-end'
            }}>
              <div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#f1f5f9',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  fontSize: '11px',
                  color: '#475569'
                }}>
                  <span style={{ fontSize: '16px' }}>🔒</span>
                  <span>
                    Digitally generated and verified via <strong>LenQredzo Core Lending System</strong>.<br />
                    System Audit ID: <strong>AUD-LN{1000 + loan.id}-{new Date().getFullYear()}</strong>
                  </span>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '54px', borderBottom: '1px solid #334155', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '10px', color: '#059669', border: '1px dashed #059669', padding: '4px 14px', borderRadius: '4px', fontWeight: 700 }}>
                    [Company Seal / Certified Closed]
                  </span>
                </div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '12px' }}>For {companyName}</p>
                <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>Authorized Signatory / Branch Manager</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
