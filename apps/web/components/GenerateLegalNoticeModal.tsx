'use client';
import React, { useState } from 'react';
import { API_URL } from '@/lib/api';

interface GenerateLegalNoticeModalProps {
  loan: any;
  onSuccess: (notice: any) => void;
  onClose: () => void;
}

export default function GenerateLegalNoticeModal({ loan, onSuccess, onClose }: GenerateLegalNoticeModalProps) {
  const [noticeType, setNoticeType] = useState<'SEC_25_PSS' | 'SEC_138_NI' | 'LOAN_RECALL'>('SEC_25_PSS');
  const [advocateName, setAdvocateName] = useState('Adv. R. V. Ramanathan, B.A., LL.B.');
  const [advocateBarNo, setAdvocateBarNo] = useState('AP/1842/2012');
  const [advocateAddress, setAdvocateAddress] = useState('Chamber No. 4, District & Sessions Court Complex');
  const [advocatePhone, setAdvocatePhone] = useState('+91 98480 22338');
  const [advocateEmail, setAdvocateEmail] = useState('ramanathan.advocate@courtlaw.in');

  const now = new Date();
  const [dishonourDate, setDishonourDate] = useState(() => now.toISOString().slice(0, 10));
  const [dishonourReason, setDishonourReason] = useState('FUNDS INSUFFICIENT / ACCOUNT INADEQUATE');
  const [instrumentNumber, setInstrumentNumber] = useState(
    loan.mandate?.umn || 'CHQ-849201'
  );
  const [curePeriodDays, setCurePeriodDays] = useState(15);
  const [customRemarks, setCustomRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loan) return null;

  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const customer = loan.customer || {};

  // Calculate overdue dues
  const overdueEmis = (loan.emis || []).filter((e: any) => e.status !== 'paid' && new Date(e.dueDate) <= now);
  const overduePrincipal = overdueEmis.reduce((s: number, e: any) => s + (e.amount - (e.paidAmount || 0)), 0);
  const totalPenalties = overdueEmis.reduce((s: number, e: any) => s + (e.penalty || 0), 0);
  const totalClaimAmount = overduePrincipal + totalPenalties;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/loans/${loan.id}/legal-notice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          noticeType,
          advocateName,
          advocateBarNo,
          advocateAddress,
          advocatePhone,
          advocateEmail,
          instrumentNumber,
          dishonourDate,
          dishonourReason,
          curePeriodDays,
          customRemarks
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to generate legal notice');
      }

      onSuccess(data.notice);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error generating legal notice');
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
        maxWidth: '680px',
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
          background: 'linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              fontSize: '20px',
              background: 'rgba(255, 255, 255, 0.15)',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              ⚖️
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                Draft Statutory Legal Demand Notice
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#fca5a5' }}>
                Section 138 NI Act / Section 25 PSS Act / Recall Demand for Defaulted Loan
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', color: '#b91c1c', fontSize: '13px' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Dues Summary Callout */}
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>
                Total Claim Amount (Defaulted Dues)
              </span>
              <div style={{ fontSize: '12px', color: '#7f1d1d', marginTop: '2px' }}>
                Borrower: <strong>{customer.name}</strong> · Loan Ref: <strong>LN{1000 + loan.id}</strong> · {overdueEmis.length} Overdue EMIs
              </div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#991b1b' }}>
              {fmt(totalClaimAmount > 0 ? totalClaimAmount : loan.amount)}
            </div>
          </div>

          {/* Notice Type Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Select Legal Act & Notice Type *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
              {[
                {
                  id: 'SEC_25_PSS',
                  title: 'Section 25 Payment and Settlement Systems Act, 2007',
                  desc: 'Electronic Mandate / e-NACH / UPI AutoPay Dishonour Notice with criminal penalty'
                },
                {
                  id: 'SEC_138_NI',
                  title: 'Section 138 Negotiable Instruments Act, 1881',
                  desc: 'Statutory 15-Day Demand Notice for Cheque Dishonour / Bounce with criminal prosecution'
                },
                {
                  id: 'LOAN_RECALL',
                  title: 'Loan Recall & Final Demand Notice (Contract Act)',
                  desc: 'Pre-litigation recall demand for overdue loan acceleration & civil recovery suit'
                }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setNoticeType(opt.id as any);
                    if (opt.id === 'SEC_138_NI' && !instrumentNumber.startsWith('CHQ')) {
                      setInstrumentNumber('CHQ-849201');
                    } else if (opt.id === 'SEC_25_PSS' && loan.mandate?.umn) {
                      setInstrumentNumber(loan.mandate.umn);
                    }
                  }}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: noticeType === opt.id ? '2px solid #991b1b' : '1px solid #cbd5e1',
                    background: noticeType === opt.id ? '#fff1f2' : 'white',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '13px', color: noticeType === opt.id ? '#991b1b' : '#1e293b' }}>
                    {opt.title}
                  </div>
                  <div style={{ fontSize: '11px', color: noticeType === opt.id ? '#b91c1c' : '#64748b', marginTop: '2px' }}>
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Dishonour Details */}
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px',
            background: '#f8fafc',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                {noticeType === 'SEC_138_NI' ? 'Bounced Cheque Number *' : noticeType === 'SEC_25_PSS' ? 'NPCI Mandate UMN *' : 'Loan Agreement Ref *'}
              </label>
              <input
                type="text"
                required
                value={instrumentNumber}
                onChange={(e) => setInstrumentNumber(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  fontWeight: 600,
                  outline: 'none',
                  background: 'white',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Bank Dishonour Memo Date *
              </label>
              <input
                type="date"
                required
                value={dishonourDate}
                onChange={(e) => setDishonourDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                  background: 'white',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Bank Return Reason (Memo Remarks) *
              </label>
              <input
                type="text"
                required
                value={dishonourReason}
                onChange={(e) => setDishonourReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  outline: 'none',
                  background: 'white',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Legal Advocate Information */}
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px'
          }}>
            <div style={{ gridColumn: 'span 2', fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
              Legal Counsel / Issuing Advocate Details
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                Advocate Name *
              </label>
              <input
                type="text"
                required
                value={advocateName}
                onChange={(e) => setAdvocateName(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                Bar Council Enrollment No *
              </label>
              <input
                type="text"
                required
                value={advocateBarNo}
                onChange={(e) => setAdvocateBarNo(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                Chamber Address
              </label>
              <input
                type="text"
                value={advocateAddress}
                onChange={(e) => setAdvocateAddress(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Statutory 15-Day Cure Period */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '14px', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Cure Period (Days) *
              </label>
              <input
                type="number"
                min={7}
                max={30}
                required
                value={curePeriodDays}
                onChange={(e) => setCurePeriodDays(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
              Statutory requirement: Under Section 138 of NI Act and Section 25 of PSS Act, the drawer must be given exactly <strong>15 days</strong> from receipt of notice before criminal proceedings can be instituted.
            </div>
          </div>

          {/* Actions */}
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
              disabled={loading}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)',
                fontSize: '13px',
                fontWeight: 700,
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(153, 27, 27, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {loading ? 'Drafting Statutory Notice...' : '⚖️ Generate Court-Grade Legal Notice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
