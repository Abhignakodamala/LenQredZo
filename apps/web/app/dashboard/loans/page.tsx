'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';

export default function LoansPage() {
  const [loans, setLoans] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customerId: '', type: 'Personal Loan', amount: '', interestRate: '', tenure: '' });

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => {
    fetchLoans();
    fetchCustomers();
  }, []);

  const fetchLoans = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/loans', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setLoans(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/customers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setCustomers(data);
    } catch (err) { console.error(err); }
  };

const addLoan = async () => {
    if (!form.customerId) { alert('Please select a customer'); return; }
    if (!form.amount || Number(form.amount) < 1000) { alert('Loan amount must be at least ₹1,000'); return; }
    if (!form.interestRate || Number(form.interestRate) <= 0 || Number(form.interestRate) > 50) { alert('Interest rate must be between 1% and 50%'); return; }
    if (!form.tenure || Number(form.tenure) < 1 || Number(form.tenure) > 360) { alert('Tenure must be between 1 and 360 months'); return; }
    try {
      const res = await fetch('http://localhost:5000/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customerId: Number(form.customerId),
          type: form.type,
          amount: Number(form.amount),
          interestRate: Number(form.interestRate),
          tenure: Number(form.tenure)
        })
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ customerId: '', type: 'Personal Loan', amount: '', interestRate: '', tenure: '' });
        fetchLoans();
      }
    } catch (err) { console.error(err); }
  };

  const formatINR = (num: number) => '₹' + num.toLocaleString('en-IN');

  return (
    <div style={{display:'flex',minHeight:'100vh',backgroundColor:'#f9fafb'}}>
      <Sidebar />
      <div style={{marginLeft:'240px',flex:1,padding:'24px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
          <div>
            <h2 style={{fontSize:'24px',fontWeight:'bold',color:'#111827',margin:0}}>Loans</h2>
            <p style={{color:'#6b7280',margin:0}}>Manage all loans and EMI schedules</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} style={{background:'#1e40af',color:'white',border:'none',padding:'10px 20px',borderRadius:'8px',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}>
            + New Loan
          </button>
        </div>

        {showForm && (
          <div style={{background:'white',padding:'24px',borderRadius:'12px',border:'1px solid #e5e7eb',marginBottom:'24px'}}>
            <h3 style={{fontWeight:'600',marginBottom:'16px'}}>Create New Loan</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
              <div>
                <label style={{display:'block',fontSize:'13px',fontWeight:'500',marginBottom:'4px'}}>Customer</label>
                <select value={form.customerId} onChange={(e) => setForm({...form, customerId: e.target.value})} style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box'}}>
                  <option value="">Select customer</option>
                  {customers.map((c: any) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
              <div>
                <label style={{display:'block',fontSize:'13px',fontWeight:'500',marginBottom:'4px'}}>Loan Type</label>
                <select value={form.type} onChange={(e) => setForm({...form, type: e.target.value})} style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box'}}>
                  <option>Personal Loan</option>
                  <option>Business Loan</option>
                  <option>Gold Loan</option>
                  <option>Vehicle Loan</option>
                </select>
              </div>
              <div>
                <label style={{display:'block',fontSize:'13px',fontWeight:'500',marginBottom:'4px'}}>Amount (₹)</label>
                <input type="number" value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box'}} />
              </div>
              <div>
                <label style={{display:'block',fontSize:'13px',fontWeight:'500',marginBottom:'4px'}}>Interest Rate (%)</label>
                <input type="number" value={form.interestRate} onChange={(e) => setForm({...form, interestRate: e.target.value})} style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box'}} />
              </div>
              <div>
                <label style={{display:'block',fontSize:'13px',fontWeight:'500',marginBottom:'4px'}}>Tenure (months)</label>
                <input type="number" value={form.tenure} onChange={(e) => setForm({...form, tenure: e.target.value})} style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box'}} />
              </div>
            </div>
            <div style={{display:'flex',gap:'8px',marginTop:'16px'}}>
              <button onClick={addLoan} style={{background:'#1e40af',color:'white',border:'none',padding:'8px 20px',borderRadius:'8px',fontSize:'14px',cursor:'pointer'}}>Create Loan</button>
              <button onClick={() => setShowForm(false)} style={{background:'white',color:'#374151',border:'1px solid #d1d5db',padding:'8px 20px',borderRadius:'8px',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{background:'white',borderRadius:'12px',border:'1px solid #e5e7eb'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid #e5e7eb'}}>
            <h3 style={{fontWeight:'600',margin:0}}>All Loans ({loans.length})</h3>
          </div>
          {loading ? (
            <div style={{padding:'40px',textAlign:'center',color:'#6b7280'}}>Loading...</div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'1px solid #e5e7eb',background:'#f9fafb'}}>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Loan ID</th>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Customer</th>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Type</th>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Amount</th>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Rate</th>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Tenure</th>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l: any) => (
                  <tr key={l.id} style={{borderBottom:'1px solid #f3f4f6'}}>
                    <td style={{padding:'14px 20px',fontSize:'14px',color:'#1e40af'}}>LN{1000 + l.id}</td>
                    <td style={{padding:'14px 20px',fontSize:'14px',fontWeight:'500'}}>{l.customer?.name}</td>
                    <td style={{padding:'14px 20px',fontSize:'14px'}}>{l.type}</td>
                    <td style={{padding:'14px 20px',fontSize:'14px',fontWeight:'500'}}>{formatINR(l.amount)}</td>
                    <td style={{padding:'14px 20px',fontSize:'14px'}}>{l.interestRate}%</td>
                    <td style={{padding:'14px 20px',fontSize:'14px'}}>{l.tenure} mo</td>
                    <td style={{padding:'14px 20px'}}>
                      <span style={{background:'#dcfce7',color:'#16a34a',padding:'2px 10px',borderRadius:'20px',fontSize:'12px'}}>{l.status}</span>
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