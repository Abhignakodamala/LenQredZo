'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { API_URL } from '@/lib/api';

const COLORS = ['#1e40af', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/dashboard/analytics`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '240px', flex: 1, padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading analytics...</div>
    </div>
  );

  const card = { background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '240px', flex: 1, padding: '24px' }}>

        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Analytics</h2>
          <p style={{ color: '#6b7280', margin: 0 }}>Insights into your loan portfolio performance</p>
        </div>

        {/* Top metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Total Loans', value: data?.totalLoans ?? 0, color: '#1e40af' },
            { label: 'Avg Loan Size', value: fmt(data?.avgLoanSize), color: '#7c3aed' },
            { label: 'Collection Rate', value: `${data?.collectionRate ?? 0}%`, color: '#16a34a' },
            { label: 'Active Loans', value: data?.statusBreakdown?.active ?? 0, color: '#ea580c' },
          ].map(s => (
            <div key={s.label} style={card}>
              <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 8px' }}>{s.label}</p>
              <p style={{ fontSize: '22px', fontWeight: 'bold', margin: 0, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Monthly trend chart */}
        <div style={{ ...card, marginBottom: '24px' }}>
          <h3 style={{ fontWeight: '600', fontSize: '16px', margin: '0 0 16px' }}>Disbursement vs Collection Trend (6 months)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data?.monthlyTrend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
              <Tooltip formatter={(v: any) => fmt(v)} />
              <Legend />
              <Line type="monotone" dataKey="disbursed" stroke="#1e40af" strokeWidth={2} name="Disbursed" />
              <Line type="monotone" dataKey="collected" stroke="#16a34a" strokeWidth={2} name="Collected" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Two column: loan type chart + table */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div style={card}>
            <h3 style={{ fontWeight: '600', fontSize: '16px', margin: '0 0 16px' }}>Loan Type Distribution</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data?.loanTypeBreakdown || []} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="amount" nameKey="type">
                  {(data?.loanTypeBreakdown || []).map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(v)} />
                <Legend iconType="circle" iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={card}>
            <h3 style={{ fontWeight: '600', fontSize: '16px', margin: '0 0 16px' }}>Loan Type Breakdown</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  {['Type', 'Count', 'Total Amount'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 8px', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.loanTypeBreakdown || []).map((t: any) => (
                  <tr key={t.type} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 8px', fontSize: '13px', fontWeight: '500' }}>{t.type}</td>
                    <td style={{ padding: '12px 8px', fontSize: '13px' }}>{t.count}</td>
                    <td style={{ padding: '12px 8px', fontSize: '13px', fontWeight: '600' }}>{fmt(t.amount)}</td>
                  </tr>
                ))}
                {(!data?.loanTypeBreakdown || data.loanTypeBreakdown.length === 0) && (
                  <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top customers table */}
        <div style={card}>
          <h3 style={{ fontWeight: '600', fontSize: '16px', margin: '0 0 16px' }}>Top Customers by Loan Value</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                {['#', 'Customer', 'Loans', 'Total Value'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.topCustomers || []).map((c: any, i: number) => (
                <tr key={c.name} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6b7280' }}>{i + 1}</td>
                  <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '600' }}>{c.name}</td>
                  <td style={{ padding: '14px 16px', fontSize: '13px' }}>{c.loanCount} loans</td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600', color: '#16a34a' }}>{fmt(c.totalAmount)}</td>
                </tr>
              ))}
              {(!data?.topCustomers || data.topCustomers.length === 0) && (
                <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>No data</td></tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}