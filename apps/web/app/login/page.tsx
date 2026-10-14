'use client';
import { API_URL } from '@/lib/api';
import FaceCaptureModal from '@/components/FaceCaptureModal';
import Script from 'next/script';
import { useState, useRef, useEffect, useCallback } from 'react';

type ForgotStep = 'idle' | 'send' | 'verify' | 'done';
type OTPChannel = 'email' | 'sms';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Forgot password flow
  const [forgotStep, setForgotStep] = useState<ForgotStep>('idle');
  const [forgotChannel, setForgotChannel] = useState<OTPChannel>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Mandatory photo capture step on every login
  const [showLoginCapture, setShowLoginCapture] = useState(false);
  const [pendingToken, setPendingToken] = useState('');
  const [pendingUser, setPendingUser] = useState<any>(null);

  const clearMessages = () => { setError(''); setSuccess(''); };

  useEffect(() => {
    const rememberedEmail = localStorage.getItem('rememberedLoginEmail');
    if (rememberedEmail) setEmail(rememberedEmail);
  }, []);

  const handleRememberMeChange = (checked: boolean) => {
    setRememberMe(checked);
    if (!checked) localStorage.removeItem('rememberedLoginEmail');
  };

  // Called after successful credentials/google auth to trigger mandatory photo capture
  const initiateMandatoryPhotoCapture = useCallback((token: string, user: any) => {
    setPendingToken(token);
    setPendingUser(user);
    setShowLoginCapture(true);
  }, []);

  // Called when photo is captured in the webcam modal
  const handleLoginPhotoCapture = async (photoBase64: string) => {
    try {
      await fetch(`${API_URL}/api/auth/login-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pendingToken}` },
        body: JSON.stringify({ photoData: photoBase64 }),
      });
    } catch (e) {
      console.warn('Login attendance photo upload error:', e);
    }

    // Persist session and enter dashboard
    if (rememberMe && typeof pendingUser?.email === 'string') {
      localStorage.setItem('rememberedLoginEmail', pendingUser.email);
    }
    localStorage.setItem('token', pendingToken);
    localStorage.setItem('user', JSON.stringify(pendingUser));
    window.location.href = '/dashboard';
  };

  // Called if user cancels the camera modal without capturing
  const handleLoginPhotoCancel = () => {
    setShowLoginCapture(false);
    setPendingToken('');
    setPendingUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setError('Photo capture is mandatory to log in. Verification was not completed.');
  };

  // ── Google Sign-In ─────────────────────────────────────────────────────
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [gsiLoaded, setGsiLoaded] = useState(false);

  const handleGoogleCredential = useCallback(async (response: { credential: string }) => {
    setGoogleLoading(true); clearMessages();
    try {
      const res = await fetch(`${API_URL}/api/auth/google/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await res.json();
      if (res.ok) {
        initiateMandatoryPhotoCapture(data.token, data.user);
      } else {
        setError(data.message || 'Google sign-in failed');
      }
    } catch {
      setError('Server not reachable.');
    }
    setGoogleLoading(false);
  }, [initiateMandatoryPhotoCapture]);

  useEffect(() => {
    if (!gsiLoaded || !googleBtnRef.current) return;
    const google = (window as any).google;
    if (!google?.accounts?.id) return;
    google.accounts.id.initialize({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
    });
    google.accounts.id.renderButton(googleBtnRef.current, {
      theme: 'outline', size: 'large', width: 340, text: 'continue_with', shape: 'rectangular',
    });
  }, [gsiLoaded, handleGoogleCredential]);

  // ── Email & Password Sign-In ───────────────────────────────────────────
  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter both your email address and password.');
      return;
    }
    setLoading(true); clearMessages();
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        initiateMandatoryPhotoCapture(data.token, data.user);
      } else {
        setError(data.message || 'Invalid email or password');
      }
    } catch {
      setError('Server not reachable. Make sure backend is running.');
    }
    setLoading(false);
  };

  // ── Forgot Password Handlers ───────────────────────────────────────────
  const handleForgotSend = async () => {
    setLoading(true); clearMessages();
    try {
      const res = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotChannel === 'email' ? forgotEmail : undefined,
          phone: forgotChannel === 'sms' ? forgotPhone : undefined,
          type: 'forgot_password',
          channel: forgotChannel
        })
      });
      const data = await res.json();
      if (res.ok) { setForgotStep('verify'); setSuccess('OTP sent! Check your ' + (forgotChannel === 'email' ? 'email' : 'phone')); }
      else setError(data.message || 'Failed to send OTP');
    } catch { setError('Server not reachable.'); }
    setLoading(false);
  };

  const handleForgotReset = async () => {
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true); clearMessages();
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotChannel === 'email' ? forgotEmail : undefined,
          phone: forgotChannel === 'sms' ? forgotPhone : undefined,
          code: forgotCode,
          newPassword,
          channel: forgotChannel
        })
      });
      const data = await res.json();
      if (res.ok) { setForgotStep('done'); setSuccess('Password reset successfully! You can now log in.'); }
      else setError(data.message || 'Failed to reset password');
    } catch { setError('Server not reachable.'); }
    setLoading(false);
  };

  const TEAL = '#0d9488';
  const ACCENT = '#1e40af';
  const GREEN = '#22c55e';

  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 12px', border: 'none', borderRadius: '8px',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#eef2ff', color: '#111827'
  };
  const lbl: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: '6px' };
  const btn = (color = ACCENT): React.CSSProperties => ({
    width: '100%', padding: '12px', background: color, color: 'white', border: 'none', borderRadius: '8px',
    fontSize: '14px', fontWeight: 600, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1
  });
  const btnWhite = (disabled = false): React.CSSProperties => ({
    width: '100%', padding: '12px', background: 'white', color: '#111827', border: 'none', borderRadius: '8px',
    fontSize: '14px', fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.7 : 1
  });

  const pageWrap: React.CSSProperties = {
    minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #f7fbff 0%, #e4f3f0 52%, #f7f0e8 100%), repeating-linear-gradient(120deg, rgba(13,27,46,0.035) 0, rgba(13,27,46,0.035) 1px, transparent 1px, transparent 24px)',
    padding: '32px 20px', gap: '16px'
  };
  const cardWrap: React.CSSProperties = {
    width: '100%', maxWidth: '1180px', minHeight: '680px', display: 'flex', background: TEAL,
    borderRadius: '22px', overflow: 'hidden', boxShadow: '0 10px 48px rgba(15,23,42,0.18)'
  };

  const HeroIllustration = () => (
    <svg viewBox="0 0 320 190" style={{ width: '100%', maxWidth: '300px', height: 'auto' }}>
      <rect x="70" y="10" width="180" height="110" rx="10" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" />
      <rect x="84" y="24" width="60" height="8" rx="4" fill="rgba(255,255,255,0.25)" />
      <rect x="84" y="42" width="40" height="6" rx="3" fill="rgba(255,255,255,0.15)" />
      <rect x="84" y="78" width="12" height="30" rx="2" fill={GREEN} opacity="0.8" />
      <rect x="102" y="66" width="12" height="42" rx="2" fill="#60a5fa" opacity="0.8" />
      <rect x="120" y="54" width="12" height="54" rx="2" fill={GREEN} opacity="0.6" />
      <rect x="138" y="72" width="12" height="36" rx="2" fill="#60a5fa" opacity="0.6" />
      <rect x="156" y="60" width="12" height="48" rx="2" fill={GREEN} opacity="0.9" />
      <circle cx="205" cy="80" r="24" fill="none" stroke="#60a5fa" strokeWidth="6" opacity="0.5" />
      <circle cx="205" cy="80" r="24" fill="none" stroke={GREEN} strokeWidth="6" strokeDasharray="70 150" opacity="0.9" />
      <g transform="translate(20, 110)">
        <path d="M28 0 L52 10 V38 C52 58 40 70 28 76 C16 70 4 58 4 38 V10 Z" fill="url(#shieldGrad)" opacity="0.95" />
        <rect x="18" y="34" width="20" height="16" rx="3" fill="white" opacity="0.9" />
        <path d="M22 34 V27 a6 6 0 0 1 12 0 v7" fill="none" stroke="white" strokeWidth="3" opacity="0.9" />
      </g>
      <g transform="translate(230, 130)">
        <ellipse cx="30" cy="42" rx="34" ry="10" fill="#fbbf24" opacity="0.25" />
        <ellipse cx="30" cy="32" rx="30" ry="9" fill="#fbbf24" opacity="0.4" />
        <ellipse cx="30" cy="22" rx="26" ry="8" fill="#fbbf24" opacity="0.6" />
        <ellipse cx="30" cy="12" rx="22" ry="7" fill="#fbbf24" opacity="0.85" />
        <ellipse cx="30" cy="4" rx="18" ry="6" fill="#facc15" />
      </g>
      <defs>
        <linearGradient id="shieldGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={GREEN} />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
    </svg>
  );

  const LeftPanel = () => (
    <div style={{
      width: '42%', minWidth: '340px', position: 'relative', overflow: 'hidden',
      background: `linear-gradient(160deg, rgba(13,27,46,0.78) 0%, rgba(22,40,63,0.86) 100%), url('/login-hero.jpg') center / cover`,
      color: 'white', padding: '40px 40px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
    }}>
      <div style={{
        position: 'absolute', top: '-120px', right: '-100px', width: '320px', height: '320px',
        borderRadius: '50%', background: `radial-gradient(circle, ${GREEN}20 0%, transparent 70%)`, zIndex: 0
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <img src="/lenqredzo-logo-transparent.png" alt="LenQredzo" style={{ width: '132px', height: 'auto', maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
        <p style={{ fontSize: '12.5px', color: '#9ca3af', margin: '10px 0 20px', letterSpacing: '0.02em' }}>Lending. Credit. Zero Friction.</p>
        <h1 style={{ fontSize: '26px', fontWeight: 700, lineHeight: 1.25, margin: '0 0 10px' }}>
          Run your lending business with{' '}
          <span style={{
            background: `linear-gradient(90deg, ${GREEN} 0%, #4ade80 50%, #60a5fa 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
          }}>confidence.</span>
        </h1>
        <p style={{ fontSize: '13.5px', color: '#cbd5e1', lineHeight: 1.6, maxWidth: '320px', margin: 0 }}>
          Loans, collections, and compliance — in one platform built for India's informal lending sector.
        </p>
      </div>
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
        <HeroIllustration />
      </div>
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {[
          ['🔒', 'AES-256 Encryption', 'Aadhaar, PAN & bank details encrypted at rest'],
          ['🛡️', 'Role-Based Access', 'Owners, branch managers & staff — scoped by role'],
          ['📸', 'Attendance Audit Photo', 'Mandatory live webcam capture on every login'],
        ].map(([icon, title, desc]) => (
          <div key={title} style={{ display: 'flex', gap: '13px', alignItems: 'flex-start' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>{icon}</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>{title}</div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>
      <p style={{ position: 'relative', zIndex: 1, fontSize: '11.5px', color: '#64748b', margin: '12px 0 0' }}>© 2026 LenQredzo. All rights reserved.</p>
    </div>
  );

  const FeatureStrip = () => (
    <div style={{
      width: '100%', maxWidth: '1180px', background: 'white', borderRadius: '16px',
      border: '1px solid #e5e7eb', boxShadow: '0 4px 20px rgba(15,23,42,0.05)', display: 'flex', flexWrap: 'wrap', padding: '18px 8px'
    }}>
      {[
        ['📸', 'Mandatory Photo Capture', 'Attendance logged every login'],
        ['🌐', 'Google & Email Sign-In', 'Fast, secure access'],
        ['🛡️', 'Role-Based Access', 'Scoped by role & branch'],
        ['🔒', '256-bit Encryption', 'Bank-level security'],
        ['📋', '6-Month Audit Trail', 'Full operation logs'],
      ].map(([icon, title, desc]) => (
        <div key={title} style={{ flex: '1 1 180px', display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '8px 16px', minWidth: '180px' }}>
          <span style={{ fontSize: '16px' }}>{icon}</span>
          <div>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827' }}>{title}</div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px' }}>{desc}</div>
          </div>
        </div>
      ))}
    </div>
  );

  // ── Forgot Password Screen ──────────────────────────────────────────────
  if (forgotStep !== 'idle') {
    return (
      <div style={pageWrap}>
        <div style={cardWrap}>
          <LeftPanel />
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
            <div style={{ width: '100%', maxWidth: '380px' }}>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'white', margin: '0 0 4px' }}>Reset Password</h2>
                <p style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.75)', margin: 0 }}>We'll help you get back into your account</p>
              </div>

              {error && <div style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
              {success && <div style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid #86efac', color: '#16a34a', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>{success}</div>}

              {forgotStep === 'done' ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
                  <p style={{ color: 'white', marginBottom: '20px' }}>Password reset successfully!</p>
                  <button onClick={() => { setForgotStep('idle'); clearMessages(); }} style={btn()}>Back to Login</button>
                </div>
              ) : forgotStep === 'send' ? (
                <>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    {(['email', 'sms'] as OTPChannel[]).map(ch => (
                      <button key={ch} onClick={() => setForgotChannel(ch)} style={{
                        flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid',
                        borderColor: forgotChannel === ch ? 'white' : 'rgba(255,255,255,0.3)',
                        background: forgotChannel === ch ? 'white' : 'transparent',
                        color: forgotChannel === ch ? ACCENT : 'rgba(255,255,255,0.8)',
                        fontSize: '13px', fontWeight: 500, cursor: 'pointer'
                      }}>{ch === 'email' ? '📧 Email OTP' : '📱 SMS OTP'}</button>
                    ))}
                  </div>
                  {forgotChannel === 'email' ? (
                    <div style={{ marginBottom: '16px' }}>
                      <label style={lbl}>Registered Email</label>
                      <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="your@email.com" style={inp} />
                    </div>
                  ) : (
                    <div style={{ marginBottom: '16px' }}>
                      <label style={lbl}>Registered Phone</label>
                      <input type="tel" value={forgotPhone} onChange={e => setForgotPhone(e.target.value)} placeholder="9876543210" maxLength={10} style={inp} />
                    </div>
                  )}
                  <button onClick={handleForgotSend} disabled={loading} style={btn()}>{loading ? 'Sending...' : 'Send OTP'}</button>
                  <button onClick={() => { setForgotStep('idle'); clearMessages(); }} style={{ ...btnWhite(), marginTop: '8px' }}>Cancel</button>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={lbl}>Enter OTP</label>
                    <input value={forgotCode} onChange={e => setForgotCode(e.target.value)} placeholder="6-digit OTP" maxLength={6} style={{ ...inp, textAlign: 'center', fontSize: '22px', letterSpacing: '6px', fontWeight: 700 }} />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={lbl}>New Password</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="min 6 characters" style={{ ...inp, paddingRight: '44px' }} />
                      <button type="button" onClick={() => setShowNewPassword(s => !s)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: 0 }}>
                        {showNewPassword ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                  <button onClick={handleForgotReset} disabled={loading} style={btn()}>{loading ? 'Resetting...' : 'Reset Password'}</button>
                  <button onClick={() => { setForgotStep('send'); clearMessages(); }} style={{ ...btnWhite(), marginTop: '8px' }}>← Resend OTP</button>
                </>
              )}
            </div>
          </div>
        </div>
        <FeatureStrip />
      </div>
    );
  }

  // ── Main Login Screen (2 Options: Google or Email & Password) ────────────
  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setGsiLoaded(true)}
      />
      <div style={pageWrap}>
        <div style={cardWrap}>
          <LeftPanel />
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
            <div style={{ width: '100%', maxWidth: '380px' }}>
              <div style={{ marginBottom: '22px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'white', margin: '0 0 6px' }}>Welcome back</h1>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13.5px', margin: 0 }}>Sign in to your LenQredzo account</p>
              </div>

              {/* ── Option 1: Continue with Google ── */}
              <div ref={googleBtnRef} style={{ display: 'flex', justifyContent: 'center', minHeight: '44px', marginBottom: '16px' }} />
              {googleLoading && <p style={{ textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginBottom: '10px' }}>Signing in with Google...</p>}

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '6px 0 20px' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.25)' }} />
                <span style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>or continue with email</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.25)' }} />
              </div>

              {error && <div style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
              {success && <div style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid #86efac', color: '#16a34a', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>{success}</div>}

              {/* ── Option 2: Email & Password ── */}
              <div style={{ marginBottom: '16px' }}>
                <label style={lbl}>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  style={inp}
                />
              </div>

              <div style={{ marginBottom: '8px' }}>
                <label style={lbl}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !loading) handleLogin(); }}
                    placeholder="Enter your password"
                    style={{ ...inp, paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '16px',
                      padding: 0
                    }}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '10px 0 20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'rgba(255,255,255,0.8)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => handleRememberMeChange(e.target.checked)}
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => { setForgotStep('send'); clearMessages(); }}
                  style={{ background: 'none', border: 'none', color: '#bfdbfe', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="button"
                onClick={handleLogin}
                disabled={loading}
                style={btn()}
              >
                {loading ? 'Verifying...' : '🔒 Login Securely'}
              </button>

              <div style={{
                marginTop: '16px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.75)',
                lineHeight: 1.4,
                textAlign: 'center'
              }}>
                📷 <strong>Mandatory Attendance Step:</strong> Every sign-in requires a quick webcam attendance photo capture before dashboard access.
              </div>

              <p style={{ textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginTop: '22px', marginBottom: 0 }}>
                Not registered yet? <a href="/register" style={{ color: '#bfdbfe', fontWeight: 600, textDecoration: 'none' }}>Create an account</a>
              </p>
            </div>
          </div>
        </div>
        <FeatureStrip />
      </div>

      {/* Mandatory Attendance Photo Capture Modal on EVERY Login */}
      {showLoginCapture && (
        <FaceCaptureModal
          title="Mandatory Attendance Photo"
          message="Please capture a clear photo of your face to verify your attendance and proceed to the dashboard."
          onCapture={handleLoginPhotoCapture}
          onCancel={handleLoginPhotoCancel}
        />
      )}
    </>
  );
}