'use client';
import CustomerSearchSelect from '../../../components/CustomerSearchSelect';
import { CSSProperties, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { AuthUser, getAuthUser, can } from '@/lib/authUser';
import { API_URL } from '@/lib/api';

type Customer = { id: number; name: string; phone?: string };

type Guarantor = {
  name: string;
  phone: string;
  aadhar: string;
  pan: string;
  relationship: string;
  type: string;
  dateOfBirth?: string;
  email?: string;
  address?: string;
  city?: string;
  pinCode?: string;
  employmentType?: string;
  employerName?: string;
  grossAnnualIncome?: string;
  bankName?: string;
  bankAccountNumber?: string;
  consentGiven?: boolean;
  details?: Record<string, unknown> | string;
};

type Loan = {
  id: number;
  customer?: { name: string } | null;
  type: string;
  amount: number;
  disbursedAmount: number;
  frequency: string;
  tenure: number;
  status: string;
};

type LoanForm = {
  customerId: string;
  type: string;
  amount: string;
  interestRate: string;
  interestType: string;
  frequency: string;
  tenure: string;
  deductUpfront: boolean;
  hasProcessingFee: boolean;
  processingFee: string;
  processingFeeType: string;
  penaltyType: string;
  penaltyValue: string;
  roundEmi: boolean;
};

type SummaryItem = {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
};

function Section({ title, icon, children, defaultOpen = false }: {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', marginBottom: '12px', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: open ? '#eff6ff' : '#f9fafb', border: 'none', cursor: 'pointer',
          fontSize: '14px', fontWeight: '600', color: '#1e40af', textAlign: 'left'
        }}
      >
        <span>{icon} {title}</span>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>{open ? '▲ collapse' : '▼ expand'}</span>
      </button>
      {open && <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>{children}</div>}
    </div>
  );
}

export default function LoansPage() {
  const router = useRouter();
  const [me, setMe] = useState<AuthUser | null>(null);
  useEffect(() => { setMe(getAuthUser()); }, []);
  const canCreateLoan = can(me, 'loan:create');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const emptyForm: LoanForm = {
    customerId: '', type: 'Personal Loan', amount: '',
    interestRate: '', interestType: 'percentage',
    frequency: 'monthly', tenure: '', deductUpfront: false,
    hasProcessingFee: false, processingFee: '', processingFeeType: 'percentage',
    penaltyType: 'none', penaltyValue: '', roundEmi: false
  };
  const [form, setForm] = useState<LoanForm>(emptyForm);
  const emptyGuarantor: Guarantor = {
  name: '', relationship: '', dateOfBirth: '', aadhar: '', pan: '',
  phone: '', email: '', address: '', city: '', pinCode: '',
  employmentType: '', employerName: '', grossAnnualIncome: '',
  bankName: '', bankAccountNumber: '', consentGiven: false, type: 'guarantor'
};
const [guarantors, setGuarantors] = useState<Guarantor[]>([{ ...emptyGuarantor }]);
  const [hasGuarantor, setHasGuarantor] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchLoans(); fetchCustomers(); }, []);

  const fetchLoans = async () => {
    try {
      const res = await fetch(`${API_URL}/api/loans`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      setLoans(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/customers`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  };

  const getPeriodsPerYear = () =>
    form.frequency === 'daily' ? 365 :
    form.frequency === 'weekly' ? 52 :
    form.frequency === 'yearly' ? 1 :
    12;

  const calcTotalInterest = () => {
    const p = Number(form.amount), r = Number(form.interestRate), t = Number(form.tenure);
    if (!p || !r || !t) return 0;
    const py = getPeriodsPerYear();
    if (form.interestType === 'flat') return Math.round(p * (r / 100) * (t / py));
    const pr = r / py / 100;
    const emi = pr === 0 ? p / t : (p * pr * Math.pow(1 + pr, t)) / (Math.pow(1 + pr, t) - 1);
    return Math.round(emi * t - p);
  };

  const calcProcessingFee = () => {
    if (!form.hasProcessingFee || !form.processingFee || !form.amount) return 0;
    return form.processingFeeType === 'percentage'
      ? Math.round(Number(form.amount) * Number(form.processingFee) / 100)
      : Math.round(Number(form.processingFee));
  };

  const calcDisbursed = () => {
    const p = Number(form.amount);
    const pf = calcProcessingFee();
    if (form.deductUpfront) return p - calcTotalInterest() - pf;
    return p - pf;
  };

  const calcEMI = () => {
    const p = Number(form.amount), r = Number(form.interestRate), t = Number(form.tenure);
    if (!p || !r || !t) return 0;
    const py = getPeriodsPerYear();
    if (form.interestType === 'flat') {
      const totalInterest = p * (r / 100) * (t / py);
      return form.deductUpfront ? Math.round(p / t) : Math.round((p + totalInterest) / t);
    }
    const pr = r / py / 100;
    if (form.deductUpfront) return Math.round(p / t);
    return pr === 0 ? Math.round(p / t) : Math.round((p * pr * Math.pow(1 + pr, t)) / (Math.pow(1 + pr, t) - 1));
  };

  const updateGuarantor = (idx: number, field: keyof Guarantor, value: string) => {
    const ng = [...guarantors];
    ng[idx] = { ...ng[idx], [field]: value };
    setGuarantors(ng);
  };

 const addLoan = async () => {
    setFormError('');
    if (!form.customerId) { setFormError('Please select a customer.'); return; }
    if (!form.amount || Number(form.amount) < 1000) { setFormError('Minimum loan amount is ₹1,000.'); return; }
    if (!form.interestRate) { setFormError('Please enter an interest rate.'); return; }
    if (!form.tenure) { setFormError('Please enter the number of installments.'); return; }
    const validGuarantors = hasGuarantor ? guarantors.filter(g => g.name.trim() && g.phone.trim()) : [];
    if (hasGuarantor && validGuarantors.length === 0) {
      setFormError('Add at least one guarantor (name + phone) or uncheck the guarantor option.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({
          customerId: Number(form.customerId), type: form.type,
          amount: Number(form.amount), interestRate: Number(form.interestRate),
          interestType: form.interestType, frequency: form.frequency,
          tenure: Number(form.tenure), deductUpfront: form.deductUpfront,
          processingFee: form.hasProcessingFee ? Number(form.processingFee) : 0,
          processingFeeType: form.processingFeeType,
          penaltyType: form.penaltyType,
          penaltyValue: Number(form.penaltyValue) || 0,
          guarantors: validGuarantors
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message || 'Could not create the loan. Please check the details and try again.');
        setSaving(false);
        return;
      }
      setShowForm(false);
      setForm(emptyForm);
      setGuarantors([{ name: '', phone: '', aadhar: '', pan: '', relationship: '', type: 'guarantor' }]);
      setHasGuarantor(false);
      fetchLoans();
    } catch (err) {
      console.error(err);
      setFormError('Server error. Please make sure you are logged in and try again.');
    }
    setSaving(false);
  };

  const fmt = (n: number) => '\u20B9' + Number(n || 0).toLocaleString('en-IN');
  const inp: CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' };
  const lbl: CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px', color: '#374151' };

  const p = Number(form.amount);
  const emi = calcEMI();
  const pf = calcProcessingFee();
  const disbursed = calcDisbursed();
  const showPreview = p > 0 && Number(form.interestRate) > 0 && Number(form.tenure) > 0;

  const previewItems: SummaryItem[] = [
    { label: 'Loan Amount', value: fmt(p) },
    { label: 'Processing Fee', value: pf > 0 ? `- ${fmt(pf)}` : 'None', color: pf > 0 ? '#dc2626' : '#16a34a' },
    { label: 'Interest Deducted', value: form.deductUpfront ? `- ${fmt(calcTotalInterest())}` : 'On EMI', color: form.deductUpfront ? '#dc2626' : '#6b7280' },
    { label: 'Customer Receives', value: fmt(Math.max(0, disbursed)), color: '#16a34a', bold: true },
    { label: 'EMI Amount', value: fmt(emi), bold: true },
    { label: 'Total Repayable', value: fmt(emi * Number(form.tenure)) },
    { label: 'Total Interest', value: fmt(calcTotalInterest()) },
    { label: 'Late Penalty', value: form.penaltyType === 'none' ? 'None' : form.penaltyType === 'fixed' ? `${form.penaltyValue} per EMI` : form.penaltyType === 'percentage' ? `${form.penaltyValue}% of EMI` : `${form.penaltyValue}/day` },
  ];

  const filteredLoans = loans.filter((l: Loan) => {
    const q = search.toLowerCase();
    return (l.customer?.name || '').toLowerCase().includes(q) ||
      (l.type || '').toLowerCase().includes(q) ||
      ('ln' + (1000 + l.id)).includes(q);
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Loans</h2>
            <p style={{ color: '#6b7280', margin: 0 }}>Manage all loans and EMI schedules</p>
          </div>
          {canCreateLoan && (
            <button onClick={() => setShowForm(!showForm)} style={{ background: '#1e40af', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
              + New Loan
            </button>
          )}
        </div>

        {showForm && (
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
            <h3 style={{ fontWeight: '700', marginBottom: '20px', fontSize: '16px' }}>Create New Loan</h3>

            <div style={{ display: 'grid', gap: '12px' }}>
              <Section title="Basic Loan Details" icon="📄" defaultOpen>
                <div>
                  <label style={lbl}>Customer</label>
                  <CustomerSearchSelect
                    customers={customers}
                    value={form.customerId}
                    onChange={(customerId: string) => setForm({ ...form, customerId })}
                    style={inp}
                  />
                </div>

                <div>
                  <label style={lbl}>Loan Type</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inp}>
                  <optgroup label="Consumer & Personal Loans">
                    <option>Personal Loan</option>
                    <option>Mortgage Loan</option>
                    <option>Payday Loan</option>
                  </optgroup>
                  <optgroup label="Asset & Equity Loans">
                    <option>Home Equity Loan</option>
                    <option>Gold Loan</option>
                    <option>Loan Against Property</option>
                  </optgroup>
                  <optgroup label="Business & Commercial Loans">
                    <option>Working Capital Loan</option>
                    <option>Term Loan</option>
                    <option>Equipment Financing</option>
                    <option>Invoice Discounting</option>
                  </optgroup>
                  <optgroup label="Other Loans">
                    <option>Business Loan</option>
                    <option>Microfinance Loan</option>
                    <option>Agricultural Loan</option>
                    <option>Vehicle Loan</option>
                  </optgroup>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={lbl}>Loan Amount</label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    placeholder="100000"
                    style={{ width: '140px', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', fontWeight: '700', textAlign: 'right' as CSSProperties['textAlign'] }}
                  />
                </div>
                <input
                  type="range" min={1000} max={10000000} step={1000}
                  value={form.amount || 1000}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  style={{ width: '100%', accentColor: '#1e40af' }}
                />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af' }}>
                    <span>₹1K</span><span>₹1Cr</span>
                  </div>
                </div>

                <div>
                  <label style={lbl}>Interest Type</label>
                  <select value={form.interestType} onChange={e => setForm({ ...form, interestType: e.target.value })} style={inp}>
                  <option value="percentage">Reducing Balance</option>
                  <option value="flat">Flat Rate</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={lbl}>Interest Rate (% p.a.)</label>
                  <input
                    type="number" step="0.1"
                    value={form.interestRate}
                    onChange={e => setForm({ ...form, interestRate: e.target.value })}
                    placeholder="12"
                    style={{ width: '140px', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', fontWeight: '700', textAlign: 'right' as CSSProperties['textAlign'] }}
                  />
                </div>
                <input
                  type="range" min={0} max={30} step={0.1}
                  value={form.interestRate || 0}
                  onChange={e => setForm({ ...form, interestRate: e.target.value })}
                  style={{ width: '100%', accentColor: '#1e40af' }}
                />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af' }}>
                    <span>0%</span><span>30%</span>
                  </div>
                </div>

                <div>
                  <label style={lbl}>Repayment Frequency</label>
                  <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} style={inp}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={lbl}>
                    Tenure ({form.frequency === 'daily' ? 'days' : form.frequency === 'weekly' ? 'weeks' : form.frequency === 'yearly' ? 'years' : 'months'})
                  </label>
                  <input
                    type="number"
                    value={form.tenure}
                    onChange={e => setForm({ ...form, tenure: e.target.value })}
                    placeholder="12"
                    style={{ width: '140px', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', fontWeight: '700', textAlign: 'right' as CSSProperties['textAlign'] }}
                  />
                </div>
                <input
                  type="range" min={1} max={form.frequency === 'daily' ? 365 : form.frequency === 'weekly' ? 104 : form.frequency === 'yearly' ? 30 : 240} step={1}
                  value={form.tenure || 1}
                  onChange={e => setForm({ ...form, tenure: e.target.value })}
                  style={{ width: '100%', accentColor: '#1e40af' }}
                />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af' }}>
                    <span>1</span>
                    <span>{form.frequency === 'daily' ? 365 : form.frequency === 'weekly' ? 104 : form.frequency === 'yearly' ? 30 : 240}</span>
                  </div>
                </div>
              </Section>

              <Section title="Fees & Charges" icon="🧾">
                <div>
                  <label style={lbl}>Penalty for Late Payment</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select value={form.penaltyType} onChange={e => setForm({ ...form, penaltyType: e.target.value, penaltyValue: '' })} style={{ ...inp, flex: 1 }}>
                    <option value="none">No Penalty</option>
                    <option value="fixed">Fixed Amount per EMI</option>
                    <option value="percentage">% of EMI Amount</option>
                    <option value="daily">Per Day</option>
                  </select>
                  {form.penaltyType !== 'none' && (
                    <input type="number" value={form.penaltyValue} onChange={e => setForm({ ...form, penaltyValue: e.target.value })}
                      placeholder={form.penaltyType === 'percentage' ? '2' : '50'}
                      style={{ ...inp, width: '100px' }} />
                  )}
                </div>
              </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <input type="checkbox" checked={form.deductUpfront} onChange={e => setForm({ ...form, deductUpfront: e.target.checked })} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                    <div>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>Deduct Interest Upfront</p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Interest deducted first</p>
                    </div>
                  </label>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <input type="checkbox" checked={form.roundEmi} onChange={e => setForm({ ...form, roundEmi: e.target.checked })} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                    <div>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>Round EMI to clean ₹ amount</p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>e.g. ₹8,333 instead of ₹8,333.33 — last EMI adjusts</p>
                    </div>
                  </label>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '8px' }}>
                    <input type="checkbox" checked={form.hasProcessingFee} onChange={e => setForm({ ...form, hasProcessingFee: e.target.checked, processingFee: '' })} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                    <span style={{ fontSize: '14px', fontWeight: '600' }}>Add Processing Fee</span>
                  </label>
                  {form.hasProcessingFee && (
                    <div style={{ display: 'flex', gap: '8px', paddingLeft: '26px' }}>
                      <select value={form.processingFeeType} onChange={e => setForm({ ...form, processingFeeType: e.target.value })} style={{ ...inp, width: '200px' }}>
                        <option value="percentage">Percentage of loan</option>
                        <option value="flat">Flat Amount</option>
                      </select>
                      <input type="number" value={form.processingFee} onChange={e => setForm({ ...form, processingFee: e.target.value })}
                        placeholder="amount"
                        style={{ ...inp, flex: 1 }} />
                    </div>
                  )}
                </div>
              </Section>

              {<Section title="Guarantor / Co-signer" icon="🤝">
  <div style={{ gridColumn: '1 / -1' }}>
    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: hasGuarantor ? '16px' : '0' }}>
      <input type="checkbox" checked={hasGuarantor} onChange={e => setHasGuarantor(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
      <span style={{ fontSize: '14px', fontWeight: '600' }}>This loan has a guarantor / co-signer</span>
    </label>
  </div>

  {hasGuarantor && (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e40af' }}>APPLICATION FOR FINANCIAL SERVICES (WITH GUARANTOR)</span>
        <button type="button" onClick={() => setGuarantors([...guarantors, { ...emptyGuarantor }])}
          style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>
          + Add Guarantor
        </button>
      </div>

      {guarantors.map((g, idx) => (
        <div key={idx} style={{ background: '#f9fafb', padding: '16px', borderRadius: '10px', border: '1px solid #e5e7eb', marginBottom: '16px' }}>

          {/*  Header  */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e40af' }}>GUARANTOR {idx + 1}</span>
            {guarantors.length > 1 && (
              <button type="button" onClick={() => setGuarantors(guarantors.filter((_, i) => i !== idx))}
                style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                Remove
              </button>
            )}
          </div>

          {/*  A. Personal & Identity  */}
          <div style={{ marginBottom: '14px' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>A. Personal & Identity Details</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={lbl}>Full Legal Name <span style={{ color: '#ef4444' }}> </span></label>
                <input placeholder="Full name as per ID" value={g.name} onChange={e => updateGuarantor(idx, 'name', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Relationship to Applicant <span style={{ color: '#ef4444' }}> </span></label>
                <select value={g.relationship} onChange={e => updateGuarantor(idx, 'relationship', e.target.value)} style={inp}>
                  <option value="">— Select —</option>
                  <option value="Parent">Parent</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Business Partner">Business Partner</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Date of Birth <span style={{ color: '#ef4444' }}> </span></label>
                <input type="date" value={g.dateOfBirth} onChange={e => updateGuarantor(idx, 'dateOfBirth', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>PAN Number <span style={{ color: '#ef4444' }}> </span></label>
                <input placeholder="ABCDE1234F" maxLength={10} value={g.pan} onChange={e => updateGuarantor(idx, 'pan', e.target.value.toUpperCase())} style={inp} />
              </div>
              <div>
                <label style={lbl}>Aadhaar Number <span style={{ color: '#ef4444' }}> </span></label>
                <input placeholder="1234 5678 9012" maxLength={12} value={g.aadhar} onChange={e => updateGuarantor(idx, 'aadhar', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Type</label>
                <select value={g.type} onChange={e => updateGuarantor(idx, 'type', e.target.value)} style={inp}>
                  <option value="guarantor">Guarantor</option>
                  <option value="co-signer">Co-signer</option>
                  <option value="nominee">Nominee</option>
                </select>
              </div>
            </div>
          </div>

          {/*  B. Contact & Residential  */}
          <div style={{ marginBottom: '14px' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>B. Contact & Residential Details</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={lbl}>Mobile Number <span style={{ color: '#ef4444' }}> </span></label>
                <input placeholder="+91 XXXXXXXXXX" maxLength={10} value={g.phone} onChange={e => updateGuarantor(idx, 'phone', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Email Address</label>
                <input placeholder="email@example.com" type="email" value={g.email} onChange={e => updateGuarantor(idx, 'email', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Residential Address <span style={{ color: '#ef4444' }}> </span></label>
                <input placeholder="House No, Street, Area" value={g.address} onChange={e => updateGuarantor(idx, 'address', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>City / Town <span style={{ color: '#ef4444' }}> </span></label>
                <input placeholder="City" value={g.city} onChange={e => updateGuarantor(idx, 'city', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>PIN Code <span style={{ color: '#ef4444' }}> </span></label>
                <input placeholder="500001" maxLength={6} value={g.pinCode} onChange={e => updateGuarantor(idx, 'pinCode', e.target.value)} style={inp} />
              </div>
            </div>
          </div>

          {/*  C. Employment & Financial  */}
          <div style={{ marginBottom: '14px' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>C. Employment & Financial Profile</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={lbl}>Employment Type <span style={{ color: '#ef4444' }}> </span></label>
                <select value={g.employmentType} onChange={e => updateGuarantor(idx, 'employmentType', e.target.value)} style={inp}>
                  <option value="">— Select —</option>
                  <option value="Salaried">Salaried</option>
                  <option value="Self-Employed Professional">Self-Employed Professional</option>
                  <option value="Business Owner">Business Owner</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Employer / Company Name <span style={{ color: '#ef4444' }}> </span></label>
                <input placeholder="Company name" value={g.employerName} onChange={e => updateGuarantor(idx, 'employerName', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Gross Annual Income (₹) <span style={{ color: '#ef4444' }}> </span></label>
                <input placeholder="500000" type="number" value={g.grossAnnualIncome} onChange={e => updateGuarantor(idx, 'grossAnnualIncome', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Primary Bank Name <span style={{ color: '#ef4444' }}> </span></label>
                <input placeholder="HDFC Bank" value={g.bankName} onChange={e => updateGuarantor(idx, 'bankName', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Account Number <span style={{ color: '#ef4444' }}> </span></label>
                <input placeholder="Account number" value={g.bankAccountNumber} onChange={e => updateGuarantor(idx, 'bankAccountNumber', e.target.value)} style={inp} />
              </div>
            </div>
          </div>

          {/*  Legal Consent  */}
          <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', color: '#92400e', margin: '0 0 8px', textTransform: 'uppercase' }}>Guarantor Declaration & Binding Clause</p>
            <p style={{ fontSize: '12px', color: '#374151', margin: '0 0 10px', lineHeight: '1.6', fontStyle: 'italic' }}>
              "I hereby confirm my willingness to act as a guarantor for this application. I explicitly authorize the finance company to pull my credit history report (CIBIL/Experian). I accept full joint and several liability for the timely repayment of the total financial obligation if the primary applicant defaults."
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={g.consentGiven} onChange={e => updateGuarantor(idx, 'consentGiven', e.target.checked as any)}
                style={{ width: '15px', height: '15px' }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>
                Guarantor has read and agreed to the above declaration
              </span>
            </label>
          </div>

        </div>
      ))}
    </div>
  )}
</Section>
            }            </div>

            {showPreview && (
              <div style={{ marginTop: '20px', padding: '16px', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd' }}>
                <p style={{ fontWeight: '700', margin: '0 0 12px', fontSize: '14px', color: '#0369a1' }}>Loan Summary Preview</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {previewItems.map(item => (
                    <div key={item.label} style={{ background: 'white', padding: '10px 12px', borderRadius: '8px' }}>
                      <p style={{ color: '#6b7280', fontSize: '11px', margin: '0 0 4px' }}>{item.label}</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: item.bold ? '700' : '600', color: item.color || '#111827' }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {formError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginTop: '16px' }}>
                ⚠️ {formError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button onClick={addLoan} disabled={saving} style={{ background: '#1e40af', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Creating...' : 'Create Loan'}
              </button>
              <button onClick={() => setShowForm(false)} style={{ background: 'white', color: '#374151', border: '1px solid #d1d5db', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: '600', margin: 0 }}>All Loans ({filteredLoans.length})</h3>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, type, ID..." style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', width: '280px' }} />
          </div>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                  {['Loan ID', 'Customer', 'Type', 'Amount', 'Disbursed', 'Frequency', 'Tenure', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLoans.map((l: Loan) => (
                  <tr key={l.id} onClick={() => router.push(`/dashboard/loans/${l.id}`)}
                    style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1e40af', fontWeight: '600' }}>LN{1000 + l.id}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{l.customer?.name}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>{l.type}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{fmt(l.amount)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: (l.disbursedAmount ?? l.amount) < l.amount ? '#dc2626' : '#16a34a' }}>
                      {fmt(l.disbursedAmount ?? l.amount)}
                      {(l.disbursedAmount ?? l.amount) < l.amount && <span style={{ fontSize: '10px', display: 'block', color: '#6b7280' }}>after deductions</span>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', textTransform: 'capitalize' }}>{l.frequency || 'monthly'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>{l.tenure} {l.frequency === 'daily' ? 'days' : l.frequency === 'weekly' ? 'wks' : 'mo'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        background: l.status === 'completed' ? '#eff6ff' : l.status === 'active' ? '#dcfce7' : '#f3f4f6',
                        color: l.status === 'completed' ? '#1e40af' : l.status === 'active' ? '#16a34a' : '#6b7280',
                        padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600'
                      }}>
                        {l.status === 'completed' ? 'Completed' : l.status}
                      </span>
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