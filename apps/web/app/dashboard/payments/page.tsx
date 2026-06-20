'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { API_URL } from '@/lib/api';
export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchPayments(); }, []);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/loans/payments/all`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      const paymentsArray = Array.isArray(data) ? data : (Array.isArray(data?.payments) ? data.payments : []);
      setPayments(paymentsArray);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const formatINR = (num: number) => '₹' + Number(num || 0).toLocaleString('en-IN');
  const formatDateTimeIST = (d: string) => d
    ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
    : '-';

  const totalReceived = payments.reduce((s: number, p: any) => s + Number(p?.amount || 0), 0);
  const unverifiedTotal = payments.filter((p: any) => !p.verified).reduce((s: number, p: any) => s + Number(p?.amount || 0), 0);

  const th = { textAlign: 'left' as any, padding: '12px 20px', fontSize: '13px', color: '#6b7280', fontWeight: '500' as any };

  return (
    <div style={{display:'flex',minHeight:'100vh',backgroundColor:'#f9fafb'}}>
      <Sidebar />
      <div style={{marginLeft:'240px',flex:1,padding:'24px'}}>
        <div style={{marginBottom:'24px'}}>
          <h2 style={{fontSize:'24px',fontWeight:'bold',color:'#111827',margin:0}}>Payments</h2>
          <p style={{color:'#6b7280',margin:0}}>All payments received</p>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:'16px',marginBottom:'24px'}}>
          <div style={{background:'white',padding:'20px',borderRadius:'12px',border:'1px solid #e5e7eb'}}>
            <p style={{color:'#6b7280',fontSize:'13px',margin:'0 0 8px'}}>Total Received</p>
            <p style={{fontSize:'22px',fontWeight:'bold',margin:0,color:'#16a34a'}}>{formatINR(totalReceived)}</p>
          </div>
          <div style={{background:'white',padding:'20px',borderRadius:'12px',border:'1px solid #e5e7eb'}}>
            <p style={{color:'#6b7280',fontSize:'13px',margin:'0 0 8px'}}>Total Transactions</p>
            <p style={{fontSize:'22px',fontWeight:'bold',margin:0}}>{payments.length}</p>
          </div>
          <div style={{background:'white',padding:'20px',borderRadius:'12px',border:'1px solid #e5e7eb'}}>
            <p style={{color:'#6b7280',fontSize:'13px',margin:'0 0 8px'}}>Unverified (cash)</p>
            <p style={{fontSize:'22px',fontWeight:'bold',margin:0,color: unverifiedTotal > 0 ? '#d97706' : '#16a34a'}}>{formatINR(unverifiedTotal)}</p>
          </div>
        </div>

        <div style={{background:'white',borderRadius:'12px',border:'1px solid #e5e7eb'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid #e5e7eb'}}>
            <h3 style={{fontWeight:'600',margin:0}}>Payment History ({payments.length})</h3>
          </div>
          {loading ? (
            <div style={{padding:'40px',textAlign:'center',color:'#6b7280'}}>Loading...</div>
          ) : payments.length === 0 ? (
            <div style={{padding:'40px',textAlign:'center',color:'#6b7280'}}>No payments yet. Collect an EMI to see it here.</div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'1px solid #e5e7eb',background:'#f9fafb'}}>
                  <th style={th}>Date &amp; Time (IST)</th>
                  <th style={th}>Customer</th>
                  <th style={th}>Loan</th>
                  <th style={th}>Amount</th>
                  <th style={th}>Method</th>
                  <th style={th}>Reference</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} style={{borderBottom:'1px solid #f3f4f6'}}>
                    <td style={{padding:'14px 20px',fontSize:'14px'}}>{formatDateTimeIST(p.paidAt)}</td>
                    <td style={{padding:'14px 20px',fontSize:'14px',fontWeight:'500'}}>{p.loan?.customer?.name}</td>
                    <td style={{padding:'14px 20px',fontSize:'14px',color:'#1e40af'}}>LN{1000 + p.loanId}</td>
                    <td style={{padding:'14px 20px',fontSize:'14px',fontWeight:'500'}}>{formatINR(p.amount)}</td>
                    <td style={{padding:'14px 20px',fontSize:'14px',textTransform:'capitalize'}}>{p.method}</td>
                    <td style={{padding:'14px 20px',fontSize:'13px',color: p.reference ? '#374151' : '#9ca3af'}}>{p.reference || '—'}</td>
                    <td style={{padding:'14px 20px'}}>
                      <span style={{
                        background: p.verified ? '#dcfce7' : '#f3f4f6',
                        color: p.verified ? '#16a34a' : '#6b7280',
                        padding:'2px 10px',borderRadius:'20px',fontSize:'12px',fontWeight:'600'
                      }}>
                        {p.verified ? '✓ Ref recorded' : 'Cash / no proof'}
                      </span>
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