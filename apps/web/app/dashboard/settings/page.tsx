'use client';
import { useState, useEffect, useRef, type CSSProperties } from 'react';
import Sidebar from '@/components/Sidebar';
import { API_URL } from '@/lib/api';
import ActivityLog from '@/components/ActivityLog';
import SecurityDeviceInfo from '@/components/SecurityDeviceInfo';

type CompanyState = { name: string; plan: string; logo?: string | null; primaryColor?: string | null };
type UserState = { name: string; email: string; role: string };
type PasswordState = { currentPassword: string; newPassword: string; confirmPassword: string };

type ShowPasswordState = { current: boolean; new: boolean; confirm: boolean };

export default function SettingsPage() {
  const [showPwd, setShowPwd] = useState<ShowPasswordState>({ current: false, new: false, confirm: false });
  const [company, setCompany] = useState<CompanyState>({ name: '', plan: 'starter', logo: null });
  const [user, setUser] = useState<UserState>({ name: '', email: '', role: '' });
  const [loading, setLoading] = useState(true);
  const [savingCompany, setSavingCompany] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [msg, setMsg] = useState('');
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [exporting, setExporting] = useState(false);

  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      if (data.company) {
        setCompany(data.company);
        localStorage.setItem('company', JSON.stringify(data.company));
        window.dispatchEvent(new Event('company:updated'));
      }
      if (data.user) setUser(data.user);
    } catch (error) { console.error('Failed to fetch settings', error); }
    setLoading(false);
  };

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showMsg('❌ Logo file size cannot exceed 5MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);

      const res = await fetch(`${API_URL}/api/settings/company/logo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        setCompany(prev => ({ ...prev, logo: data.logo }));
        if (data.company) {
          localStorage.setItem('company', JSON.stringify(data.company));
          window.dispatchEvent(new Event('company:updated'));
        }
        showMsg('✅ Company logo uploaded successfully');
      } else {
        showMsg(`❌ ${data.message || 'Failed to upload logo'}`);
      }
    } catch (err: any) {
      console.error('Logo upload error:', err);
      showMsg('❌ Error uploading company logo');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!confirm('Are you sure you want to remove the custom company logo and revert to default?')) return;
    setUploadingLogo(true);
    try {
      const res = await fetch(`${API_URL}/api/settings/company/logo`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setCompany(prev => ({ ...prev, logo: null }));
        if (data.company) {
          localStorage.setItem('company', JSON.stringify(data.company));
          window.dispatchEvent(new Event('company:updated'));
        }
        showMsg('✅ Company logo removed');
      } else {
        showMsg(`❌ ${data.message || 'Failed to remove logo'}`);
      }
    } catch (err) {
      showMsg('❌ Error removing company logo');
    } finally {
      setUploadingLogo(false);
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
          <h3 style={{ fontWeight: '700', fontSize: '16px', margin: '0 0 16px' }}>🏢 Company Details & Branding</h3>

          {/* Company Logo Section */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '76px',
                height: '76px',
                borderRadius: '8px',
                border: '1.5px dashed #cbd5e1',
                background: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                padding: '4px'
              }}>
                {company.logo ? (
                  <img
                    src={company.logo.startsWith('http') ? company.logo : `${API_URL}${company.logo}`}
                    alt="Company Logo"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ fontSize: '32px', color: '#94a3b8' }}>🏢</span>
                )}
              </div>

              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                  Official Company Logo
                </h4>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                  {company.logo ? 'Custom logo active. Visible on Sidebar, Passbooks, Sanction Letters & NOCs.' : 'No custom logo uploaded yet. Using standard branding.'}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                  Supported formats: PNG, JPG, SVG, WebP (Max 5MB)
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                style={{ display: 'none' }}
                onChange={handleLogoFileChange}
              />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                style={{
                  background: '#1e40af',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: uploadingLogo ? 0.7 : 1
                }}
              >
                {uploadingLogo ? 'Uploading...' : (company.logo ? 'Change Logo' : 'Upload Logo')}
              </button>

              {company.logo && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={uploadingLogo}
                  style={{
                    background: '#fef2f2',
                    color: '#dc2626',
                    border: '1px solid #fecaca',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>

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
            {savingCompany ? 'Saving...' : 'Save Company Details'}
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



        <SecurityDeviceInfo />

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