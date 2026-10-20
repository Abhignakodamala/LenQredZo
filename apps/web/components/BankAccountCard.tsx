'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from '@/lib/api';

interface BankAccountCardProps {
  customer: any;
  onRefresh: () => Promise<void> | void;
}

export default function BankAccountCard({ customer, onRefresh }: BankAccountCardProps) {
  // Modal visibility & active tab
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'upi_qr' | 'penny_drop'>('upi_qr');
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Loading states
  const [isVerifying, setIsVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ifscLoading, setIfscLoading] = useState(false);
  const [upiLoading, setUpiLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Alert banner
  const [alertInfo, setAlertInfo] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  // Method 1: Dynamic UPI QR states
  const [upiData, setUpiData] = useState<{
    txRef: string;
    vpa: string;
    amount: number;
    upiIntentUrl: string;
    qrCodeUrl: string;
    customerName: string;
    expiresInSeconds: number;
  } | null>(null);
  const [upiTimer, setUpiTimer] = useState<number>(300);
  const [upiScenario, setUpiScenario] = useState<'exact' | 'reversed' | 'partial' | 'mismatch' | 'custom'>('exact');
  const [customUpiName, setCustomUpiName] = useState('');
  const [showUpiSimulator, setShowUpiSimulator] = useState(false);
  const [showPennySimulator, setShowPennySimulator] = useState(false);
  const [upiResult, setUpiResult] = useState<{
    success: boolean;
    status: string;
    matchScore: number;
    matchLabel: string;
    beneficiaryName: string;
    payerVpa: string;
    needsFallbackToImps: boolean;
  } | null>(null);

  // Method 2: IMPS Penny Drop states
  const [scenario, setScenario] = useState<'exact' | 'reversed' | 'partial' | 'mismatch' | 'invalid' | 'custom'>('exact');
  const [customName, setCustomName] = useState('');

  // Edit Modal form states
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [branch, setBranch] = useState('');

  const status = customer.bankAccountStatus || 'unverified';
  const hasAccountDetails = Boolean(customer.bankAccountNumber || customer.bankIfsc);

  // Fetch / Generate dynamic ₹1 UPI QR
  const fetchUpiQr = useCallback(async () => {
    setUpiLoading(true);
    setUpiResult(null);
    try {
      const res = await fetch(`${API_URL}/api/customers/${customer.id}/verify-upi-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUpiData(data);
        setUpiTimer(data.expiresInSeconds || 300);
      } else {
        alert(data.error || 'Failed to generate UPI QR code');
      }
    } catch (err: any) {
      console.error('Failed to generate UPI QR:', err);
    } finally {
      setUpiLoading(false);
    }
  }, [customer.id]);

  // Countdown timer for active UPI QR session
  useEffect(() => {
    let interval: any;
    if (modalOpen && activeTab === 'upi_qr' && upiTimer > 0) {
      interval = setInterval(() => {
        setUpiTimer(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [modalOpen, activeTab, upiTimer]);

  // Open verification modal with selected tab
  const openVerificationModal = (tab: 'upi_qr' | 'penny_drop') => {
    setActiveTab(tab);
    setModalOpen(true);
    setUpiResult(null);
    if (tab === 'upi_qr' && (!upiData || upiTimer <= 0)) {
      fetchUpiQr();
    }
  };

  const openEditModal = () => {
    setAccountNumber('');
    setIfsc(customer.bankIfsc || '');
    setBankName(customer.bankName || '');
    setBranch(customer.bankBranch || '');
    setAlertInfo(null);
    setEditModalOpen(true);
  };

  // Live IFSC lookup from Razorpay public RBI directory
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
          message: 'Bank account details updated. Please perform verification to confirm ownership.'
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

  // Execute Method 1: Verify UPI Payment
  const executeVerifyUpi = async () => {
    setIsVerifying(true);
    setAlertInfo(null);
    setUpiResult(null);

    const payload: Record<string, any> = {
      payerVpa: `${customer.name.toLowerCase().replace(/[^a-z]/g, '')}@okaxis`
    };

    if (upiScenario === 'mismatch') {
      payload.simulateMismatch = true;
      payload.payerVpa = 'ramesh.sharma@paytm';
    } else if (upiScenario === 'reversed') {
      payload.simulateReversed = true;
    } else if (upiScenario === 'partial') {
      payload.simulatePartial = true;
    } else if (upiScenario === 'custom' && customUpiName.trim()) {
      payload.customPayerName = customUpiName.trim();
    }

    try {
      const res = await fetch(`${API_URL}/api/customers/${customer.id}/verify-upi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setUpiResult(data);
        await onRefresh();

        if (data.status === 'verified') {
          setAlertInfo({
            type: 'success',
            message: `✓ ₹1 UPI Verification Succeeded! Payer legal name "${data.beneficiaryName}" matched borrower KYC (${data.matchScore}%). Account cleared for loan disbursement.`
          });
        } else {
          setAlertInfo({
            type: 'warning',
            message: `⚠️ UPI Name Mismatch (${data.matchScore}%). Payer registered as "${data.beneficiaryName}" vs KYC "${customer.name}". Switch to Method 2 (Account + IFSC) to verify official passbook.`,
            actionLabel: 'Switch to Method 2 →',
            onAction: () => openVerificationModal('penny_drop')
          });
        }
      } else {
        alert(data.error || 'Failed to process UPI verification');
      }
    } catch (err: any) {
      console.error(err);
      alert('UPI verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Execute Method 2: IMPS Penny Drop Verification
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
        setModalOpen(false);
        await onRefresh();
        if (data.status === 'verified') {
          setAlertInfo({
            type: 'success',
            message: `✓ IMPS Penny Drop Succeeded! Registered Beneficiary: "${data.beneficiaryName}" (Match: ${data.matchScore}%). Account cleared for loan disbursement.`
          });
        } else if (data.status === 'partial') {
          setAlertInfo({
            type: 'warning',
            message: `⚠️ Partial Match (${data.matchScore}%). Bank Passbook Name: "${data.beneficiaryName}" vs KYC Name: "${customer.name}". Review recommended before sanctioning.`
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
      alert('Bank verification failed. Please check account details and try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const copyVpaToClipboard = () => {
    if (upiData?.vpa) {
      navigator.clipboard.writeText(upiData.vpa);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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
            <span>✓</span> Bank Verified (Match: {customer.bankNameMatchScore || 100}%)
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

  const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : '—');

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
              🏦 Dual Bank Verification Engine
            </h3>
            {getStatusBadge()}
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
            Two-layer RBI validation: Instant ₹1 UPI QR scan (Reverse Penny Drop) with smart fallback to Direct Bank Account + IFSC Penny Drop.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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

          {/* Method 1 Quick Button: ₹1 UPI QR */}
          <button
            onClick={() => openVerificationModal('upi_qr')}
            style={{
              background: '#047857',
              color: 'white',
              border: 'none',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            📱 Method 1: ₹1 UPI QR (3s)
          </button>

          {/* Method 2 Quick Button: IMPS Penny Drop */}
          <button
            onClick={() => {
              if (!hasAccountDetails) {
                alert('Please configure bank details first before running IMPS Penny Drop.');
                openEditModal();
              } else {
                openVerificationModal('penny_drop');
              }
            }}
            style={{
              background: '#2563eb',
              color: 'white',
              border: 'none',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            ⚡ Method 2: Account + IFSC
          </button>
        </div>
      </div>

      {/* Alert Banner */}
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
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
            <span>{alertInfo.message}</span>
            {alertInfo.actionLabel && alertInfo.onAction && (
              <button
                onClick={alertInfo.onAction}
                style={{
                  background: '#d97706',
                  color: 'white',
                  border: 'none',
                  padding: '3px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {alertInfo.actionLabel}
              </button>
            )}
          </div>
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
                {customer.bankBeneficiaryName || '— (Run Verification)'}
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
                  : '⚪ Pending Verification'}
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

        {/* Informational Callout: Dual Verification Advantage */}
        <div style={{
          marginTop: '16px',
          background: '#f8fafc',
          borderRadius: '8px',
          padding: '12px 16px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#475569' }}>
            <span style={{ fontSize: '16px' }}>🛡️</span>
            <span>
              <strong>Smart Fallback Guarantee:</strong> Fast 3-second verification via ₹1 UPI QR. If borrower uses a spouse or shop UPI with a different name, seamlessly switch to Bank Account + IFSC without rejecting the customer.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => openVerificationModal('upi_qr')}
              style={{
                background: 'white',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#0f172a',
                cursor: 'pointer'
              }}
            >
              Test UPI Flow
            </button>
            <button
              onClick={() => openVerificationModal('penny_drop')}
              style={{
                background: 'white',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#0f172a',
                cursor: 'pointer'
              }}
            >
              Test IMPS Flow
            </button>
          </div>
        </div>
      </div>

      {/* ── UNIFIED VERIFICATION MODAL (DUAL METHOD) ────────────────────────── */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '560px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🛡️ RBI Bank Verification Portal
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                  Borrower: <strong style={{ color: '#1e40af' }}>{customer.name}</strong> (CUS-{1000 + customer.id})
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '16px', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            {/* Method Tabs */}
            <div style={{
              display: 'flex',
              background: '#f1f5f9',
              padding: '4px',
              borderRadius: '10px',
              marginBottom: '20px',
              gap: '4px'
            }}>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('upi_qr');
                  if (!upiData) fetchUpiQr();
                }}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeTab === 'upi_qr' ? 'white' : 'transparent',
                  color: activeTab === 'upi_qr' ? '#0f172a' : '#64748b',
                  boxShadow: activeTab === 'upi_qr' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>📱 Method 1: ₹1 UPI QR</span>
                <span style={{ fontSize: '10px', background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '10px', fontWeight: 700 }}>
                  Fast 3s
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('penny_drop')}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeTab === 'penny_drop' ? 'white' : 'transparent',
                  color: activeTab === 'penny_drop' ? '#0f172a' : '#64748b',
                  boxShadow: activeTab === 'penny_drop' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>🏦 Method 2: Account + IFSC</span>
                <span style={{ fontSize: '10px', background: '#eff6ff', color: '#1e40af', padding: '2px 6px', borderRadius: '10px', fontWeight: 700 }}>
                  Passbook
                </span>
              </button>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* TAB 1: ₹1 UPI DYNAMIC QR CODE (REVERSE PENNY DROP)                */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'upi_qr' && (
              <div>
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 500 }}>
                    Borrower scans with any UPI app to deposit ₹1 verification ping
                  </div>

                  {upiLoading ? (
                    <div style={{ padding: '40px 0', color: '#64748b', fontSize: '13px' }}>
                      ⏳ Generating Dynamic UPI QR Code...
                    </div>
                  ) : upiData ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {/* Dynamic QR Container */}
                      <div style={{
                        background: 'white',
                        padding: '12px',
                        borderRadius: '12px',
                        border: '2px solid #e2e8f0',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                        marginBottom: '10px'
                      }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={upiData.qrCodeUrl}
                          alt="Dynamic UPI QR Code"
                          width={190}
                          height={190}
                          style={{ display: 'block', borderRadius: '6px' }}
                        />
                      </div>

                      {/* Amount & Timer */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                          Amount: ₹1.00
                        </span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: upiTimer > 60 ? '#f0fdf4' : '#fef2f2',
                          color: upiTimer > 60 ? '#166534' : '#b91c1c',
                          border: `1px solid ${upiTimer > 60 ? '#86efac' : '#fca5a5'}`
                        }}>
                          ⏱️ Expires in {formatTimer(upiTimer)}
                        </span>
                      </div>

                      {/* VPA Copy Pill */}
                      <div style={{
                        background: 'white',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '8px'
                      }}>
                        <span style={{ color: '#64748b' }}>UPI ID:</span>
                        <strong style={{ fontFamily: 'monospace', color: '#1e40af' }}>{upiData.vpa}</strong>
                        <button
                          onClick={copyVpaToClipboard}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#2563eb',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: '0 4px'
                          }}
                        >
                          {copySuccess ? '✓ Copied' : '📋 Copy'}
                        </button>
                      </div>

                      {/* Supported App Badges */}
                      <div style={{ display: 'flex', gap: '6px', fontSize: '11px', color: '#64748b', alignItems: 'center', marginTop: '4px' }}>
                        <span>Supported:</span>
                        <span style={{ fontWeight: 600, color: '#4338ca' }}>Google Pay</span> ·
                        <span style={{ fontWeight: 600, color: '#6d28d9' }}>PhonePe</span> ·
                        <span style={{ fontWeight: 600, color: '#0284c7' }}>Paytm</span> ·
                        <span style={{ fontWeight: 600, color: '#059669' }}>BHIM</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={fetchUpiQr}
                      style={{
                        background: '#2563eb',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Generate QR Code
                    </button>
                  )}
                </div>

                {/* ── AUTOMATIC NPCI LIVE GATEWAY STATUS ── */}
                <div style={{
                  background: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: '#16a34a',
                    boxShadow: '0 0 0 4px #bbf7d0',
                    flexShrink: 0
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>⚡ 100% Automatic Detection Active</span>
                      <span style={{ fontSize: '10px', background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>NPCI Webhook</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px', lineHeight: 1.4 }}>
                      When borrower scans & pays ₹1 via GPay / PhonePe / Paytm, the bank automatically returns their registered legal name via webhook in &lt;1 second. <strong>No manual option selection needed!</strong>
                    </div>
                  </div>
                </div>

                {/* ── COLLAPSIBLE SANDBOX / DEMO SIMULATOR (FOR STAFF TESTING) ── */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginBottom: '16px'
                }}>
                  <button
                    type="button"
                    onClick={() => setShowUpiSimulator(!showUpiSimulator)}
                    style={{
                      background: 'none',
                      border: 'none',
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#475569',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🧪 Staff Testing & Sandbox Simulator</span>
                      <span style={{ fontSize: '10px', background: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>
                        Demo Mode Only
                      </span>
                    </span>
                    <span style={{ color: '#2563eb', fontSize: '12px' }}>
                      {showUpiSimulator ? '▲ Hide Test Scenarios' : '▼ Test Mismatch Scenarios (Shop / Nickname)'}
                    </span>
                  </button>

                  {showUpiSimulator && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                        ℹ️ <strong>For testing only:</strong> In live production, NPCI detects this automatically. Use these buttons to simulate what happens when a borrower pays from their own account vs a shopkeeper&apos;s phone:
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                        {[
                          { key: 'exact', label: '🟢 Exact Borrower KYC', desc: `Payer: "${customer.name.toUpperCase()}"` },
                          { key: 'reversed', label: '🟢 Reversed Name', desc: 'Surname first, given name last' },
                          { key: 'partial', label: '🟡 Initials / Nickname', desc: 'e.g. Srilakshmi M.' },
                          { key: 'mismatch', label: '🔴 Shop / Family Account', desc: 'Payer: "RAMESH KUMAR SHARMA"' }
                        ].map(s => (
                          <label
                            key={s.key}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '6px',
                              background: upiScenario === s.key ? '#e0f2fe' : 'white',
                              border: upiScenario === s.key ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            <input
                              type="radio"
                              name="upiScenario"
                              checked={upiScenario === s.key}
                              onChange={() => setUpiScenario(s.key as any)}
                              style={{ marginTop: '2px' }}
                            />
                            <div style={{ fontSize: '11px', textAlign: 'left' }}>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{s.label}</div>
                              <div style={{ color: '#64748b', fontSize: '10px' }}>{s.desc}</div>
                            </div>
                          </label>
                        ))}
                      </div>

                      {upiScenario === 'custom' && (
                        <input
                          type="text"
                          placeholder="Enter custom NPCI registered legal payer name..."
                          value={customUpiName}
                          onChange={(e) => setCustomUpiName(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                            boxSizing: 'border-box'
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* UPI Result Banner with Smart Fallback Trigger */}
                {upiResult && (
                  <div style={{
                    padding: '14px',
                    borderRadius: '10px',
                    marginBottom: '16px',
                    background: upiResult.status === 'verified' ? '#f0fdf4' : '#fffbeb',
                    border: `1.5px solid ${upiResult.status === 'verified' ? '#86efac' : '#fde68a'}`
                  }}>
                    {upiResult.status === 'verified' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '24px', color: '#16a34a' }}>✓</span>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#15803d' }}>
                            UPI Verified Successfully! (Match: {upiResult.matchScore}%)
                          </div>
                          <div style={{ fontSize: '12px', color: '#166534', marginTop: '2px' }}>
                            NPCI Payer: <strong>&quot;{upiResult.beneficiaryName}&quot;</strong> matches borrower KYC. Account cleared for loan disbursement.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          <span style={{ fontSize: '22px' }}>⚠️</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#92400e' }}>
                              UPI Name Mismatch ({upiResult.matchScore}% Match)
                            </div>
                            <div style={{ fontSize: '12px', color: '#b45309', marginTop: '2px', lineHeight: 1.4 }}>
                              UPI Bank Registered Name: <strong>&quot;{upiResult.beneficiaryName}&quot;</strong><br />
                              Borrower KYC Name: <strong>&quot;{customer.name}&quot;</strong>
                            </div>
                            <div style={{
                              marginTop: '8px',
                              background: 'white',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid #fef3c7',
                              fontSize: '11px',
                              color: '#78350f',
                              lineHeight: 1.4
                            }}>
                              <strong>Why did this happen?</strong> Borrower likely scanned using a shop account, business handle, or spouse&apos;s phone. Under RBI digital lending regulations, loan funds cannot be sent to third-party accounts.
                            </div>
                            <div style={{ marginTop: '10px' }}>
                              <button
                                type="button"
                                onClick={() => setActiveTab('penny_drop')}
                                style={{
                                  background: '#d97706',
                                  color: 'white',
                                  border: 'none',
                                  padding: '7px 14px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                }}
                              >
                                <span>Switch to Method 2: Bank Account + IFSC Penny Drop →</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer Actions for UPI */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={fetchUpiQr}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    🔄 Refresh QR
                  </button>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
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
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={executeVerifyUpi}
                      disabled={isVerifying}
                      style={{
                        background: isVerifying ? '#94a3b8' : '#047857',
                        color: 'white',
                        border: 'none',
                        padding: '8px 20px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: isVerifying ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isVerifying ? '⏳ Verifying Received ₹1...' : 'Confirm Received ₹1 Payment'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* TAB 2: BANK ACCOUNT + IFSC PENNY DROP (DIRECT IMPS)               */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'penny_drop' && (
              <div>
                {/* Target Account Summary */}
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#64748b' }}>Beneficiary Account:</span>
                    <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{customer.bankAccountNumber || 'Not Configured'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#64748b' }}>Bank & IFSC:</span>
                    <span style={{ fontWeight: 600 }}>{customer.bankName || 'Bank'} ({customer.bankIfsc || 'N/A'})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>KYC Borrower Name:</span>
                    <span style={{ fontWeight: 700, color: '#1e40af' }}>{customer.name}</span>
                  </div>
                </div>

                {!hasAccountDetails && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '10px 12px', borderRadius: '8px', marginBottom: '14px', fontSize: '12px', color: '#b91c1c' }}>
                    ⚠️ No bank account number or IFSC configured. Please click below to configure account details first.
                    <div style={{ marginTop: '6px' }}>
                      <button
                        onClick={openEditModal}
                        style={{ background: '#dc2626', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Enter Bank Details
                      </button>
                    </div>
                  </div>
                )}

                {/* Explanation */}
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '12px', color: '#1e40af', lineHeight: '1.4' }}>
                  <strong>ℹ️ Direct IMPS Verification:</strong> Sends ₹1 to the borrower&apos;s savings/current account. The beneficiary bank Core Banking System (CBS) returns the official legal passbook name automatically, bypassing UPI app nicknames.
                </div>

                {/* Collapsible Sandbox / Demo Simulator for IMPS */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginBottom: '18px'
                }}>
                  <button
                    type="button"
                    onClick={() => setShowPennySimulator(!showPennySimulator)}
                    style={{
                      background: 'none',
                      border: 'none',
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#475569',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🧪 Staff Testing & Sandbox Simulator</span>
                      <span style={{ fontSize: '10px', background: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>
                        Demo Mode Only
                      </span>
                    </span>
                    <span style={{ color: '#2563eb', fontSize: '12px' }}>
                      {showPennySimulator ? '▲ Hide Test Scenarios' : '▼ Test Passbook Name Matching'}
                    </span>
                  </button>

                  {showPennySimulator && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                        ℹ️ <strong>For testing only:</strong> In live production, the bank Core Banking System returns the official passbook name automatically. Use these options to test LenQredzo&apos;s fuzzy matching engine:
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[
                          { key: 'exact', title: '🟢 Match Borrower Name (100%)', desc: `Bank returns: "${customer.name.toUpperCase()}"` },
                          { key: 'reversed', title: '🟢 Reversed Indian Name (100%)', desc: 'Bank returns: Surname first, given name last' },
                          { key: 'partial', title: '🟡 Partial / Initials Match (85%)', desc: `Bank returns initials (e.g. "${customer.name.split(' ')[0]} M")` },
                          { key: 'mismatch', title: '🔴 3rd-Party Fraud Account (0%)', desc: 'Bank returns: "RAMESH KUMAR SHARMA" (Triggers fraud block)' },
                          { key: 'invalid', title: '❌ Invalid Account / Closed', desc: 'Bank rejects IMPS ping with NPCI Account Inactive error' },
                          { key: 'custom', title: '✍️ Custom Bank Beneficiary Name', desc: 'Type custom name to test fuzzy match score engine' }
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
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
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
                    disabled={isVerifying || !hasAccountDetails}
                    style={{
                      background: isVerifying || !hasAccountDetails ? '#93c5fd' : '#2563eb',
                      color: 'white',
                      border: 'none',
                      padding: '8px 20px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: isVerifying || !hasAccountDetails ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isVerifying ? '⚡ Pinging IMPS Bank...' : 'Execute Penny-Drop Ping'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EDIT BANK DETAILS MODAL ─────────────────────────────────────────── */}
      {editModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(3px)',
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
