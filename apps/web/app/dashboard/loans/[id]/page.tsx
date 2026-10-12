'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter} from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { getAuthUser } from '@/lib/authUser';
import { API_URL } from '@/lib/api';
import Script from 'next/script';
import SanctionLetterModal from '@/components/SanctionLetterModal';

type LoanDetail = {
  id: number;
  type: string;
  amount: number;
  disbursedAmount?: number;
  emiAmount: number;
  outstandingAmount?: number;
  customer?: { id: number; name: string; phone?: string };
  createdAt: string;
  status: string;
  interestType?: string;
  interestRate?: number;
  frequency?: string;
  tenure?: number;
  processingFee?: number;
  penaltyType?: string;
  penaltyValue?: number;
  deductUpfront?: boolean;
  emis?: Array<{ id: number; dueDate: string; amount: number; status: string; paidAmount?: number; paidAt?: string }>;
  payments?: Array<{ id: number; amount: number; method?: string; reference?: string; verified?: boolean; paidAt?: string }>;
  guarantors?: Array<{ id: number; name: string; phone?: string; relationship?: string; aadhar?: string; pan?: string; type?: string }>;
};

type AuthUser = { userId: number; role: string; companyId: number | null; branchId: number | null } | null;

export default function LoanDetailPage() {
  const params = useParams();
  const id = params?.id;
  const router = useRouter();
  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<AuthUser>(null);
  const [deleting, setDeleting] = useState(false);
  const [sendingLinkFor, setSendingLinkFor] = useState<number | null>(null);
  const [showSanctionLetter, setShowSanctionLetter] = useState(false);
  const [guarantorModalOpen, setGuarantorModalOpen] = useState(false);
  const [savingGuarantor, setSavingGuarantor] = useState(false);
  const [guarantorForm, setGuarantorForm] = useState({
    name: '',
    relationship: 'Family / Relative',
    phone: '',
    aadhar: '',
    pan: '',
    address: '',
    city: '',
    employmentType: 'Salaried',
    grossAnnualIncome: '',
    consentGiven: true
  });
  useEffect(() => { setMe(getAuthUser()); }, []);
  const canDelete = me && ['owner', 'admin', 'Super Admin', 'branch_manager'].includes(me.role);

  const deleteLoan = async () => {
    if (!loan) return;
    if (!confirm(`Delete loan LN${1000 + loan.id}? This removes its EMIs, payments and guarantors. This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/loans/${loan.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message || 'Could not delete'); setDeleting(false); return; }
      router.push('/dashboard/loans');
    } catch (err) {
      console.error(err);
      alert('Server error. Please try again.');
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    const loadLoan = async () => {
      try {
        const res = await fetch(`${API_URL}/api/loans/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
        });
        const data = await res.json();
        setLoan(data && data.id ? data : null);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };

    loadLoan();
  }, [id]);

  const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtDateTimeIST = (d: string) => d
    ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
    : '—';

  const paidEmis = loan?.emis?.filter((e) => e.status === 'paid').length || 0;
  const totalEmis = loan?.emis?.length || 0;
  const progressPct = totalEmis > 0 ? Math.round((paidEmis / totalEmis) * 100) : 0;

  const guarantorTypeLabel = (t: string) => {
    if (t === 'co-signer') return 'Co-signer';
    if (t === 'nominee') return 'Nominee';
    return 'Guarantor';
  };

  const guarantorTypeBadgeStyle = (t: string) => ({
    padding: '2px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 600,
    background: t === 'co-signer' ? '#fef3c7' : t === 'nominee' ? '#f3e8ff' : '#dbeafe',
    color: t === 'co-signer' ? '#92400e' : t === 'nominee' ? '#6b21a8' : '#1e40af',
  });

  const maskAadhaar = (a: string) => a ? '****-****-' + a.slice(-4) : '—';

  const handleSendPaymentLink = async (emi: any) => {
    if (!loan) return;
    setSendingLinkFor(emi.id);

    try {
      const res = await fetch(`${API_URL}/api/payments/send-payment-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          loanId: loan.id,
          emiId: emi.id
        })
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to generate payment link.');
        setSendingLinkFor(null);
        return;
      }

      // 1. Copy link to clipboard as an instant fallback
      if (typeof navigator !== 'undefined' && navigator.clipboard && data.paymentLink) {
        await navigator.clipboard.writeText(data.paymentLink);
      }

      // 2. If automated Meta API is configured
      if (data.whatsappSent) {
        alert(
          `✅ WhatsApp message delivered automatically to ${data.customerName} (${data.phone})!\n\nPayment Link:\n${data.paymentLink}\n\n(Link is also copied to your clipboard as backup)`
        );
      } else {
        // 3. In-built WhatsApp launch (Free 1-click WhatsApp Web / App)
        const waUrl = `https://web.whatsapp.com/send?phone=${data.phone}&text=${encodeURIComponent(data.formattedMessage)}`;
        window.open(waUrl, '_blank');

        alert(
          `✅ Payment Link Generated!\n\n• Opening WhatsApp with the pre-filled message and UPI link.\n• The payment link has also been copied to your clipboard as a backup:\n${data.paymentLink}`
        );
      }
    } catch (err) {
      console.error(err);
      alert('Network error while generating payment link.');
    } finally {
      setSendingLinkFor(null);
    }
  };

  const handleSaveGuarantor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guarantorForm.name.trim() || !guarantorForm.phone.trim()) {
      alert('Guarantor full name and phone number are required.');
      return;
    }
    setSavingGuarantor(true);
    try {
      const res = await fetch(`${API_URL}/api/loans/${id}/guarantors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify(guarantorForm)
      });
      const data = await res.json();
      if (res.ok) {
        setGuarantorModalOpen(false);
        setGuarantorForm({
          name: '',
          relationship: 'Family / Relative',
          phone: '',
          aadhar: '',
          pan: '',
          address: '',
          city: '',
          employmentType: 'Salaried',
          grossAnnualIncome: '',
          consentGiven: true
        });
        // Reload loan data
        const fresh = await fetch(`${API_URL}/api/loans/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
        });
        const freshData = await fresh.json();
        setLoan(freshData);
      } else {
        alert(data.message || 'Failed to attach guarantor');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving guarantor');
    } finally {
      setSavingGuarantor(false);
    }
  };

  const handleDeleteGuarantor = async (guarantorId: number) => {
    if (!confirm('Are you sure you want to remove this guarantor from the loan?')) return;
    try {
      const res = await fetch(`${API_URL}/api/loans/${id}/guarantors/${guarantorId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (res.ok) {
        const fresh = await fetch(`${API_URL}/api/loans/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
        });
        const freshData = await fresh.json();
        setLoan(freshData);
      } else {
        alert('Failed to delete guarantor');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6b7280' }}>Loading loan details...</p>
      </div>
    </div>
  );

  if (!loan) return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '24px' }}>
        <button onClick={() => router.push('/dashboard/loans')} style={{ background: 'none', border: 'none', color: '#1e40af', cursor: 'pointer', fontSize: '14px', marginBottom: '16px' }}>← Back</button>
        <p style={{ color: '#6b7280' }}>Loan not found.</p>
      </div>
    </div>
  );

  const outstanding = loan.emis?.filter((e) => e.status !== 'paid').reduce((s, e) => s + (e.amount - (e.paidAmount || 0)), 0) || 0;

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button onClick={() => router.push('/dashboard/loans')} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>← Back</button>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
              LN{1000 + loan.id} — {loan.type}
            </h2>
            <p style={{ color: '#6b7280', margin: 0, fontSize: '13px' }}>
              {loan.customer?.name} · Created {fmtDate(loan.createdAt)}
            </p>
          </div>
          <span style={{
            marginLeft: 'auto',
            background: loan.status === 'completed' ? '#dbeafe' : loan.status === 'active' ? '#dcfce7' : '#f3f4f6',
            color: loan.status === 'completed' ? '#1e40af' : loan.status === 'active' ? '#16a34a' : '#6b7280',
            padding: '4px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '700'
          }}>
            {loan.status === 'completed' ? '✅ Completed' : loan.status === 'active' ? '🟢 Active' : loan.status}
          </span>
          <button
            onClick={() => setShowSanctionLetter(true)}
            style={{
              background: '#1e40af',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            📄 Sanction Letter & Agreement
          </button>
          {canDelete && (
            <button onClick={deleteLoan} disabled={deleting}
              style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', opacity: deleting ? 0.6 : 1 }}>
              {deleting ? 'Deleting...' : '🗑 Delete Loan'}
            </button>
          )}
        </div>

        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Loan Amount', value: fmt(loan.amount), color: '#111827' },
            { label: 'Disbursed', value: fmt(loan.disbursedAmount ?? loan.amount), color: '#16a34a' },
            { label: 'EMI Amount', value: fmt(loan.emiAmount), color: '#1e40af' },
            { label: 'Outstanding', value: fmt(outstanding), color: '#dc2626' },
          ].map(c => (
            <div key={c.label} style={{ background: 'white', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 4px' }}>{c.label}</p>
              <p style={{ color: c.color, fontSize: '20px', fontWeight: '700', margin: 0 }}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Repayment Progress</span>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>{paidEmis} / {totalEmis} EMIs paid ({progressPct}%)</span>
          </div>
          <div style={{ background: '#f3f4f6', borderRadius: '999px', height: '10px' }}>
            <div style={{ background: progressPct === 100 ? '#16a34a' : '#1e40af', width: `${progressPct}%`, height: '10px', borderRadius: '999px', transition: 'width 0.3s' }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>

          {/* Loan Details */}
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px', color: '#111827' }}>📋 Loan Details</h3>
            {[
              ['Customer', loan.customer?.name],
              ['Phone', loan.customer?.phone],
              ['Loan Type', loan.type],
              ['Interest Type', loan.interestType === 'flat' ? 'Flat Rate' : 'Reducing Balance'],
              ['Interest Rate', `${loan.interestRate}% p.a.`],
              ['Frequency', loan.frequency ? loan.frequency.charAt(0).toUpperCase() + loan.frequency.slice(1) : '—'],
              ['Tenure', loan.tenure ? `${loan.tenure} ${loan.frequency === 'daily' ? 'days' : loan.frequency === 'weekly' ? 'weeks' : 'months'}` : '—'],
              ['Processing Fee', loan.processingFee != null && loan.processingFee > 0 ? fmt(loan.processingFee) : 'None'],
              ['Penalty', loan.penaltyType === 'none' ? 'None' : loan.penaltyType === 'fixed' ? `₹${loan.penaltyValue ?? 0} per EMI` : loan.penaltyType === 'percentage' ? `${loan.penaltyValue ?? 0}% of EMI` : `₹${loan.penaltyValue ?? 0}/day`],
              ['Upfront Interest', loan.deductUpfront ? 'Yes — deducted upfront' : 'No'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }}>
                <span style={{ color: '#6b7280' }}>{k}</span>
                <span style={{ fontWeight: '500', color: '#111827' }}>{v || '—'}</span>
              </div>
            ))}
          </div>

          {/* Guarantors */}
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: '#111827' }}>👥 Guarantors / Co-signers</h3>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#6b7280' }}>
                  Jointly liable under Section 128 of Indian Contract Act
                </p>
              </div>
              <button
                onClick={() => setGuarantorModalOpen(true)}
                style={{
                  background: '#eff6ff',
                  color: '#1e40af',
                  border: '1px solid #bfdbfe',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                + Add Guarantor
              </button>
            </div>

            {!loan.guarantors || loan.guarantors.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', background: '#fafafa', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
                <p style={{ fontSize: '28px', margin: '0 0 6px' }}>🤝</p>
                <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>No Guarantor Recorded</p>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#6b7280' }}>
                  Attach a guarantor or surety to secure this loan and generate official co-signed agreements.
                </p>
                <button
                  onClick={() => setGuarantorModalOpen(true)}
                  style={{
                    background: '#1e40af',
                    color: 'white',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  + Add Guarantor / Co-Signer
                </button>
              </div>
            ) : (
              loan.guarantors?.map((g: any, idx: number) => (
                <div key={g.id} style={{ background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '14px', marginBottom: idx < (loan.guarantors?.length ?? 0) - 1 ? '12px' : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: '#111827' }}>{g.name}</span>
                      <span style={guarantorTypeBadgeStyle(g.type ?? 'guarantor')}>{guarantorTypeLabel(g.type ?? 'guarantor')}</span>
                      {g.relationship && (
                        <span style={{ fontSize: '11px', color: '#6b7280', background: '#e2e8f0', padding: '1px 6px', borderRadius: '4px' }}>
                          {g.relationship}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteGuarantor(g.id)}
                      title="Remove Guarantor"
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px', padding: '2px 6px' }}
                    >
                      🗑️
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
                    {[
                      ['📞 Phone', g.phone || '—'],
                      ['🪪 Aadhaar', g.aadhar ? maskAadhaar(g.aadhar) : '—'],
                      ['📄 PAN', g.pan || '—'],
                      ['🏠 Address', g.address || g.city || '—'],
                      ['💼 Work', g.employmentType ? `${g.employmentType} ${g.grossAnnualIncome ? '(₹' + Number(g.grossAnnualIncome).toLocaleString('en-IN') + '/yr)' : ''}` : '—'],
                      ['✍️ Legal Consent', g.consentGiven ? '✓ Co-Signed on Record' : 'Pending Consent']
                    ].map(([k, v]) => (
                      <div key={k} style={{ fontSize: '12px' }}>
                        <span style={{ color: '#6b7280' }}>{k}: </span>
                        <span style={{ fontWeight: '500', color: '#374151' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* EMI Schedule */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ fontWeight: '700', margin: 0, fontSize: '15px' }}>📅 EMI Schedule</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['#', 'Due Date', 'Amount', 'Paid', 'Remaining', 'Status', 'Paid On', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(loan.emis || []).map((e, idx: number) => {
                  const paidAmt = e.paidAmount || 0;
                  const remaining = e.amount - paidAmt;
                  const isOverdue = e.status !== 'paid' && new Date(e.dueDate) < new Date();
                  const isPartial = e.status !== 'paid' && paidAmt > 0;

                  let label = 'Pending', bg = '#f3f4f6', color = '#6b7280';
                  if (e.status === 'paid') { label = '✓ Paid'; bg = '#dcfce7'; color = '#16a34a'; }
                  else if (isPartial) { label = 'Partial'; bg = '#dbeafe'; color = '#1e40af'; }
                  else if (isOverdue) { label = 'Overdue'; bg = '#fee2e2'; color = '#dc2626'; }

                  return (
                    <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6', background: isOverdue ? '#fff7ed' : 'white' }}>
                      <td style={{ padding: '10px 16px', fontSize: '13px', color: '#6b7280' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: '500', color: isOverdue ? '#dc2626' : '#111827' }}>
                        {fmtDate(e.dueDate)}
                        {isOverdue && <span style={{ fontSize: '10px', display: 'block', color: '#dc2626' }}>OVERDUE</span>}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: '600' }}>{fmt(e.amount)}</td>
                      <td style={{ padding: '10px 16px', fontSize: '13px', color: paidAmt > 0 ? '#16a34a' : '#9ca3af' }}>
                        {paidAmt > 0 ? fmt(paidAmt) : '—'}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: '13px', color: e.status === 'paid' ? '#9ca3af' : '#111827', fontWeight: e.status === 'paid' ? '400' : '600' }}>
                        {e.status === 'paid' ? '—' : fmt(remaining)}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ background: bg, color, padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
                          {label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: '12px', color: '#6b7280' }}>
                        {e.status === 'paid' && e.paidAt ? fmtDate(e.paidAt) : '—'}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        {e.status !== 'paid' && (
                          <button
                            onClick={() => handleSendPaymentLink(e)}
                            disabled={sendingLinkFor === e.id}
                            style={{
                              background: '#16a34a',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              fontSize: '12px',
                              cursor: sendingLinkFor === e.id ? 'not-allowed' : 'pointer',
                              fontWeight: '600',
                              opacity: sendingLinkFor === e.id ? 0.7 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {sendingLinkFor === e.id ? '⏳ Sending...' : '📲 Send Payment Link'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment History */}
        {loan.payments && loan.payments.length > 0 && (
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ fontWeight: '700', margin: 0, fontSize: '15px' }}>💳 Payment History</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Date & Time (IST)', 'Amount', 'Method', 'Reference', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loan.payments?.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 16px', fontSize: '13px' }}>{fmtDateTimeIST(p.paidAt ?? '')}</td>
                    <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: '600', color: '#16a34a' }}>{fmt(p.amount)}</td>
                    <td style={{ padding: '10px 16px', fontSize: '13px', textTransform: 'capitalize' }}>{p.method || 'cash'}</td>
                    <td style={{ padding: '10px 16px', fontSize: '12px', color: p.reference ? '#374151' : '#9ca3af' }}>{p.reference || '—'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        background: p.verified ? '#dcfce7' : '#f3f4f6',
                        color: p.verified ? '#16a34a' : '#6b7280',
                        padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600'
                      }}>
                       {p.verified ? '✓ Ref recorded' : 'Cash / no proof'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
    {showSanctionLetter && (
      <SanctionLetterModal loan={loan} onClose={() => setShowSanctionLetter(false)} />
    )}

    {/* Guarantor / Surety Attachment Modal */}
    {guarantorModalOpen && (
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden'
        }}>
          {/* Modal Header */}
          <div style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                🤝 Attach Guarantor / Co-Signer
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                Loan A/C: LN{1000 + loan.id} · {loan.customer?.name}
              </p>
            </div>
            <button
              onClick={() => setGuarantorModalOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '18px',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px'
              }}
            >
              ✕
            </button>
          </div>

          {/* Modal Body Form */}
          <form onSubmit={handleSaveGuarantor} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Legal Notice Callout */}
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '11px',
                color: '#1e40af',
                lineHeight: 1.4
              }}>
                ⚖️ <strong>Legal Protection:</strong> Under Section 128 of the Indian Contract Act, 1872, the guarantor's liability is co-extensive with the borrower. All Aadhaar & PAN details are encrypted with AES-256.
              </div>

              {/* Full Name & Relationship */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                    Full Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={guarantorForm.name}
                    onChange={(e) => setGuarantorForm({ ...guarantorForm, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                    Relationship with Borrower
                  </label>
                  <select
                    value={guarantorForm.relationship}
                    onChange={(e) => setGuarantorForm({ ...guarantorForm, relationship: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      background: 'white'
                    }}
                  >
                    <option value="Father / Mother">Father / Mother</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Brother / Sister">Brother / Sister</option>
                    <option value="Family / Relative">Family / Relative</option>
                    <option value="Friend / Colleague">Friend / Colleague</option>
                    <option value="Business Partner">Business Partner</option>
                    <option value="Neighbor">Neighbor</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Phone & City */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="10-digit mobile"
                    value={guarantorForm.phone}
                    onChange={(e) => setGuarantorForm({ ...guarantorForm, phone: e.target.value.replace(/\D/g, '') })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                    City / Town
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hyderabad"
                    value={guarantorForm.city}
                    onChange={(e) => setGuarantorForm({ ...guarantorForm, city: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px'
                    }}
                  />
                </div>
              </div>

              {/* Aadhaar & PAN */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                    Aadhaar Number (12 Digits)
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    placeholder="1234 5678 9012"
                    value={guarantorForm.aadhar}
                    onChange={(e) => setGuarantorForm({ ...guarantorForm, aadhar: e.target.value.replace(/\D/g, '') })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                    PAN Number
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="ABCDE1234F"
                    value={guarantorForm.pan}
                    onChange={(e) => setGuarantorForm({ ...guarantorForm, pan: e.target.value.toUpperCase() })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      textTransform: 'uppercase'
                    }}
                  />
                </div>
              </div>

              {/* Full Address */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                  Residential Address / Landmarks
                </label>
                <input
                  type="text"
                  placeholder="Plot/Door No, Street, Colony, Village/Town"
                  value={guarantorForm.address}
                  onChange={(e) => setGuarantorForm({ ...guarantorForm, address: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px'
                  }}
                />
              </div>

              {/* Employment & Annual Income */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                    Employment Type
                  </label>
                  <select
                    value={guarantorForm.employmentType}
                    onChange={(e) => setGuarantorForm({ ...guarantorForm, employmentType: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      background: 'white'
                    }}
                  >
                    <option value="Salaried">Salaried</option>
                    <option value="Self-Employed">Self-Employed</option>
                    <option value="Business Owner">Business Owner</option>
                    <option value="Agriculture / Farmer">Agriculture / Farmer</option>
                    <option value="Daily Wage / Labor">Daily Wage / Labor</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                    Annual Income (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 350000"
                    value={guarantorForm.grossAnnualIncome}
                    onChange={(e) => setGuarantorForm({ ...guarantorForm, grossAnnualIncome: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px'
                    }}
                  />
                </div>
              </div>

              {/* Consent confirmation checkbox */}
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                marginTop: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#374151',
                lineHeight: 1.4
              }}>
                <input
                  type="checkbox"
                  checked={guarantorForm.consentGiven}
                  onChange={(e) => setGuarantorForm({ ...guarantorForm, consentGiven: e.target.checked })}
                  style={{ marginTop: '2px' }}
                />
                <span>
                  Confirm that guarantor has submitted identity proof and consents to joint co-obligation for this loan.
                </span>
              </label>

            </div>

            {/* Modal Actions */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e5e7eb',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                type="button"
                onClick={() => setGuarantorModalOpen(false)}
                disabled={savingGuarantor}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  background: 'white',
                  color: '#374151',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingGuarantor}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#1e40af',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: savingGuarantor ? 'not-allowed' : 'pointer',
                  opacity: savingGuarantor ? 0.7 : 1
                }}
              >
                {savingGuarantor ? 'Attaching...' : '✓ Attach Guarantor'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    </>
  );
}
