'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', aadhar: '', pan: '' });
  const [errors, setErrors] = useState<any>({});

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/customers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setCustomers(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const validate = () => {
    const e: any = {};
    if (!form.name.trim()) e.name = 'Name is required';
    else if (form.name.trim().length < 3) e.name = 'Name must be at least 3 characters';
    if (!form.phone) e.phone = 'Phone is required';
    else if (!/^[6-9]\d{9}$/.test(form.phone)) e.phone = 'Phone must be 10 digits starting 6-9';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (form.aadhar && !/^\d{12}$/.test(form.aadhar.replace(/\s/g, ''))) e.aadhar = 'Aadhaar must be 12 digits';
    if (form.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.pan.toUpperCase())) e.pan = 'PAN format: ABCDE1234F';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const addCustomer = async () => {
    if (!validate()) return;
    try {
      const res = await fetch('http://localhost:5000/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, pan: form.pan.toUpperCase() })
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ name: '', email: '', phone: '', address: '', aadhar: '', pan: '' });
        setErrors({});
        fetchCustomers();
      }
    } catch (err) { console.error(err); }
  };

  const fields = [
    { key: 'name', label: 'Name', placeholder: 'Full name' },
    { key: 'email', label: 'Email', placeholder: 'email@example.com' },
    { key: 'phone', label: 'Phone', placeholder: '9876543210', maxLength: 10 },
    { key: 'aadhar', label: 'Aadhaar', placeholder: '123456789012', maxLength: 12 },
    { key: 'pan', label: 'PAN', placeholder: 'ABCDE1234F', maxLength: 10 },
    { key: 'address', label: 'Address', placeholder: 'City, State' },
  ];

  return (
    <div style={{display:'flex',minHeight:'100vh',backgroundColor:'#f9fafb'}}>
      <Sidebar />
      <div style={{marginLeft:'240px',flex:1,padding:'24px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
          <div>
            <h2 style={{fontSize:'24px',fontWeight:'bold',color:'#111827',margin:0}}>Customers</h2>
            <p style={{color:'#6b7280',margin:0}}>Manage all your customers</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} style={{background:'#1e40af',color:'white',border:'none',padding:'10px 20px',borderRadius:'8px',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}>+ Add Customer</button>
        </div>

        {showForm && (
          <div style={{background:'white',padding:'24px',borderRadius:'12px',border:'1px solid #e5e7eb',marginBottom:'24px'}}>
            <h3 style={{fontWeight:'600',marginBottom:'16px'}}>Add New Customer</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
              {fields.map((f) => (
                <div key={f.key}>
                  <label style={{display:'block',fontSize:'13px',fontWeight:'500',color:'#374151',marginBottom:'4px'}}>{f.label}</label>
                  <input value={form[f.key as keyof typeof form]} maxLength={f.maxLength} placeholder={f.placeholder} onChange={(ev) => setForm({...form, [f.key]: ev.target.value})} style={{width:'100%',padding:'8px 12px',border:errors[f.key]?'1px solid #ef4444':'1px solid #d1d5db',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box'}} />
                  {errors[f.key] && <p style={{color:'#ef4444',fontSize:'12px',margin:'4px 0 0'}}>{errors[f.key]}</p>}
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:'8px',marginTop:'16px'}}>
              <button onClick={addCustomer} style={{background:'#1e40af',color:'white',border:'none',padding:'8px 20px',borderRadius:'8px',fontSize:'14px',cursor:'pointer'}}>Save</button>
              <button onClick={() => {setShowForm(false); setErrors({});}} style={{background:'white',color:'#374151',border:'1px solid #d1d5db',padding:'8px 20px',borderRadius:'8px',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{background:'white',borderRadius:'12px',border:'1px solid #e5e7eb'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid #e5e7eb'}}>
            <h3 style={{fontWeight:'600',margin:0}}>All Customers ({customers.length})</h3>
          </div>
          {loading ? (
            <div style={{padding:'40px',textAlign:'center',color:'#6b7280'}}>Loading...</div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'1px solid #e5e7eb',background:'#f9fafb'}}>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Name</th>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Email</th>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Phone</th>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Loans</th>
                  <th style={{textAlign:'left',padding:'12px 20px',fontSize:'13px',color:'#6b7280',fontWeight:'500'}}>Status</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c: any) => (
                  <tr key={c.id} style={{borderBottom:'1px solid #f3f4f6'}}>
                    <td style={{padding:'14px 20px',fontSize:'14px',fontWeight:'500'}}>{c.name}</td>
                    <td style={{padding:'14px 20px',fontSize:'14px',color:'#6b7280'}}>{c.email || '-'}</td>
                    <td style={{padding:'14px 20px',fontSize:'14px'}}>{c.phone}</td>
                    <td style={{padding:'14px 20px',fontSize:'14px'}}>{c.loans?.length || 0} loans</td>
                    <td style={{padding:'14px 20px'}}><span style={{background:'#dcfce7',color:'#16a34a',padding:'2px 10px',borderRadius:'20px',fontSize:'12px'}}>Active</span></td>
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