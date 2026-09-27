'use client';
import { useState } from 'react';
import Image from 'next/image';
import { API_URL } from '@/lib/api';

type Step = 'form' | 'verify' | 'done';

export default function RegisterPage() {
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState({
    name: '', email: '', password: '', companyName: '', accessCode: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });
  const clearMessages = () => { setError(''); setSuccess(''); };

  // ── Step 1: Validate form + send email OTP ───────────────────────────────
  const handleSendOTP = async () => {
    clearMessages();
    if (!form.name || !form.email || !form.password || !form.companyName || !form.accessCode) {
      setError('Please fill in all fields.'); return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.'); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Please enter a valid email address.'); return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, type: 'email_verify', channel: 'email' })
      });
      const data = await res.json();
      if (res.ok) {
        setStep('verify');
        setSuccess(`OTP sent to ${form.email}. Check your inbox.`);
      } else {
        setError(data.message || 'Failed to send OTP');
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    }
    setSaving(false);
  };

  // ── Step 2: Verify OTP + create account ─────────────────────────────────
  const handleVerifyAndRegister = async () => {
    clearMessages();
    if (!otpCode || otpCode.length !== 6) {
      setError('Please enter the 6-digit OTP.'); return;
    }

    setSaving(true);
    try {
      // First verify the OTP
      const verifyRes = await fetch(`${API_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, code: otpCode })
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setError(verifyData.message || 'Invalid OTP');
        setSaving(false);
        return;
      }

      // Then create the account
      const regRes = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const regData = await regRes.json();
      if (!regRes.ok) {
        setError(regData.message || 'Could not create account.');
        setSaving(false);
        return;
      }

      setStep('done');
    } catch {
      setError('Could not reach the server. Please try again.');
    }
    setSaving(false);
  };

  // ── Resend OTP ───────────────────────────────────────────────────────────
  const handleResendOTP = async () => {
    clearMessages();
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, type: 'email_verify', channel: 'email' })
      });
      if (res.ok) setSuccess('OTP resent! Check your inbox.');
      else setError('Failed to resend OTP. Please try again.');
    } catch {
      setError('Server not reachable.');
    }
    setSaving(false);
  };

  // ── Styles ───────────────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 12px', border: '1px solid #d1d5db',
    borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none',
    marginBottom: '14px'
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '13px', fontWeight: 600,
    marginBottom: '6px', color: '#374151'
  };
  const btn: React.CSSProperties = {
    width: '100%', background: '#1e40af', color: 'white', border: 'none',
    padding: '12px', borderRadius: '8px', fontSize: '15px', fontWeight: 600,
    cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1, marginTop: '4px'
  };

  const wrapper: React.CSSProperties = {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #f7fbff 0%, #e4f3f0 52%, #f7f0e8 100%), repeating-linear-gradient(120deg, rgba(13,27,46,0.035) 0, rgba(13,27,46,0.035) 1px, transparent 1px, transparent 24px)',
    padding: '32px 20px'
  };
  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.92)', padding: '32px 28px', borderRadius: '24px',
    border: '1px solid rgba(255,255,255,0.75)', backdropFilter: 'blur(14px)',
    boxShadow: '0 18px 48px rgba(15,23,42,0.18)', width: '100%', maxWidth: '420px'
  };

  // ── Done screen ──────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div style={wrapper}>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '0 0 8px' }}>
            Account created!
          </h2>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 8px' }}>
            Your email has been verified and your company account is ready.
          </p>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 24px' }}>
            You can now sign in as the owner.
          </p>
          <a href="/login" style={{
            display: 'inline-block', background: '#1e40af', color: 'white',
            textDecoration: 'none', padding: '11px 32px', borderRadius: '8px',
            fontSize: '14px', fontWeight: 600
          }}>
            Go to Login →
          </a>
        </div>
      </div>
    );
  }

  // ── Verify OTP screen ────────────────────────────────────────────────────
  if (step === 'verify') {
    return (
      <div style={wrapper}>
        <div style={card}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Image src="/lenqredzo-logo.png" alt="LenQredzo" width={150} height={83} style={{ width: '150px', maxWidth: '100%', height: 'auto', objectFit: 'contain', margin: '0 auto' }} />
            <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '8px 0 4px' }}>
              Verify your email
            </h1>
            <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
              We sent a 6-digit OTP to
            </p>
            <p style={{ color: '#1e40af', fontSize: '14px', fontWeight: '600', margin: '4px 0 0' }}>
              {form.email}
            </p>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '11px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#16a34a', padding: '11px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
              {success}
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ ...lbl, textAlign: 'center', display: 'block' }}>Enter OTP</label>
            <input
              value={otpCode}
              onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => { if (e.key === 'Enter' && !saving) handleVerifyAndRegister(); }}
              placeholder="• • • • • •"
              maxLength={6}
              style={{
                ...inp,
                textAlign: 'center', fontSize: '28px', letterSpacing: '10px',
                fontWeight: '700', marginBottom: '8px'
              }}
            />
            <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', margin: '0 0 16px' }}>
              OTP valid for 10 minutes
            </p>
          </div>

          <button onClick={handleVerifyAndRegister} disabled={saving} style={btn}>
            {saving ? 'Verifying...' : 'Verify & Create Account'}
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
            <button onClick={() => { setStep('form'); clearMessages(); }}
              style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '13px', cursor: 'pointer' }}>
              ← Change email
            </button>
            <button onClick={handleResendOTP} disabled={saving}
              style={{ background: 'none', border: 'none', color: '#1e40af', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
              Resend OTP
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Registration form ────────────────────────────────────────────────────
  return (
    <div style={wrapper}>
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Image src="/lenqredzo-logo.png" alt="LenQredzo" width={150} height={83} style={{ width: '150px', maxWidth: '100%', height: 'auto', objectFit: 'contain', margin: '0 auto' }} />
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: '8px 0 0' }}>
            Create your company
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: '4px 0 0' }}>
            Set up your LenQredzo owner account
          </p>
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
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={e => update('password', e.target.value)}
            placeholder="min 6 characters"
            style={{ ...inp, marginBottom: 0, paddingRight: '44px' }}
          />
          <button type="button" onClick={() => setShowPassword(s => !s)}
            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: 0 }}>
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>

        <label style={lbl}>Access Code</label>
        <input style={inp} value={form.accessCode} onChange={e => update('accessCode', e.target.value)} placeholder="Code provided by LenQredzo" />

        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', fontSize: '12px', color: '#92400e' }}>
          📧 After clicking Continue, we'll send a verification OTP to your email address.
        </div>

        <button onClick={handleSendOTP} disabled={saving} style={btn}>
          {saving ? 'Sending OTP...' : 'Continue →'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '13px', color: '#6b7280', margin: '18px 0 0' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#1e40af', fontWeight: 600, textDecoration: 'none' }}>Sign in</a>
        </p>
      </div>
    </div>
  );
}
