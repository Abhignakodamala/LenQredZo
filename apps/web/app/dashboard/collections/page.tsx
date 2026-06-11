'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';

export default function CollectionsPage() {
  const [emis, setEmis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => { fetchCollections(); }, []);

  const fetchCollections = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/loans/collections/all', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      setEmis(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const markPaid = async (emiId: number, collectPenalty: boolean) => {
    try {
      await fetch(`http://localhost:5000/api/loans/emi/${emiId}/pay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ collectPenalty, method: 'cash' })
      });
      fetchCollections();
    } catch (err) { console.error(err); }
  };

  const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const badge = (status: string) => {
    if (status === 'paid') return { background: '#dcfce7', color: '#16a34a' };
    if (status === 'overdue') return { background: '#fee2e2', color: '#dc2626' };
    return { background: '#fef3c7', color: '#d97706' };
  };

  const totalPending = emis.filter(e => e.status !== 'paid').reduce((s, e) => s + e.amount, 0);
  const totalPenalty = emis.filter(e => e.status === 'overdue').reduce((s, e) => s + (e.penalty || 0), 0);
  const paidCount = emis.filter(e => e.status === 'paid').length;
  const overdueCount = emis.filter(e => e.status === 'overdue').length;
  const pendingCount = emis.filter(e => e.status === 'pending').length;

  let filtered = [...emis];
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(e =>
      (e.customerName || '').toLowerCase().includes(q) ||
      ('ln' + (1000 + e.loanId)).includes(q)
    );
  }
  if (statusFilter !== 'all') filtered = filtered.filter(e => e.status === statusFilter);
  filtered.sort((a, b) => {
    const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    return sortOrder === 'asc' ? diff : -diff;
  });

  const tabs = [
    { label: 'All', value: 'all', count: emis.length },
    { label: 'Paid', value: 'paid', count: paidCount },
    { label: 'Pending', value: 'pending', count: pendingCount },
    { label: 'Overdue', value: 'overdue', count: overdueCount },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '240px', flex: 1, padding: '24px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Collections</h2>
          <p style={{ color: '#6b7280', margin: 0 }}>Track EMIs, penalties and collections</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Total EMI Pending', value: fmt(totalPending), color: '#111827' },
            { label: 'Total Penalty Due', value: fmt(totalPenalty), color: '#dc2626' },
            { label: 'Overdue EMIs', value: overdueCount, color: '#dc2626' },
            { label: 'Collected EMIs', value: paidCount, color: '#16a34a' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 8px' }}>{s.label}</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontWeight: '600', margin: 0 }}>EMI Collections ({filtered.length})</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="🔍 Search customer or loan ID..."
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', width: '260px' }} />
                <button onClick={() => setSortOrder(s => s === 'asc' ? 'desc' : 'asc')}
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'white' }}>
                  📅 {sortOrder === 'asc' ? 'Oldest ↑' : 'Newest ↓'}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {tabs.map(tab => (
                <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
                  style={{ padding: '5px 14px', borderRadius: '20px', border: 'none', fontSize: '13px', cursor: 'pointer', fontWeight: statusFilter === tab.value ? '600' : '400', background: statusFilter === tab.value ? '#1e40af' : '#f3f4f6', color: statusFilter === tab.value ? 'white' : '#374151' }}>
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No records found</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                  {['Customer', 'Loan', 'Due Date', 'EMI Amount', 'Penalty', 'Total Due', 'Status', 'Action'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e: any) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{e.customerName}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1e40af' }}>LN{1000 + e.loanId}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>{fmtDate(e.dueDate)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600' }}>{fmt(e.amount)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: e.penalty > 0 ? '#dc2626' : '#9ca3af', fontWeight: e.penalty > 0 ? '600' : '400' }}>
                      {e.penalty > 0 ? fmt(e.penalty) : '—'}
                      {e.daysOverdue > 0 && <span style={{ display: 'block', fontSize: '11px', color: '#dc2626' }}>{e.daysOverdue} days late</span>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: e.penalty > 0 ? '#dc2626' : '#111827' }}>
                      {fmt(e.totalDue)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ ...badge(e.status), padding: '2px 10px', borderRadius: '20px', fontSize: '11px' }}>{e.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {e.status !== 'paid' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {e.penalty > 0 ? (
                            <>
                              <button onClick={() => markPaid(e.id, true)}
                                style={{ background: '#dc2626', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                Collect + Penalty
                              </button>
                              <button onClick={() => markPaid(e.id, false)}
                                style={{ background: '#1e40af', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                                EMI Only
                              </button>
                            </>
                          ) : (
                            <button onClick={() => markPaid(e.id, false)}
                              style={{ background: '#1e40af', color: 'white', border: 'none', padding: '5px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                              Collect
                            </button>
                          )}
                        </div>
                      )}
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