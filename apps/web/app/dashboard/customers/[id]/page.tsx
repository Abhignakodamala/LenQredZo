'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { API_URL } from '@/lib/api';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (id) fetchCustomer(); }, [id]);

  const fetchCustomer = async () => {
    try {
      const res = await fetch(`${API_URL}/api/customers/${id}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      setCustomer(data && data.id ? data : null);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button onClick={() => router.push('/dashboard/customers')} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>← Back</button>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: 0 }}>{customer.name}</h2>
            <p style={{ color: '#6b7280', margin: 0, fontSize: '13px' }}>Customer #{customer.id}</p>
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

        {/* Profile */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px', color: '#111827' }}>👤 Profile</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
            {[
              ['Name', customer.name],
              ['Phone', customer.phone],
              ['Email', customer.email],
              ['Address', customer.address],
              ['Aadhaar', customer.aadhar],
              ['PAN', customer.pan],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }}>
                <span style={{ color: '#6b7280' }}>{k}</span>
                <span style={{ fontWeight: '500', color: '#111827' }}>{v || '—'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Loans */}
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
                  <tr key={l.id} onClick={() => router.push(`/dashboard/loans/${l.id}`)} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                    <td style={{ padding: '10px 16px', fontSize: '13px', color: '#1e40af', fontWeight: '600' }}>LN{1000 + l.id}</td>
                    <td style={{ padding: '10px 16px', fontSize: '13px' }}>{l.type}</td>
                    <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: '500' }}>{fmt(l.amount)}</td>
                    <td style={{ padding: '10px 16px', fontSize: '13px', textTransform: 'capitalize' }}>{l.frequency || 'monthly'}</td>
                    <td style={{ padding: '10px 16px', fontSize: '13px' }}>{l.tenure} {l.frequency === 'daily' ? 'days' : l.frequency === 'weekly' ? 'wks' : 'mo'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        background: l.status === 'completed' ? '#dbeafe' : l.status === 'active' ? '#dcfce7' : '#f3f4f6',
                        color: l.status === 'completed' ? '#1e40af' : l.status === 'active' ? '#16a34a' : '#6b7280',
                        padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600'
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

        {/* Payment history */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ fontWeight: '700', margin: 0, fontSize: '15px' }}>💳 Payment History ({allPayments.length})</h3>
          </div>
          {allPayments.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>No payments recorded yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Date & Time (IST)', 'Loan', 'Amount', 'Method', 'Reference', 'Status'].map(h => (
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
                        {p.verified ? '✓ Ref recorded' : 'Cash / no proof'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}