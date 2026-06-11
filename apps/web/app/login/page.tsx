'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/dashboard';
      } else {
        setError(data.message || 'Login failed');
      }
    } catch {
      setError('Server not reachable. Make sure backend is running.');
    }
    setLoading(false);
  };

  return (
    <div style={{minHeight:'100vh',background:'#f0f4ff',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{background:'white',padding:'40px',borderRadius:'16px',boxShadow:'0 4px 24px rgba(0,0,0,0.08)',width:'100%',maxWidth:'400px'}}>
        <div style={{textAlign:'center',marginBottom:'32px'}}>
          <div style={{width:'48px',height:'48px',background:'#1e40af',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px',color:'white',fontWeight:'bold',fontSize:'20px'}}>F</div>
          <h1 style={{fontSize:'24px',fontWeight:'bold',color:'#111827',margin:'0 0 4px'}}>FinSmart</h1>
          <p style={{color:'#6b7280',fontSize:'14px',margin:0}}>Sign in to your account</p>
        </div>

        {error && (
          <div style={{background:'#fef2f2',border:'1px solid #fecaca',color:'#dc2626',padding:'12px',borderRadius:'8px',fontSize:'14px',marginBottom:'16px'}}>
            {error}
          </div>
        )}

        <div style={{marginBottom:'16px'}}>
          <label style={{display:'block',fontSize:'14px',fontWeight:'500',color:'#374151',marginBottom:'6px'}}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ramesh@finsmart.com"
            style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box'}}
          />
        </div>

        <div style={{marginBottom:'24px'}}>
          <label style={{display:'block',fontSize:'14px',fontWeight:'500',color:'#374151',marginBottom:'6px'}}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box'}}
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{width:'100%',padding:'12px',background:'#1e40af',color:'white',border:'none',borderRadius:'8px',fontSize:'15px',fontWeight:'600',cursor:'pointer'}}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <p style={{textAlign:'center',fontSize:'13px',color:'#6b7280',marginTop:'16px'}}>
          Demo: ramesh@finsmart.com / admin123
        </p>
      </div>
    </div>
  );
}