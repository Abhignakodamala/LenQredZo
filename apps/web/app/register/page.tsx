'use client';
import { useState } from 'react';
import { API_URL } from '@/lib/api';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', companyName: '', accessCode: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });

  const submit = async () => {
    setError('');
    if (!form.name || !form.email || !form.password || !form.companyName || !form.accessCode) {
      setError('Please fill in all fields.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Could not create account.');
        setSaving(false);
        return;
      }
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError('Could not reach the server. Please try again.');
    }
    setSaving(false);
  };

  const inp = { width: '100%', padding: '11px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as any, marginBottom: '14px' };
  const lbl = { display: 'block', fontSize: '13px', fontWeight: 600 as any, marginBottom: '6px', color: '#374151' };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', maxWidth: '420px', textAlign: 'center' }}>
          <div style={{ fontSize: '44px', marginBottom: '8px' }}>✅</div>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '0 0 8px' }}>Account created!</h2>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 20px' }}>
            Your company account is ready. You can now sign in as the owner.
          </p>
          <a href="/login" style={{ display: 'inline-block', background: '#1e40af', color: 'white', textDecoration: 'none', padding: '11px 28px', borderRadius: '8px', fontSize: '14px', fontWeight: 600 }}>
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff', padding: '20px' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: '52px', height: '52px', background: '#1e40af', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'white', fontSize: '24px', fontWeight: 'bold' }}>F</div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Create your company</h1>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: '4px 0 0' }}>Set up your LenQredZo owner account</p>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '11px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <label style={lbl}>Your Name</label>
        <input style={inp} value={form.name} onChange={e => update('name', e.target.value)} placeholder="Ramesh Babu" />

        <label style={lbl}>Company Name</label>
        <input style={inp} value={form.companyName} onChange={e => update('companyName', e.target.value)} placeholder="ABC Finance" />

        <label style={lbl}>Email</label>
        <input style={inp} type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@company.com" />

        <label style={lbl}>Password</label>
        <input style={inp} type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder="min 6 characters" />

        <label style={lbl}>Access Code</label>
        <input style={inp} value={form.accessCode} onChange={e => update('accessCode', e.target.value)} placeholder="Code provided by LenQredZo" />

        <button onClick={submit} disabled={saving}
          style={{ width: '100%', background: '#1e40af', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1, marginTop: '4px' }}>
          {saving ? 'Creating...' : 'Create Account'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '13px', color: '#6b7280', margin: '18px 0 0' }}>
          Already have an account? <a href="/login" style={{ color: '#1e40af', fontWeight: 600, textDecoration: 'none' }}>Sign in</a>
        </p>
      </div>
    </div>
  );
}