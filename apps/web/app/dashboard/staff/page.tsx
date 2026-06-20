'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { API_URL } from '@/lib/api';

const ROLE_OPTIONS = [
  { value: 'branch_manager', label: 'Branch Manager' },
  { value: 'loan_officer', label: 'Loan Officer' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'collection_agent', label: 'Collection Agent' },
  { value: 'recovery_officer', label: 'Recovery Officer' },
  { value: 'owner', label: 'Finance Owner' },
];

const roleLabel = (r: string) => {
  const found = ROLE_OPTIONS.find(o => o.value === r);
  if (found) return found.label;
  if (r === 'admin' || r === 'Super Admin') return 'Super Admin';
  return r;
};

const COMPANY_WIDE = ['owner', 'accountant', 'admin', 'Super Admin'];

export default function StaffPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'collection_agent', branchId: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const token = () => localStorage.getItem('token') || '';

  useEffect(() => { fetchStaff(); fetchBranches(); }, []);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/staff`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      setStaff(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch(`${API_URL}/api/branches`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      setBranches(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', email: '', password: '', role: 'collection_agent', branchId: '' });
    setError('');
    setShowForm(true);
  };

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({ name: s.name, email: s.email, password: '', role: s.role, branchId: s.branchId ? String(s.branchId) : '' });
    setError('');
    setShowForm(true);
  };

  const save = async () => {
    setError('');
    if (!editing) {
      if (!form.name.trim() || !form.email.trim() || !form.password) { setError('Name, email and password are required.'); return; }
      if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    }
    const branchScoped = !COMPANY_WIDE.includes(form.role);
    if (branchScoped && !form.branchId) { setError('This role must be assigned to a branch.'); return; }

    setSaving(true);
    try {
      const url = editing
        ? `${API_URL}/api/staff/${editing.id}`
        : `${API_URL}/api/staff`;
      const method = editing ? 'PUT' : 'POST';
      const body = editing
        ? { role: form.role, branchId: form.branchId || null }
        : { name: form.name, email: form.email, password: form.password, role: form.role, branchId: form.branchId || null };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Failed to save'); setSaving(false); return; }
      setShowForm(false);
      fetchStaff();
    } catch (err) {
      console.error(err);
      setError('Server error. Please try again.');
    }
    setSaving(false);
  };

  const branchName = (id: number) => branches.find(b => b.id === id)?.name || '—';

  const inp = { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as any };
  const lbl = { display: 'block' as any, fontSize: '13px', fontWeight: '500' as any, marginBottom: '6px', color: '#374151' };
  const branchScoped = !COMPANY_WIDE.includes(form.role);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '240px', flex: 1, padding: '24px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Staff</h2>
            <p style={{ color: '#6b7280', margin: 0 }}>Manage your team and their roles</p>
          </div>
          <button onClick={openAdd}
            style={{ background: '#1e40af', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
            + Add Staff
          </button>
        </div>

        {showForm && (
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
            <h3 style={{ fontWeight: '700', marginBottom: '16px', fontSize: '16px' }}>
              {editing ? `Edit — ${editing.name}` : 'Add New Staff'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={lbl}>Full Name</label>
                <input value={form.name} disabled={!!editing}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  style={{ ...inp, background: editing ? '#f3f4f6' : 'white' }} />
              </div>
              <div>
                <label style={lbl}>Email</label>
                <input value={form.email} disabled={!!editing}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  style={{ ...inp, background: editing ? '#f3f4f6' : 'white' }} />
              </div>
              {!editing && (
                <div>
                  <label style={lbl}>Password (min 6 chars)</label>
                  <input type="password" value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    style={inp} />
                </div>
              )}
              <div>
                <label style={lbl}>Role</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={inp}>
                  {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Branch {branchScoped ? '*' : '(optional)'}</label>
                <select value={form.branchId} onChange={e => setForm({ ...form, branchId: e.target.value })} style={inp}>
                  <option value="">— No branch —</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                {branchScoped && (
                  <p style={{ fontSize: '11px', color: '#6b7280', margin: '6px 0 0' }}>
                    This role sees only its assigned branch.
                  </p>
                )}
                {!branchScoped && (
                  <p style={{ fontSize: '11px', color: '#6b7280', margin: '6px 0 0' }}>
                    This role sees the whole company.
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginTop: '14px' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={save} disabled={saving}
                style={{ background: '#1e40af', color: 'white', border: 'none', padding: '9px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Staff'}
              </button>
              <button onClick={() => setShowForm(false)}
                style={{ background: 'white', color: '#374151', border: '1px solid #d1d5db', padding: '9px 24px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ fontWeight: '600', margin: 0 }}>Team ({staff.length})</h3>
          </div>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
          ) : staff.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No staff yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                  {['Name', 'Email', 'Role', 'Branch', 'Action'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 20px', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((s: any) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '600' }}>{s.name}</td>
                    <td style={{ padding: '14px 20px', fontSize: '13px', color: '#6b7280' }}>{s.email}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ background: '#eff6ff', color: '#1e40af', padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                        {roleLabel(s.role)}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '13px' }}>
                      {COMPANY_WIDE.includes(s.role) ? 'All branches' : (s.branch?.name || (s.branchId ? branchName(s.branchId) : '— none —'))}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <button onClick={() => openEdit(s)}
                        style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: '5px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>
                        Edit role/branch
                      </button>
                    </td>
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