'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import CollectionsChart from '@/components/CollectionsChart';
import LoanPortfolioChart from '@/components/LoanPortfolioChart';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setStats(data);
      } catch (err) { console.error(err); }
    };
    fetchStats();
  }, []);

  const formatINR = (num: number) => '₹' + Number(num || 0).toLocaleString('en-IN');

  return (
    <div style={{display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb'}}>
      <Sidebar />
      <div style={{marginLeft: '240px', flex: 1, padding: '24px'}}>
        <div style={{marginBottom: '24px'}}>
          <h2 style={{fontSize: '24px', fontWeight: 'bold', color: '#111827'}}>Dashboard</h2>
          <p style={{color: '#6b7280'}}>Welcome back, Ramesh Babu 👋</p>
        </div>

        <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px'}}>
          <div style={{background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb'}}>
            <p style={{color: '#6b7280', fontSize: '13px', margin: '0 0 8px'}}>Total Loan Disbursed</p>
            <p style={{fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px'}}>{stats ? formatINR(stats.totalDisbursed) : '...'}</p>
            <p style={{color: '#16a34a', fontSize: '13px', margin: 0}}>{stats?.totalLoans || 0} total loans</p>
          </div>
          <div style={{background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb'}}>
            <p style={{color: '#6b7280', fontSize: '13px', margin: '0 0 8px'}}>Total Collections</p>
            <p style={{fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px'}}>{stats ? formatINR(stats.totalCollections) : '...'}</p>
            <p style={{color: '#16a34a', fontSize: '13px', margin: 0}}>received so far</p>
          </div>
          <div style={{background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb'}}>
            <p style={{color: '#6b7280', fontSize: '13px', margin: '0 0 8px'}}>Active Customers</p>
            <p style={{fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px'}}>{stats?.activeCustomers ?? '...'}</p>
            <p style={{color: '#16a34a', fontSize: '13px', margin: 0}}>registered</p>
          </div>
          <div style={{background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb'}}>
            <p style={{color: '#6b7280', fontSize: '13px', margin: '0 0 8px'}}>Active Loans</p>
            <p style={{fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px'}}>{stats?.activeLoans ?? '...'}</p>
            <p style={{color: '#16a34a', fontSize: '13px', margin: 0}}>currently running</p>
          </div>
        </div>

        <div style={{display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px', marginBottom: '24px'}}>
          <CollectionsChart />
          <LoanPortfolioChart />
        </div>

        <div style={{background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb'}}>
          <h3 style={{fontWeight: '600', marginBottom: '16px', fontSize: '16px'}}>Recent Loans</h3>
          <table style={{width: '100%', borderCollapse: 'collapse'}}>
            <thead>
              <tr style={{borderBottom: '1px solid #e5e7eb'}}>
                <th style={{textAlign: 'left', padding: '8px', color: '#6b7280', fontSize: '13px', fontWeight: '500'}}>Loan ID</th>
                <th style={{textAlign: 'left', padding: '8px', color: '#6b7280', fontSize: '13px', fontWeight: '500'}}>Customer</th>
                <th style={{textAlign: 'left', padding: '8px', color: '#6b7280', fontSize: '13px', fontWeight: '500'}}>Type</th>
                <th style={{textAlign: 'left', padding: '8px', color: '#6b7280', fontSize: '13px', fontWeight: '500'}}>Amount</th>
                <th style={{textAlign: 'left', padding: '8px', color: '#6b7280', fontSize: '13px', fontWeight: '500'}}>Status</th>
              </tr>
            </thead>
            <tbody>
              {stats?.recentLoans?.length ? stats.recentLoans.map((l: any) => (
                <tr key={l.id} style={{borderBottom: '1px solid #f3f4f6'}}>
                  <td style={{padding: '12px 8px', color: '#1e40af', fontSize: '14px'}}>LN{1000 + l.id}</td>
                  <td style={{padding: '12px 8px', fontSize: '14px'}}>{l.customer?.name}</td>
                  <td style={{padding: '12px 8px', fontSize: '14px'}}>{l.type}</td>
                  <td style={{padding: '12px 8px', fontSize: '14px', fontWeight: '500'}}>{formatINR(l.amount)}</td>
                  <td style={{padding: '12px 8px'}}><span style={{background: '#dcfce7', color: '#16a34a', padding: '2px 10px', borderRadius: '20px', fontSize: '12px'}}>{l.status}</span></td>
                </tr>
              )) : (
                <tr><td colSpan={5} style={{padding:'20px',textAlign:'center',color:'#6b7280',fontSize:'14px'}}>No loans yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
