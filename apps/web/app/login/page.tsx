'use client';
import { API_URL } from '@/lib/api';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
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
        
          <img 
            src="/lenqredzo-logo.png" 
            alt="LenQredZo" 
            style={{ width: '80px', height: '80px', objectFit: 'contain' }} 
          />
          <h1 style={{fontSize:'24px',fontWeight:'bold',color:'#111827',margin:'0 0 4px'}}>LenQredZo</h1>
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
            placeholder="ramesh@LenQredZo.com"
            style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box'}}
          />
        </div>

        <div style={{marginBottom:'24px'}}>
          <label style={{display:'block',fontSize:'14px',fontWeight:'500',color:'#374151',marginBottom:'6px'}}>Password</label>
          <div style={{position:'relative'}}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleLogin(); }}
              placeholder="Enter your password"
              style={{width:'100%',padding:'10px 44px 10px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'14px',outline:'none',boxSizing:'border-box'}}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:'16px',padding:0,lineHeight:1}}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{width:'100%',padding:'12px',background:'#1e40af',color:'white',border:'none',borderRadius:'8px',fontSize:'15px',fontWeight:'600',cursor:'pointer'}}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <p style={{textAlign:'center',fontSize:'13px',color:'#6b7280',marginTop:'16px'}}>
          Demo: ramesh@LenQredZo.com / admin123
        </p>
      </div>
    </div>
  );
}