'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';

export default function CollectionsPage() {
  const [emis, setEmis] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => { fetchCollections(); }, []);

  const fetchCollections = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/loans/collections/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setEmis(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const markPaid = async (emiId: number) => {
    try {
      await fetch(`http://localhost:5000/api/loans/emi/${emiId}/pay`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchCollections();
    } catch (err) { console.error(err); }
  };

  const formatINR = (num: number) => '₹' + Number(num).toLocaleString('en-IN');
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const badge = (status: string) => {
    if (status === 'paid') return { background:'#dcfce7', color:'#16a34a' };
    if (status === 'overdue') return { background:'#fee2e2', color:'#dc2626' };
    return { background:'#fef3c7', color:'#d97706' };
  };

  const totalDue = emis.filter((e: any) => e.status !== 'paid').reduce((s: number, e: any) => s + e.amount, 0);
  const overdueCount = emis.filter((e: any) => e.status === 'overdue').length;
  const collectedCount = emis.filter((e: any) => e.status === 'paid').length;

  return (
    <div style={{display:'flex',minHeight:'100vh',backgroundColor:'#f9fafb'}}>
      <Sidebar />
      <div style={{marginLeft:'240px',flex:1,padding:'24px'}}>
        <div style={{marginBottom:'24px'}}>
          <h2 style={{fontSize:'24px',fontWeight:'bold',color:'#111827',margin:0}}>Collections</h2>
          <p style={{color:'#6b7280',margin:0}}>Track who paid and who is overdue</p>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:'16px',marginBottom:'24px'}}>
          <div style={{background:'white',padding:'20px',borderRadius:'12px',border:'1px solid #e5e7eb'}}>
            <p style={{color:'#6b7280',fontSize:'13px',margin:'0 0 8px'}}>Total Pending</p>
            <p style={{fontSize:'22px',fontWeight:'bold',margin:0}}>{formatINR(totalDue)}</p>
          </div>
          <div style={{background:'white',padding:'20px',borderRadius:'12px',border:'1px solid #e5e7eb'}}>
            <p style={{color:'#6b7280',fontSize:'13px',margin:'0 0 8px'}}>Overdue EMIs</p>
            <p style={{fontSize:'22px',fontWeight:'bold',margin:0,color:'#dc2626'}}>{overdueCount}</p>
          </div>
          <div style={{background:'white',padding:'20px',borderRadius:'12px',border:'1px solid #e5e7eb'}}>
            <p style={{color:'#6b7280',fontSize:'13px',margin:'0 0 8px'}}>Collected EMIs</p>
            <p style={{fontSize:'22px',fontWeight:'bold',margin:0,color:'#16a34a'}}>{collectedCount}</p>
          </div>
        </div>

        <div style={{background:'white',borderRadius:'12px',border:'1px solid #e5e7eb'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid #e5e7eb'}}>
            <h3 style={{fontWeight:'600',margin:0}}>All EMI Collections ({emis.length})</h3>
          </div>
          {loading ? (
            <div style={{padding:'40px',textAlign:'center',color:'#6b7280'}}>Loading...</div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'1px solid #e5e7eb',background:'#f9fafb'}}>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Customer</th>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Loan</th>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Due Date</th>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Amount</th>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Status</th>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Action</th>
                </tr>
              </thead>
              <tbody>
                {emis.map((e: any) => (
                  <tr key={e.id} style={{borderBottom:'1px solid #f3f4f6'}}>
                    <td style={{padding:'14px 20px',fontSize:'14px',fontWeight:'500'}}>{e.customerName}</td>
                    <td style={{padding:'14px 20px',fontSize:'14px',color:'#1e40af'}}>LN{1000 + e.loanId}</td>
                    <td style={{padding:'14px 20px',fontSize:'14px'}}>{formatDate(e.dueDate)}</td>
                    <td style={{padding:'14px 20px',fontSize:'14px',fontWeight:'500'}}>{formatINR(e.amount)}</td>
                    <td style={{padding:'14px 20px'}}><span style={{...badge(e.status),padding:'2px 10px',borderRadius:'20px',fontSize:'12px'}}>{e.status}</span></td>
                    <td style={{padding:'14px 20px'}}>{e.status !== 'paid' && (<button onClick={() => markPaid(e.id)} style={{background:'#1e40af',color:'white',border:'none',padding:'4px 12px',borderRadius:'6px',fontSize:'12px',cursor:'pointer'}}>Collect</button>)}</td>
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