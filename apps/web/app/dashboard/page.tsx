'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import CollectionsChart from '@/components/CollectionsChart';
import LoanPortfolioChart from '@/components/LoanPortfolioChart';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, TooltipProps } from 'recharts';

type Insight = {
  icon?: string;
  title?: string;
  description?: string;
  level?: string;
  levelBg?: string;
  levelColor?: string;
};

type RecentLoan = {
  id: number;
  customer?: { name?: string };
  type?: string;
  amount?: number;
  status?: string;
  frequency?: string;
  tenure?: number;
  deductUpfront?: boolean;
  disbursedAmount?: number;
};

type NpaChartPoint = {
  name: string;
  value: number;
  fill?: string;
};

type BranchPerformance = {
  name: string;
  totalDisbursed?: number;
  collected?: number;
  efficiency?: number;
};

type DashboardStats = {
  totalDisbursed?: number;
  totalCollections?: number;
  totalLoans?: number;
  disbursedChange?: number;
  collectionChange?: number;
  activeCustomers?: number;
  activeLoans?: number;
  npaPercentage?: number;
  netProfit?: number;
  portfolioData?: { name: string; value: number }[];
  aiInsights?: Insight[];
  recentLoans?: RecentLoan[];
  npaChartData?: NpaChartPoint[];
  branchPerformance?: BranchPerformance[];
};

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => {
    fetch('http://localhost:5000/api/dashboard/stats', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  const fmt = (n?: number | null | string) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const pct = (n: number | null) => n === null ? null : (
    <span style={{ color: n >= 0 ? '#16a34a' : '#dc2626', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '2px' }}>
      {n >= 0 ? '↑' : '↓'} {Math.abs(n)}% vs last month
    </span>
  );

  const statCards = [
    { label: 'Total Loan Disbursed', value: fmt(stats?.totalDisbursed), sub: `${stats?.totalLoans || 0} total loans`, change: stats?.disbursedChange, icon: '💰', color: '#eff6ff', iconBg: '#1e40af' },
    { label: 'Total Collections', value: fmt(stats?.totalCollections), sub: 'received so far', change: stats?.collectionChange, icon: '📥', color: '#f0fdf4', iconBg: '#16a34a' },
    { label: 'Active Customers', value: stats?.activeCustomers ?? '...', sub: `${stats?.activeLoans || 0} active loans`, change: null, icon: '👥', color: '#fdf4ff', iconBg: '#7c3aed' },
    { label: 'NPA (30+ Days)', value: `${stats?.npaPercentage ?? 0}%`, sub: 'non-performing assets', change: null, icon: '⚠️', color: '#fff7ed', iconBg: '#ea580c' },
    { label: 'Net Profit (Est.)', value: fmt(stats?.netProfit), sub: '~15% of collections', change: null, icon: '📈', color: '#fef9c3', iconBg: '#ca8a04' },
  ];

  const branchPerformance = stats?.branchPerformance;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <Navbar />
      <div style={{ marginLeft: '240px', flex: 1, padding: '24px', paddingTop: '80px' }}>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Dashboard</h2>
          <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>
            {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '24px' }}>
          {statCards.map(card => (
            <div key={card.label} style={{ background: 'white', padding: '18px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <p style={{ color: '#6b7280', fontSize: '12px', margin: 0, lineHeight: '1.4' }}>{card.label}</p>
                <div style={{ width: '32px', height: '32px', background: card.iconBg, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>{card.icon}</div>
              </div>
              <p style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px', color: '#111827' }}>{loading ? '...' : card.value}</p>
              <p style={{ color: '#6b7280', fontSize: '11px', margin: 0 }}>{card.sub}</p>
              {card.change !== null && card.change !== undefined && pct(card.change)}
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <CollectionsChart />
          <LoanPortfolioChart data={stats?.portfolioData} />

          {/* AI Insights */}
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontWeight: '600', fontSize: '15px', margin: 0 }}>🤖 AI Insights</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stats?.aiInsights?.map((insight, i) => (
                <div key={i} style={{ padding: '12px', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: '600' }}>{insight.icon} {insight.title}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{insight.description}</p>
                    </div>
                    <span style={{ background: insight.levelBg, color: insight.levelColor, padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                      {insight.level}
                    </span>
                  </div>
                </div>
              ))}
              {(!stats?.aiInsights || stats.aiInsights.length === 0) && (
                <p style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', margin: '16px 0' }}>No insights yet</p>
              )}
            </div>
            <Link href="/dashboard/ai" style={{ display: 'block', marginTop: '16px', background: '#1e40af', color: 'white', textAlign: 'center', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>
              Run AI Analysis →
            </Link>
          </div>
        </div>

        {/* Bottom Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px', marginBottom: '24px' }}>

          {/* Recent Loans */}
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontWeight: '600', fontSize: '15px', margin: 0 }}>Recent Loans</h3>
              <Link href="/dashboard/loans" style={{ fontSize: '13px', color: '#1e40af', textDecoration: 'none' }}>View All →</Link>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                  {['Loan ID', 'Customer', 'Type', 'Amount', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px', color: '#9ca3af', fontSize: '12px', fontWeight: '500' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats?.recentLoans?.length ? stats.recentLoans.map((l) => (
                  <tr key={l.id} onClick={() => window.location.href = `/dashboard/loans/${l.id}`} style={{ borderBottom: '1px solid #f9fafb', cursor: 'pointer' }}>
                    <td style={{ padding: '10px 8px', color: '#1e40af', fontSize: '13px', fontWeight: '600' }}>LN{1000 + l.id}</td>
                    <td style={{ padding: '10px 8px', fontSize: '13px' }}>{l.customer?.name}</td>
                    <td style={{ padding: '10px 8px', fontSize: '13px', color: '#6b7280' }}>{l.type}</td>
                    <td style={{ padding: '10px 8px', fontSize: '13px', fontWeight: '600' }}>{fmt(l.amount)}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{
  background: l.status === 'completed' ? '#eff6ff' : l.status === 'active' ? '#dcfce7' : '#f3f4f6',
  color: l.status === 'completed' ? '#1e40af' : '#16a34a',
  padding: '2px 8px', borderRadius: '12px', fontSize: '11px'
}}>
  {l.status === 'completed' ? '✅ Completed' : l.status}
</span>
                    </td>
                  </tr>
                )) : <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>No loans yet</td></tr>}
              </tbody>
            </table>
          </div>

          {/* NPA Analysis Chart */}
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontWeight: '600', fontSize: '15px', margin: '0 0 4px' }}>NPA Analysis</h3>
            <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 16px' }}>Overdue EMIs by age bucket</p>
            {stats?.npaChartData ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.npaChartData} barSize={36}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number | string | undefined) => {
                    if (typeof value === 'number') {
                      return value > 0 ? `${(value / 100000).toFixed(1)}L` : '0';
                    }
                    return '0';
                  }} />
                  <Tooltip formatter={((value: number | string | undefined) => fmt(value)) as TooltipProps['formatter']} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {stats.npaChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>No overdue data</div>}
          </div>
        </div>

        {/* Branch Performance */}
        {branchPerformance?.length ? (
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontWeight: '600', fontSize: '15px', margin: 0 }}>🏢 Top Branch Performance</h3>
              <Link href="/dashboard/branches" style={{ fontSize: '13px', color: '#1e40af', textDecoration: 'none' }}>View All →</Link>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                  {['#', 'Branch', 'Total Disbursed', 'Collected', 'Efficiency'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#9ca3af', fontSize: '12px', fontWeight: '500' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branchPerformance.map((b, i) => {
                  const efficiency = b.efficiency ?? 0;
                  return (
                    <tr key={b.name} style={{ borderBottom: '1px solid #f9fafb' }}>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#6b7280' }}>{i + 1}</td>
                      <td style={{ padding: '12px', fontSize: '13px', fontWeight: '600' }}>{b.name}</td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>{fmt(b.totalDisbursed ?? 0)}</td>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#16a34a', fontWeight: '500' }}>{fmt(b.collected ?? 0)}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '6px', background: '#f3f4f6', borderRadius: '3px' }}>
                            <div style={{ width: `${Math.min(efficiency, 100)}%`, height: '100%', background: efficiency >= 75 ? '#16a34a' : efficiency >= 50 ? '#f59e0b' : '#dc2626', borderRadius: '3px' }} />
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: efficiency >= 75 ? '#16a34a' : '#d97706', minWidth: '32px' }}>{efficiency}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

      </div>
    </div>
  );
}