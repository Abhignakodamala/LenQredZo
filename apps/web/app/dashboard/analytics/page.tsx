'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import CreditBureauExportModal from '@/components/CreditBureauExportModal';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import { API_URL } from '@/lib/api';

const COLORS = ['#1e40af', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsPage() {
  const router = useRouter();

  // Top level tab: 'pnl_fy' (Financial Year & MoM P&L) vs 'rbi_npa' (RBI Stressed Asset Matrix)
  const [activeTab, setActiveTab] = useState<'pnl_fy' | 'rbi_npa'>('pnl_fy');

  // Basic dashboard analytics
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // RBI NPA Ageing Matrix State
  const [npaData, setNpaData] = useState<any>(null);
  const [npaLoading, setNpaLoading] = useState(true);
  const [selectedBucket, setSelectedBucket] = useState<string>('all');
  const [npaSearch, setNpaSearch] = useState<string>('');
  const [showBureauModal, setShowBureauModal] = useState(false);

  // Financial Year (FY) State
  const [selectedFy, setSelectedFy] = useState<string>('2026-27');
  const [fyData, setFyData] = useState<any>(null);
  const [fyLoading, setFyLoading] = useState(true);
  const [exportingCaPack, setExportingCaPack] = useState(false);

  const fetchAnalytics = () => {
    setLoading(true);
    fetch(`${API_URL}/api/dashboard/analytics`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const fetchNpaMatrix = () => {
    setNpaLoading(true);
    fetch(`${API_URL}/api/loans/analytics/npa-ageing`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) setNpaData(d);
        setNpaLoading(false);
      })
      .catch(() => setNpaLoading(false));
  };

  const fetchFyAnalytics = (fyString: string) => {
    setFyLoading(true);
    fetch(`${API_URL}/api/dashboard/financial-year-analytics?fy=${fyString}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) setFyData(d);
        setFyLoading(false);
      })
      .catch(() => setFyLoading(false));
  };

  useEffect(() => {
    fetchAnalytics();
    fetchNpaMatrix();
    fetchFyAnalytics(selectedFy);
  }, [selectedFy]);

  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

  const handleExportCaAuditPack = async () => {
    try {
      setExportingCaPack(true);
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API_URL}/api/dashboard/financial-year-export?fy=${selectedFy}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to generate CA audit pack');

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `CA_AUDIT_PACK_FY_${selectedFy.replace('-', '_')}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      alert(err.message || 'Error exporting CA audit pack');
    } finally {
      setExportingCaPack(false);
    }
  };

  // Flattened list of loans from npaData
  const allStressedLoans = useMemo(() => {
    if (!npaData?.buckets) return [];
    const b = npaData.buckets;
    return [
      ...(b.standard?.loans || b.standard?.items || []),
      ...(b.sma0?.loans || b.sma0?.items || []),
      ...(b.sma1?.loans || b.sma1?.items || []),
      ...(b.sma2?.loans || b.sma2?.items || []),
      ...(b.npa?.loans || b.npa?.items || [])
    ];
  }, [npaData]);

  // Filtered loans based on selected bucket and search
  const filteredStressedLoans = useMemo(() => {
    let list = allStressedLoans;
    if (selectedBucket !== 'all') {
      list = list.filter((l: any) => l.bucket.toLowerCase() === selectedBucket.toLowerCase());
    }
    if (npaSearch.trim()) {
      const q = npaSearch.toLowerCase();
      list = list.filter((l: any) =>
        (l.loanRef || '').toLowerCase().includes(q) ||
        (l.customerName || '').toLowerCase().includes(q) ||
        (l.customerPhone || '').includes(q) ||
        (l.customerCity || '').toLowerCase().includes(q) ||
        (l.loanType || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [allStressedLoans, selectedBucket, npaSearch]);

  const cardStyle = { background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' };

  if (loading && npaLoading && fyLoading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '40px', textAlign: 'center', color: '#64748b' }}>
        Loading enterprise portfolio analytics and financial statements...
      </div>
    </div>
  );

  const npaSummary = npaData?.summary || {};
  const buckets = npaData?.buckets || {};

  const pnl = fyData?.pnlSummary || {};
  const portfolioM = fyData?.portfolioMetrics || {};
  const caPack = fyData?.caAuditPack || {};
  const monthlyList = fyData?.monthlyBreakdown || [];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '24px' }}>

        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                Enterprise Financial & Risk Intelligence
              </h2>
              <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                Executive Cockpit
              </span>
            </div>
            <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '14px' }}>
              Financial Year (FY) Annual P&L, MoM Trajectory, CA Tax Closing & RBI Asset Ageing
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => { fetchAnalytics(); fetchNpaMatrix(); fetchFyAnalytics(selectedFy); }}
              style={{
                background: 'white',
                border: '1px solid #cbd5e1',
                color: '#475569',
                padding: '9px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🔄 Refresh
            </button>
            <button
              onClick={() => setShowBureauModal(true)}
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: 'white',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.25)'
              }}
            >
              📑 Export CIBIL / CRIF Bureau File
            </button>
          </div>
        </div>

        {/* Top-Level Tab Switcher */}
        <div style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '24px'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('pnl_fy')}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'pnl_fy' ? '3px solid #1e40af' : '3px solid transparent',
              color: activeTab === 'pnl_fy' ? '#1e40af' : '#64748b',
              fontWeight: activeTab === 'pnl_fy' ? 800 : 600,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>📊</span> Financial Year (FY) Annual & Monthly P&L Statement
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rbi_npa')}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'rbi_npa' ? '3px solid #1e40af' : '3px solid transparent',
              color: activeTab === 'rbi_npa' ? '#1e40af' : '#64748b',
              fontWeight: activeTab === 'rbi_npa' ? 800 : 600,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>⚖️</span> RBI Asset Classification & NPA Ageing Console
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: FINANCIAL YEAR (FY) ANNUAL & MONTHLY P&L EXECUTIVE INTELLIGENCE    */}
        {/* ========================================================================= */}
        {activeTab === 'pnl_fy' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* FY Filter & CA Export Toolbar */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '16px 20px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                  Select Financial Year:
                </span>
                <select
                  value={selectedFy}
                  onChange={e => setSelectedFy(e.target.value)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#0f172a',
                    background: '#f8fafc'
                  }}
                >
                  <option value="2026-27">FY 2026-27 (Current Financial Year)</option>
                  <option value="2025-26">FY 2025-26 (Previous Financial Year)</option>
                  <option value="2024-25">FY 2024-25 (Historical FY)</option>
                </select>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  (Apr 01 to Mar 31 Fiscal Period)
                </span>
              </div>

              <button
                type="button"
                onClick={handleExportCaAuditPack}
                disabled={exportingCaPack}
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: exportingCaPack ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)'
                }}
              >
                {exportingCaPack ? '⏳ Generating...' : '📑 Export CA Annual Audit Pack (CSV)'}
              </button>
            </div>

            {/* Executive P&L Cards (6 Columns) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
              <div style={{ ...cardStyle, borderTop: '4px solid #10b981' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
                  Gross Revenue
                </span>
                <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: '800', color: '#065f46' }}>
                  {fmt(pnl.grossRevenue)}
                </p>
                <span style={{ fontSize: '10.5px', color: '#64748b' }}>Interest + Fees + Penalties</span>
              </div>

              <div style={{ ...cardStyle, borderTop: '4px solid #0284c7' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
                  Interest Income
                </span>
                <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: '800', color: '#0369a1' }}>
                  {fmt(pnl.interestIncome)}
                </p>
                <span style={{ fontSize: '10.5px', color: '#64748b' }}>Regular EMI Interest</span>
              </div>

              <div style={{ ...cardStyle, borderTop: '4px solid #8b5cf6' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
                  Processing Fees
                </span>
                <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: '800', color: '#6d28d9' }}>
                  {fmt(pnl.processingFees)}
                </p>
                <span style={{ fontSize: '10.5px', color: '#64748b' }}>File & Doc Charges</span>
              </div>

              <div style={{ ...cardStyle, borderTop: '4px solid #f59e0b' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
                  Penalties Collected
                </span>
                <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: '800', color: '#b45309' }}>
                  {fmt(pnl.penaltiesCollected)}
                </p>
                <span style={{ fontSize: '10.5px', color: '#64748b' }}>Late & Bounce Recovery</span>
              </div>

              <div style={{ ...cardStyle, borderTop: '4px solid #ef4444' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
                  Loss Provision Reserve
                </span>
                <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: '800', color: '#b91c1c' }}>
                  {fmt(pnl.statutoryReserve)}
                </p>
                <span style={{ fontSize: '10.5px', color: '#64748b' }}>RBI IRAC Allocation</span>
              </div>

              <div style={{ ...cardStyle, borderTop: '4px solid #16a34a', background: '#f0fdf4' }}>
                <span style={{ fontSize: '11px', color: '#166534', fontWeight: '800', textTransform: 'uppercase' }}>
                  Net Profit (NPBT)
                </span>
                <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: '900', color: '#15803d' }}>
                  {fmt(pnl.netProfit)}
                </p>
                <span style={{ fontSize: '10.5px', color: '#166534', fontWeight: '700' }}>
                  NIM: {pnl.netInterestMargin ?? 0}%
                </span>
              </div>
            </div>

            {/* 12-Month MoM Fiscal Trajectory Chart */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                    12-Month Fiscal Trajectory: Capital Disbursed vs Collections & Efficiency %
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                    Full Financial Year April to March Month-on-Month Performance
                  </p>
                </div>
                <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '700' }}>
                  FY Overall Efficiency: <span style={{ color: '#16a34a' }}>{portfolioM.overallEfficiency ?? 0}%</span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyList}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="shortLabel" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="disbursedAmount" fill="#0284c7" name="Fresh Disbursals" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="collectedAmount" fill="#16a34a" name="Actual Collections" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 12-Month Financial Year Operating Schedule Table */}
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                Month-on-Month (MoM) Financial Performance & Demand Recovery Schedule
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#475569', fontWeight: '600' }}>Month (FY)</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', color: '#475569', fontWeight: '600' }}>Quarter</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: '#475569', fontWeight: '600' }}>Disbursed (₹)</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: '#475569', fontWeight: '600' }}>Demand Due (₹)</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: '#475569', fontWeight: '600' }}>Recovered (₹)</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', color: '#475569', fontWeight: '600' }}>Efficiency %</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: '#475569', fontWeight: '600' }}>Interest Income (₹)</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: '#475569', fontWeight: '600' }}>Net Cash Flow (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyList.map((m: any) => {
                      const eff = m.efficiencyRatio;
                      const effBadge =
                        eff >= 95 ? { bg: '#dcfce7', text: '#15803d' } :
                        eff >= 80 ? { bg: '#e0f2fe', text: '#0369a1' } :
                        { bg: '#fee2e2', text: '#991b1b' };

                      return (
                        <tr key={m.monthKey} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>
                            {m.monthLabel}
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                            <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                              {m.quarter}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600', color: '#0284c7' }}>
                            {fmt(m.disbursedAmount)}
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                            {fmt(m.demandAmount)}
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '700', color: '#16a34a' }}>
                            {fmt(m.collectedAmount)}
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', background: effBadge.bg, color: effBadge.text }}>
                              {eff}%
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600' }}>
                            {fmt(m.interestEarned)}
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '700', color: m.netCashFlow >= 0 ? '#16a34a' : '#dc2626' }}>
                            {m.netCashFlow >= 0 ? `+${fmt(m.netCashFlow)}` : fmt(m.netCashFlow)}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Total Row */}
                    <tr style={{ background: '#f8fafc', fontWeight: '800', borderTop: '2px solid #cbd5e1' }}>
                      <td colSpan={2} style={{ padding: '12px' }}>
                        Total Financial Year ({selectedFy})
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px', color: '#0284c7' }}>
                        {fmt(portfolioM.totalDisbursedCapital)}
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px' }}>
                        {fmt(portfolioM.totalDemandDue)}
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px', color: '#16a34a' }}>
                        {fmt(portfolioM.totalActualCollected)}
                      </td>
                      <td style={{ textAlign: 'center', padding: '12px', color: '#16a34a' }}>
                        {portfolioM.overallEfficiency ?? 0}%
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px' }}>
                        {fmt(pnl.interestIncome)}
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px', color: '#0f172a' }}>
                        {fmt(portfolioM.totalActualCollected - portfolioM.totalDisbursedCapital)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chartered Accountant (CA) Balance Sheet Reconciliation Card */}
            <div style={{
              background: '#ffffff',
              border: '2px solid #cbd5e1',
              borderRadius: '14px',
              padding: '20px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>📑</span>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                    Chartered Accountant (CA) Portfolio Balance Sheet Reconciliation
                  </h3>
                </div>
                <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                  Income Tax & ROC Audit Ready
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>1. Opening Loan Book (Apr 01)</span>
                  <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                    {fmt(caPack.openingAum)}
                  </p>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: '600' }}>(+) Fresh Loans Disbursed</span>
                  <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: '800', color: '#0284c7' }}>
                    +{fmt(caPack.additionsFreshDisbursals)}
                  </p>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '600' }}>(-) Principal Recovered</span>
                  <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: '800', color: '#16a34a' }}>
                    -{fmt(caPack.principalCollections)}
                  </p>
                </div>

                <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <span style={{ fontSize: '11px', color: '#15803d', fontWeight: '700' }}>(=) Closing Loan Book (Mar 31)</span>
                  <p style={{ margin: '4px 0 0', fontSize: '17px', fontWeight: '900', color: '#15803d' }}>
                    {fmt(caPack.closingAum)}
                  </p>
                </div>

                <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <span style={{ fontSize: '11px', color: '#1e40af', fontWeight: '700' }}>Taxable Interest Income</span>
                  <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: '800', color: '#1e40af' }}>
                    {fmt(caPack.taxableInterestIncome)}
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: RBI ASSET CLASSIFICATION & NPA AGEING CONSOLE                      */}
        {/* ========================================================================= */}
        {activeTab === 'rbi_npa' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* SECTION 1: RBI REGULATORY & NPA KPI CARDS */}
            <div style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              borderRadius: '16px',
              padding: '20px 24px',
              color: 'white',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>⚖️</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#94a3b8' }}>
                    RBI IRAC Stressed Assets & Loss Provisioning Reserve
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: '#94a3b8', background: 'rgba(255,255,255,0.08)', padding: '3px 10px', borderRadius: '12px' }}>
                  As of: {npaSummary.asOfDate || new Date().toISOString().slice(0, 10)}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                {/* Gross NPA */}
                <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '14px 16px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Gross NPA %</p>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: (npaSummary.grossNpaRatio || 0) > 3 ? '#ef4444' : (npaSummary.grossNpaRatio || 0) > 1 ? '#f59e0b' : '#10b981',
                      color: 'white'
                    }}>
                      {(npaSummary.grossNpaRatio || 0) > 3 ? 'High' : (npaSummary.grossNpaRatio || 0) > 1 ? 'Moderate' : 'Healthy'}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: (npaSummary.grossNpaRatio || 0) > 3 ? '#f87171' : '#fde047' }}>
                    {npaSummary.grossNpaRatio ?? 0}%
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#cbd5e1' }}>
                    Vol: {fmt(npaSummary.grossNpaAmount)}
                  </p>
                </div>

                {/* PAR-30 */}
                <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '14px 16px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#94a3b8' }}>PAR-30 (Risk &gt;30 DPD)</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#fb923c' }}>
                    {npaSummary.par30Ratio ?? 0}%
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#cbd5e1' }}>
                    Vol: {fmt(npaSummary.par30Amount)}
                  </p>
                </div>

                {/* PAR-60 */}
                <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '14px 16px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#94a3b8' }}>PAR-60 (High Risk)</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#f87171' }}>
                    {npaSummary.par60Ratio ?? 0}%
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#cbd5e1' }}>
                    Vol: {fmt(npaSummary.par60Amount)}
                  </p>
                </div>

                {/* Required Provision Reserve */}
                <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '14px 16px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#94a3b8' }}>Required Loss Reserve</p>
                  <p style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#38bdf8' }}>
                    {fmt(npaSummary.totalProvisionReserve)}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                    Per RBI IRAC rates
                  </p>
                </div>

                {/* Total AUM & Overdue */}
                <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '14px 16px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#94a3b8' }}>Live AUM / Overdue</p>
                  <p style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#f1f5f9' }}>
                    {fmt(npaSummary.totalAum)}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#f87171' }}>
                    Overdue: {fmt(npaSummary.totalOverdue)}
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 2: IRAC ASSET CLASSIFICATION BUCKET SELECTOR */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                  Asset Quality Classification (Click bucket to filter drilldown)
                </h3>
                {selectedBucket !== 'all' && (
                  <button
                    onClick={() => setSelectedBucket('all')}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    Clear Bucket Filter (Show All)
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                {/* Standard */}
                <div
                  onClick={() => setSelectedBucket(selectedBucket === 'Standard' ? 'all' : 'Standard')}
                  style={{
                    ...cardStyle,
                    cursor: 'pointer',
                    border: selectedBucket === 'Standard' ? '2px solid #16a34a' : '1px solid #e2e8f0',
                    background: selectedBucket === 'Standard' ? '#f0fdf4' : 'white',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#16a34a' }}>Standard Asset</span>
                    <span style={{ fontSize: '10px', background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                      0 DPD
                    </span>
                  </div>
                  <p style={{ margin: '0 0 2px', fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
                    {buckets.standard?.count || 0} <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#64748b' }}>loans</span>
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#16a34a' }}>
                    {fmt(buckets.standard?.sum || buckets.standard?.amount)}
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>
                    Provision: 0.4% ({fmt(buckets.standard?.provisionAmount)})
                  </p>
                </div>

                {/* SMA-0 */}
                <div
                  onClick={() => setSelectedBucket(selectedBucket === 'SMA-0' ? 'all' : 'SMA-0')}
                  style={{
                    ...cardStyle,
                    cursor: 'pointer',
                    border: selectedBucket === 'SMA-0' ? '2px solid #0284c7' : '1px solid #e2e8f0',
                    background: selectedBucket === 'SMA-0' ? '#f0f9ff' : 'white',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0284c7' }}>SMA-0</span>
                    <span style={{ fontSize: '10px', background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                      1–30 DPD
                    </span>
                  </div>
                  <p style={{ margin: '0 0 2px', fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
                    {buckets.sma0?.count || 0} <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#64748b' }}>loans</span>
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#0284c7' }}>
                    {fmt(buckets.sma0?.sum || buckets.sma0?.amount)}
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>
                    Provision: 0.4% ({fmt(buckets.sma0?.provisionAmount)})
                  </p>
                </div>

                {/* SMA-1 */}
                <div
                  onClick={() => setSelectedBucket(selectedBucket === 'SMA-1' ? 'all' : 'SMA-1')}
                  style={{
                    ...cardStyle,
                    cursor: 'pointer',
                    border: selectedBucket === 'SMA-1' ? '2px solid #d97706' : '1px solid #e2e8f0',
                    background: selectedBucket === 'SMA-1' ? '#fffbeb' : 'white',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#d97706' }}>SMA-1</span>
                    <span style={{ fontSize: '10px', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                      31–60 DPD
                    </span>
                  </div>
                  <p style={{ margin: '0 0 2px', fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
                    {buckets.sma1?.count || 0} <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#64748b' }}>loans</span>
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#d97706' }}>
                    {fmt(buckets.sma1?.sum || buckets.sma1?.amount)}
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>
                    Provision: 5.0% ({fmt(buckets.sma1?.provisionAmount)})
                  </p>
                </div>

                {/* SMA-2 */}
                <div
                  onClick={() => setSelectedBucket(selectedBucket === 'SMA-2' ? 'all' : 'SMA-2')}
                  style={{
                    ...cardStyle,
                    cursor: 'pointer',
                    border: selectedBucket === 'SMA-2' ? '2px solid #ea580c' : '1px solid #e2e8f0',
                    background: selectedBucket === 'SMA-2' ? '#fff7ed' : 'white',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#ea580c' }}>SMA-2</span>
                    <span style={{ fontSize: '10px', background: '#ffedd5', color: '#9a3412', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                      61–90 DPD
                    </span>
                  </div>
                  <p style={{ margin: '0 0 2px', fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
                    {buckets.sma2?.count || 0} <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#64748b' }}>loans</span>
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#ea580c' }}>
                    {fmt(buckets.sma2?.sum || buckets.sma2?.amount)}
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>
                    Provision: 10.0% ({fmt(buckets.sma2?.provisionAmount)})
                  </p>
                </div>

                {/* NPA */}
                <div
                  onClick={() => setSelectedBucket(selectedBucket === 'NPA' ? 'all' : 'NPA')}
                  style={{
                    ...cardStyle,
                    cursor: 'pointer',
                    border: selectedBucket === 'NPA' ? '2px solid #dc2626' : '1px solid #e2e8f0',
                    background: selectedBucket === 'NPA' ? '#fef2f2' : 'white',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#dc2626' }}>NPA / Sub-std</span>
                    <span style={{ fontSize: '10px', background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                      &gt;90 DPD
                    </span>
                  </div>
                  <p style={{ margin: '0 0 2px', fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
                    {buckets.npa?.count || 0} <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#64748b' }}>loans</span>
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#dc2626' }}>
                    {fmt(buckets.npa?.sum || buckets.npa?.amount)}
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>
                    Provision: 15.0% ({fmt(buckets.npa?.provisionAmount)})
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 3: STRESSED ASSETS & NPA DRILLDOWN TABLE */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                      Stressed Asset Drilldown & Action Terminal
                    </h3>
                    <span style={{ fontSize: '12px', background: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                      {filteredStressedLoans.length} accounts {selectedBucket !== 'all' ? `in ${selectedBucket}` : ''}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                    Days Past Due (DPD) calculated from oldest unpaid EMI. 1-click legal notice, restructuring & payment portal.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Search borrower, loan ID, phone..."
                    value={npaSearch}
                    onChange={e => setNpaSearch(e.target.value)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      width: '260px'
                    }}
                  />
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#475569', fontWeight: '600' }}>Loan & Borrower</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#475569', fontWeight: '600' }}>Type / City</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: '#475569', fontWeight: '600' }}>Sanctioned</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: '#475569', fontWeight: '600' }}>Outstanding</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: '#475569', fontWeight: '600' }}>Overdue</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', color: '#475569', fontWeight: '600' }}>DPD</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', color: '#475569', fontWeight: '600' }}>IRAC Bucket</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: '#475569', fontWeight: '600' }}>Provision</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', color: '#475569', fontWeight: '600' }}>Action Links</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStressedLoans.map((l: any) => {
                      const bucketBadgeColor = 
                        l.bucket === 'Standard' ? { bg: '#dcfce7', text: '#15803d' } :
                        l.bucket === 'SMA-0' ? { bg: '#e0f2fe', text: '#0369a1' } :
                        l.bucket === 'SMA-1' ? { bg: '#fef3c7', text: '#92400e' } :
                        l.bucket === 'SMA-2' ? { bg: '#ffedd5', text: '#9a3412' } :
                        { bg: '#fee2e2', text: '#991b1b' };

                      return (
                        <tr key={l.loanId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: '700', color: '#0f172a' }}>{l.customerName}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              <span style={{ fontWeight: '600', color: '#0284c7' }}>{l.loanRef}</span> • {l.customerPhone}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div>{l.loanType}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{l.customerCity}</div>
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '500' }}>
                            {fmt(l.sanctionAmount)}
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>
                            {fmt(l.outstandingPrincipal)}
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '700', color: l.overdueAmount > 0 ? '#dc2626' : '#16a34a' }}>
                            {fmt(l.overdueAmount)}
                            {l.overdueEmisCount > 0 && (
                              <div style={{ fontSize: '10px', color: '#dc2626' }}>{l.overdueEmisCount} EMIs late</div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                            <span style={{
                              fontWeight: '800',
                              fontSize: '12px',
                              color: l.dpd > 90 ? '#b91c1c' : l.dpd > 60 ? '#c2410c' : l.dpd > 30 ? '#b45309' : l.dpd > 0 ? '#0369a1' : '#15803d'
                            }}>
                              {l.dpd} d
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              background: bucketBadgeColor.bg,
                              color: bucketBadgeColor.text
                            }}>
                              {l.bucket}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 12px', fontSize: '12px' }}>
                            <div style={{ fontWeight: '600', color: '#334155' }}>{fmt(l.provisionAmount)}</div>
                            <div style={{ fontSize: '10px', color: '#64748b' }}>{l.provisionRate}% rate</div>
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button
                                onClick={() => router.push(`/dashboard/loans/${l.loanId}`)}
                                title="View Loan File"
                                style={{
                                  background: '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  fontWeight: '600'
                                }}
                              >
                                👁️ View
                              </button>

                              <button
                                onClick={() => router.push(`/dashboard/loans/${l.loanId}`)}
                                title="Restructure Loan"
                                style={{
                                  background: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  color: '#1d4ed8',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  fontWeight: '600'
                                }}
                              >
                                🔄 Restructure
                              </button>

                              <a
                                href={`/pay/${l.loanId}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Open Borrower UPI Pay Link"
                                style={{
                                  background: '#ecfdf5',
                                  border: '1px solid #a7f3d0',
                                  color: '#047857',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  textDecoration: 'none',
                                  fontWeight: '600',
                                  display: 'inline-flex',
                                  alignItems: 'center'
                                }}
                              >
                                💳 Pay Link
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredStressedLoans.length === 0 && (
                      <tr>
                        <td colSpan={9} style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                          No loans match the selected filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION 4: RBI STATUTORY PROVISIONING SCHEDULE */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: '0 0 12px' }}>
                RBI IRAC Loss Provisioning Statutory Schedule
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#475569' }}>Asset Category</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#475569' }}>DPD Range</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', color: '#475569' }}>Active Accounts</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', color: '#475569' }}>Exposure (AUM)</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', color: '#475569' }}>Prescribed Rate</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', color: '#475569' }}>Required Loss Reserve</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '600', color: '#16a34a' }}>Standard Asset</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>0 Days Past Due</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px' }}>{buckets.standard?.count || 0}</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600' }}>{fmt(buckets.standard?.sum || buckets.standard?.amount)}</td>
                    <td style={{ textAlign: 'center', padding: '10px 12px' }}>0.40%</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600' }}>{fmt(buckets.standard?.provisionAmount)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '600', color: '#0284c7' }}>SMA-0 (Incipient Stress)</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>1 to 30 Days</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px' }}>{buckets.sma0?.count || 0}</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600' }}>{fmt(buckets.sma0?.sum || buckets.sma0?.amount)}</td>
                    <td style={{ textAlign: 'center', padding: '10px 12px' }}>0.40%</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600' }}>{fmt(buckets.sma0?.provisionAmount)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '600', color: '#d97706' }}>SMA-1 (Moderate Default)</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>31 to 60 Days</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px' }}>{buckets.sma1?.count || 0}</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600' }}>{fmt(buckets.sma1?.sum || buckets.sma1?.amount)}</td>
                    <td style={{ textAlign: 'center', padding: '10px 12px' }}>5.00%</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600', color: '#d97706' }}>{fmt(buckets.sma1?.provisionAmount)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '600', color: '#ea580c' }}>SMA-2 (High Risk / Pre-NPA)</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>61 to 90 Days</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px' }}>{buckets.sma2?.count || 0}</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600' }}>{fmt(buckets.sma2?.sum || buckets.sma2?.amount)}</td>
                    <td style={{ textAlign: 'center', padding: '10px 12px' }}>10.00%</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600', color: '#ea580c' }}>{fmt(buckets.sma2?.provisionAmount)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '600', color: '#dc2626' }}>Substandard / NPA</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>&gt; 90 Days</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px' }}>{buckets.npa?.count || 0}</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600' }}>{fmt(buckets.npa?.sum || buckets.npa?.amount)}</td>
                    <td style={{ textAlign: 'center', padding: '10px 12px' }}>15.00%</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600', color: '#dc2626' }}>{fmt(buckets.npa?.provisionAmount)}</td>
                  </tr>
                  <tr style={{ background: '#f8fafc', fontWeight: '700' }}>
                    <td colSpan={2} style={{ padding: '12px' }}>Total Portfolio Exposure & Minimum Loss Reserve</td>
                    <td style={{ textAlign: 'right', padding: '12px' }}>{npaSummary.totalActiveLoans || 0}</td>
                    <td style={{ textAlign: 'right', padding: '12px', color: '#0f172a' }}>{fmt(npaSummary.totalAum)}</td>
                    <td style={{ textAlign: 'center', padding: '12px' }}>—</td>
                    <td style={{ textAlign: 'right', padding: '12px', color: '#0284c7', fontSize: '14px' }}>
                      {fmt(npaSummary.totalProvisionReserve)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        )}

      </div>

      {/* Credit Bureau Export Modal */}
      {showBureauModal && (
        <CreditBureauExportModal
          onClose={() => setShowBureauModal(false)}
        />
      )}
    </div>
  );
}
