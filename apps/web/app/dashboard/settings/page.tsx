'use client';
import { useState, useEffect, type CSSProperties } from 'react';
import Sidebar from '@/components/Sidebar';
import { API_URL } from '@/lib/api';
import ActivityLog from '@/components/ActivityLog';
import { deletePasskey, listPasskeys, registerPasskey } from '@/lib/webauthn';

type CompanyState = { name: string; plan: string };
type UserState = { name: string; email: string; role: string };
type PasswordState = { currentPassword: string; newPassword: string; confirmPassword: string };

type ShowPasswordState = { current: boolean; new: boolean; confirm: boolean };
type Passkey = { id: string; nickname: string | null; deviceType: string | null; createdAt: string; lastUsedAt: string | null };

export default function SettingsPage() {
  const [showPwd, setShowPwd] = useState<ShowPasswordState>({ current: false, new: false, confirm: false });
  const [company, setCompany] = useState<CompanyState>({ name: '', plan: 'starter' });
  const [user, setUser] = useState<UserState>({ name: '', email: '', role: '' });
  const [loading, setLoading] = useState(true);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [msg, setMsg] = useState('');
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [biometricLoading, setBiometricLoading] = useState(false);
  useEffect(() => { fetchSettings(); }, []);
  useEffect(() => { fetchPasskeys(); }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      if (data.company) setCompany(data.company);
      if (data.user) setUser(data.user);
    } catch (error) { console.error('Failed to fetch settings', error); }
    setLoading(false);
  };

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const fetchPasskeys = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      setPasskeys(await listPasskeys(token));
    } catch (error) { console.error('Failed to fetch passkeys', error); }
  };

  const handleEnableBiometric = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      showMsg('❌ Your session has expired. Please log in again.');
      return;
    }
    if (!window.isSecureContext) {
      showMsg('❌ Biometric login requires localhost or a secure HTTPS connection.');
      return;
    }
    if (!window.PublicKeyCredential) {
      showMsg('❌ This browser does not support biometric login.');
      return;
    }
    setBiometricLoading(true);
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        showMsg('❌ No Windows Hello, fingerprint, or Face ID authenticator is available on this device.');
        setBiometricLoading(false);
        return;
      }
      await registerPasskey(token, navigator.platform || 'This device');
      await fetchPasskeys();
      showMsg('✅ Biometric login enabled on this device');
    } catch (error: any) {
      showMsg(`❌ ${error.message || 'Failed to enable biometric login'}`);
    }
    setBiometricLoading(false);
  };

  const handleRemovePasskey = async (id: string) => {
    if (!window.confirm('Remove biometric login from this device?')) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      await deletePasskey(token, id);
      setPasskeys(current => current.filter(passkey => passkey.id !== id));
      showMsg('✅ Biometric login removed');
    } catch (error: any) {
      showMsg(`❌ ${error.message || 'Failed to remove biometric login'}`);
    }
  };

  const saveCompany = async () => {
    setSavingCompany(true);
    try {
      const res = await fetch(`${API_URL}/api/settings/company`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ name: company.name, plan: company.plan })
      });
      if (res.ok) showMsg('✅ Company details saved');
    } catch (error) { console.error('Failed to save company settings', error); }
    setSavingCompany(false);
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch(`${API_URL}/api/settings/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ name: user.name, email: user.email })
      });
      if (res.ok) {
        const data = await res.json();
        // Update localStorage so sidebar/navbar reflect new name
        const stored = localStorage.getItem('user');
        if (stored) {
          const u = JSON.parse(stored);
          u.name = data.user.name;
          u.email = data.user.email;
          localStorage.setItem('user', JSON.stringify(u));
        }
        showMsg('✅ Profile saved');
      }
    } catch (error) { console.error('Failed to save profile', error); }
    setSavingProfile(false);
  };
  
  const changePassword = async () => {
    setPwdError('');
    if (!pwd.currentPassword || !pwd.newPassword) { setPwdError('Fill all password fields'); return; }
    if (pwd.newPassword.length < 6) { setPwdError('New password must be at least 6 characters'); return; }
    if (pwd.newPassword !== pwd.confirmPassword) { setPwdError('New passwords do not match'); return; }
    setSavingPwd(true);
    try {
      const res = await fetch(`${API_URL}/api/settings/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ currentPassword: pwd.currentPassword, newPassword: pwd.newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        showMsg('✅ Password changed successfully');
        setPwd({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPwdError(data.message || 'Failed to change password');
      }
    } catch (error) { console.error('Failed to change password', error); setPwdError('Server error'); }
    setSavingPwd(false);
  };

  const exportData = async () => {
  setExporting(true);
  try {
   const res = await fetch(`${API_URL}/api/export/data`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
    });
    
  if (!res.ok) throw new Error('Export failed');

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LenQredZo-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    showMsg('✅ Data exported successfully');
  } catch (error) {
    console.error('Failed to export data', error);
    showMsg('❌ Export failed');
  }
  setExporting(false);
};

  const inp: CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' };
  const lbl: CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' };
  const card: CSSProperties = { background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '20px' };
  const btn: CSSProperties = { background: '#1e40af', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' };

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading settings...</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '24px', maxWidth: '800px' }}>

        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Settings</h2>
          <p style={{ color: '#6b7280', margin: 0 }}>Manage your company and account</p>
        </div>

        {msg && (
          <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#16a34a', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '20px' }}>
            {msg}
          </div>
        )}

        {/* Company Settings */}
        <div style={card}>
          <h3 style={{ fontWeight: '700', fontSize: '16px', margin: '0 0 16px' }}>🏢 Company Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={lbl}>Company Name</label>
              <input value={company.name || ''} onChange={e => setCompany({ ...company, name: e.target.value })} style={inp} />
            </div>
            <div>
              <label style={lbl}>Plan</label> 
              <select value={company.plan || 'starter'} onChange={e => setCompany({ ...company, plan: e.target.value })} style={inp}>
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
    
          </div>
          <button onClick={saveCompany} disabled={savingCompany} style={{ ...btn, marginTop: '16px', opacity: savingCompany ? 0.7 : 1 }}>
            {savingCompany ? 'Saving...' : 'Save Company'}
          </button>
        </div>

        {/* Profile Settings */}
        <div style={card}>
          <h3 style={{ fontWeight: '700', fontSize: '16px', margin: '0 0 16px' }}>👤 My Profile</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={lbl}>Your Name</label>
              <input value={user.name || ''} onChange={e => setUser({ ...user, name: e.target.value })} style={inp} />
            </div>
            <div>
              <label style={lbl}>Email</label>
              <input value={user.email || ''} onChange={e => setUser({ ...user, email: e.target.value })} style={inp} />
            </div>
            <div>
              <label style={lbl}>Role</label>
              <select value={user.role || ''} disabled style={{ ...inp, background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }}>
                {!['Super Admin', 'Owner', 'Manager', 'Agent', 'Accountant'].includes(user.role) && user.role && (
                  <option value={user.role}>{user.role}</option>
                )}
                <option value="Super Admin">Super Admin (Owner)</option>
                <option value="Manager">Manager — single branch</option>
                <option value="Agent">Agent — field collection</option>
                <option value="Accountant">Accountant — reconciliation</option>
              </select>
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: '6px 0 0' }}>Roles are assigned by the owner (coming soon)</p>
            </div>
          </div>
          <button onClick={saveProfile} disabled={savingProfile} style={{ ...btn, marginTop: '16px', opacity: savingProfile ? 0.7 : 1 }}>
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </div>

        {/* Change Password */}
       <div style={card}>
  <h3 style={{ fontWeight: '700', fontSize: '16px', margin: '0 0 16px' }}>🔒 Change Password</h3>
  {pwdError && (
    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
      {pwdError}
    </div>
  )}
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
    {[
      { label: 'Current Password', key: 'currentPassword', show: 'current', placeholder: '••••••' },
      { label: 'New Password', key: 'newPassword', show: 'new', placeholder: 'min 6 characters' },
      { label: 'Confirm New Password', key: 'confirmPassword', show: 'confirm', placeholder: 're-type new password' },
    ].map(f => (
      <div key={f.key}>
        <label style={lbl}>{f.label}</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPwd[f.show as keyof typeof showPwd] ? 'text' : 'password'}
            value={pwd[f.key as keyof typeof pwd]}
            onChange={e => setPwd({ ...pwd, [f.key]: e.target.value })}
            placeholder={f.placeholder}
            style={{ ...inp, paddingRight: '40px' }}
          />
          <button
            type="button"
            onClick={() => setShowPwd({ ...showPwd, [f.show]: !showPwd[f.show as keyof typeof showPwd] })}
            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#6b7280', padding: 0 }}
          >
            {showPwd[f.show as keyof typeof showPwd] ? '🙈' : '👁'}
          </button>
        </div>
      </div>
    ))}
  </div>
  <button onClick={changePassword} disabled={savingPwd} style={{ ...btn, marginTop: '16px', opacity: savingPwd ? 0.7 : 1 }}>
    {savingPwd ? 'Changing...' : 'Change Password'}
  </button>
</div>

        {/* Biometric Login */}
        <div style={card}>
          <h3 style={{ fontWeight: '700', fontSize: '16px', margin: '0 0 8px' }}>👤 Biometric Login</h3>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px' }}>
            Register a device passkey to sign in with Face ID, fingerprint, Windows Hello, or a device PIN.
          </p>
          <button onClick={handleEnableBiometric} disabled={biometricLoading} style={{ ...btn, opacity: biometricLoading ? 0.7 : 1 }}>
            {biometricLoading ? 'Waiting for device...' : 'Enable Device Passkey Login'}
          </button>
          {passkeys.length > 0 && (
            <div style={{ marginTop: '18px', borderTop: '1px solid #e5e7eb', paddingTop: '14px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 10px', color: '#374151' }}>Registered devices</p>
              {passkeys.map(passkey => (
                <div key={passkey.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>{passkey.nickname || 'This device'}</p>
                    <p style={{ fontSize: '11px', color: '#6b7280', margin: '3px 0 0' }}>
                      Added {new Date(passkey.createdAt).toLocaleDateString('en-IN')}
                      {passkey.lastUsedAt ? ` · Last used ${new Date(passkey.lastUsedAt).toLocaleDateString('en-IN')}` : ''}
                    </p>
                  </div>
                  <button onClick={() => handleRemovePasskey(passkey.id)} style={{ background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

<ActivityLog />
          {/* Data Export */}
        <div style={card}>
          <h3 style={{ fontWeight: '700', fontSize: '16px', margin: '0 0 8px' }}>📊 Export My Data</h3>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px' }}>
            Download all your company&apos;s data (customers, loans, EMIs, payments, guarantors) as an Excel file.
            The file contains sensitive information including full Aadhaar and PAN numbers — store it securely.
          </p>
          <button onClick={exportData} disabled={exporting} style={{ ...btn, opacity: exporting ? 0.7 : 1 }}>
            {exporting ? 'Preparing file...' : 'Download Excel Export'}
          </button>
        </div>

        {/* Danger Zone */}
        <div style={{ ...card, border: '1px solid #fecaca' }}>
          <h3 style={{ fontWeight: '700', fontSize: '16px', margin: '0 0 8px', color: '#dc2626' }}>Account</h3>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px' }}>Sign out of your account on this device.</p>
          <button
            onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = '/login'; }}
            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
            Logout
          </button>
        </div>

      </div>
    </div>
  );
}