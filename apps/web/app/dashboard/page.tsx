import Sidebar from '@/components/Sidebar';
import CollectionsChart from '@/components/CollectionsChart';
import LoanPortfolioChart from '@/components/LoanPortfolioChart';

export default function Dashboard() {
  return (
    <div style={{display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb'}}>
      <Sidebar />
      <div style={{marginLeft: '240px', flex: 1, padding: '24px'}}>
        <div style={{marginBottom: '24px'}}>
          <h2 style={{fontSize: '24px', fontWeight: 'bold', color: '#111827'}}>Dashboard</h2>
          <p style={{color: '#6b7280'}}>Welcome back, Ramesh Babu</p>
        </div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px'}}>
          <div style={{background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb'}}>
            <p style={{color: '#6b7280', fontSize: '13px', margin: '0 0 8px'}}>Total Loan Disbursed</p>
            <p style={{fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px'}}>Rs 12,45,00,000</p>
            <p style={{color: '#16a34a', fontSize: '13px', margin: 0}}>+18.6% vs last month</p>
          </div>
          <div style={{background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb'}}>
            <p style={{color: '#6b7280', fontSize: '13px', margin: '0 0 8px'}}>Total Collections</p>
            <p style={{fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px'}}>Rs 8,75,20,000</p>
            <p style={{color: '#16a34a', fontSize: '13px', margin: 0}}>+12.4% vs last month</p>
          </div>
          <div style={{background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb'}}>
            <p style={{color: '#6b7280', fontSize: '13px', margin: '0 0 8px'}}>Active Customers</p>
            <p style={{fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px'}}>12,850</p>
            <p style={{color: '#16a34a', fontSize: '13px', margin: 0}}>+8.7% vs last month</p>
          </div>
          <div style={{background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb'}}>
            <p style={{color: '#6b7280', fontSize: '13px', margin: '0 0 8px'}}>NPA (30+ Days)</p>
            <p style={{fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px'}}>2.35%</p>
            <p style={{color: '#ef4444', fontSize: '13px', margin: 0}}>-0.8% vs last month</p>
          </div>
        </div>
        <div style={{display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px', marginBottom: '24px'}}>
          <CollectionsChart />
          <LoanPortfolioChart />
        </div>
        <div style={{background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb'}}>
          <h3 style={{fontWeight: '600', marginBottom: '16px', fontSize: '16px'}}>Recent Loans</h3>
          <p style={{fontSize:'14px'}}>LN10001 - Suresh Kumar - Personal Loan - Rs 2,00,000 - Active</p>
        </div>
      </div>
    </div>
  );
}
