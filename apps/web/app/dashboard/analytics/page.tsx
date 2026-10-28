'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import CreditBureauExportModal from '@/components/CreditBureauExportModal';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { API_URL } from '@/lib/api';

const COLORS = ['#1e40af', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [npaData, setNpaData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [npaLoading, setNpaLoading] = useState(true);
  const [showBureauModal, setShowBureauModal] = useState(false);

  // Stressed Asset Drilldown Filters
  const [selectedBucket, setSelectedBucket] = useState<string>('all');
  const [npaSearch, setNpaSearch] = useState<string>('');

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
        if (d.success) {
          setNpaData(d);
        }
        setNpaLoading(false);
      })
      .catch(() => setNpaLoading(false));
  };

  useEffect(() => {
    fetchAnalytics();
    fetchNpaMatrix();
  }, []);

  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

  // Flattened list of loans from npaData
  const allStressedLoans = useMemo(() => {
    if (!npaData?.buckets) return [];
    const b = npaData.buckets;
    return [
      ...(b.standard?.loans || []),
      ...(b.sma0?.loans || []),
      ...(b.sma1?.loans || []),
      ...(b.sma2?.loans || []),
      ...(b.npa?.loans || [])
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

  const cardStyle = { background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' };

  if (loading && npaLoading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        Loading portfolio analytics and NPA ageing matrix...
      </div>
    </div>
  );

  const npaSummary = npaData?.summary || {};
  const buckets = npaData?.buckets || {};

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '24px' }}>

        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                Portfolio Analytics & RBI Asset Classification
              </h2>
              <span style={{ fontSize: '11px', background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                IRAC Norms Compliant
              </span>
            </div>
            <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '14px' }}>
              RBI NPA Ageing Matrix, Portfolio at Risk (PAR-30 / PAR-60), Loss Provisioning & Bureau Reporting
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => { fetchAnalytics(); fetchNpaMatrix(); }}
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

        {/* SECTION 1: RBI REGULATORY & NPA KPI CARDS */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '16px',
          padding: '20px 24px',
          color: 'white',
          marginBottom: '24px',
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
        <div style={{ marginBottom: '24px' }}>
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
                {fmt(buckets.standard?.sum)}
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
                {fmt(buckets.sma0?.sum)}
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
                {fmt(buckets.sma1?.sum)}
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
                {fmt(buckets.sma2?.sum)}
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
                {fmt(buckets.npa?.sum)}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>
                Provision: 15.0% ({fmt(buckets.npa?.provisionAmount)})
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 3: STRESSED ASSETS & NPA DRILLDOWN TABLE */}
        <div style={{ ...cardStyle, marginBottom: '24px' }}>
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
        <div style={{ ...cardStyle, marginBottom: '24px' }}>
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
                <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600' }}>{fmt(buckets.standard?.sum)}</td>
                <td style={{ textAlign: 'center', padding: '10px 12px' }}>0.40%</td>
                <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600' }}>{fmt(buckets.standard?.provisionAmount)}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 12px', fontWeight: '600', color: '#0284c7' }}>SMA-0 (Incipient Stress)</td>
                <td style={{ padding: '10px 12px', color: '#64748b' }}>1 to 30 Days</td>
                <td style={{ textAlign: 'right', padding: '10px 12px' }}>{buckets.sma0?.count || 0}</td>
                <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600' }}>{fmt(buckets.sma0?.sum)}</td>
                <td style={{ textAlign: 'center', padding: '10px 12px' }}>0.40%</td>
                <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600' }}>{fmt(buckets.sma0?.provisionAmount)}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 12px', fontWeight: '600', color: '#d97706' }}>SMA-1 (Moderate Default)</td>
                <td style={{ padding: '10px 12px', color: '#64748b' }}>31 to 60 Days</td>
                <td style={{ textAlign: 'right', padding: '10px 12px' }}>{buckets.sma1?.count || 0}</td>
                <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600' }}>{fmt(buckets.sma1?.sum)}</td>
                <td style={{ textAlign: 'center', padding: '10px 12px' }}>5.00%</td>
                <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600', color: '#d97706' }}>{fmt(buckets.sma1?.provisionAmount)}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 12px', fontWeight: '600', color: '#ea580c' }}>SMA-2 (High Risk / Pre-NPA)</td>
                <td style={{ padding: '10px 12px', color: '#64748b' }}>61 to 90 Days</td>
                <td style={{ textAlign: 'right', padding: '10px 12px' }}>{buckets.sma2?.count || 0}</td>
                <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600' }}>{fmt(buckets.sma2?.sum)}</td>
                <td style={{ textAlign: 'center', padding: '10px 12px' }}>10.00%</td>
                <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600', color: '#ea580c' }}>{fmt(buckets.sma2?.provisionAmount)}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '10px 12px', fontWeight: '600', color: '#dc2626' }}>Substandard / NPA</td>
                <td style={{ padding: '10px 12px', color: '#64748b' }}>&gt; 90 Days</td>
                <td style={{ textAlign: 'right', padding: '10px 12px' }}>{buckets.npa?.count || 0}</td>
                <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600' }}>{fmt(buckets.npa?.sum)}</td>
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

        {/* SECTION 5: CHARTS & DISTRIBUTION */}
        {/* Monthly trend chart */}
        <div style={{ ...cardStyle, marginBottom: '24px' }}>
          <h3 style={{ fontWeight: '600', fontSize: '16px', margin: '0 0 16px' }}>Disbursement vs Collection Trend (6 months)</h3>
          <ResponsiveContainer width="100%" height={280}>
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
          <div style={cardStyle}>
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

          <div style={cardStyle}>
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
        <div style={cardStyle}>
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

      {/* Credit Bureau Export Modal */}
      {showBureauModal && (
        <CreditBureauExportModal
          onClose={() => setShowBureauModal(false)}
        />
      )}
    </div>
  );
}
