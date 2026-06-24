'use client';
import CustomerSearchSelect from '../../../components/CustomerSearchSelect';
import { CSSProperties, useState, useEffect } from 'react';
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

export default function LoansPage() {
  const [me, setMe] = useState<AuthUser | null>(null);
  useEffect(() => { setMe(getAuthUser()); }, []);
  const canCreateLoan = can(me, 'loan:create');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<LoanForm>({
    customerId: '', type: 'Personal Loan', amount: '',
    interestRate: '', interestType: 'percentage',
    frequency: 'monthly', tenure: '', deductUpfront: false,
    hasProcessingFee: false, processingFee: '', processingFeeType: 'percentage',
    penaltyType: 'none', penaltyValue: '', roundEmi: false
  });
  const [guarantors, setGuarantors] = useState<Guarantor[]>([
    { name: '', phone: '', aadhar: '', pan: '', relationship: '', type: 'guarantor' }
  ]);
  const [hasGuarantor, setHasGuarantor] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchLoans(); fetchCustomers(); }, []);

  const fetchLoans = async () => {
    try {
      const res = await fetch(`${API_URL}/api/loans`, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
      const data = await res.json();
      setLoans(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/customers`, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  };

  const getPeriodsPerYear = () => form.frequency === 'daily' ? 365 : form.frequency === 'weekly' ? 52 : 12;

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
    if (hasGuarantor && validGuarantors.length === 0) { setFormError('Add at least one guarantor (name + phone) or uncheck the guarantor option.'); return; }

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
      setForm({
        customerId: '', type: 'Personal Loan', amount: '',
        interestRate: '', interestType: 'percentage',
        frequency: 'monthly', tenure: '', deductUpfront: false,
        hasProcessingFee: false, processingFee: '', processingFeeType: 'percentage',
        penaltyType: 'none', penaltyValue: '',roundEmi: false
      });
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
      <div style={{ marginLeft: '240px', flex: 1, padding: '24px' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                  <option>Personal Loan</option>
                  <option>Business Loan</option>
                  <option>Gold Loan</option>
                  <option>Vehicle Loan</option>
                  <option>Microfinance Loan</option>
                  <option>Agricultural Loan</option>
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
                    style={{ width: '140px', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', fontWeight: '700', textAlign: 'right' as any }}
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
                    style={{ width: '140px', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', fontWeight: '700', textAlign: 'right' as any }}
                  />
                </div>
                <input
                  type="range" min={5} max={30} step={0.1}
                  value={form.interestRate || 5}
                  onChange={e => setForm({ ...form, interestRate: e.target.value })}
                  style={{ width: '100%', accentColor: '#1e40af' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af' }}>
                  <span>5%</span><span>30%</span>
                </div>
              </div>

              <div>
                <label style={lbl}>Repayment Frequency</label>
                <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} style={inp}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label style={lbl}>
                  Number of Installments ({form.frequency === 'daily' ? 'days' : form.frequency === 'weekly' ? 'weeks' : 'months'})
                </label>
                <input type="number" value={form.tenure} onChange={e => setForm({ ...form, tenure: e.target.value })} placeholder="12" style={inp} />
              </div>

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

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: hasGuarantor ? '12px' : '0' }}>
                  <input type="checkbox" checked={hasGuarantor} onChange={e => setHasGuarantor(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>This loan has a guarantor / co-signer</span>
                </label>
              </div>

              {hasGuarantor && (
                <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600' }}>Guarantors (at least one required)</span>
                    <button type="button" onClick={() => setGuarantors([...guarantors, { name: '', phone: '', aadhar: '', pan: '', relationship: '', type: 'guarantor' }])}
                      style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>
                      + Add Guarantor
                    </button>
                  </div>
                  {guarantors.map((g, idx) => (
                    <div key={idx} style={{ background: '#f9fafb', padding: '14px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Guarantor {idx + 1}</span>
                        {guarantors.length > 1 && (
                          <button type="button" onClick={() => setGuarantors(guarantors.filter((_, i) => i !== idx))}
                            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                            Remove
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        <input placeholder="Name *" value={g.name} maxLength={40} onChange={e => updateGuarantor(idx, 'name', e.target.value)} style={inp} />
                        <input placeholder="Phone *" value={g.phone} maxLength={10} onChange={e => updateGuarantor(idx, 'phone', e.target.value)} style={inp} />
                        <select value={g.type} onChange={e => updateGuarantor(idx, 'type', e.target.value)} style={inp}>
                          <option value="guarantor">Guarantor</option>
                          <option value="co-signer">Co-signer</option>
                          <option value="nominee">Nominee</option>
                        </select>
                        <input placeholder="Relationship" value={g.relationship} onChange={e => updateGuarantor(idx, 'relationship', e.target.value)} style={inp} />
                        <input placeholder="Aadhaar" value={g.aadhar} maxLength={12} onChange={e => updateGuarantor(idx, 'aadhar', e.target.value)} style={inp} />
                        <input placeholder="PAN" value={g.pan} maxLength={10} onChange={e => updateGuarantor(idx, 'pan', e.target.value)} style={inp} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                  <tr key={l.id} onClick={() => window.location.href = `/dashboard/loans/${l.id}`}
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