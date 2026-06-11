'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function LoanDetailPage() {
  const params = useParams();
  const id = params.id;
  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => { fetchLoan(); }, []);

  const fetchLoan = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/loans/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setLoan(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const markPaid = async (emiId: number) => {
    try {
      await fetch(`http://localhost:5000/api/loans/emi/${emiId}/pay`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}` }
      });
      fetchLoan();
    } catch (err) { console.error(err); }
  };

  const formatINR = (n: number) => '₹' + Number(n).toLocaleString('en-IN');
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const today = new Date();

  const getStatus = (emi: any) => {
    if (emi.status === 'paid') return 'paid';
    if (new Date(emi.dueDate) < today) return 'overdue';
    return 'pending';
  };

  const badge = (status: string) => {
    if (status === 'paid') return { background: '#dcfce7', color: '#16a34a' };
    if (status === 'overdue') return { background: '#fee2e2', color: '#dc2626' };
    return { background: '#fef3c7', color: '#d97706' };
  };

  // Filter + sort + search
  let emis = [...(loan?.emis || [])];

  if (search.trim()) {
    emis = emis.filter((e: any) =>
      formatDate(e.dueDate).toLowerCase().includes(search.toLowerCase()) ||
      formatINR(e.amount).includes(search) ||
      getStatus(e).includes(search.toLowerCase())
    );
  }

  if (statusFilter !== 'all') {
    emis = emis.filter((e: any) => getStatus(e) === statusFilter);
  }

  emis.sort((a: any, b: any) => {
    const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    return sortOrder === 'asc' ? diff : -diff;
  });

  const allEmis = loan?.emis || [];
  const paidCount = allEmis.filter((e: any) => e.status === 'paid').length;
  const overdueCount = allEmis.filter((e: any) => e.status !== 'paid' && new Date(e.dueDate) < today).length;
  const pendingCount = allEmis.filter((e: any) => e.status !== 'paid' && new Date(e.dueDate) >= today).length;

  const tabs = [
    { label: 'All', value: 'all', count: allEmis.length },
    { label: 'Paid', value: 'paid', count: paidCount },
    { label: 'Pending', value: 'pending', count: pendingCount },
    { label: 'Overdue', value: 'overdue', count: overdueCount },
  ];

  const paidAmount = allEmis.filter((e: any) => e.status === 'paid').reduce((s: number, e: any) => s + e.amount, 0);
  const remainingAmount = allEmis.filter((e: any) => e.status !== 'paid').reduce((s: number, e: any) => s + e.amount, 0);
  const progress = allEmis.length > 0 ? Math.round((paidCount / allEmis.length) * 100) : 0;

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '240px', flex: 1, padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
    </div>
  );

  if (!loan || loan.message) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '240px', flex: 1, padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loan not found</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '240px', flex: 1, padding: '24px' }}>

        <a href="/dashboard/loans" style={{ color: '#1e40af', fontSize: '14px', textDecoration: 'none' }}>← Back to Loans</a>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '12px 0 20px' }}>Loan LN{1000 + loan.id}</h2>

        {/* Loan Info Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '20px' }}>
          {[
            { label: 'Customer', value: loan.customer?.name },
            { label: 'Loan Amount', value: formatINR(loan.amount) },
            { label: 'Interest Rate', value: `${loan.interestRate}${loan.interestType === 'flat' ? ' (flat)' : '%'}` },
            { label: 'Frequency', value: loan.frequency || 'Monthly', style: { textTransform: 'capitalize' } },
            { label: 'Tenure', value: `${loan.tenure} ${loan.frequency === 'daily' ? 'days' : loan.frequency === 'weekly' ? 'weeks' : 'months'}` },
          ].map(card => (
            <div key={card.label} style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 6px' }}>{card.label}</p>
              <p style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>Repayment Progress</span>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#16a34a', marginLeft: '10px' }}>{progress}% complete</span>
            </div>
            <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
              <span>✅ Paid: <strong style={{ color: '#16a34a' }}>{formatINR(paidAmount)}</strong></span>
              <span>⏳ Remaining: <strong style={{ color: '#d97706' }}>{formatINR(remainingAmount)}</strong></span>
            </div>
          </div>
          <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '4px' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? '#16a34a' : '#1e40af', borderRadius: '4px', transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* EMI Table */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontWeight: '600', margin: 0, fontSize: '15px' }}>
                EMI Schedule — {emis.length} records shown
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="🔍 Search date, amount, status..."
                  style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', width: '240px' }}
                />
                <button
                  onClick={() => setSortOrder(s => s === 'asc' ? 'desc' : 'asc')}
                  style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'white', whiteSpace: 'nowrap' }}
                >
                  📅 {sortOrder === 'asc' ? 'Oldest First ↑' : 'Newest First ↓'}
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {tabs.map(tab => (
                <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
                  style={{ padding: '5px 14px', borderRadius: '20px', border: 'none', fontSize: '13px', cursor: 'pointer', fontWeight: statusFilter === tab.value ? '600' : '400', background: statusFilter === tab.value ? '#1e40af' : '#f3f4f6', color: statusFilter === tab.value ? 'white' : '#374151' }}>
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          {emis.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No EMIs found</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                  {['EMI #', 'Due Date', 'Amount', 'Status', 'Action'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 20px', fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {emis.map((emi: any, index: number) => {
                  const status = getStatus(emi);
                  return (
                    <tr key={emi.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '14px 20px', fontSize: '14px', color: '#6b7280' }}>{index + 1}</td>
                      <td style={{ padding: '14px 20px', fontSize: '14px' }}>{formatDate(emi.dueDate)}</td>
                      <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '600' }}>{formatINR(emi.amount)}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{ ...badge(status), padding: '3px 10px', borderRadius: '20px', fontSize: '12px' }}>{status}</span>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        {emi.status !== 'paid' && (
                          <button onClick={() => markPaid(emi.id)}
                            style={{ background: '#1e40af', color: 'white', border: 'none', padding: '5px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}