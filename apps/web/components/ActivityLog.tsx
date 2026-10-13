'use client';
import { useState, useEffect, useMemo } from 'react';
import { API_URL } from '@/lib/api';

interface AuditLogItem {
  id: number;
  companyId: number;
  userId?: number;
  userName?: string;
  action: string;
  entityType: string;
  entityId?: number | null;
  details?: string | null;
  photoData?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

const ACTION_CONFIG: Record<string, { icon: string; label: string; badgeBg: string; badgeColor: string }> = {
  VERIFY_BANK_ACCOUNT: { icon: '🏦', label: 'Bank Verification', badgeBg: '#dbeafe', badgeColor: '#1e40af' },
  UPDATE_BANK_DETAILS: { icon: '🏦', label: 'Bank Details Updated', badgeBg: '#e0e7ff', badgeColor: '#3730a3' },
  UPLOAD_CUSTOMER_DOCUMENT: { icon: '📄', label: 'Document Uploaded', badgeBg: '#fef3c7', badgeColor: '#92400e' },
  VERIFY_CUSTOMER_DOCUMENT: { icon: '✅', label: 'Document Approved', badgeBg: '#dcfce7', badgeColor: '#166534' },
  REJECT_CUSTOMER_DOCUMENT: { icon: '❌', label: 'Document Rejected', badgeBg: '#fee2e2', badgeColor: '#991b1b' },
  DELETE_CUSTOMER_DOCUMENT: { icon: '🗑️', label: 'Document Deleted', badgeBg: '#f3f4f6', badgeColor: '#4b5563' },
  UPDATE_CUSTOMER_KYC_STATUS: { icon: '🪪', label: 'KYC Status Updated', badgeBg: '#e0e7ff', badgeColor: '#4338ca' },
  MARK_EMI_PAID: { icon: '💰', label: 'EMI Collection', badgeBg: '#dcfce7', badgeColor: '#15803d' },
  ONLINE_EMI_VERIFIED: { icon: '💳', label: 'Online Payment Verified', badgeBg: '#ccfbf1', badgeColor: '#0f766e' },
  WAIVE_PENALTY: { icon: '🏷️', label: 'Penalty Waived', badgeBg: '#fef9c3', badgeColor: '#854d0e' },
  FORECLOSE_LOAN: { icon: '🏁', label: 'Loan Foreclosed', badgeBg: '#f3e8ff', badgeColor: '#6b21a8' },
  CREATE_LOAN: { icon: '📋', label: 'Loan Disbursed', badgeBg: '#ede9fe', badgeColor: '#5b21b6' },
  UPDATE_LOAN_STATUS: { icon: '🔄', label: 'Loan Status Changed', badgeBg: '#e0e7ff', badgeColor: '#3730a3' },
  DELETE_LOAN: { icon: '🗑️', label: 'Loan Deleted', badgeBg: '#fee2e2', badgeColor: '#991b1b' },
  ADD_GUARANTOR: { icon: '👥', label: 'Guarantor Added', badgeBg: '#f0fdf4', badgeColor: '#166534' },
  UPDATE_GUARANTOR: { icon: '👥', label: 'Guarantor Updated', badgeBg: '#f0fdf4', badgeColor: '#166534' },
  DELETE_GUARANTOR: { icon: '👥', label: 'Guarantor Removed', badgeBg: '#f3f4f6', badgeColor: '#4b5563' },
  CREATE_CUSTOMER: { icon: '👤', label: 'Customer Created', badgeBg: '#dbeafe', badgeColor: '#1d4ed8' },
  UPDATE_CUSTOMER: { icon: '✏️', label: 'Customer Updated', badgeBg: '#f3f4f6', badgeColor: '#374151' },
  DELETE_CUSTOMER: { icon: '🗑️', label: 'Customer Deleted', badgeBg: '#fee2e2', badgeColor: '#991b1b' },
  BULK_IMPORT_CUSTOMERS: { icon: '📥', label: 'Bulk Customer Import', badgeBg: '#e0e7ff', badgeColor: '#3730a3' },
  SENT_PAYMENT_LINK: { icon: '🔗', label: 'Payment Link Sent', badgeBg: '#e0f2fe', badgeColor: '#0369a1' },
  UPDATE_COMPANY_LOGO: { icon: '🖼️', label: 'Company Logo Changed', badgeBg: '#fef3c7', badgeColor: '#92400e' },
  CREATE_STAFF: { icon: '🧑‍💼', label: 'Staff Added', badgeBg: '#ede9fe', badgeColor: '#5b21b6' },
  UPDATE_STAFF: { icon: '🧑‍💼', label: 'Staff Updated', badgeBg: '#f3f4f6', badgeColor: '#374151' },
  login_photo: { icon: '📸', label: 'Webcam Login', badgeBg: '#f1f5f9', badgeColor: '#334155' },
  login_google: { icon: '🌐', label: 'Google Login', badgeBg: '#f1f5f9', badgeColor: '#334155' },
  CRON_PENALTY_ACCRUAL: { icon: '⏰', label: 'Automated Penalty Cron', badgeBg: '#fef3c7', badgeColor: '#92400e' }
};

const DOC_TYPE_LABELS: Record<string, string> = {
  aadhar_front: 'Aadhaar Card (Front)',
  aadhar_back: 'Aadhaar Card (Back)',
  pan_card: 'PAN Card',
  photo: 'Borrower Photo',
  bank_passbook: 'Bank Passbook / Statement',
  salary_slip: 'Salary Slip',
  cheque: 'Cancelled Cheque',
  other: 'Supporting Document'
};

export default function ActivityLog() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'payments' | 'bank_kyc' | 'customers' | 'system'>('all');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/audit`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const fmtIST = (d: string) =>
    new Date(d).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    }) + ' IST';

  // Filters by category tab & search query
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Tab filter
      if (activeTab === 'payments') {
        if (!['MARK_EMI_PAID', 'ONLINE_EMI_VERIFIED', 'WAIVE_PENALTY', 'FORECLOSE_LOAN', 'SENT_PAYMENT_LINK', 'CRON_PENALTY_ACCRUAL'].includes(log.action)) {
          return false;
        }
      } else if (activeTab === 'bank_kyc') {
        if (!['VERIFY_BANK_ACCOUNT', 'UPDATE_BANK_DETAILS', 'UPLOAD_CUSTOMER_DOCUMENT', 'VERIFY_CUSTOMER_DOCUMENT', 'REJECT_CUSTOMER_DOCUMENT', 'DELETE_CUSTOMER_DOCUMENT', 'UPDATE_CUSTOMER_KYC_STATUS'].includes(log.action)) {
          return false;
        }
      } else if (activeTab === 'customers') {
        if (!['CREATE_CUSTOMER', 'UPDATE_CUSTOMER', 'DELETE_CUSTOMER', 'BULK_IMPORT_CUSTOMERS', 'CREATE_LOAN', 'UPDATE_LOAN_STATUS', 'DELETE_LOAN', 'ADD_GUARANTOR', 'UPDATE_GUARANTOR', 'DELETE_GUARANTOR'].includes(log.action)) {
          return false;
        }
      } else if (activeTab === 'system') {
        if (!['CREATE_STAFF', 'UPDATE_STAFF', 'login_photo', 'login_google', 'UPDATE_COMPANY_LOGO'].includes(log.action)) {
          return false;
        }
      }

      // Search filter
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const user = (log.userName || '').toLowerCase();
      const action = (log.action || '').toLowerCase();
      const details = (log.details || '').toLowerCase();
      return user.includes(q) || action.includes(q) || details.includes(q);
    });
  }, [logs, activeTab, search]);

  /**
   * Safely formats audit log details into clean, human-readable UI elements.
   * Parses legacy or existing raw JSON strings into structured, professional badges and typography.
   */
  const renderReadableDetails = (log: AuditLogItem) => {
    const raw = (log.details || '').trim();

    // Check if details is a JSON string
    if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
        const parsed = JSON.parse(raw);

        // Case 1: Bank verification event
        if (parsed.bankName !== undefined || parsed.ifsc !== undefined || parsed.beneficiaryName !== undefined) {
          const isVerified = parsed.status === 'verified';
          const isFailed = parsed.status === 'failed';
          const score = typeof parsed.matchScore === 'number' ? parsed.matchScore : null;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: '600', color: '#111827', fontSize: '14px' }}>
                  Bank Account Verification
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: isVerified ? '#dcfce7' : isFailed ? '#fee2e2' : '#fef3c7',
                    color: isVerified ? '#166534' : isFailed ? '#991b1b' : '#92400e',
                    border: `1px solid ${isVerified ? '#bbf7d0' : isFailed ? '#fecaca' : '#fde68a'}`,
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    textTransform: 'capitalize'
                  }}
                >
                  {isVerified ? '✓ Verified' : isFailed ? '✕ Verification Failed' : '⚠ ' + (parsed.status || 'Pending')}
                </span>
                {score !== null && (
                  <span
                    style={{
                      background: score >= 80 ? '#f0fdf4' : score >= 60 ? '#fffbeb' : '#fef2f2',
                      color: score >= 80 ? '#15803d' : score >= 60 ? '#b45309' : '#b91c1c',
                      border: `1px solid ${score >= 80 ? '#bbf7d0' : score >= 60 ? '#fde68a' : '#fecaca'}`,
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}
                  >
                    {score}% Name Match
                  </span>
                )}
              </div>
              <div style={{ fontSize: '13px', color: '#4b5563', lineHeight: '1.5' }}>
                <span style={{ fontWeight: '600', color: '#1f2937' }}>{parsed.bankName || 'Bank'}</span>
                {parsed.ifsc && (
                  <>
                    {' · IFSC: '}
                    <span style={{ fontFamily: 'monospace', fontWeight: '600', background: '#f3f4f6', padding: '1px 6px', borderRadius: '4px', color: '#111827' }}>
                      {parsed.ifsc}
                    </span>
                  </>
                )}
                {parsed.beneficiaryName && (
                  <>
                    {' · Beneficiary: '}
                    <span style={{ fontWeight: '600', color: '#111827' }}>{parsed.beneficiaryName}</span>
                  </>
                )}
              </div>
            </div>
          );
        }

        // Case 2: Document upload / verify / delete event
        if (parsed.docType !== undefined || parsed.fileName !== undefined) {
          const docLabel = DOC_TYPE_LABELS[parsed.docType] || parsed.docType?.replace(/_/g, ' ') || 'Document';
          const isDocVerified = parsed.status === 'verified';
          const isDocRejected = parsed.status === 'rejected';

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: '600', color: '#111827', fontSize: '14px' }}>
                  {docLabel}
                </span>
                {parsed.customerId && (
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    (Customer #{parsed.customerId})
                  </span>
                )}
                {parsed.status && (
                  <span
                    style={{
                      background: isDocVerified ? '#dcfce7' : isDocRejected ? '#fee2e2' : '#fef3c7',
                      color: isDocVerified ? '#166534' : isDocRejected ? '#991b1b' : '#92400e',
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      textTransform: 'capitalize'
                    }}
                  >
                    {isDocVerified ? '✓ Approved' : isDocRejected ? '✕ Rejected' : parsed.status}
                  </span>
                )}
              </div>
              {parsed.fileName && (
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  File: <span style={{ fontFamily: 'monospace', color: '#374151' }}>{parsed.fileName}</span>
                </div>
              )}
              {parsed.rejectionReason && (
                <div style={{ fontSize: '12px', color: '#b91c1c', fontStyle: 'italic' }}>
                  Reason: {parsed.rejectionReason}
                </div>
              )}
            </div>
          );
        }

        // Case 3: KYC Status change event
        if (parsed.previousStatus !== undefined || parsed.newStatus !== undefined) {
          return (
            <div style={{ fontSize: '13px', color: '#1f2937' }}>
              KYC Status updated from{' '}
              <span style={{ fontWeight: '600', textTransform: 'capitalize', color: '#6b7280' }}>
                {parsed.previousStatus || 'pending'}
              </span>
              {' → '}
              <span style={{ fontWeight: '700', textTransform: 'capitalize', color: '#166534' }}>
                {parsed.newStatus}
              </span>
              {parsed.customerId && ` for customer #${parsed.customerId}`}
            </div>
          );
        }

        // Generic JSON fallback: convert keys into clean human readable labels
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {Object.entries(parsed).map(([key, val]) => {
              if (val === null || val === undefined || val === '') return null;
              const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
              return (
                <span
                  key={key}
                  style={{
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#374151'
                  }}
                >
                  <strong style={{ color: '#111827' }}>{formattedKey}:</strong> {String(val)}
                </span>
              );
            })}
          </div>
        );
      } catch {
        // Fall through to plain text if JSON parse fails
      }
    }

    // Default: Plain text presentation
    if (raw) {
      return (
        <p style={{ margin: 0, fontSize: '14px', color: '#1f2937', lineHeight: '1.45', fontWeight: '400' }}>
          {raw}
        </p>
      );
    }

    // Fallback if details is completely empty
    if (log.action === 'login_photo') {
      return <p style={{ margin: 0, fontSize: '14px', color: '#374151' }}>Staff signed in with webcam selfie verification</p>;
    }
    if (log.action === 'login_google') {
      return <p style={{ margin: 0, fontSize: '14px', color: '#374151' }}>Staff signed in via Google OAuth</p>;
    }
    const config = ACTION_CONFIG[log.action];
    return <p style={{ margin: 0, fontSize: '14px', color: '#374151' }}>{config ? config.label : log.action.replace(/_/g, ' ')}</p>;
  };

  const getActionConfig = (action: string) => {
    return ACTION_CONFIG[action] || { icon: '📌', label: action.replace(/_/g, ' '), badgeBg: '#f3f4f6', badgeColor: '#4b5563' };
  };

  return (
    <div
      style={{
        background: '#ffffff',
        padding: '24px',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        marginBottom: '24px'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontWeight: '700', fontSize: '18px', margin: 0, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🕒</span> Company Activity & Audit Trail
          </h3>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>
            Track every loan disbursal, EMI collection, KYC verification, and staff login with full timestamp accuracy.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#f9fafb',
            border: '1px solid #d1d5db',
            padding: '7px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            color: '#374151',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          <span>🔄</span> {loading ? 'Refreshing...' : 'Refresh Logs'}
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Activities' },
            { id: 'payments', label: '💰 Payments & EMIs' },
            { id: 'bank_kyc', label: '🏦 Bank & KYC' },
            { id: 'customers', label: '👥 Customers & Loans' },
            { id: 'system', label: '🔒 Staff & Security' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: activeTab === tab.id ? '700' : '500',
                background: activeTab === tab.id ? '#1e3a8a' : '#f3f4f6',
                color: activeTab === tab.id ? '#ffffff' : '#4b5563',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 240px', maxWidth: '340px' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, action, bank, IFSC..."
            style={{
              width: '100%',
              padding: '7px 12px 7px 32px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '13px',
              outline: 'none',
              background: '#f9fafb'
            }}
          />
          <span style={{ position: 'absolute', left: '10px', top: '7px', fontSize: '13px', color: '#9ca3af' }}>
            🔍
          </span>
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '7px',
                background: 'transparent',
                border: 'none',
                fontSize: '12px',
                cursor: 'pointer',
                color: '#9ca3af'
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Logs Feed */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '36px 0', color: '#6b7280', fontSize: '14px' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
          Loading activity trail...
        </div>
      ) : filteredLogs.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '36px 16px',
            background: '#f9fafb',
            borderRadius: '12px',
            border: '1px dashed #d1d5db',
            color: '#6b7280',
            fontSize: '14px'
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔍</div>
          <p style={{ margin: 0, fontWeight: '600', color: '#374151' }}>No activities found</p>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#9ca3af' }}>
            {search ? 'Try modifying your search query or switching categories.' : 'New operations will automatically appear here.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px', textAlign: 'right' }}>
            Showing {filteredLogs.length} of {logs.length} logged events
          </div>
          {filteredLogs.map((log) => {
            const config = getActionConfig(log.action);
            return (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: '#fafbfc',
                  border: '1px solid #f1f5f9',
                  transition: 'background 0.15s ease'
                }}
              >
                {/* Action Icon Pill */}
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: config.badgeBg,
                    color: config.badgeColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    flexShrink: 0
                  }}
                  title={config.label}
                >
                  {config.icon}
                </div>

                {/* Content Body */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ marginBottom: '6px' }}>
                    {renderReadableDetails(log)}
                  </div>

                  {/* Metadata Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '12px', color: '#6b7280' }}>
                    {/* User Badge */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '600', color: '#374151' }}>
                      <span
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: '#e2e8f0',
                          color: '#475569',
                          fontSize: '10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700'
                        }}
                      >
                        {(log.userName || 'U').charAt(0).toUpperCase()}
                      </span>
                      {log.userName || 'Staff Member'}
                    </span>

                    <span style={{ color: '#d1d5db' }}>•</span>

                    {/* Timestamp */}
                    <span title={fmtIST(log.createdAt)} style={{ color: '#6b7280' }}>
                      {fmtIST(log.createdAt)} ({timeAgo(log.createdAt)})
                    </span>

                    {/* Photo proof badge if available */}
                    {log.photoData && (
                      <>
                        <span style={{ color: '#d1d5db' }}>•</span>
                        <button
                          onClick={() => setPreviewPhoto(log.photoData || null)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            padding: '1px 6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          📸 View Photo Proof
                        </button>
                      </>
                    )}

                    {/* IP Address badge */}
                    {log.ipAddress && log.ipAddress !== '::1' && log.ipAddress !== '127.0.0.1' && (
                      <>
                        <span style={{ color: '#d1d5db' }}>•</span>
                        <span style={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: '11px' }}>
                          IP: {log.ipAddress}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '20px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                📸 Verification Photo Proof
              </h4>
              <button
                onClick={() => setPreviewPhoto(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ borderRadius: '10px', overflow: 'hidden', background: '#000000', textAlign: 'center' }}>
              <img
                src={previewPhoto}
                alt="Audit Photo Proof"
                style={{ width: '100%', maxHeight: '380px', objectFit: 'contain' }}
              />
            </div>
            <div style={{ marginTop: '14px', textAlign: 'right' }}>
              <button
                onClick={() => setPreviewPhoto(null)}
                style={{
                  background: '#1f2937',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
