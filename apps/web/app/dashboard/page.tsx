import Sidebar from '../../components/Sidebar';

export default function Dashboard() {
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
            <p style={{fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px'}}>₹12,45,00,000</p>
            <p style={{color: '#16a34a', fontSize: '13px', margin: 0}}>↑ 18.6% vs last month</p>
          </div>
          <div style={{background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb'}}>
            <p style={{color: '#6b7280', fontSize: '13px', margin: '0 0 8px'}}>Total Collections</p>
            <p style={{fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px'}}>₹8,75,20,000</p>
            <p style={{color: '#16a34a', fontSize: '13px', margin: 0}}>↑ 12.4% vs last month</p>
          </div>
          <div style={{background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb'}}>
            <p style={{color: '#6b7280', fontSize: '13px', margin: '0 0 8px'}}>Active Customers</p>
            <p style={{fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px'}}>12,850</p>
            <p style={{color: '#16a34a', fontSize: '13px', margin: 0}}>↑ 8.7% vs last month</p>
          </div>
          <div style={{background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb'}}>
            <p style={{color: '#6b7280', fontSize: '13px', margin: '0 0 8px'}}>NPA (30+ Days)</p>
            <p style={{fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px'}}>2.35%</p>
            <p style={{color: '#ef4444', fontSize: '13px', margin: 0}}>↓ 0.8% vs last month</p>
          </div>
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
              <tr style={{borderBottom: '1px solid #f3f4f6'}}>
                <td style={{padding: '12px 8px', color: '#1e40af', fontSize: '14px'}}>LN10001</td>
                <td style={{padding: '12px 8px', fontSize: '14px'}}>Suresh Kumar</td>
                <td style={{padding: '12px 8px', fontSize: '14px'}}>Personal Loan</td>
                <td style={{padding: '12px 8px', fontSize: '14px', fontWeight: '500'}}>₹2,00,000</td>
                <td style={{padding: '12px 8px'}}><span style={{background: '#dcfce7', color: '#16a34a', padding: '2px 10px', borderRadius: '20px', fontSize: '12px'}}>Active</span></td>
              </tr>
              <tr>
                <td style={{padding: '12px 8px', color: '#1e40af', fontSize: '14px'}}>LN10002</td>
                <td style={{padding: '12px 8px', fontSize: '14px'}}>Anitha Devi</td>
                <td style={{padding: '12px 8px', fontSize: '14px'}}>Business Loan</td>
                <td style={{padding: '12px 8px', fontSize: '14px', fontWeight: '500'}}>₹5,00,000</td>
                <td style={{padding: '12px 8px'}}><span style={{background: '#dcfce7', color: '#16a34a', padding: '2px 10px', borderRadius: '20px', fontSize: '12px'}}>Active</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}