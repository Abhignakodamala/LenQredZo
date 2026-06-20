'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter} from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { getAuthUser } from '@/lib/authUser';
import { API_URL } from '@/lib/api';

export default function LoanDetailPage() {
  const params = useParams();
  const id = params?.id;
  const router = useRouter();
  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

const [me, setMe] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => { setMe(getAuthUser()); }, []);
  const canDelete = me && ['owner', 'admin', 'Super Admin', 'branch_manager'].includes(me.role);

  const deleteLoan = async () => {
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
  
  useEffect(() => { if (id) fetchLoan(); }, [id]);

  const fetchLoan = async () => {
    try {
      const res = await fetch(`${API_URL}/api/loans/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      setLoan(data && data.id ? data : null);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtDateTimeIST = (d: string) => d
    ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
    : '—';

  const paidEmis = loan?.emis?.filter((e: any) => e.status === 'paid').length || 0;
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
    fontWeight: '600' as any,
    background: t === 'co-signer' ? '#fef3c7' : t === 'nominee' ? '#f3e8ff' : '#dbeafe',
    color: t === 'co-signer' ? '#92400e' : t === 'nominee' ? '#6b21a8' : '#1e40af',
  });

  const maskAadhaar = (a: string) => a ? '****-****-' + a.slice(-4) : '—';

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '240px', flex: 1, padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6b7280' }}>Loading loan details...</p>
      </div>
    </div>
  );

  if (!loan) return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '240px', flex: 1, padding: '24px' }}>
        <button onClick={() => router.push('/dashboard/loans')} style={{ background: 'none', border: 'none', color: '#1e40af', cursor: 'pointer', fontSize: '14px', marginBottom: '16px' }}>← Back</button>
        <p style={{ color: '#6b7280' }}>Loan not found.</p>
      </div>
    </div>
  );

  const outstanding = loan.emis?.filter((e: any) => e.status !== 'paid').reduce((s: number, e: any) => s + (e.amount - (e.paidAmount || 0)), 0) || 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '240px', flex: 1, padding: '24px' }}>

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
              ['Frequency', loan.frequency?.charAt(0).toUpperCase() + loan.frequency?.slice(1)],
              ['Tenure', `${loan.tenure} ${loan.frequency === 'daily' ? 'days' : loan.frequency === 'weekly' ? 'weeks' : 'months'}`],
              ['Processing Fee', loan.processingFee > 0 ? fmt(loan.processingFee) : 'None'],
              ['Penalty', loan.penaltyType === 'none' ? 'None' : loan.penaltyType === 'fixed' ? `₹${loan.penaltyValue} per EMI` : loan.penaltyType === 'percentage' ? `${loan.penaltyValue}% of EMI` : `₹${loan.penaltyValue}/day`],
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
            <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px', color: '#111827' }}>👥 Guarantors / Co-signers</h3>
            {!loan.guarantors || loan.guarantors.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
                <p style={{ fontSize: '28px', margin: '0 0 8px' }}>🤝</p>
                <p style={{ margin: 0, fontSize: '13px' }}>No guarantors recorded for this loan</p>
              </div>
            ) : (
              loan.guarantors.map((g: any, idx: number) => (
                <div key={g.id} style={{ background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '14px', marginBottom: idx < loan.guarantors.length - 1 ? '12px' : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: '700', fontSize: '14px', color: '#111827' }}>{g.name}</span>
                    <span style={guarantorTypeBadgeStyle(g.type)}>{guarantorTypeLabel(g.type)}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {[
                      ['📞 Phone', g.phone || '—'],
                      ['🤝 Relationship', g.relationship || '—'],
                      ['🪪 Aadhaar', g.aadhar ? maskAadhaar(g.aadhar) : '—'],
                      ['📄 PAN', g.pan || '—'],
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
                  {['#', 'Due Date', 'Amount', 'Paid', 'Remaining', 'Status', 'Paid On'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(loan.emis || []).map((e: any, idx: number) => {
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
                {loan.payments.map((p: any) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 16px', fontSize: '13px' }}>{fmtDateTimeIST(p.paidAt)}</td>
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
  );
}
