'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { API_URL } from '@/lib/api';

type DashboardStats = {
  totalDisbursed: number;
  totalLoans: number;
  totalCollections: number;
  activeCustomers: number;
  activeLoans: number;
  npaPercentage: number;
};

type DueItem = {
  id: number;
  customerName: string;
  loanId: number;
  amount: number;
};

type ActivityItem = {
  customerName: string;
  loanId: number;
  amount: number;
  date: string;
};

type TodayData = {
  overdueCount: number;
  overdueAmount: number;
  dueTodayAmount: number;
  dueTodayCount: number;
  dueToday: DueItem[];
  recentActivity: ActivityItem[];
};

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [today, setToday] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayLabel, setTodayLabel] = useState('');

  useEffect(() => {
    setTodayLabel(
      new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    );
    const token = localStorage.getItem('token') || '';
    Promise.all([
      fetch(`${API_URL}/api/dashboard/stats`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API_URL}/api/dashboard/today`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([s, t]) => {
      setStats(s);
      setToday(t);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—';
  const fmtTime = (d: string) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '';

  const overdueCount = today?.overdueCount ?? 0;
  const overdueAmount = today?.overdueAmount ?? 0;

  const statCards = [
    { label: 'Total Disbursed', value: fmt(stats?.totalDisbursed), sub: `${stats?.totalLoans || 0} loans`, icon: '💰', bg: '#1e40af' },
    { label: 'Total Collections', value: fmt(stats?.totalCollections), sub: 'received', icon: '📥', bg: '#16a34a' },
    { label: 'Active Customers', value: stats?.activeCustomers ?? 0, sub: `${stats?.activeLoans || 0} active loans`, icon: '👥', bg: '#7c3aed' },
    { label: 'NPA (30+ Days)', value: `${stats?.npaPercentage ?? 0}%`, sub: 'non-performing', icon: '⚠️', bg: '#ea580c' },
  ];

  const card = { background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <Navbar />
      <div style={{ marginLeft: '240px', flex: 1, padding: '24px', paddingTop: '80px' }}>

        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Dashboard</h2>
          <p suppressHydrationWarning style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>
            {todayLabel || '\u00A0'}
          </p>
        </div>

        {/* Overdue Alert Banner */}
        {overdueCount > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontWeight: '700', color: '#dc2626', fontSize: '15px' }}>
                ⚠️ {overdueCount} EMIs are overdue — {fmt(overdueAmount)} pending
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#991b1b' }}>Follow up with these customers to recover dues.</p>
            </div>
            <Link href="/dashboard/collections" style={{ background: '#dc2626', color: 'white', padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              View Overdue →
            </Link>
          </div>
        )}

        {/* Quick Actions */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <Link href="/dashboard/loans" style={{ flex: 1, ...card, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
            <div style={{ width: '40px', height: '40px', background: '#eff6ff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>➕</div>
            <div><p style={{ margin: 0, fontWeight: '600', fontSize: '14px', color: '#111827' }}>New Loan</p><p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Create a loan</p></div>
          </Link>
          <Link href="/dashboard/customers" style={{ flex: 1, ...card, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
            <div style={{ width: '40px', height: '40px', background: '#f0fdf4', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>👤</div>
            <div><p style={{ margin: 0, fontWeight: '600', fontSize: '14px', color: '#111827' }}>Add Customer</p><p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Register new</p></div>
          </Link>
          <Link href="/dashboard/collections" style={{ flex: 1, ...card, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
            <div style={{ width: '40px', height: '40px', background: '#fef9c3', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>💳</div>
            <div><p style={{ margin: 0, fontWeight: '600', fontSize: '14px', color: '#111827' }}>Collect EMI</p><p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Today&apos;s dues</p></div>
          </Link>
        </div>

        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
          {statCards.map(c => (
            <div key={c.label} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <p style={{ color: '#6b7280', fontSize: '12px', margin: 0 }}>{c.label}</p>
                <div style={{ width: '32px', height: '32px', background: c.bg, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>{c.icon}</div>
              </div>
              <p style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px', color: '#111827' }}>{loading ? '...' : c.value}</p>
              <p style={{ color: '#6b7280', fontSize: '11px', margin: 0 }}>{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Two columns: Today's Collections + Recent Activity */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '16px' }}>

          {/* Today's Collections Due */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontWeight: '600', fontSize: '15px', margin: 0 }}>📅 Today&apos;s Collections Due</h3>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>{fmt(today?.dueTodayAmount)} ({today?.dueTodayCount || 0})</span>
            </div>
            {loading ? (
              <p style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Loading...</p>
            ) : today?.dueToday?.length ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                    {['Customer', 'Loan', 'Amount'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px', color: '#9ca3af', fontSize: '12px', fontWeight: '500' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {today.dueToday.map((e: DueItem) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                      <td style={{ padding: '10px 8px', fontSize: '13px', fontWeight: '500' }}>{e.customerName}</td>
                      <td style={{ padding: '10px 8px', fontSize: '13px', color: '#1e40af' }}>LN{1000 + e.loanId}</td>
                      <td style={{ padding: '10px 8px', fontSize: '13px', fontWeight: '600' }}>{fmt(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '30px' }}>✅ No collections due today</p>
            )}
          </div>

          {/* Recent Activity */}
          <div style={card}>
            <h3 style={{ fontWeight: '600', fontSize: '15px', margin: '0 0 16px' }}>🕐 Recent Activity</h3>
            {loading ? (
              <p style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Loading...</p>
            ) : today?.recentActivity?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {today.recentActivity.map((a: ActivityItem, i: number) => (
                  <div key={`${a.loanId}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: i < today.recentActivity.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: '500' }}>{a.customerName}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>LN{1000 + a.loanId} · {fmtDate(a.date)} · {fmtTime(a.date)} IST</p>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#16a34a' }}>+{fmt(a.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '30px' }}>No activity yet</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}