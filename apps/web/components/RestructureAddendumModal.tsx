'use client';
import React from 'react';

export interface RestructureAddendumModalProps {
  addendum: any;
  company?: any;
  onClose: () => void;
}

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

export default function RestructureAddendumModal({ addendum, company, onClose }: RestructureAddendumModalProps) {
  if (!addendum) return null;

  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtDateTime = (d?: string) => d ? new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
  }) : '—';

  const companyName = company?.name || addendum.company?.name || 'LenQredzo Capital Private Limited';
  const borrower = addendum.borrower || {};
  const orig = addendum.originalTerms || {};
  const rest = addendum.restructuredTerms || {};
  const officer = addendum.authorizedOfficer || {};

  const shareText = `*${companyName} - Loan Restructuring Addendum*\n` +
    `*Ref:* ${addendum.addendumRefNo}\n` +
    `*Borrower:* ${borrower.name} (Loan: ${addendum.loanRef})\n` +
    `*Restructure Type:* ${(addendum.restructuringType || 'Moratorium').toUpperCase()}\n` +
    `*Revised Monthly EMI:* ${fmt(rest.revisedEmiAmount)}\n` +
    `*Remaining Installments:* ${rest.newRemainingInstallments} EMIs\n` +
    `*Resumption Date:* ${fmtDate(rest.resumptionDate)}\n\n` +
    `Your loan repayment schedule has been officially rescheduled under the RBI Resolution Framework.`;

  const waUrl = `https://api.whatsapp.com/send?phone=${borrower.phone || ''}&text=${encodeURIComponent(shareText)}`;

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
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        maxWidth: '820px',
        width: '100%',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        border: '1px solid #e2e8f0'
      }}>
        {/* Top Control Bar */}
        <div style={{
          background: '#0f172a',
          color: 'white',
          padding: '14px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>📜</span>
            <span style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '0.4px' }}>
              OFFICIAL LOAN RESTRUCTURING ADDENDUM
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => window.print()}
              style={{
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🖨️ Print Addendum
            </button>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#25D366',
                color: 'white',
                textDecoration: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📱 Share via WhatsApp
            </a>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '22px',
                cursor: 'pointer',
                lineHeight: 1
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div style={{ padding: '32px 40px', overflowY: 'auto', flex: 1, color: '#1e293b', fontSize: '13px', lineHeight: 1.6 }}>
          {/* Document Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '20px' }}>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', letterSpacing: '0.5px' }}>
              {companyName.toUpperCase()}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              REGISTERED NON-BANKING FINANCIAL INSTITUTION • CREDIT OPERATIONS DIVISION
            </div>
            <div style={{
              display: 'inline-block',
              background: '#f1f5f9',
              padding: '6px 18px',
              borderRadius: '20px',
              marginTop: '12px',
              fontWeight: 800,
              fontSize: '12px',
              color: '#0f172a',
              letterSpacing: '0.4px',
              border: '1px solid #cbd5e1'
            }}>
              SUPPLEMENTARY LOAN RESTRUCTURING AGREEMENT & REVISED SANCTION SCHEDULE
            </div>
          </div>

          {/* Reference Meta */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '18px', fontSize: '12px' }}>
            <div>
              <div><strong>Addendum Reference:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{addendum.addendumRefNo}</span></div>
              <div><strong>Master Facility Ref:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{addendum.loanRef}</span></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div><strong>Execution Date:</strong> {fmtDateTime(addendum.restructuringDate)}</div>
              <div><strong>Framework:</strong> RBI Resolution & Hardship Guidelines</div>
            </div>
          </div>

          {/* Parties Box */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 18px', marginBottom: '20px' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>PARTIES TO THIS SUPPLEMENTARY AGREEMENT:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>LENDER / CREDITOR:</div>
                <div style={{ fontWeight: 700 }}>{companyName}</div>
                <div style={{ fontSize: '12px', color: '#475569' }}>Headquarters & Credit Sanction Committee</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>BORROWER / OBLIGOR:</div>
                <div style={{ fontWeight: 700 }}>{borrower.name}</div>
                <div style={{ fontSize: '12px', color: '#475569' }}>
                  Contact: {borrower.phone || '—'} • PAN: {borrower.pan || '—'} • Aadhaar: {borrower.aadhar || '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Recitals */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>1. RECITALS & HARDSHIP GROUNDS:</div>
            <p style={{ margin: 0, color: '#334155' }}>
              WHEREAS the Borrower was granted the aforementioned credit facility by the Lender, and WHEREAS the Borrower has formally requested relief under the Regulatory Resolution Framework due to <strong>{addendum.reason}</strong>, the Credit Committee of the Lender has approved the rescheduling and restructuring of the repayment terms as set forth hereunder.
            </p>
            {addendum.officerNotes && (
              <div style={{ marginTop: '6px', fontSize: '12px', fontStyle: 'italic', color: '#475569' }}>
                Officer Notes: "{addendum.officerNotes}"
              </div>
            )}
          </div>

          {/* Comparative Terms Table */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>2. COMPARATIVE RESTRUCTURING TERMS:</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '8px 12px' }}>Parameter</th>
                  <th style={{ padding: '8px 12px' }}>Original Sanction Terms</th>
                  <th style={{ padding: '8px 12px' }}>Revised Restructured Terms</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>Sanction / Outstanding Principal</td>
                  <td style={{ padding: '8px 12px' }}>{fmt(orig.sanctionAmount)}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>{fmt(rest.newPrincipal)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>Monthly Installment (EMI)</td>
                  <td style={{ padding: '8px 12px' }}>{fmt(orig.originalEmiAmount)}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 800, color: '#16a34a' }}>
                    {fmt(rest.revisedEmiAmount)}
                    {rest.revisedEmiAmount < orig.originalEmiAmount && (
                      <span style={{ fontSize: '11px', color: '#15803d', marginLeft: '6px' }}>
                        (↓ {fmt(orig.originalEmiAmount - rest.revisedEmiAmount)} relief)
                      </span>
                    )}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>Moratorium / Grace Period</td>
                  <td style={{ padding: '8px 12px' }}>0 Months (Standard)</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: '#4338ca' }}>
                    {rest.moratoriumMonths > 0 ? `${rest.moratoriumMonths} Months Freeze` : 'None'}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>Remaining Installments</td>
                  <td style={{ padding: '8px 12px' }}>{orig.originalTenure - (orig.clearedInstallments || 0)} EMIs</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700 }}>{rest.newRemainingInstallments} EMIs</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>Payment Resumption Date</td>
                  <td style={{ padding: '8px 12px' }}>On Schedule</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700 }}>{fmtDate(rest.resumptionDate)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>Penalty Waiver / Relief</td>
                  <td style={{ padding: '8px 12px' }}>—</td>
                  <td style={{ padding: '8px 12px', color: rest.penaltiesWaived > 0 ? '#15803d' : '#475569', fontWeight: 600 }}>
                    {rest.penaltiesWaived > 0 ? `100% Waived (${fmt(rest.penaltiesWaived)})` : rest.penaltiesCapitalized > 0 ? `Capitalized (${fmt(rest.penaltiesCapitalized)})` : 'None'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Legal Undertaking Clauses */}
          <div style={{ marginBottom: '24px', fontSize: '11px', color: '#475569', background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>3. STATUTORY UNDERTAKINGS & BINDING CLAUSES:</div>
            <ol style={{ margin: 0, paddingLeft: '18px' }}>
              <li>All terms and conditions of the Master Loan Agreement LN{1000 + addendum.loanId} not explicitly modified by this Addendum shall remain in full force and effect.</li>
              <li>The Borrower agrees and confirms that timely payment of the revised installment of {fmt(rest.revisedEmiAmount)} starting on {fmtDate(rest.resumptionDate)} is the essence of this relief.</li>
              <li>Failure to honour the revised schedule shall automatically revive all original remedies including proceedings under Section 138 of the Negotiable Instruments Act and Section 25 of the Payments and Settlement Systems Act.</li>
            </ol>
          </div>

          {/* Signature Block */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '36px', paddingTop: '20px', borderTop: '1px dashed #cbd5e1' }}>
            <div>
              <div style={{ height: '40px' }}></div>
              <div style={{ borderTop: '1px solid #0f172a', paddingTop: '6px' }}>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{officer.name || 'Branch Credit Head'}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Authorized Signatory • {companyName}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Designation: {officer.role || 'Credit Officer'} (Staff ID: #{officer.userId})</div>
              </div>
            </div>

            <div>
              <div style={{ height: '40px' }}></div>
              <div style={{ borderTop: '1px solid #0f172a', paddingTop: '6px' }}>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{borrower.name}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Signature of Borrower / Co-Borrower</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Acknowledged & Accepted on {fmtDate(addendum.restructuringDate)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div style={{
          padding: '14px 24px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              background: '#0f172a',
              color: 'white',
              border: 'none',
              padding: '8px 20px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Close Addendum
          </button>
        </div>
      </div>
    </div>
  );
}
