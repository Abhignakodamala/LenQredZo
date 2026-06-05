'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => { fetchPayments(); }, []);

  const fetchPayments = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/loans/payments/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setPayments(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const formatINR = (num: number) => '₹' + Number(num).toLocaleString('en-IN');
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  const totalReceived = payments.reduce((s: number, p: any) => s + p.amount, 0);

  return (
    <div style={{display:'flex',minHeight:'100vh',backgroundColor:'#f9fafb'}}>
      <Sidebar />
      <div style={{marginLeft:'240px',flex:1,padding:'24px'}}>
        <div style={{marginBottom:'24px'}}>
          <h2 style={{fontSize:'24px',fontWeight:'bold',color:'#111827',margin:0}}>Payments</h2>
          <p style={{color:'#6b7280',margin:0}}>All payments received</p>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(2, 1fr)',gap:'16px',marginBottom:'24px'}}>
          <div style={{background:'white',padding:'20px',borderRadius:'12px',border:'1px solid #e5e7eb'}}>
            <p style={{color:'#6b7280',fontSize:'13px',margin:'0 0 8px'}}>Total Received</p>
            <p style={{fontSize:'22px',fontWeight:'bold',margin:0,color:'#16a34a'}}>{formatINR(totalReceived)}</p>
          </div>
          <div style={{background:'white',padding:'20px',borderRadius:'12px',border:'1px solid #e5e7eb'}}>
            <p style={{color:'#6b7280',fontSize:'13px',margin:'0 0 8px'}}>Total Transactions</p>
            <p style={{fontSize:'22px',fontWeight:'bold',margin:0}}>{payments.length}</p>
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
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Date</th>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Customer</th>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Loan</th>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Amount</th>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Method</th>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} style={{borderBottom:'1px solid #f3f4f6'}}>
                    <td style={{padding:'14px 20px',fontSize:'14px'}}>{formatDate(p.paidAt)}</td>
                    <td style={{padding:'14px 20px',fontSize:'14px',fontWeight:'500'}}>{p.loan?.customer?.name}</td>
                    <td style={{padding:'14px 20px',fontSize:'14px',color:'#1e40af'}}>LN{1000 + p.loanId}</td>
                    <td style={{padding:'14px 20px',fontSize:'14px',fontWeight:'500'}}>{formatINR(p.amount)}</td>
                    <td style={{padding:'14px 20px',fontSize:'14px',textTransform:'capitalize'}}>{p.method}</td>
                    <td style={{padding:'14px 20px'}}><span style={{background:'#dcfce7',color:'#16a34a',padding:'2px 10px',borderRadius:'20px',fontSize:'12px'}}>{p.status}</span></td>
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
