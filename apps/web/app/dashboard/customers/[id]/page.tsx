'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import BankAccountCard from '@/components/BankAccountCard';
import CustomerPassbookModal from '@/components/CustomerPassbookModal';
import { API_URL } from '@/lib/api';

type CustomerDoc = {
  id: number;
  customerId: number;
  companyId?: number;
  docType: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
};

const STANDARD_DOC_SLOTS = [
  { key: 'aadhar_front', label: 'Aadhaar (Front)', icon: '🪪', required: true, desc: 'Full front face, Name & 12-digit number' },
  { key: 'aadhar_back', label: 'Aadhaar (Back)', icon: '🪪', required: true, desc: 'Address & Barcode/QR code visible' },
  { key: 'pan_card', label: 'PAN Card', icon: '💳', required: true, desc: 'Permanent Account Number & signature' },
  { key: 'photo', label: 'Borrower Photo', icon: '👤', required: false, desc: 'Clear recent passport photo or selfie' },
  { key: 'bank_statement', label: 'Bank Statement / Income', icon: '📄', required: false, desc: 'Last 3-6 months statement or salary slip' },
  { key: 'address_proof', label: 'Address Proof / Utility', icon: '🏠', required: false, desc: 'Electricity, Water or Rent Agreement' },
];

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // KYC & Document States
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [activePreviewDoc, setActivePreviewDoc] = useState<CustomerDoc | null>(null);
  const [rejectingDocId, setRejectingDocId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [kycUpdating, setKycUpdating] = useState(false);
  const [customDocType, setCustomDocType] = useState('other');
  const [showCustomUpload, setShowCustomUpload] = useState(false);
  const [showPassbookModal, setShowPassbookModal] = useState(false);

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    if (id) fetchCustomer();
  }, [id]);

  const fetchCustomer = async () => {
    try {
      const res = await fetch(`${API_URL}/api/customers/${id}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      setCustomer(data && data.id ? data : null);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Upload handler
  const handleFileUpload = async (slotKey: string, file: File) => {
    if (!file) return;
    setUploadingSlot(slotKey);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('docType', slotKey);

      const res = await fetch(`${API_URL}/api/customers/${id}/documents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to upload document');
      } else {
        await fetchCustomer();
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Error uploading document.');
    } finally {
      setUploadingSlot(null);
    }
  };

  // Verify document
  const handleVerifyDoc = async (docId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/customers/${id}/documents/${docId}/verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ status: 'verified' })
      });

      if (res.ok) {
        if (activePreviewDoc?.id === docId) {
          setActivePreviewDoc(prev => prev ? { ...prev, status: 'verified', rejectionReason: null } : null);
        }
        await fetchCustomer();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to verify document');
      }
    } catch (err) {
      console.error('Verify error:', err);
    }
  };

  // Reject document
  const handleRejectDoc = async (docId: number) => {
    if (!rejectionReason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/customers/${id}/documents/${docId}/verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ status: 'rejected', rejectionReason })
      });

      if (res.ok) {
        setRejectingDocId(null);
        setRejectionReason('');
        if (activePreviewDoc?.id === docId) {
          setActivePreviewDoc(prev => prev ? { ...prev, status: 'rejected', rejectionReason } : null);
        }
        await fetchCustomer();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to reject document');
      }
    } catch (err) {
      console.error('Reject error:', err);
    }
  };

  // Delete document
  const handleDeleteDoc = async (docId: number) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      const res = await fetch(`${API_URL}/api/customers/${id}/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        }
      });

      if (res.ok) {
        if (activePreviewDoc?.id === docId) setActivePreviewDoc(null);
        await fetchCustomer();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete document');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Change overall customer KYC status
  const handleUpdateKycStatus = async (status: string) => {
    if (status === 'verified') {
      const docs = customer?.documents || [];
      const hasAadhaar = docs.some((d: any) => (d.docType === 'aadhar_front' || d.docType === 'aadhar_back') && d.status === 'verified');
      const hasPan = docs.some((d: any) => d.docType === 'pan_card' && d.status === 'verified');
      const hasPhoto = docs.some((d: any) => d.docType === 'photo');

      const missing: string[] = [];
      if (!hasAadhaar) missing.push('Verified Aadhaar (Front/Back)');
      if (!hasPan) missing.push('Verified PAN Card');
      if (!hasPhoto) missing.push('Borrower Photo');

      if (missing.length > 0) {
        alert(`⚠️ Cannot mark KYC as Verified:\n\nThe following mandatory identity documents are missing or unverified:\n• ${missing.join('\n• ')}\n\nPlease upload and verify all required documents first.`);
        return;
      }
    }

    setKycUpdating(true);
    try {
      const res = await fetch(`${API_URL}/api/customers/${id}/kyc-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ kycStatus: status })
      });

      if (res.ok) {
        await fetchCustomer();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update KYC status');
      }
    } catch (err) {
      console.error('KYC update error:', err);
    } finally {
      setKycUpdating(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
        Loading customer...
      </div>
    </div>
  );

  if (!customer) return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '24px' }}>
        <button onClick={() => router.push('/dashboard/customers')} style={{ background: 'none', border: 'none', color: '#1e40af', cursor: 'pointer', fontSize: '14px', marginBottom: '16px' }}>← Back</button>
        <p style={{ color: '#6b7280' }}>Customer not found.</p>
      </div>
    </div>
  );

  const loans = customer.loans || [];
  const totalLoans = loans.length;
  const activeLoans = loans.filter((l: any) => l.status === 'active').length;
  const totalBorrowed = loans.reduce((s: number, l: any) => s + (l.amount || 0), 0);
  const totalPaid = loans.reduce((s: number, l: any) => s + (l.payments || []).reduce((ps: number, p: any) => ps + (p.amount || 0), 0), 0);

  const allPayments = loans
    .flatMap((l: any) => (l.payments || []).map((p: any) => ({ ...p, loanId: l.id, loanType: l.type })))
    .sort((a: any, b: any) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

  const docs: CustomerDoc[] = customer.documents || [];
  const kycStatus = customer.kycStatus || 'pending';

  // Helper to find document for a given slot
  const getSlotDoc = (slotKey: string) => docs.find(d => d.docType === slotKey);
  const otherDocs = docs.filter(d => !STANDARD_DOC_SLOTS.some(s => s.key === d.docType));

  const kycBadgeConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
    verified: { label: 'KYC Verified', bg: '#dcfce7', text: '#15803d', border: '#86efac' },
    submitted: { label: 'Under Review', bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
    rejected: { label: 'KYC Rejected', bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
    pending: { label: 'Pending Documents', bg: '#f3f4f6', text: '#4b5563', border: '#e5e7eb' },
  };

  const currentBadge = kycBadgeConfig[kycStatus] || kycBadgeConfig.pending;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button onClick={() => router.push('/dashboard/customers')} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
              ← Back
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: 0 }}>{customer.name}</h2>
                <span style={{
                  background: currentBadge.bg,
                  color: currentBadge.text,
                  border: `1px solid ${currentBadge.border}`,
                  padding: '3px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  {kycStatus === 'verified' ? '✓' : kycStatus === 'rejected' ? '✕' : '●'} {currentBadge.label}
                </span>
              </div>
              <p style={{ color: '#6b7280', margin: '2px 0 0 0', fontSize: '13px' }}>
                Customer #{customer.id} · Registered {fmtDate(customer.createdAt)}
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setShowPassbookModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#1e3a8a',
                color: 'white',
                border: 'none',
                padding: '7px 14px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(30, 58, 138, 0.2)'
              }}
            >
              📖 Account Passbook / SOA
            </button>

            {/* Quick Staff KYC Status Override */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>KYC Status:</span>
              <select
                value={kycStatus}
                disabled={kycUpdating}
                onChange={(e) => handleUpdateKycStatus(e.target.value)}
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  background: '#f9fafb',
                  color: '#111827',
                  cursor: 'pointer'
                }}
              >
                <option value="pending">Pending Documents</option>
                <option value="submitted">Under Review</option>
                <option value="verified">KYC Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Total Loans', value: String(totalLoans), color: '#111827' },
            { label: 'Active Loans', value: String(activeLoans), color: '#16a34a' },
            { label: 'Total Borrowed', value: fmt(totalBorrowed), color: '#1e40af' },
            { label: 'Total Paid', value: fmt(totalPaid), color: '#16a34a' },
          ].map(c => (
            <div key={c.label} style={{ background: 'white', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 4px' }}>{c.label}</p>
              <p style={{ color: c.color, fontSize: '20px', fontWeight: '700', margin: 0 }}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* ── KYC & DOCUMENT VERIFICATION SECTION ───────────────────────────────── */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '24px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🪪 KYC Document Management & Verification
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                Verify identity proofs, upload Aadhaar / PAN scans, inspect previews, and record staff KYC approvals.
              </p>
            </div>
            <button
              onClick={() => setShowCustomUpload(prev => !prev)}
              style={{
                background: '#eff6ff',
                color: '#1e40af',
                border: '1px solid #bfdbfe',
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              + Upload Custom Document
            </button>
          </div>

          {/* Custom Document Upload Bar */}
          {showCustomUpload && (
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Document Type:</span>
              <input
                type="text"
                placeholder="e.g. Electricity Bill, Property Document"
                value={customDocType}
                onChange={(e) => setCustomDocType(e.target.value)}
                style={{ padding: '7px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', width: '260px' }}
              />
              <input
                type="file"
                accept="image/*,application/pdf"
                id="custom-file-input"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(customDocType || 'other', f);
                  e.target.value = '';
                }}
              />
              <label
                htmlFor="custom-file-input"
                style={{
                  background: '#1e40af',
                  color: 'white',
                  padding: '7px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Choose & Upload File
              </label>
              <button
                onClick={() => setShowCustomUpload(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Document Slots Grid */}
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '18px' }}>
            {STANDARD_DOC_SLOTS.map((slot) => {
              const doc = getSlotDoc(slot.key);
              const isUploading = uploadingSlot === slot.key;

              return (
                <div
                  key={slot.key}
                  style={{
                    border: doc ? (doc.status === 'verified' ? '1px solid #86efac' : doc.status === 'rejected' ? '1px solid #fca5a5' : '1px solid #e5e7eb') : '1px dashed #d1d5db',
                    borderRadius: '12px',
                    padding: '16px',
                    background: doc ? (doc.status === 'verified' ? '#f0fdf4' : doc.status === 'rejected' ? '#fef2f2' : 'white') : '#fafafa',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '220px',
                    position: 'relative'
                  }}
                >
                  <div>
                    {/* Slot Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{slot.icon}</span> {slot.label}
                        </span>
                        <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#6b7280' }}>{slot.desc}</p>
                      </div>
                      {slot.required && !doc && (
                        <span style={{ fontSize: '10px', background: '#fee2e2', color: '#dc2626', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          Required
                        </span>
                      )}
                    </div>

                    {/* Slot Content */}
                    {doc ? (
                      <div>
                        {/* File Thumbnail & Info */}
                        <div
                          onClick={() => setActivePreviewDoc(doc)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px',
                            background: 'white',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            cursor: 'pointer',
                            marginBottom: '10px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '6px',
                            background: '#f3f4f6',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {doc.mimeType?.startsWith('image/') || doc.fileName.match(/\.(png|jpg|jpeg|webp)$/i) ? (
                              <img
                                src={`${API_URL}${doc.fileUrl}`}
                                alt={doc.fileName}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e: any) => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              <span style={{ fontSize: '20px' }}>📄</span>
                            )}
                          </div>
                          <div style={{ overflow: 'hidden', flex: 1 }}>
                            <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {doc.fileName}
                            </p>
                            <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#6b7280' }}>
                              {fmtFileSize(doc.fileSize)} · {fmtDate(doc.createdAt)}
                            </p>
                          </div>
                          <span style={{ fontSize: '14px', color: '#1e40af', fontWeight: 600 }}>🔍</span>
                        </div>

                        {/* Status Info */}
                        <div style={{ marginBottom: '8px' }}>
                          {doc.status === 'verified' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                              <span>✓ Verified by {doc.verifiedBy || 'Staff'}</span>
                              {doc.verifiedAt && <span>({fmtDate(doc.verifiedAt)})</span>}
                            </div>
                          )}
                          {doc.status === 'rejected' && (
                            <div style={{ fontSize: '11px', color: '#dc2626' }}>
                              <p style={{ margin: 0, fontWeight: 600 }}>✕ Rejected</p>
                              {doc.rejectionReason && <p style={{ margin: '2px 0 0 0' }}>Reason: {doc.rejectionReason}</p>}
                            </div>
                          )}
                          {doc.status === 'pending' && (
                            <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600 }}>
                              ⏳ Pending Review
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Empty upload placeholder */
                      <div
                        onClick={() => fileInputRefs.current[slot.key]?.click()}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '24px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: 'white',
                          border: '1px solid #e5e7eb'
                        }}
                      >
                        <span style={{ fontSize: '24px', marginBottom: '6px' }}>📤</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e40af' }}>
                          {isUploading ? 'Uploading...' : 'Click to Upload Document'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                          JPG, PNG, or PDF up to 10MB
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Hidden File Input */}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    ref={(el) => { fileInputRefs.current[slot.key] = el; }}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(slot.key, file);
                      e.target.value = '';
                    }}
                  />

                  {/* Actions Bar */}
                  {doc ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #f3f4f6' }}>
                      <button
                        onClick={() => setActivePreviewDoc(doc)}
                        style={{ background: '#f3f4f6', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#374151', fontWeight: 500 }}
                      >
                        👁️ Preview
                      </button>

                      {doc.status !== 'verified' && (
                        <button
                          onClick={() => handleVerifyDoc(doc.id)}
                          style={{ background: '#dcfce7', border: '1px solid #86efac', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#15803d', fontWeight: 600 }}
                        >
                          ✓ Verify
                        </button>
                      )}

                      {doc.status !== 'rejected' && (
                        <button
                          onClick={() => {
                            setRejectingDocId(doc.id);
                            setRejectionReason('');
                          }}
                          style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#b91c1c', fontWeight: 600 }}
                        >
                          ✕ Reject
                        </button>
                      )}

                      <button
                        onClick={() => fileInputRefs.current[slot.key]?.click()}
                        style={{ background: 'none', border: 'none', padding: '6px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#6b7280', marginLeft: 'auto' }}
                        title="Re-upload"
                      >
                        🔄
                      </button>

                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        style={{ background: 'none', border: 'none', padding: '6px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#ef4444' }}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Other / Additional Documents List */}
          {otherDocs.length > 0 && (
            <div style={{ padding: '0 20px 20px 20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px 0', color: '#374151' }}>
                📁 Other Uploaded Documents ({otherDocs.length})
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '14px' }}>
                {otherDocs.map((doc) => (
                  <div key={doc.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px', background: 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827', textTransform: 'capitalize' }}>
                        📄 {doc.docType.replace(/_/g, ' ')}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: 600,
                        background: doc.status === 'verified' ? '#dcfce7' : doc.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                        color: doc.status === 'verified' ? '#15803d' : doc.status === 'rejected' ? '#b91c1c' : '#b45309'
                      }}>
                        {doc.status}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.fileName} ({fmtFileSize(doc.fileSize)})
                    </p>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setActivePreviewDoc(doc)} style={{ background: '#f3f4f6', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>👁️ Preview</button>
                      {doc.status !== 'verified' && (
                        <button onClick={() => handleVerifyDoc(doc.id)} style={{ background: '#dcfce7', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', color: '#15803d', fontWeight: 600, cursor: 'pointer' }}>✓ Verify</button>
                      )}
                      <button onClick={() => handleDeleteDoc(doc.id)} style={{ background: '#fee2e2', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', color: '#b91c1c', cursor: 'pointer', marginLeft: 'auto' }}>🗑️ Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── BANK ACCOUNT & PENNY-DROP VERIFICATION ─────────────────────────── */}
        <BankAccountCard customer={customer} onRefresh={fetchCustomer} />

        {/* ── PROFILE DETAILS ─────────────────────────────────────────────────── */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: '#111827' }}>👤 Profile Details</h3>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              Aadhaar & PAN are AES-256 encrypted in database
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
            {[
              ['Full Name', customer.name],
              ['Phone Number', customer.phone],
              ['Email Address', customer.email],
              ['Current Address', customer.address || customer.permanentAddress],
              ['Aadhaar Number', customer.aadhar ? `XXXX-XXXX-${customer.aadhar.slice(-4)}` : '—'],
              ['PAN Card Number', customer.pan || '—'],
              ['Date of Birth', customer.dateOfBirth ? fmtDate(customer.dateOfBirth) : '—'],
              ['Gender / Marital', [customer.gender, customer.maritalStatus].filter(Boolean).join(' · ') || '—'],
              ['Employment & Income', customer.employmentType ? `${customer.employmentType} (${customer.monthlyIncome ? fmt(customer.monthlyIncome) + '/mo' : '—'})` : '—'],
              ['Bank Name & Acc', customer.bankName ? `${customer.bankName} (Acc: ${customer.bankAccountNumber || '—'})` : '—'],
              ['KYC Consent Signed', customer.consentGiven ? `✓ Given on ${customer.consentDate ? fmtDate(customer.consentDate) : 'Consent Record'}` : '✕ Pending'],
            ].map(([k, v]) => (
              <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }}>
                <span style={{ color: '#6b7280' }}>{k}</span>
                <span style={{ fontWeight: '500', color: '#111827' }}>{v || '—'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── LOANS ───────────────────────────────────────────────────────────── */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ fontWeight: '700', margin: 0, fontSize: '15px' }}>💼 Loans ({totalLoans})</h3>
          </div>
          {loans.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>No loans for this customer.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Loan ID', 'Type', 'Amount', 'Frequency', 'Tenure', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loans.map((l: any) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }} onClick={() => router.push(`/dashboard/loans/${l.id}`)}>
                    <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: '600', color: '#1e40af' }}>LN{1000 + l.id}</td>
                    <td style={{ padding: '10px 16px', fontSize: '13px' }}>{l.type}</td>
                    <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: '600' }}>{fmt(l.amount)}</td>
                    <td style={{ padding: '10px 16px', fontSize: '13px', textTransform: 'capitalize' }}>{l.frequency}</td>
                    <td style={{ padding: '10px 16px', fontSize: '13px' }}>{l.tenure} months</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        background: l.status === 'active' ? '#dcfce7' : l.status === 'closed' ? '#f3f4f6' : '#fee2e2',
                        color: l.status === 'active' ? '#16a34a' : l.status === 'closed' ? '#6b7280' : '#dc2626',
                        padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', textTransform: 'capitalize'
                      }}>
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── PAYMENTS HISTORY ────────────────────────────────────────────────── */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ fontWeight: '700', margin: 0, fontSize: '15px' }}>💳 Payments History ({allPayments.length})</h3>
          </div>
          {allPayments.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>No payments recorded yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Date & Time', 'Loan', 'Amount', 'Method', 'Reference', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allPayments.map((p: any) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 16px', fontSize: '13px' }}>
                      {p.paidAt ? new Date(p.paidAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '13px', color: '#1e40af' }}>LN{1000 + p.loanId}</td>
                    <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: '600', color: '#16a34a' }}>{fmt(p.amount)}</td>
                    <td style={{ padding: '10px 16px', fontSize: '13px', textTransform: 'capitalize' }}>{p.method || 'cash'}</td>
                    <td style={{ padding: '10px 16px', fontSize: '12px', color: p.reference ? '#374151' : '#9ca3af' }}>{p.reference || '—'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        background: p.verified ? '#dcfce7' : '#f3f4f6',
                        color: p.verified ? '#16a34a' : '#6b7280',
                        padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600'
                      }}>
                        {p.verified ? '✓ Recorded' : 'Cash / no proof'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* ── MODAL: DOCUMENT PREVIEW VIEWER ───────────────────────────────────────── */}
      {activePreviewDoc && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '850px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827', textTransform: 'capitalize' }}>
                  {activePreviewDoc.docType.replace(/_/g, ' ')} — {activePreviewDoc.fileName}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                  Uploaded {fmtDate(activePreviewDoc.createdAt)} · {fmtFileSize(activePreviewDoc.fileSize)}
                </p>
              </div>
              <button
                onClick={() => setActivePreviewDoc(null)}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Viewer */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '380px' }}>
              {activePreviewDoc.mimeType === 'application/pdf' || activePreviewDoc.fileName.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={`${API_URL}${activePreviewDoc.fileUrl}`}
                  style={{ width: '100%', height: '500px', border: 'none', borderRadius: '8px' }}
                  title="PDF Preview"
                />
              ) : (
                <img
                  src={`${API_URL}${activePreviewDoc.fileUrl}`}
                  alt={activePreviewDoc.fileName}
                  style={{ maxWidth: '100%', maxHeight: '520px', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
              )}
            </div>

            {/* Modal Footer Controls */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
              <div>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: activePreviewDoc.status === 'verified' ? '#dcfce7' : activePreviewDoc.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                  color: activePreviewDoc.status === 'verified' ? '#15803d' : activePreviewDoc.status === 'rejected' ? '#b91c1c' : '#b45309'
                }}>
                  Status: {activePreviewDoc.status.toUpperCase()}
                  {activePreviewDoc.rejectionReason && ` (${activePreviewDoc.rejectionReason})`}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <a
                  href={`${API_URL}${activePreviewDoc.fileUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  download={activePreviewDoc.fileName}
                  style={{
                    background: '#f3f4f6',
                    color: '#374151',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  ⬇️ Open Original / Download
                </a>

                {activePreviewDoc.status !== 'verified' && (
                  <button
                    onClick={() => handleVerifyDoc(activePreviewDoc.id)}
                    style={{ background: '#16a34a', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    ✓ Mark as Verified
                  </button>
                )}

                {activePreviewDoc.status !== 'rejected' && (
                  <button
                    onClick={() => {
                      setRejectingDocId(activePreviewDoc.id);
                      setRejectionReason('');
                    }}
                    style={{ background: '#dc2626', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    ✕ Reject Document
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: REJECT REASON PROMPT ────────────────────────────────────────── */}
      {rejectingDocId !== null && (
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
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', maxWidth: '440px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 700, color: '#111827' }}>
              Reject Document Verification
            </h3>
            <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#6b7280' }}>
              Please specify the reason for rejecting this document (e.g., blurry image, name mismatch, expired):
            </p>
            <textarea
              rows={3}
              placeholder="e.g. Blurry photo; Name on card does not match customer profile."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '13px',
                boxSizing: 'border-box',
                outline: 'none',
                marginBottom: '16px'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => { setRejectingDocId(null); setRejectionReason(''); }}
                style={{ background: '#f3f4f6', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', color: '#374151' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRejectDoc(rejectingDocId)}
                style={{ background: '#dc2626', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Passbook / Statement of Account Modal */}
      {showPassbookModal && (
        <CustomerPassbookModal
          customer={customer}
          onClose={() => setShowPassbookModal(false)}
        />
      )}

    </div>
  );
}