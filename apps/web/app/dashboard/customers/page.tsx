'use client';
import { ChangeEvent, CSSProperties, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { getAuthUser, can, type AuthUser } from '@/lib/authUser';
import { API_URL } from '@/lib/api';

type Customer = {
  id: number;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  aadhar?: string;
  pan?: string;
  branchId?: number | null;
  loans?: Array<{ id: number; amount: number; status: string }>;
};

type Branch = {
  id: number;
  name: string;
};

type FormState = {
  name: string;
  email: string;
  phone: string;
  address: string;
  aadhar: string;
  pan: string;
  branchId: string;
};

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<FormState>({ name: '', email: '', phone: '', address: '', aadhar: '', pan: '', branchId: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [me, setMe] = useState<AuthUser | null>(null);
  useEffect(() => { setMe(getAuthUser()); }, []);
  const canCreate = can(me, 'customer:create');
  const canEdit = can(me, 'customer:edit');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchCustomers(); fetchBranches(); }, []);

  const fetchBranches = async () => {
    try {
      const res = await fetch(`${API_URL}/api/branches`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      setBranches(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/customers`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setCustomers([]);
    }
    setLoading(false);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    else if (form.name.trim().length < 3) e.name = 'Min 3 characters';
    if (!form.phone) e.phone = 'Phone is required';
    else if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\s/g, ''))) e.phone = 'Must be 10 digits starting with 6-9';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (form.aadhar && !/^\d{12}$/.test(form.aadhar.replace(/\s/g, ''))) e.aadhar = 'Must be 12 digits';
    if (form.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.pan.toUpperCase())) e.pan = 'Format: ABCDE1234F';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openAddForm = () => {
    setEditingCustomer(null);
    setForm({ name: '', email: '', phone: '', address: '', aadhar: '', pan: '', branchId: '' });
    setErrors({});
    setShowForm(true);
  };

  const openEditForm = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      aadhar: customer.aadhar || '',
      pan: customer.pan || '',
      branchId: customer.branchId != null ? String(customer.branchId) : '',
    });
    setErrors({});
    setShowForm(true);
  };

  const saveCustomer = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const url = editingCustomer
        ? `${API_URL}/api/customers/${editingCustomer.id}`
        : `${API_URL}/api/customers`;
      const method = editingCustomer ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ ...form, pan: form.pan.toUpperCase(), branchId: form.branchId ? Number(form.branchId) : null })
      });
      if (res.ok) {
        setShowForm(false);
        setEditingCustomer(null);
        setForm({ name: '', email: '', phone: '', address: '', aadhar: '', pan: '', branchId: '' });
        setErrors({});
        fetchCustomers();
      }
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const highlight = (text: string | number | undefined) => {
    const t = String(text ?? '');
    if (!search.trim()) return t;
    const i = t.toLowerCase().indexOf(search.toLowerCase());
    if (i === -1) return t;
    return (
      <span>
        {t.slice(0, i)}
        <mark style={{ background: '#fde047', padding: '0 2px', borderRadius: '2px' }}>{t.slice(i, i + search.length)}</mark>
        {t.slice(i + search.length)}
      </span>
    );
  };

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q);
  });

  const fields = [
    { key: 'name', label: 'Full Name *', placeholder: 'Ramesh Kumar' },
    { key: 'phone', label: 'Phone *', placeholder: '9876543210', maxLength: 10 },
    { key: 'email', label: 'Email', placeholder: 'email@example.com' },
    { key: 'aadhar', label: 'Aadhaar', placeholder: '123456789012', maxLength: 12 },
    { key: 'pan', label: 'PAN', placeholder: 'ABCDE1234F', maxLength: 10 },
    { key: 'address', label: 'Address', placeholder: 'City, State' },
  ];

  const inpStyle = (key: string) => ({
    width: '100%',
    padding: '8px 12px',
    border: `1px solid ${errors[key] ? '#ef4444' : '#d1d5db'}`,
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box' as any,
    outline: 'none'
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '240px', flex: 1, padding: '24px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Customers</h2>
            <p style={{ color: '#6b7280', margin: 0 }}>Manage all your customers</p>
          </div>
          {canCreate && (
            <button onClick={openAddForm}
              style={{ background: '#1e40af', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
              + Add Customer
            </button>
          )}
        </div>

        {showForm && (
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
            <h3 style={{ fontWeight: '700', marginBottom: '16px', fontSize: '16px' }}>
              {editingCustomer ? `✏️ Edit — ${editingCustomer.name}` : '➕ Add New Customer'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {fields.map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>{f.label}</label>
                  <input
                    value={form[f.key as keyof typeof form]}
                    maxLength={f.maxLength}
                    placeholder={f.placeholder}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    style={inpStyle(f.key)}
                  />
                  {errors[f.key] && <p style={{ color: '#ef4444', fontSize: '12px', margin: '4px 0 0' }}>{errors[f.key]}</p>}
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Branch</label>
                <select value={form.branchId} onChange={e => setForm({ ...form, branchId: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as CSSProperties['boxSizing'] }}>
                  <option value="">— No branch —</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={saveCustomer} disabled={saving}
                style={{ background: '#1e40af', color: 'white', border: 'none', padding: '9px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving...' : editingCustomer ? 'Save Changes' : 'Add Customer'}
              </button>
              <button onClick={() => { setShowForm(false); setErrors({}); }}
                style={{ background: 'white', color: '#374151', border: '1px solid #d1d5db', padding: '9px 24px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: '600', margin: 0 }}>All Customers ({filtered.length})</h3>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search by name, email, phone..."
              style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', width: '300px' }} />
          </div>

          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>Loading customers...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
              {search ? `No results for "${search}"` : 'No customers yet. Add your first one!'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                  {['Name', 'Email', 'Phone', 'Aadhaar', 'PAN', 'Loans', 'Status', 'Action'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 20px', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '600' }}>
                      <span
                        onClick={() => router.push(`/dashboard/customers/${c.id}`)}
                        style={{ color: '#1e40af', cursor: 'pointer' }}
                      >
                        {highlight(c.name)}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '13px', color: '#6b7280' }}>{c.email ? highlight(c.email) : '—'}</td>
                    <td style={{ padding: '14px 20px', fontSize: '13px' }}>
                      {c.phone?.replace(/\s/g, '').length > 10
                        ? <span style={{ color: '#dc2626' }}>{highlight(c.phone)} ⚠️</span>
                        : highlight(c.phone)}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '13px', color: '#6b7280' }}>
                      {c.aadhar ? `XXXX XXXX ${c.aadhar.slice(-4)}` : '—'}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '13px', color: '#6b7280' }}>{c.pan || '—'}</td>
                    <td style={{ padding: '14px 20px', fontSize: '13px' }}>{c.loans?.length || 0} loans</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ background: '#dcfce7', color: '#16a34a', padding: '2px 10px', borderRadius: '20px', fontSize: '12px' }}>Active</span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {canEdit ? (
                        <button onClick={() => openEditForm(c)}
                          style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: '5px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>
                          ✏️ Edit
                        </button>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '12px' }}>View only</span>
                      )}
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