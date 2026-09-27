'use client';
import { CSSProperties, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { getAuthUser, can, type AuthUser } from '@/lib/authUser';
import { API_URL } from '@/lib/api';

type Customer = {
  id: number;
  name: string; email?: string; phone: string; address?: string;
  aadhar?: string; pan?: string; branchId?: number | null;
  loans?: Array<{ id: number; amount: number; status: string }>;
  firstName?: string; middleName?: string; lastName?: string;
  dateOfBirth?: string; gender?: string; maritalStatus?: string; nationality?: string;
  altIdType?: string; altIdNumber?: string;
  alternateMobile?: string; street?: string; city?: string; state?: string;
  pinCode?: string; residenceType?: string; permanentAddress?: string;
  employmentType?: string; employerName?: string; designation?: string;
  workEmail?: string; monthlyIncome?: number; bankName?: string; bankAccountNumber?: string;
  isPEP?: boolean; isForeignTaxResident?: boolean;
  nomineeName?: string; nomineeRelation?: string;
  consentGiven?: boolean; consentPlace?: string;
};

type Branch = { id: number; name: string };

const emptyForm = {
  // core
  name: '', email: '', phone: '', address: '', aadhar: '', pan: '', branchId: '',
  // section 1
  firstName: '', middleName: '', lastName: '',
  dateOfBirth: '', gender: '', maritalStatus: '', nationality: 'Indian',
  // section 2
  altIdType: '', altIdNumber: '',
  // section 3
  alternateMobile: '', street: '', city: '', state: '', pinCode: '',
  residenceType: '', permanentAddress: '',
  // section 4
  employmentType: '', employerName: '', designation: '', workEmail: '',
  monthlyIncome: '', bankName: '', bankAccountNumber: '',
  // section 5
  isPEP: false, isForeignTaxResident: false, nomineeName: '', nomineeRelation: '',
  // section 6
  consentGiven: false, consentPlace: '',
};

type FormState = typeof emptyForm;

// ── Collapsible section wrapper ─────────────────────────────────────────────
function Section({ title, icon, children, defaultOpen = false }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', marginBottom: '12px', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: open ? '#eff6ff' : '#f9fafb',
          border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: '#1e40af',
        }}
      >
        <span>{icon} {title}</span>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>{open ? '▲ collapse' : '▼ expand'}</span>
      </button>
      {open && (
        <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string;
  error?: string;
  placeholder?: string;
  maxLength?: number;
  type?: string;
  required?: boolean;
  onChange: (value: string) => void;
};

const fieldInputStyle = (error?: string): CSSProperties => ({
  width: '100%', padding: '8px 12px',
  border: `1px solid ${error ? '#ef4444' : '#d1d5db'}`,
  borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none'
});

const fieldLabelStyle: CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px', color: '#374151'
};

const fieldErrorStyle: CSSProperties = { color: '#ef4444', fontSize: '12px', margin: '4px 0 0' };

function FormField({ label, value, error, placeholder, maxLength, type = 'text', required, onChange }: FieldProps) {
  return (
    <div>
      <label style={fieldLabelStyle}>{label}{required && <span style={{ color: '#ef4444' }}>  </span>}</label>
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={fieldInputStyle(error)}
      />
      {error && <p style={fieldErrorStyle}>{error}</p>}
    </div>
  );
}

function SelectField({ label, value, error, options, required, onChange }: {
  label: string;
  value: string;
  error?: string;
  options: { value: string; label: string }[];
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label style={fieldLabelStyle}>{label}{required && <span style={{ color: '#ef4444' }}>  </span>}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...fieldInputStyle(error), background: 'white' }}>
        <option value="">— Select —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p style={fieldErrorStyle}>{error}</p>}
    </div>
  );
}

function CheckboxField({ label, value, description, error, onChange }: {
  label: string;
  value: boolean;
  description?: string;
  error?: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={value}
          onChange={e => onChange(e.target.checked)}
          style={{ marginTop: '2px', width: '16px', height: '16px' }}
        />
        <div>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#111827' }}>{label}</p>
          {description && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>{description}</p>}
        </div>
      </label>
      {error && <p style={{ ...fieldErrorStyle, marginLeft: '26px' }}>{error}</p>}
    </div>
  );
}

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [me, setMe] = useState<AuthUser | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setMe(getAuthUser()); }, []);
  const canCreate = can(me, 'customer:create');
  const canEdit = can(me, 'customer:edit');

  useEffect(() => { fetchCustomers(); fetchBranches(); }, []);

  const fetchBranches = async () => {
    try {
      const res = await fetch(`${API_URL}/api/branches`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      setBranches(Array.isArray(data) ? data : []);
    } catch (error) { console.error(error); }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/customers`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (error) { console.error(error); setCustomers([]); }
    setLoading(false);
  };

  const set = (field: keyof FormState, value: FormState[keyof FormState]) => setForm(f => ({ ...f, [field]: value }));
  const fieldProps = (field: keyof FormState) => ({
    value: String(form[field] ?? ''),
    error: errors[field],
    onChange: (value: string) => set(field, value),
  });
  const checkboxProps = (field: keyof FormState) => ({
    value: Boolean(form[field]),
    error: errors[field],
    onChange: (value: boolean) => set(field, value),
  });
  const inp = (key?: string): CSSProperties => fieldInputStyle(key && errors[key]);
  const lbl = fieldLabelStyle;
  const errTxt = fieldErrorStyle;
  const sel = (key?: string): CSSProperties => ({ ...inp(key), background: 'white' });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required';
    if (!form.lastName.trim()) e.lastName = 'Last name is required';
    if (!form.phone) e.phone = 'Phone is required';
    else if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\s/g, ''))) e.phone = 'Must be 10 digits starting with 6-9';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (form.aadhar && !/^\d{12}$/.test(form.aadhar.replace(/\s/g, ''))) e.aadhar = 'Must be 12 digits';
    if (form.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.pan.toUpperCase())) e.pan = 'Format: ABCDE1234F';
    if (!form.consentGiven) e.consentGiven = 'Customer consent is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openAddForm = () => {
    setEditingCustomer(null);
    setForm(emptyForm);
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
      firstName: customer.firstName || '',
      middleName: customer.middleName || '',
      lastName: customer.lastName || '',
      dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.slice(0, 10) : '',
      gender: customer.gender || '',
      maritalStatus: customer.maritalStatus || '',
      nationality: customer.nationality || 'Indian',
      altIdType: customer.altIdType || '',
      altIdNumber: customer.altIdNumber || '',
      alternateMobile: customer.alternateMobile || '',
      street: customer.street || '',
      city: customer.city || '',
      state: customer.state || '',
      pinCode: customer.pinCode || '',
      residenceType: customer.residenceType || '',
      permanentAddress: customer.permanentAddress || '',
      employmentType: customer.employmentType || '',
      employerName: customer.employerName || '',
      designation: customer.designation || '',
      workEmail: customer.workEmail || '',
      monthlyIncome: customer.monthlyIncome ? String(customer.monthlyIncome) : '',
      bankName: customer.bankName || '',
      bankAccountNumber: customer.bankAccountNumber || '',
      isPEP: customer.isPEP || false,
      isForeignTaxResident: customer.isForeignTaxResident || false,
      nomineeName: customer.nomineeName || '',
      nomineeRelation: customer.nomineeRelation || '',
      consentGiven: customer.consentGiven || false,
      consentPlace: customer.consentPlace || '',
    });
    setErrors({});
    setShowForm(true);
  };

  const saveCustomer = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const fullName = [form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ');
      const payload = {
        ...form,
        name: fullName || form.name,
        pan: form.pan.toUpperCase(),
        branchId: form.branchId ? Number(form.branchId) : null,
        monthlyIncome: form.monthlyIncome ? Number(form.monthlyIncome) : null,
      };
      const url = editingCustomer
        ? `${API_URL}/api/customers/${editingCustomer.id}`
        : `${API_URL}/api/customers`;
      const res = await fetch(url, {
        method: editingCustomer ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowForm(false);
        setEditingCustomer(null);
        setForm(emptyForm);
        setErrors({});
        fetchCustomers();
      }
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q);
  });

  const highlight = (text: string | undefined) => {
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '24px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Customers</h2>
            <p style={{ color: '#6b7280', margin: 0 }}>Manage all your customers</p>
          </div>
          {canCreate && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Link href="/dashboard/customers/import"
                style={{ background: 'white', color: '#1e40af', border: '1px solid #1e40af', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', textDecoration: 'none' }}>
                ⬆ Bulk Import
              </Link>
              <button onClick={openAddForm}
                style={{ background: '#1e40af', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                + Add Customer
              </button>
            </div>
          )}
        </div>

        {/* ── Form ────────────────────────────────────────────────────────  */}
        {showForm && (
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
            <h3 style={{ fontWeight: '700', marginBottom: '16px', fontSize: '16px' }}>
              {editingCustomer ? `✏️ Edit — ${editingCustomer.name}` : '➕ Add New Customer'}
            </h3>

            {/* Section 1 — Personal Info (always visible)  */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', marginBottom: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#eff6ff', fontSize: '14px', fontWeight: '600', color: '#1e40af' }}>
                👤 Personal Information <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '400' }}>(mandatory)</span>
              </div>
              <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <FormField {...fieldProps('firstName')} label="First Name" placeholder="John" required />
                <FormField {...fieldProps('lastName')} label="Last Name" placeholder="Doe" required />
                <FormField {...fieldProps('middleName')} label="Middle Name" placeholder="(optional)" />
                <FormField {...fieldProps('phone')} label="Phone" placeholder="9876543210" maxLength={10} required />
                <FormField {...fieldProps('email')} label="Email" placeholder="email@example.com" />
                <FormField {...fieldProps('dateOfBirth')} label="Date of Birth" type="date" required />
                <SelectField {...fieldProps('gender')} label="Gender" required options={[
                  { value: 'Male', label: 'Male' },
                  { value: 'Female', label: 'Female' },
                  { value: 'Other', label: 'Other' },
                ]} />
                <SelectField {...fieldProps('maritalStatus')} label="Marital Status" options={[
                  { value: 'Single', label: 'Single' },
                  { value: 'Married', label: 'Married' },
                  { value: 'Divorced', label: 'Divorced' },
                  { value: 'Widowed', label: 'Widowed' },
                  { value: 'Prefer not to say', label: 'Prefer not to say' },
                ]} />
                <FormField {...fieldProps('nationality')} label="Nationality" placeholder="Indian" />
                <div>
                  <label style={lbl}>Branch</label>
                  <select value={form.branchId} onChange={e => set('branchId', e.target.value)} style={sel()}>
                    <option value="">— No branch —</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/*  Section 2 — KYC  */}
            <Section title="Identity & KYC Documents" icon="🪪" defaultOpen>
              <FormField {...fieldProps('aadhar')} label="Aadhaar Number" placeholder="123456789012" maxLength={12} required />
              <FormField {...fieldProps('pan')} label="PAN Number" placeholder="ABCDE1234F" maxLength={10} required />
              <SelectField {...fieldProps('altIdType')} label="Alternative ID Type" options={[
                { value: 'Passport', label: 'Passport' },
                { value: "Driver's License", label: "Driver's License" },
                { value: 'Voter ID', label: 'Voter ID' },
              ]} />
              <FormField {...fieldProps('altIdNumber')} label="Alternative ID Number" placeholder="ID number" />
            </Section>

            {/*  Section 3 — Contact & Address  */}
            <Section title="Contact & Residential Details" icon="🏠">
              <FormField {...fieldProps('alternateMobile')} label="Alternate Mobile" placeholder="9876543210" maxLength={10} />
              <FormField {...fieldProps('street')} label="Street / House No." placeholder="Flat 402, Green Apartments" />
              <FormField {...fieldProps('city')} label="City / Town" placeholder="Mumbai" required />
              <FormField {...fieldProps('state')} label="State" placeholder="Maharashtra" required />
              <FormField {...fieldProps('pinCode')} label="PIN Code" placeholder="400001" maxLength={6} required />
              <SelectField {...fieldProps('residenceType')} label="Residence Type" options={[
                { value: 'Self-Owned', label: 'Self-Owned' },
                { value: 'Rented', label: 'Rented' },
                { value: 'Parental/Family', label: 'Parental / Family' },
                { value: 'Company Provided', label: 'Company Provided' },
              ]} />
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Permanent Address <span style={{ color: '#9ca3af', fontWeight: '400' }}>(leave blank if same as current)</span></label>
                <input value={form.permanentAddress} onChange={e => set('permanentAddress', e.target.value)} placeholder="Only if different from current address" style={inp()} />
              </div>
            </Section>

            {/*  Section 4 — Employment & Financial  */}
            <Section title="Employment & Financial Profile" icon="💼">
              <SelectField {...fieldProps('employmentType')} label="Employment Type" required options={[
                { value: 'Salaried', label: 'Salaried' },
                { value: 'Self-Employed Professional', label: 'Self-Employed Professional' },
                { value: 'Business Owner', label: 'Business Owner' },
                { value: 'Unemployed', label: 'Unemployed' },
              ]} />
              <FormField {...fieldProps('employerName')} label="Employer / Business Name" placeholder="Tech Solutions Pvt Ltd" />
              <FormField {...fieldProps('designation')} label="Designation / Job Title" placeholder="Software Engineer" />
              <FormField {...fieldProps('workEmail')} label="Work Email" placeholder="name@company.com" type="email" />
              <FormField {...fieldProps('monthlyIncome')} label="Gross Monthly Income (₹)" placeholder="85000" type="number" required />
              <FormField {...fieldProps('bankName')} label="Primary Bank Name" placeholder="HDFC Bank" required />
              <FormField {...fieldProps('bankAccountNumber')} label="Bank Account Number" placeholder="Account number" required />
            </Section>

            {/*  Section 5 — Declarations & Nominee  */}
            <Section title="Declarations & Nominee" icon="📋">
              <CheckboxField
                {...checkboxProps('isPEP')}
                label="Politically Exposed Person (PEP)"
                description="Check if the customer is or has been a senior government official, politician, or their family member"
              />
              <CheckboxField
                {...checkboxProps('isForeignTaxResident')}
                label="Foreign Tax Resident"
                description="Check if the customer is a tax resident of any country other than India"
              />
              <FormField {...fieldProps('nomineeName')} label="Nominee Name" placeholder="(optional — can be added later)" />
              <FormField {...fieldProps('nomineeRelation')} label="Relationship with Nominee" placeholder="e.g. Spouse, Child" />
            </Section>

            {/*  Section 6 — Legal Consent  */}
            <div style={{ border: `1px solid ${errors.consentGiven ? '#ef4444' : '#e5e7eb'}`, borderRadius: '10px', marginBottom: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#fefce8', fontSize: '14px', fontWeight: '600', color: '#92400e' }}>
                ✍️ Legal Consent <span style={{ color: '#ef4444' }}> </span>
              </div>
              <div style={{ padding: '16px' }}>
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', marginBottom: '14px', fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>
                  &quot;I hereby declare that all the information provided above is true and complete. I explicitly authorize the finance company to verify my identity via e-KYC and pull my credit history report from authorized credit bureaus (CIBIL/Experian) to process this application.&quot;
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.consentGiven}
                        onChange={e => set('consentGiven', e.target.checked)}
                        style={{ marginTop: '2px', width: '16px', height: '16px' }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                        Customer has read and agreed to the above declaration
                      </span>
                    </label>
                    {errors.consentGiven && <p style={{ ...errTxt, marginLeft: '26px' }}>{errors.consentGiven}</p>}
                  </div>
                  <div>
                    <label style={lbl}>Place of Signing</label>
                    <input value={form.consentPlace} onChange={e => set('consentPlace', e.target.value)} placeholder="e.g. Hyderabad" style={inp()} />
                  </div>
                  <div>
                    <label style={lbl}>Date of Consent</label>
                    <input type="text" value={new Date().toLocaleDateString('en-IN')} disabled style={{ ...inp(), background: '#f3f4f6', color: '#6b7280' }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button onClick={saveCustomer} disabled={saving}
                style={{ background: '#1e40af', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving...' : editingCustomer ? 'Save Changes' : 'Add Customer'}
              </button>
              <button onClick={() => { setShowForm(false); setErrors({}); }}
                style={{ background: 'white', color: '#374151', border: '1px solid #d1d5db', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/*  ── Table ───────────────────────────────────────────────────────  */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: '600', margin: 0 }}>All Customers ({filtered.length})</h3>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search by name, email, phone..."
              style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', width: '300px' }} />
          </div>

          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#6b7280' }}>Loading customers...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#6b7280' }}>
              {search ? `No results for "${search}"` : 'No customers yet. Add your first one!'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                  {['Name', 'Phone', 'City', 'Employment', 'Aadhaar', 'PAN', 'Consent', 'Loans', 'Action'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '600' }}>
                      <span onClick={() => router.push(`/dashboard/customers/${c.id}`)} style={{ color: '#1e40af', cursor: 'pointer' }}>
                        {highlight(c.name)}
                      </span>
                      {c.dateOfBirth && (
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                          DOB: {new Date(c.dateOfBirth).toLocaleDateString('en-IN')}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                      {highlight(c.phone)}
                      {c.alternateMobile && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{c.alternateMobile}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>
                      {c.city || '—'}
                      {c.state && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{c.state}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280' }}>
                      {c.employmentType || '—'}
                      {c.monthlyIncome && <div style={{ fontSize: '11px', color: '#9ca3af' }}>₹{c.monthlyIncome.toLocaleString('en-IN')}/mo</div>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>
                      {c.aadhar ? `XXXX XXXX ${c.aadhar.slice(-4)}` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{c.pan || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        background: c.consentGiven ? '#dcfce7' : '#fef2f2',
                        color: c.consentGiven ? '#16a34a' : '#dc2626',
                        padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600'
                      }}>
                        {c.consentGiven ? '✓ Given' : '✗ Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>{c.loans?.length || 0}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {canEdit ? (
                        <button onClick={() => openEditForm(c)}
                          style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>
                          ✏️ Edit
                        </button>
                      ) : <span style={{ color: '#9ca3af', fontSize: '12px' }}>View only</span>}
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
