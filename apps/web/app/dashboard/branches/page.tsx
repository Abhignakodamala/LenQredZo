'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';

type Branch = {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  customerCount: number;
  staffCount: number;
  loanCount: number;
  totalDisbursed: number;
  totalCollected: number;
};

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchBranches(); }, []);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/branches', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      setBranches(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); setBranches([]); }
    setLoading(false);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', address: '', phone: '' });
    setShowForm(true);
  };

  const openEdit = (b: Branch) => {
    setEditing(b);
    setForm({ name: b.name || '', address: b.address || '', phone: b.phone || '' });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) { alert('Branch name is required'); return; }
    setSaving(true);
    try {
      const url = editing
        ? `http://localhost:5000/api/branches/${editing.id}`
        : 'http://localhost:5000/api/branches';
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ name: '', address: '', phone: '' });
        fetchBranches();
      }
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

  const totalDisbursed = branches.reduce((s, b) => s + b.totalDisbursed, 0);
  const totalCustomers = branches.reduce((s, b) => s + b.customerCount, 0);

  const inp = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as any };
  const lbl = { display: 'block' as any, fontSize: '13px', fontWeight: '500' as any, marginBottom: '4px', color: '#374151' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '240px', flex: 1, padding: '24px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Branches</h2>
            <p style={{ color: '#6b7280', margin: 0 }}>Manage your company branches</p>
          </div>
          <button onClick={openAdd} style={{ background: '#1e40af', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
            + Add Branch
          </button>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Total Branches', value: branches.length, color: '#1e40af' },
            { label: 'Total Customers', value: totalCustomers, color: '#7c3aed' },
            { label: 'Total Disbursed', value: fmt(totalDisbursed), color: '#16a34a' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 8px' }}>{s.label}</p>
              <p style={{ fontSize: '22px', fontWeight: 'bold', margin: 0, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Form */}
        {showForm && (
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
            <h3 style={{ fontWeight: '700', marginBottom: '16px', fontSize: '16px' }}>
              {editing ? `✏️ Edit — ${editing.name}` : '➕ Add New Branch'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label style={lbl}>Branch Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Hyderabad Branch" style={inp} />
              </div>
              <div>
                <label style={lbl}>Phone</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="9876543210" style={inp} />
              </div>
              <div>
                <label style={lbl}>Address</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="City, State" style={inp} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={save} disabled={saving} style={{ background: '#1e40af', color: 'white', border: 'none', padding: '9px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Branch'}
              </button>
              <button onClick={() => setShowForm(false)} style={{ background: 'white', color: '#374151', border: '1px solid #d1d5db', padding: '9px 24px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Branches table */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ fontWeight: '600', margin: 0 }}>All Branches ({branches.length})</h3>
          </div>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#6b7280' }}>Loading branches...</div>
          ) : branches.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#6b7280' }}>No branches yet. Add your first branch!</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                  {['Branch', 'Phone', 'Customers', 'Staff', 'Loans', 'Disbursed', 'Collected', 'Action'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branches.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '600' }}>
                      {b.name}
                      {b.address && <span style={{ display: 'block', fontSize: '11px', color: '#9ca3af', fontWeight: '400' }}>{b.address}</span>}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6b7280' }}>{b.phone || '—'}</td>
                    <td style={{ padding: '14px 16px', fontSize: '13px' }}>{b.customerCount}</td>
                    <td style={{ padding: '14px 16px', fontSize: '13px' }}>{b.staffCount}</td>
                    <td style={{ padding: '14px 16px', fontSize: '13px' }}>{b.loanCount}</td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '500' }}>{fmt(b.totalDisbursed)}</td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#16a34a', fontWeight: '500' }}>{fmt(b.totalCollected)}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <button onClick={() => openEdit(b)} style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: '5px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>
                        ✏️ Edit
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