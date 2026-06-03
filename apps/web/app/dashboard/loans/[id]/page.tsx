'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function LoanDetailPage() {
  const params = useParams();
  const id = params.id;
  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => { fetchLoan(); }, []);

  const fetchLoan = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/loans/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setLoan(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const markPaid = async (emiId: number) => {
    try {
      await fetch(`http://localhost:5000/api/loans/emi/${emiId}/pay`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      fetchLoan();
    } catch (err) { console.error(err); }
  };

  const formatINR = (num: number) => '₹' + Number(num).toLocaleString('en-IN');
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  if (loading) return <div style={{display:'flex',minHeight:'100vh',backgroundColor:'#f9fafb'}}><Sidebar /><div style={{marginLeft:'240px',flex:1,padding:'40px',textAlign:'center',color:'#6b7280'}}>Loading...</div></div>;
  if (!loan || loan.message) return <div style={{display:'flex',minHeight:'100vh',backgroundColor:'#f9fafb'}}><Sidebar /><div style={{marginLeft:'240px',flex:1,padding:'40px',textAlign:'center',color:'#6b7280'}}>Loan not found</div></div>;

  return (
    <div style={{display:'flex',minHeight:'100vh',backgroundColor:'#f9fafb'}}>
      <Sidebar />
      <div style={{marginLeft:'240px',flex:1,padding:'24px'}}>
        <a href="/dashboard/loans" style={{color:'#1e40af',fontSize:'14px',textDecoration:'none'}}>← Back to Loans</a>
        <h2 style={{fontSize:'24px',fontWeight:'bold',color:'#111827',margin:'12px 0 24px'}}>Loan LN{1000 + loan.id}</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:'16px',marginBottom:'24px'}}>
          <div style={{background:'white',padding:'20px',borderRadius:'12px',border:'1px solid #e5e7eb'}}><p style={{color:'#6b7280',fontSize:'13px',margin:'0 0 8px'}}>Customer</p><p style={{fontSize:'18px',fontWeight:'bold',margin:0}}>{loan.customer?.name}</p></div>
          <div style={{background:'white',padding:'20px',borderRadius:'12px',border:'1px solid #e5e7eb'}}><p style={{color:'#6b7280',fontSize:'13px',margin:'0 0 8px'}}>Loan Amount</p><p style={{fontSize:'18px',fontWeight:'bold',margin:0}}>{formatINR(loan.amount)}</p></div>
          <div style={{background:'white',padding:'20px',borderRadius:'12px',border:'1px solid #e5e7eb'}}><p style={{color:'#6b7280',fontSize:'13px',margin:'0 0 8px'}}>Interest Rate</p><p style={{fontSize:'18px',fontWeight:'bold',margin:0}}>{loan.interestRate}%</p></div>
          <div style={{background:'white',padding:'20px',borderRadius:'12px',border:'1px solid #e5e7eb'}}><p style={{color:'#6b7280',fontSize:'13px',margin:'0 0 8px'}}>Tenure</p><p style={{fontSize:'18px',fontWeight:'bold',margin:0}}>{loan.tenure} months</p></div>
        </div>
        <div style={{background:'white',borderRadius:'12px',border:'1px solid #e5e7eb'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid #e5e7eb'}}><h3 style={{fontWeight:'600',margin:0}}>EMI Schedule ({loan.emis?.length || 0} months)</h3></div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{borderBottom:'1px solid #e5e7eb',background:'#f9fafb'}}>
              <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>EMI #</th>
              <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Due Date</th>
              <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Amount</th>
              <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Status</th>
              <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Action</th>
            </tr></thead>
            <tbody>
              {loan.emis?.map((emi: any, index: number) => (
                <tr key={emi.id} style={{borderBottom:'1px solid #f3f4f6'}}>
                  <td style={{padding:'14px 20px',fontSize:'14px'}}>{index + 1}</td>
                  <td style={{padding:'14px 20px',fontSize:'14px'}}>{formatDate(emi.dueDate)}</td>
                  <td style={{padding:'14px 20px',fontSize:'14px',fontWeight:'500'}}>{formatINR(emi.amount)}</td>
                  <td style={{padding:'14px 20px'}}><span style={{background: emi.status === 'paid' ? '#dcfce7' : '#fef3c7', color: emi.status === 'paid' ? '#16a34a' : '#d97706', padding:'2px 10px', borderRadius:'20px', fontSize:'12px'}}>{emi.status}</span></td>
                  <td style={{padding:'14px 20px'}}>{emi.status !== 'paid' && (<button onClick={() => markPaid(emi.id)} style={{background:'#1e40af',color:'white',border:'none',padding:'4px 12px',borderRadius:'6px',fontSize:'12px',cursor:'pointer'}}>Mark Paid</button>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}