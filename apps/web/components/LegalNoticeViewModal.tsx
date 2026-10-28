'use client';
import React from 'react';

interface LegalNoticeViewModalProps {
  notice: any;
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

export default function LegalNoticeViewModal({ notice, onClose }: LegalNoticeViewModalProps) {
  if (!notice) return null;

  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const advocate = notice.advocate || {};
  const client = notice.client || {};
  const borrower = notice.borrower || {};
  const guarantors = notice.guarantors || [];
  const defaultDetails = notice.defaultDetails || {};
  const totalClaim = Number(defaultDetails.totalClaimAmount || 0);

  const handleSendWhatsAppNotice = () => {
    const msg = `*STATUTORY LEGAL DEMAND NOTICE*\n\nRef: ${notice.noticeRefNo}\nDate: ${fmtDate(notice.issuedAt)}\n\nTo: *${borrower.name}*\n\nPlease take notice that under instructions from my client *${client.companyName}*, this Statutory Demand Notice is hereby served upon you under *${notice.primaryStatute || notice.legalAct}* regarding default and dishonour on Loan Ref *${notice.loanDetails?.loanRef}*.\n\n• Overdue Dues Claimed: *${fmt(totalClaim)}*\n• Instrument Ref: *${defaultDetails.instrumentNumber || '—'}*\n• Dishonour Reason: *${defaultDetails.dishonourReason}*\n\n⚠️ *15-DAY MANDATORY CURE PERIOD:*\nYou are hereby called upon to pay the entire outstanding sum of *${fmt(totalClaim)}* within *${notice.curePeriodDays || 15} days* of this notice. Failure to do so shall compel my client to institute criminal proceedings under Section 138 NI Act / Section 25 PSS Act and Section 420 of IPC.\n\n— Issued by:\n*${advocate.name}*, Advocate\nBar Reg: ${advocate.barEnrollmentNo}\nChambers: ${advocate.address}`;
    const cleanPhone = String(borrower.phone || '').replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
    const waUrl = `https://web.whatsapp.com/send?phone=${phoneWithCountry}&text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
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
      zIndex: 99999,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        maxWidth: '780px',
        width: '100%',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0'
      }}>
        {/* Top Control Bar */}
        <div style={{
          padding: '14px 24px',
          background: '#1e1b4b',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>⚖️</span>
            <span style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '0.4px' }}>
              OFFICIAL STATUTORY LEGAL DEMAND NOTICE
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleSendWhatsAppNotice}
              style={{
                background: '#16a34a',
                color: 'white',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              💬 Send on WhatsApp
            </button>

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
                gap: '5px'
              }}
            >
              🖨️ Print / Save Legal PDF
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

        {/* Printable Legal Notice Document */}
        <div id="printable-legal-notice-doc" style={{
          padding: '36px 44px',
          overflowY: 'auto',
          background: '#ffffff',
          color: '#111827',
          fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif',
          lineHeight: 1.6
        }}>
          {/* Advocate Letterhead */}
          <div style={{
            borderBottom: '2px solid #000000',
            paddingBottom: '16px',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: '#000000' }}>
              {advocate.name}
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: '13px', fontStyle: 'italic', color: '#374151' }}>
              ADVOCATE & LEGAL CONSULTANT · BAR COUNCIL REG. NO: {advocate.barEnrollmentNo}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#4b5563' }}>
              {advocate.address} · Phone: {advocate.phone} · Email: {advocate.email}
            </p>
          </div>

          {/* Postal Dispatch Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '20px',
            fontSize: '12px'
          }}>
            <div>
              <strong style={{ textDecoration: 'underline' }}>
                BY REGISTERED POST WITH ACKNOWLEDGEMENT DUE (RPAD) & SPEED POST
              </strong>
              <div style={{ fontStyle: 'italic', marginTop: '2px', color: '#4b5563' }}>
                (ALSO TRANSMITTED DIGITALLY VIA REGISTERED WHATSAPP & EMAIL)
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div><strong>Ref:</strong> {notice.noticeRefNo}</div>
              <div><strong>Date:</strong> {fmtDate(notice.issuedAt)}</div>
            </div>
          </div>

          {/* Addressees */}
          <div style={{ marginBottom: '20px', fontSize: '13px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>TO:</div>
            
            {/* Primary Borrower */}
            <div style={{ paddingLeft: '16px', marginBottom: '10px' }}>
              <div style={{ fontWeight: 'bold' }}>1. {borrower.name} (Primary Borrower)</div>
              <div>Address: {borrower.address}</div>
              <div>Phone: {borrower.phone} · PAN: {borrower.pan} · Aadhaar: {borrower.aadhar}</div>
            </div>

            {/* Co-Borrowers / Guarantors */}
            {guarantors.map((g: any, idx: number) => (
              <div key={g.id || idx} style={{ paddingLeft: '16px', marginBottom: '6px' }}>
                <div style={{ fontWeight: 'bold' }}>{idx + 2}. {g.name} (Guarantor / Co-Obligant — Jointly & Severally Liable)</div>
                <div>Address: {g.address || 'Address on record'} · Phone: {g.phone || '—'}</div>
                <div style={{ fontSize: '11px', fontStyle: 'italic', color: '#4b5563' }}>
                  Joint and Several liability under Section 128 of Indian Contract Act, 1872
                </div>
              </div>
            ))}
          </div>

          {/* Subject Line */}
          <div style={{
            background: '#f8fafc',
            borderTop: '1px solid #000000',
            borderBottom: '1px solid #000000',
            padding: '10px 14px',
            margin: '20px 0',
            fontWeight: 'bold',
            fontSize: '13px',
            textAlign: 'center',
            textTransform: 'uppercase'
          }}>
            SUBJECT: {notice.subjectLine}
          </div>

          {/* Legal Representation Statement */}
          <p style={{ margin: '0 0 14px 0', fontSize: '13px', textAlign: 'justify' }}>
            <strong>Sir / Madam,</strong>
          </p>

          <p style={{ margin: '0 0 14px 0', fontSize: '13px', textAlign: 'justify' }}>
            Under instructions from and on behalf of my client, <strong>{client.companyName}</strong>, a duly registered Non-Banking Financial entity having its principal office at the address on record, I hereby serve upon you this <strong>Statutory Legal Demand Notice</strong> as follows:
          </p>

          <ol style={{ paddingLeft: '20px', margin: '0 0 16px 0', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'justify' }}>
            <li>
              <strong>SANCTION OF LOAN FACILITY:</strong> That at your specific request and application, my client sanctioned and disbursed a <strong>{notice.loanDetails?.loanType} Facility</strong> of <strong>{fmt(notice.loanDetails?.sanctionAmount)}</strong> under Loan Reference <strong>{notice.loanDetails?.loanRef}</strong> on <strong>{fmtDate(notice.loanDetails?.sanctionDate)}</strong>. You jointly executed the Loan Agreement and promissory undertakings agreeing to repay the loan in monthly installments of <strong>{fmt(notice.loanDetails?.emiAmount)}</strong>.
            </li>

            <li>
              <strong>FAILURE & WILLFUL REPAYMENT DEFAULT:</strong> That contrary to your express covenants, you have failed, neglected, and willfully defaulted in paying the scheduled monthly installments. As on date, <strong>{defaultDetails.overdueEmisCount || 1} monthly installments</strong> have fallen overdue and remain completely unpaid.
            </li>

            <li>
              <strong>DISHONOUR OF PAYMENT INSTRUMENT / MANDATE:</strong> That towards the discharge of your legally enforceable debt and liability, you issued / registered payment instrument / electronic mandate <strong>{defaultDetails.instrumentNumber}</strong>. Upon presentation for clearance on <strong>{fmtDate(defaultDetails.dishonourDate)}</strong>, the said instrument / mandate was returned dishonoured and unpaid by your drawee bank with the official Return Memo stating: <strong>"{defaultDetails.dishonourReason}"</strong>.
            </li>

            <li>
              <strong>CRIMINAL OFFENCE COMMITTED:</strong> That by dishonouring the said payment obligation towards a legally enforceable debt, you have committed an offence punishable under <strong>{notice.primaryStatute}</strong>, wherein the Hon'ble Supreme Court of India in authoritative rulings has held that drawer is liable to both substantial imprisonment and severe monetary fine.
            </li>
          </ol>

          {/* Overdue Claim Breakdown Table */}
          <div style={{ margin: '18px 0', border: '1px solid #000000' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', borderBottom: '1px solid #000000', textAlign: 'left' }}>
                  <th style={{ padding: '6px 12px' }}>Description of Dues</th>
                  <th style={{ padding: '6px 12px', textAlign: 'right' }}>Amount Claimed (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '6px 12px' }}>Defaulted Overdue Principal Installments</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 'bold' }}>{fmt(defaultDetails.overduePrincipal)}</td>
                </tr>
                {defaultDetails.totalPenalties > 0 && (
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '6px 12px' }}>Accrued Default Penalties / Bounce Charges</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 'bold' }}>{fmt(defaultDetails.totalPenalties)}</td>
                  </tr>
                )}
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '6px 12px' }}>Statutory Legal Notice & Counsel Drafting Fee</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 'bold' }}>₹2,500</td>
                </tr>
                <tr style={{ background: '#f9fafb', fontWeight: 'bold' }}>
                  <td style={{ padding: '8px 12px' }}>TOTAL LIQUIDATED DEMAND PAYABLE</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#991b1b', fontSize: '14px' }}>
                    {fmt(totalClaim + 2500)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p style={{ margin: '0 0 14px 0', fontSize: '13px', fontStyle: 'italic', textAlign: 'right' }}>
            ({numberToWordsINR(totalClaim + 2500)})
          </p>

          {/* Statutory 15-Day Demand Cure Clause */}
          <div style={{
            border: '2px solid #991b1b',
            background: '#fff1f2',
            padding: '14px 18px',
            margin: '20px 0',
            fontSize: '13px',
            textAlign: 'justify'
          }}>
            <strong style={{ color: '#991b1b' }}>STATUTORY 15-DAY MANDATORY DEMAND CLAUSE:</strong>
            <p style={{ margin: '6px 0 0 0', color: '#000000', lineHeight: 1.5 }}>
              I hereby call upon you, the Noticee(s), to make the payment of the said sum of <strong>{fmt(totalClaim + 2500)}</strong> to my client within <strong>{notice.curePeriodDays || 15} (FIFTEEN) DAYS</strong> from the date of receipt of this notice, failing which you will be deemed to have committed an offence under <strong>{notice.primaryStatute}</strong>.
            </p>
          </div>

          <p style={{ margin: '0 0 14px 0', fontSize: '13px', textAlign: 'justify' }}>
            <strong>CONSEQUENCES OF NON-COMPLIANCE:</strong> Please take note that if you fail to comply with this demand within the stipulated 15 days, my client has given me peremptory instructions to initiate appropriate criminal proceedings against you before the Hon'ble Metropolitan Magistrate / Judicial Magistrate First Class having jurisdiction, seeking:
          </p>

          <ul style={{ paddingLeft: '20px', margin: '0 0 24px 0', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <li>Issuance of Non-Bailable Warrants for arrest under Criminal Procedure Code (CrPC / BNSS).</li>
            <li>Substantive imprisonment extending up to <strong>2 (TWO) YEARS</strong> and/or monetary penalty up to twice the dishonoured sum.</li>
            <li>Attachment of movable and immovable assets, salary accounts, and bank lockers.</li>
            <li>Adverse reporting of willful default to RBI, CIBIL, Equifax, Experian, and CRIF High Mark, disqualifying you from future credit facilities across all Indian banks.</li>
          </ul>

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '36px' }}>
            <div style={{ fontSize: '11px', color: '#4b5563' }}>
              <div>Copy retained in Legal Chamber Archives for filing in Court.</div>
              <div>Notice Ref: {notice.noticeRefNo}</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ height: '40px', borderBottom: '1px solid #000000', width: '200px', margin: '0 auto 6px' }} />
              <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{advocate.name}</div>
              <div style={{ fontSize: '11px', color: '#4b5563' }}>Advocate, Legal Counsel for Client</div>
              <div style={{ fontSize: '10px', color: '#4b5563' }}>Bar Council Enrollment: {advocate.barEnrollmentNo}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
