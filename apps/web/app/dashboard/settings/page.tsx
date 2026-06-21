'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { API_URL } from '@/lib/api';
import ActivityLog from '@/components/ActivityLog';

export default function SettingsPage() {
  const [company, setCompany] = useState<any>({ name: '', primaryColor: '#1e40af', plan: 'starter' });
  const [user, setUser] = useState<any>({ name: '', email: '', role: '' });
  const [loading, setLoading] = useState(true);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [msg, setMsg] = useState('');
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [exporting, setExporting] = useState(false);
  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      if (data.company) setCompany(data.company);
      if (data.user) setUser(data.user);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const saveCompany = async () => {
    setSavingCompany(true);
    try {
      const res = await fetch(`${API_URL}/api/settings/company`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ name: company.name, primaryColor: company.primaryColor, plan: company.plan })
      });
      if (res.ok) showMsg('✅ Company details saved');
    } catch (err) { console.error(err); }
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
    } catch (err) { console.error(err); }
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
    } catch (err) { setPwdError('Server error'); }
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
    a.download = `finsmart-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    showMsg('✅ Data exported successfully');
  } catch (err) {
    console.error(err);
    showMsg('❌ Export failed');
  }
  setExporting(false);
};

  const inp = { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as any };
  const lbl = { display: 'block' as any, fontSize: '13px', fontWeight: '500' as any, marginBottom: '6px', color: '#374151' };
  const card = { background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '20px' };
  const btn = { background: '#1e40af', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '600' as any, cursor: 'pointer' };

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '240px', flex: 1, padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading settings...</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '240px', flex: 1, padding: '24px', maxWidth: '800px' }}>

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
            <div>
              <label style={lbl}>Brand Color</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="color" value={company.primaryColor || '#1e40af'} onChange={e => setCompany({ ...company, primaryColor: e.target.value })} style={{ width: '48px', height: '38px', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', padding: '2px' }} />
                <input value={company.primaryColor || '#1e40af'} onChange={e => setCompany({ ...company, primaryColor: e.target.value })} style={{ ...inp, flex: 1 }} />
              </div>
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
            <div>
              <label style={lbl}>Current Password</label>
              <input type="password" value={pwd.currentPassword} onChange={e => setPwd({ ...pwd, currentPassword: e.target.value })} placeholder="••••••" style={inp} />
            </div>
            <div>
              <label style={lbl}>New Password</label>
              <input type="password" value={pwd.newPassword} onChange={e => setPwd({ ...pwd, newPassword: e.target.value })} placeholder="min 6 characters" style={inp} />
            </div>
            <div>
              <label style={lbl}>Confirm New Password</label>
              <input type="password" value={pwd.confirmPassword} onChange={e => setPwd({ ...pwd, confirmPassword: e.target.value })} placeholder="re-type new password" style={inp} />
            </div>
          </div>
          <button onClick={changePassword} disabled={savingPwd} style={{ ...btn, marginTop: '16px', opacity: savingPwd ? 0.7 : 1 }}>
            {savingPwd ? 'Changing...' : 'Change Password'}
          </button>
        </div>
        
        <ActivityLog />

          {/* Data Export */}
        <div style={card}>
          <h3 style={{ fontWeight: '700', fontSize: '16px', margin: '0 0 8px' }}>📊 Export My Data</h3>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px' }}>
            Download all your company's data (customers, loans, EMIs, payments, guarantors) as an Excel file.
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