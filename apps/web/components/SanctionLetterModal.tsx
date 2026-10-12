'use client';
import React, { useRef } from 'react';

type SanctionLetterProps = {
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

export default function SanctionLetterModal({ loan, onClose }: SanctionLetterProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!loan) return null;

  const companyName = loan.company?.name || 'ABHI FINANCE';
  const customer = loan.customer || {};
  const guarantors = loan.guarantors || [];
  const emis = loan.emis || [];

  const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const sanctionRefNo = `SL-${companyName.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()}-2026-LN${1000 + loan.id}`;
  const totalRepayment = (loan.emiAmount || 0) * (loan.tenure || 1);
  const totalInterest = Math.max(0, totalRepayment - (loan.amount || 0));

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
          #printable-sanction-letter, #printable-sanction-letter * {
            visibility: visible;
          }
          #printable-sanction-letter {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
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
        maxWidth: '900px',
        width: '100%',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Top Action Bar (hidden during print) */}
        <div className="no-print" style={{
          padding: '14px 24px',
          background: '#1e293b',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #334155'
        }}>
          <div>
            <span style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              📄 Loan Sanction Letter & Promissory Agreement
            </span>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Ref: {sanctionRefNo} · Loan LN{1000 + loan.id}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handlePrint}
              style={{
                background: '#2563eb',
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
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#cbd5e1',
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

        {/* Scrollable Document Container */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#f1f5f9', padding: '24px' }}>
          <div
            id="printable-sanction-letter"
            ref={printRef}
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '40px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              border: '1px solid #e2e8f0',
              fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              color: '#0f172a',
              lineHeight: 1.5,
              fontSize: '13px',
              maxWidth: '800px',
              margin: '0 auto'
            }}
          >
            {/* Header Letterhead */}
            <div style={{ borderBottom: '2px solid #1e40af', paddingBottom: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1e40af', margin: '0 0 2px 0', letterSpacing: '-0.5px' }}>
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
                  background: '#eff6ff',
                  color: '#1e40af',
                  border: '1px solid #bfdbfe',
                  padding: '3px 10px',
                  borderRadius: '4px',
                  fontWeight: 700,
                  fontSize: '11px',
                  letterSpacing: '0.5px'
                }}>
                  SANCTION LETTER & AGREEMENT
                </span>
                <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                  Date: <strong>{fmtDate(new Date().toISOString())}</strong>
                </p>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                  Ref No: <strong>{sanctionRefNo}</strong>
                </p>
              </div>
            </div>

            {/* Recipient / Borrower Details */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Borrower Particulars
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: '12px' }}>
                <div><strong>Name:</strong> {customer.name}</div>
                <div><strong>Contact:</strong> +91 {customer.phone}</div>
                <div><strong>Aadhaar No:</strong> {customer.aadhar ? `XXXX-XXXX-${customer.aadhar.slice(-4)}` : 'Verified on record'}</div>
                <div><strong>PAN:</strong> {customer.pan || 'Provided'}</div>
                <div style={{ gridColumn: 'span 2' }}><strong>Address:</strong> {customer.address || customer.street || customer.city || 'Address verified as per KYC documents'}</div>
              </div>
            </div>

            {/* Subject */}
            <div style={{ marginBottom: '14px' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: '#1e3a8a' }}>
                SUB: SANCTION OF {loan.type.toUpperCase()} CREDIT FACILITY (LOAN A/C: LN{1000 + loan.id})
              </p>
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#334155' }}>
                Dear <strong>{customer.name}</strong>,<br />
                With reference to your loan application and subsequent identity verification, we are pleased to confirm that your loan facility has been sanctioned under the following terms and conditions:
              </p>
            </div>

            {/* Key Fact Statement (KFS) Table */}
            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a' }}>
              1. Key Fact Statement (KFS) & Sanction Terms
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '12px' }}>
              <tbody>
                {[
                  ['Sanctioned Loan Amount', fmt(loan.amount), 'Loan Facility Type', loan.type],
                  ['Amount in Words', numberToWordsINR(loan.amount), 'Tenure / Duration', `${loan.tenure} Installments`],
                  ['Interest Rate', `${loan.interestRate}% (${loan.interestType})`, 'Repayment Frequency', String(loan.frequency).toUpperCase()],
                  ['Periodic EMI Amount', fmt(loan.emiAmount), 'Total Interest Payable', fmt(totalInterest)],
                  ['Total Amount Repayable', fmt(totalRepayment), 'Processing Charges', fmt(loan.processingFee || 0)],
                  ['Net Disbursed Amount', fmt(loan.disbursedAmount ?? loan.amount), 'Default / Overdue Penalty', `${loan.penaltyType === 'percentage' ? loan.penaltyValue + '%' : loan.penaltyType === 'fixed' ? '₹' + loan.penaltyValue : '2% per month'}`],
                ].map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#f8fafc' : 'white' }}>
                    <td style={{ padding: '6px 10px', fontWeight: 600, color: '#475569', width: '25%' }}>{row[0]}</td>
                    <td style={{ padding: '6px 10px', fontWeight: 700, color: '#0f172a', width: '25%' }}>{row[1]}</td>
                    <td style={{ padding: '6px 10px', fontWeight: 600, color: '#475569', width: '25%' }}>{row[2]}</td>
                    <td style={{ padding: '6px 10px', fontWeight: 700, color: '#0f172a', width: '25%' }}>{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Guarantor Section (if present) */}
            {guarantors.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a' }}>
                  2. Co-Signer / Guarantor Details
                </h4>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 14px', fontSize: '12px' }}>
                  {guarantors.map((g: any, gIdx: number) => (
                    <div key={gIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                      <div><strong>Guarantor Name:</strong> {g.name}</div>
                      <div><strong>Relationship:</strong> {g.relationship || 'Guarantor'}</div>
                      <div><strong>Phone Number:</strong> {g.phone}</div>
                      <div><strong>Aadhaar/PAN:</strong> {g.aadhar || g.pan ? 'Verified on Record' : 'Provided'}</div>
                      {g.address && <div style={{ gridColumn: 'span 2' }}><strong>Address:</strong> {g.address}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Statutory Promissory Note Clause */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: 800, color: '#1e40af', letterSpacing: '0.5px' }}>
                DEMAND PROMISSORY NOTE (SECTION 4, NEGOTIABLE INSTRUMENTS ACT, 1881)
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#1e293b', fontStyle: 'italic', lineHeight: 1.6 }}>
                "ON DEMAND, I/We, <strong>{customer.name}</strong> (Borrower){guarantors.length > 0 ? ` and ${guarantors[0].name} (Guarantor)` : ''}, jointly and severally promise to pay to <strong>{companyName}</strong> or order, the sum of <strong>{fmt(loan.amount)}</strong> ({numberToWordsINR(loan.amount)}) together with agreed interest at the rate of <strong>{loan.interestRate}%</strong> thereon, for value received."
              </p>
            </div>

            {/* Repayment Schedule Summary */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a' }}>
                3. Repayment Schedule Summary
              </h4>
              <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>#</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Due Date</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>Installment Amount</th>
                      <th style={{ padding: '6px 10px', textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emis.map((e: any, idx: number) => (
                      <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '5px 10px' }}>{idx + 1}</td>
                        <td style={{ padding: '5px 10px', fontWeight: 600 }}>{fmtDate(e.dueDate)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700 }}>{fmt(e.amount)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'center', textTransform: 'capitalize' }}>
                          <span style={{
                            padding: '1px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 600,
                            background: e.status === 'paid' ? '#dcfce7' : '#f3f4f6',
                            color: e.status === 'paid' ? '#15803d' : '#64748b'
                          }}>
                            {e.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div style={{ marginBottom: '24px', fontSize: '11px', color: '#475569', lineHeight: 1.5 }}>
              <h4 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 4px 0', color: '#0f172a' }}>
                4. General Terms & Declaration
              </h4>
              <ol style={{ margin: 0, paddingLeft: '18px' }}>
                <li>Repayment shall be made via UPI, Bank Transfer, or Cash strictly on or before each specified due date.</li>
                <li>Overdue installments shall attract penal interest as stated in the Key Fact Statement until full settlement.</li>
                <li>In the event of default, the Lender reserves the right to initiate legal recovery proceedings under applicable civil and criminal statutes.</li>
                <li>The Borrower and Guarantor confirm having read and accepted all terms without coercion. Legal jurisdiction is Hyderabad, Telangana.</li>
              </ol>
            </div>

            {/* Signature Blocks */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px',
              paddingTop: '20px',
              borderTop: '1px dashed #cbd5e1'
            }}>
              {/* Borrower Signature */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '50px', borderBottom: '1px solid #334155', marginBottom: '6px' }}></div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '12px' }}>{customer.name}</p>
                <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>Borrower's Signature & LTI</p>
              </div>

              {/* Guarantor Signature */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '50px', borderBottom: '1px solid #334155', marginBottom: '6px' }}></div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '12px' }}>{guarantors[0]?.name || 'Co-Signer / Guarantor'}</p>
                <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>Guarantor's Signature</p>
              </div>

              {/* Lender Signature & Stamp */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '50px', borderBottom: '1px solid #334155', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '10px', color: '#94a3b8', border: '1px dashed #cbd5e1', padding: '4px 10px', borderRadius: '4px' }}>
                    [Company Seal / Stamp]
                  </span>
                </div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '12px' }}>For {companyName}</p>
                <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>Authorized Signatory</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
