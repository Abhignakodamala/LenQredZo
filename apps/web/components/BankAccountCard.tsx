'use client';

import React, { useState } from 'react';
import { API_URL } from '@/lib/api';

interface BankAccountCardProps {
  customer: any;
  onRefresh: () => Promise<void> | void;
}

export default function BankAccountCard({ customer, onRefresh }: BankAccountCardProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [pennyModalOpen, setPennyModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ifscLoading, setIfscLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Penny-Drop Verification Scenario
  const [scenario, setScenario] = useState<'exact' | 'reversed' | 'partial' | 'mismatch' | 'invalid' | 'custom'>('exact');
  const [customName, setCustomName] = useState('');

  // Edit Modal form states
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [branch, setBranch] = useState('');

  const status = customer.bankAccountStatus || 'unverified';
  const hasAccountDetails = Boolean(customer.bankAccountNumber || customer.bankIfsc);

  const openEditModal = () => {
    setAccountNumber('');
    setIfsc(customer.bankIfsc || '');
    setBankName(customer.bankName || '');
    setBranch(customer.bankBranch || '');
    setAlertInfo(null);
    setEditModalOpen(true);
  };

  // Live IFSC lookup from Razorpay public RBI IFSC directory
  const handleIfscChange = async (val: string) => {
    const clean = val.toUpperCase().trim();
    setIfsc(clean);

    if (clean.length === 11 && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(clean)) {
      setIfscLoading(true);
      try {
        const res = await fetch(`https://ifsc.razorpay.com/${clean}`);
        if (res.ok) {
          const data = await res.json();
          setBankName(data.BANK || '');
          setBranch(`${data.BRANCH || ''}, ${data.CITY || ''}`.trim().replace(/^,\s*|,\s*$/g, ''));
        }
      } catch (err) {
        console.warn('IFSC lookup failed, user can enter manually:', err);
      } finally {
        setIfscLoading(false);
      }
    }
  };

  // Save Bank Details
  const handleSaveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountNumber && !customer.bankAccountNumber) {
      alert('Please enter a valid bank account number');
      return;
    }
    if (!ifsc || ifsc.length !== 11) {
      alert('Please enter a valid 11-character IFSC code (e.g. HDFC0001234)');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/customers/${customer.id}/bank-details`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          bankAccountNumber: accountNumber || undefined,
          bankIfsc: ifsc,
          bankName: bankName || undefined
        })
      });

      if (res.ok) {
        setEditModalOpen(false);
        setAlertInfo({
          type: 'warning',
          message: 'Bank account details updated. Please perform Penny Drop to re-verify.'
        });
        await onRefresh();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update bank details');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating bank details');
    } finally {
      setSaving(false);
    }
  };

  // Execute Penny Drop Verification
  const executePennyDrop = async () => {
    setIsVerifying(true);
    setAlertInfo(null);

    const payload: Record<string, any> = {};

    if (scenario === 'mismatch') {
      payload.simulateMismatch = true;
    } else if (scenario === 'reversed') {
      payload.simulateReversedName = true;
    } else if (scenario === 'partial') {
      payload.simulatePartial = true;
    } else if (scenario === 'invalid') {
      payload.simulateInvalidAccount = true;
    } else if (scenario === 'custom') {
      payload.customBeneficiaryName = customName;
    }

    try {
      const res = await fetch(`${API_URL}/api/customers/${customer.id}/verify-bank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setPennyModalOpen(false);
        await onRefresh();
        if (data.status === 'verified') {
          setAlertInfo({
            type: 'success',
            message: `✓ Penny Drop Succeeded! Registered Beneficiary: "${data.beneficiaryName}" (Match: ${data.matchScore}%). Account cleared for loan disbursement.`
          });
        } else if (data.status === 'partial') {
          setAlertInfo({
            type: 'warning',
            message: `⚠️ Partial Match (${data.matchScore}%). Bank Name: "${data.beneficiaryName}" vs KYC Name: "${customer.name}". Review recommended before sanctioning.`
          });
        } else {
          setAlertInfo({
            type: 'error',
            message: `🚨 FRAUD / MISMATCH ALERT (${data.matchScore}%). Bank Account registered under "${data.beneficiaryName}" does not match customer "${customer.name}". Disbursement blocked.`
          });
        }
      } else {
        alert(data.error || 'Failed to verify bank account');
      }
    } catch (err: any) {
      console.error(err);
      alert('Bank verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'verified':
        return (
          <span style={{
            background: '#dcfce7',
            color: '#15803d',
            border: '1px solid #86efac',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>✓</span> Penny-Drop Verified (Match: {customer.bankNameMatchScore || 100}%)
          </span>
        );
      case 'partial':
        return (
          <span style={{
            background: '#fef3c7',
            color: '#b45309',
            border: '1px solid #fde68a',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>⚠️</span> Partial Name Match ({customer.bankNameMatchScore}%)
          </span>
        );
      case 'mismatch':
        return (
          <span style={{
            background: '#fee2e2',
            color: '#b91c1c',
            border: '1px solid #fca5a5',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>🚨</span> Mismatch / 3rd Party Account ({customer.bankNameMatchScore || 0}%)
          </span>
        );
      default:
        return (
          <span style={{
            background: '#f3f4f6',
            color: '#4b5563',
            border: '1px solid #e5e7eb',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>●</span> Unverified Account
          </span>
        );
    }
  };

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : '—';

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      marginBottom: '24px',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🏦 Bank Account & Penny-Drop Verification
            </h3>
            {getStatusBadge()}
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
            Validates IFSC via RBI directory, executes ₹1 IMPS penny-drop verification, and confirms beneficiary legal name matches borrower KYC.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={openEditModal}
            style={{
              background: '#f8fafc',
              color: '#334155',
              border: '1px solid #cbd5e1',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ✏️ {hasAccountDetails ? 'Edit Bank Details' : 'Add Bank Account'}
          </button>

          <button
            onClick={() => {
              if (!hasAccountDetails) {
                alert('Please add bank details before verifying.');
                openEditModal();
              } else {
                setPennyModalOpen(true);
              }
            }}
            disabled={isVerifying}
            style={{
              background: isVerifying ? '#94a3b8' : status === 'verified' ? '#059669' : '#2563eb',
              color: 'white',
              border: 'none',
              padding: '7px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isVerifying ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            ⚡ Verify Bank (Penny Drop)
          </button>
        </div>
      </div>

      {/* Alert Banner if verification recently run */}
      {alertInfo && (
        <div style={{
          padding: '12px 20px',
          background: alertInfo.type === 'success' ? '#f0fdf4' : alertInfo.type === 'warning' ? '#fefce8' : '#fef2f2',
          borderBottom: '1px solid #e5e7eb',
          fontSize: '13px',
          fontWeight: 500,
          color: alertInfo.type === 'success' ? '#166534' : alertInfo.type === 'warning' ? '#854d0e' : '#991b1b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{alertInfo.message}</span>
          <button
            onClick={() => setAlertInfo(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '14px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Details Grid */}
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {/* Card 1: Account & Bank */}
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
              Bank & Account Particulars
            </span>
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                {customer.bankName || 'Bank Name Not Specified'}
              </div>
              <div style={{ fontSize: '13px', color: '#334155', marginTop: '4px', fontFamily: 'monospace', fontWeight: 600 }}>
                A/C: {customer.bankAccountNumber || 'Not Configured'}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                IFSC: <span style={{ fontWeight: 600, color: '#1e40af', fontFamily: 'monospace' }}>{customer.bankIfsc || '—'}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Branch: {customer.bankBranch || '—'}
              </div>
            </div>
          </div>

          {/* Card 2: Beneficiary & Match Score */}
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
              Beneficiary Legal Match
            </span>
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Bank Registered Name:</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' }}>
                {customer.bankBeneficiaryName || '— (Run Penny Drop)'}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>KYC Borrower Name:</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', textTransform: 'uppercase' }}>
                {customer.name}
              </div>
              {customer.bankNameMatchScore !== null && customer.bankNameMatchScore !== undefined && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>
                    <span>Fuzzy Match Score</span>
                    <span style={{
                      color: customer.bankNameMatchScore >= 80 ? '#16a34a' : customer.bankNameMatchScore >= 50 ? '#d97706' : '#dc2626'
                    }}>
                      {customer.bankNameMatchScore}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, customer.bankNameMatchScore)}%`,
                      height: '100%',
                      background: customer.bankNameMatchScore >= 80 ? '#16a34a' : customer.bankNameMatchScore >= 50 ? '#d97706' : '#dc2626',
                      borderRadius: '4px'
                    }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Verification & Risk Status */}
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
              Disbursement Clearance
            </span>
            <div style={{ marginTop: '8px' }}>
              <div style={{
                fontSize: '14px',
                fontWeight: 700,
                marginTop: '2px',
                color: status === 'verified' ? '#16a34a' : status === 'mismatch' ? '#dc2626' : status === 'partial' ? '#d97706' : '#64748b'
              }}>
                {status === 'verified'
                  ? '🟢 Cleared for Loan Disbursement'
                  : status === 'mismatch'
                  ? '🔴 Blocked: Third-Party Mismatch Risk'
                  : status === 'partial'
                  ? '🟡 Warning: Manager Approval Required'
                  : '⚪ Pending Penny-Drop Ping'}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                Verified Timestamp: <span style={{ color: '#1e293b', fontWeight: 500 }}>{fmtDate(customer.bankVerifiedAt)}</span>
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                Under RBI digital lending guidelines, disbursements can only be transferred to a verified account held in the borrower&apos;s own legal name.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── PENNY DROP SIMULATION / VERIFY MODAL ────────────────────────────── */}
      {pennyModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '14px',
            padding: '24px',
            maxWidth: '520px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚡ ₹1 IMPS Penny-Drop Verification
              </h3>
              <button
                onClick={() => setPennyModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#9ca3af' }}
              >
                ✕
              </button>
            </div>

            {/* Target Account Summary */}
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>Beneficiary Account:</span>
                <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{customer.bankAccountNumber || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>Bank & IFSC:</span>
                <span style={{ fontWeight: 600 }}>{customer.bankName || 'Bank'} ({customer.bankIfsc})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>KYC Borrower Name:</span>
                <span style={{ fontWeight: 700, color: '#1e40af' }}>{customer.name}</span>
              </div>
            </div>

            {/* Sandbox Notice & Explanation */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', fontSize: '12px', color: '#1e40af', lineHeight: '1.4' }}>
              <strong>ℹ️ Sandbox Verification Mode:</strong> Live RBI IMPS bank transfers cost ₹1 per hit and require active corporate banking credentials. Select how the bank responds to test LenQredzo&apos;s fuzzy name matching and anti-fraud filters:
            </div>

            {/* Scenario Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
              {[
                { key: 'exact', title: '🟢 Match Borrower Name (100%)', desc: `Bank returns: "${customer.name.toUpperCase()}"` },
                { key: 'reversed', title: '🟢 Reversed Indian Name (100%)', desc: `Bank returns: Surname first, given name last` },
                { key: 'partial', title: '🟡 Partial / Initials Match (85%)', desc: `Bank returns initials (e.g. "${customer.name.split(' ')[0]} M")` },
                { key: 'mismatch', title: '🔴 3rd-Party Fraud Account (0%)', desc: 'Bank returns: "RAMESH KUMAR SHARMA" (Triggers fraud block)' },
                { key: 'invalid', title: '❌ Invalid Account / Closed', desc: 'Bank rejects IMPS ping with NPCI Account Inactive error' },
                { key: 'custom', title: '✍️ Custom Bank Beneficiary Name', desc: 'Type custom name to test fuzzy match score engine' },
              ].map(opt => (
                <label
                  key={opt.key}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: scenario === opt.key ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: scenario === opt.key ? '#f0f7ff' : 'white',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="scenario"
                    checked={scenario === opt.key}
                    onChange={() => setScenario(opt.key as any)}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{opt.title}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{opt.desc}</div>
                  </div>
                </label>
              ))}

              {scenario === 'custom' && (
                <div style={{ marginTop: '6px', paddingLeft: '24px' }}>
                  <input
                    type="text"
                    placeholder="Enter name returned by bank..."
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setPennyModalOpen(false)}
                style={{
                  background: '#f3f4f6',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  color: '#374151'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executePennyDrop}
                disabled={isVerifying}
                style={{
                  background: isVerifying ? '#93c5fd' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isVerifying ? 'not-allowed' : 'pointer'
                }}
              >
                {isVerifying ? '⚡ Pinging IMPS Bank...' : 'Execute Penny-Drop Ping'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT BANK DETAILS MODAL ─────────────────────────────────────────── */}
      {editModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: 700, color: '#111827' }}>
              🏦 Configure Bank Account Details
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
              Enter the borrower&apos;s active Indian bank account details. IFSC will automatically fetch the bank and branch from RBI registry.
            </p>

            <form onSubmit={handleSaveBankDetails}>
              {/* Account Number */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                  Bank Account Number *
                </label>
                <input
                  type="text"
                  required={!customer.bankAccountNumber}
                  placeholder={customer.bankAccountNumber ? `Keep existing (${customer.bankAccountNumber}) or enter new` : 'e.g. 50100234567890'}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ fontSize: '11px', color: '#6b7280' }}>Encrypted with AES-256 before storage</span>
              </div>

              {/* IFSC Code */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                    IFSC Code (11 Digits) *
                  </label>
                  {ifscLoading && <span style={{ fontSize: '11px', color: '#2563eb' }}>Looking up branch...</span>}
                </div>
                <input
                  type="text"
                  required
                  maxLength={11}
                  placeholder="e.g. HDFC0001234 or SBIN0000123"
                  value={ifsc}
                  onChange={(e) => handleIfscChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    textTransform: 'uppercase',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Bank Name */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                  Bank Name
                </label>
                <input
                  type="text"
                  placeholder="Auto-detected or enter bank name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Branch */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                  Branch / Location
                </label>
                <input
                  type="text"
                  placeholder="Branch location"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  style={{
                    background: '#f3f4f6',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    color: '#374151'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    background: saving ? '#93c5fd' : '#2563eb',
                    color: 'white',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer'
                  }}
                >
                  {saving ? 'Saving...' : 'Save & Prepare for Verification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
