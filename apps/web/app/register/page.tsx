'use client';
import { useState } from 'react';
import Image from 'next/image';
import { API_URL } from '@/lib/api';

type Step = 'form' | 'verify' | 'done';

export default function RegisterPage() {
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState({
    name: '', email: '', password: '', companyName: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });
  const clearMessages = () => { setError(''); setSuccess(''); };

  // ── Step 1: Validate form + send activation request to Platform Owner ─────────
  const handleSendOTP = async () => {
    clearMessages();
    if (!form.name || !form.email || !form.password || !form.companyName) {
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
        body: JSON.stringify({
          email: form.email,
          name: form.name,
          companyName: form.companyName,
          type: 'email_verify',
          channel: 'email'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStep('verify');
        setSuccess(`Activation request submitted! The activation code was routed to the Platform Administrator (${data.ownerEmail || 'abhignakodamala742@gmail.com'}).`);
      } else {
        setError(data.message || 'Failed to submit registration request');
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    }
    setSaving(false);
  };

  // ── Step 2: Verify activation code + create company account ───────────────────
  const handleVerifyAndRegister = async () => {
    clearMessages();
    if (!otpCode || otpCode.length !== 6) {
      setError('Please enter the 6-digit Activation Code provided by the Platform Owner.'); return;
    }

    setSaving(true);
    try {
      // First verify the activation code
      const verifyRes = await fetch(`${API_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, code: otpCode })
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setError(verifyData.message || 'Invalid or expired activation code. Please check with the Platform Owner.');
        setSaving(false);
        return;
      }

      // Then create the company account
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

  // ── Resend activation request to owner ───────────────────────────────────────
  const handleResendOTP = async () => {
    clearMessages();
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          name: form.name,
          companyName: form.companyName,
          type: 'email_verify',
          channel: 'email'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Activation request re-sent to Platform Administrator (${data.ownerEmail || 'abhignakodamala742@gmail.com'}).`);
      } else {
        setError('Failed to resend activation request. Please try again.');
      }
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
    background: 'rgba(255,255,255,0.95)', padding: '32px 28px', borderRadius: '24px',
    border: '1px solid rgba(255,255,255,0.75)', backdropFilter: 'blur(14px)',
    boxShadow: '0 18px 48px rgba(15,23,42,0.18)', width: '100%', maxWidth: '440px'
  };

  // ── Step 3: Done screen ──────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div style={wrapper}>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '0 0 8px' }}>
            Company Workspace Activated!
          </h2>
          <p style={{ color: '#4b5563', fontSize: '14px', margin: '0 0 8px' }}>
            <strong>{form.companyName}</strong> has been successfully licensed and registered on LenQredzo.
          </p>
          <p style={{ color: '#6b7280', fontSize: '13.5px', margin: '0 0 24px' }}>
            You can now sign in with your owner credentials and configure your branches and staff.
          </p>
          <a href="/login" style={{
            display: 'inline-block', background: '#1e40af', color: 'white',
            textDecoration: 'none', padding: '12px 36px', borderRadius: '8px',
            fontSize: '14px', fontWeight: 600, boxShadow: '0 4px 14px rgba(30,64,175,0.3)'
          }}>
            Sign In to Dashboard →
          </a>
        </div>
      </div>
    );
  }

  // ── Step 2: Awaiting Owner Activation Code ────────────────────────────────
  if (step === 'verify') {
    return (
      <div style={wrapper}>
        <div style={card}>
          <div style={{ textAlign: 'center', marginBottom: '22px' }}>
            <Image src="/lenqredzo-logo.png" alt="LenQredzo" width={150} height={83} style={{ width: '150px', maxWidth: '100%', height: 'auto', objectFit: 'contain', margin: '0 auto' }} />
            <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '10px 0 4px' }}>
              Activate Company Workspace
            </h1>
            <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>
              Software licensing approval required
            </p>
          </div>

          <div style={{
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '10px',
            padding: '14px',
            marginBottom: '18px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '16px' }}>🔒</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0369a1' }}>Owner Activation Required</span>
            </div>
            <p style={{ fontSize: '12.5px', color: '#334155', margin: '0 0 6px', lineHeight: 1.5 }}>
              Your registration request for <strong>{form.companyName}</strong> has been routed to the LenQredzo Platform Administrator.
            </p>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
              Enter the 6-digit Activation Code provided to you by the Platform Owner to unlock and create your workspace.
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
            <label style={{ ...lbl, textAlign: 'center', display: 'block' }}>Enter 6-Digit Activation Code</label>
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
              Code provided directly by LenQredzo Platform Owner
            </p>
          </div>

          <button onClick={handleVerifyAndRegister} disabled={saving} style={btn}>
            {saving ? 'Activating...' : 'Activate Company & Launch →'}
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
            <button onClick={() => { setStep('form'); clearMessages(); }}
              style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '13px', cursor: 'pointer' }}>
              ← Edit Details
            </button>
            <button onClick={handleResendOTP} disabled={saving}
              style={{ background: 'none', border: 'none', color: '#1e40af', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
              Resend Alert to Owner
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: Initial Registration Form (No access code needed!) ─────────────
  return (
    <div style={wrapper}>
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <Image src="/lenqredzo-logo.png" alt="LenQredzo" width={150} height={83} style={{ width: '150px', maxWidth: '100%', height: 'auto', objectFit: 'contain', margin: '0 auto' }} />
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: '8px 0 0' }}>
            Register Your Company
          </h1>
          <p style={{ color: '#6b7280', fontSize: '13.5px', margin: '4px 0 0' }}>
            Set up your LenQredzo finance management portal
          </p>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '11px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <label style={lbl}>Your Full Name</label>
        <input style={inp} value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Ramesh Babu" />

        <label style={lbl}>Finance Company Name</label>
        <input style={inp} value={form.companyName} onChange={e => update('companyName', e.target.value)} placeholder="e.g. Sri Krishna Finance" />

        <label style={lbl}>Company Work Email</label>
        <input style={inp} type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="e.g. ramesh@srikrishnafinance.com" />

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

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', fontSize: '12px', color: '#475569', lineHeight: 1.45 }}>
          🛡️ <strong>Platform License Security:</strong> When you click Continue, your registration details are routed to the Platform Owner for activation code generation.
        </div>

        <button onClick={handleSendOTP} disabled={saving} style={btn}>
          {saving ? 'Submitting Request...' : 'Continue to Activation →'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '13px', color: '#6b7280', margin: '18px 0 0' }}>
          Already have an active account?{' '}
          <a href="/login" style={{ color: '#1e40af', fontWeight: 600, textDecoration: 'none' }}>Sign in</a>
        </p>
      </div>
    </div>
  );
}
