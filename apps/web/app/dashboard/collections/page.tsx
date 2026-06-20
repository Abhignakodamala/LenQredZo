'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { getAuthUser, can } from '@/lib/authUser';
import { API_URL } from '@/lib/api';

export default function CollectionsPage() {
  const [emis, setEmis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Collect dialog state
  const [dialog, setDialog] = useState<any>(null); // { emi, collectPenalty }
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [waivePenalty, setWaivePenalty] = useState(false);
  const [waiveReason, setWaiveReason] = useState('');
  const [me, setMe] = useState<any>(null);

 useEffect(() => { fetchCollections(); setMe(getAuthUser()); }, []);

  const fetchCollections = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/loans/collections/all`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      setEmis(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const openDialog = (emi: any, collectPenalty: boolean) => {
    setDialog({ emi, collectPenalty });
    setMethod('cash');
    setReference('');
    setPayAmount(String(emi.remaining ?? emi.amount));
    setDialogError('');
    setWaivePenalty(false);
    setWaiveReason('');
  };

  const closeDialog = () => { setDialog(null); setSubmitting(false); setDialogError(''); };

  const canWaive = can(me, 'penalty:waive');

  const submitCollection = async () => {
    if (!dialog) return;
    const ref = reference.trim();
    const amt = Math.round(Number(payAmount));
    const remaining = dialog.emi.remaining ?? dialog.emi.amount;

    if (!amt || amt <= 0) { setDialogError('Please enter a valid amount.'); return; }
    if (amt > remaining) { setDialogError('Amount cannot exceed the remaining balance of ₹' + remaining.toLocaleString('en-IN') + '.'); return; }
    if (method !== 'cash' && !ref) {
      setDialogError('A reference / transaction ID is required for ' + method.toUpperCase() + ' payments.');
      return;
    }
    if (waivePenalty && !waiveReason.trim()) { setDialogError('Please enter a reason for waiving the penalty.'); return; }

    const clearsEmi = amt >= remaining;
    setSubmitting(true);
    setDialogError('');
    try {
      const res = await fetch(`${API_URL}/api/loans/emi/${dialog.emi.id}/pay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        // Penalty only when this payment fully clears the EMI.
        body: JSON.stringify({ amount: amt, collectPenalty: dialog.collectPenalty && clearsEmi, method, reference: ref, waivePenalty: waivePenalty && clearsEmi, waiveReason: waiveReason.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setDialogError(data.message || 'Failed to record payment');
        setSubmitting(false);
        return;
      }
      closeDialog();
      fetchCollections();
    } catch (err) {
      console.error(err);
      setDialogError('Server error. Please try again.');
      setSubmitting(false);
    }
  };

  const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const badge = (status: string) => {
    if (status === 'paid') return { background: '#dcfce7', color: '#16a34a' };
    if (status === 'overdue') return { background: '#fee2e2', color: '#dc2626' };
    if (status === 'partial') return { background: '#dbeafe', color: '#1e40af' };
    return { background: '#fef3c7', color: '#d97706' };
  };

  const totalPending = emis.filter(e => e.status !== 'paid').reduce((s, e) => s + (e.remaining ?? e.amount), 0);
  const totalPenalty = emis.filter(e => e.status === 'overdue').reduce((s, e) => s + (e.penalty || 0), 0);
  const paidCount = emis.filter(e => e.status === 'paid').length;
  const overdueCount = emis.filter(e => e.status === 'overdue').length;
  const pendingCount = emis.filter(e => e.status === 'pending').length;
  const partialCount = emis.filter(e => e.status === 'partial').length;

  let filtered = [...emis];
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(e =>
      (e.customerName || '').toLowerCase().includes(q) ||
      ('ln' + (1000 + e.loanId)).includes(q)
    );
  }
  if (statusFilter !== 'all') filtered = filtered.filter(e => e.status === statusFilter);
  filtered.sort((a, b) => {
    const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    return sortOrder === 'asc' ? diff : -diff;
  });

  const tabs = [
    { label: 'All', value: 'all', count: emis.length },
    { label: 'Paid', value: 'paid', count: paidCount },
    { label: 'Partial', value: 'partial', count: partialCount },
    { label: 'Pending', value: 'pending', count: pendingCount },
    { label: 'Overdue', value: 'overdue', count: overdueCount },
  ];

  const inp = { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as any };
  const lbl = { display: 'block' as any, fontSize: '13px', fontWeight: '500' as any, marginBottom: '6px', color: '#374151' };

  const dialogRemaining = dialog ? (dialog.emi.remaining ?? dialog.emi.amount) : 0;
  const dialogAmt = Math.round(Number(payAmount)) || 0;
  const isPartial = dialog ? (dialogAmt > 0 && dialogAmt < dialogRemaining) : false;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '240px', flex: 1, padding: '24px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Collections</h2>
          <p style={{ color: '#6b7280', margin: 0 }}>Track EMIs, penalties and collections</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Total EMI Pending', value: fmt(totalPending), color: '#111827' },
            { label: 'Total Penalty Due', value: fmt(totalPenalty), color: '#dc2626' },
            { label: 'Overdue EMIs', value: overdueCount, color: '#dc2626' },
            { label: 'Collected EMIs', value: paidCount, color: '#16a34a' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 8px' }}>{s.label}</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontWeight: '600', margin: 0 }}>EMI Collections ({filtered.length})</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="🔍 Search customer or loan ID..."
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', width: '260px' }} />
                <button onClick={() => setSortOrder(s => s === 'asc' ? 'desc' : 'asc')}
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'white' }}>
                  📅 {sortOrder === 'asc' ? 'Oldest ↑' : 'Newest ↓'}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {tabs.map(tab => (
                <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
                  style={{ padding: '5px 14px', borderRadius: '20px', border: 'none', fontSize: '13px', cursor: 'pointer', fontWeight: statusFilter === tab.value ? '600' : '400', background: statusFilter === tab.value ? '#1e40af' : '#f3f4f6', color: statusFilter === tab.value ? 'white' : '#374151' }}>
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No records found</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                  {['Customer', 'Loan', 'Due Date', 'EMI Amount', 'Paid', 'Penalty', 'Total Due', 'Status', 'Action'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e: any) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{e.customerName}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1e40af' }}>LN{1000 + e.loanId}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>{fmtDate(e.dueDate)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600' }}>{fmt(e.amount)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: e.paidAmount > 0 ? '#16a34a' : '#9ca3af' }}>
                      {e.paidAmount > 0 ? fmt(e.paidAmount) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: e.penalty > 0 ? '#dc2626' : '#9ca3af', fontWeight: e.penalty > 0 ? '600' : '400' }}>
                      {e.penalty > 0 ? fmt(e.penalty) : '—'}
                      {e.daysOverdue > 0 && <span style={{ display: 'block', fontSize: '11px', color: '#dc2626' }}>{e.daysOverdue} days late</span>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: e.penalty > 0 ? '#dc2626' : '#111827' }}>
                      {fmt(e.totalDue)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ ...badge(e.status), padding: '2px 10px', borderRadius: '20px', fontSize: '11px' }}>{e.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {e.status !== 'paid' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {e.penalty > 0 ? (
                            <>
                              <button onClick={() => openDialog(e, true)}
                                style={{ background: '#dc2626', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                Collect + Penalty
                              </button>
                              <button onClick={() => openDialog(e, false)}
                                style={{ background: '#1e40af', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                                EMI Only
                              </button>
                            </>
                          ) : (
                            <button onClick={() => openDialog(e, false)}
                              style={{ background: '#1e40af', color: 'white', border: 'none', padding: '5px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                              Collect
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Collect dialog */}
      {dialog && (
        <div onClick={closeDialog} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div onClick={ev => ev.stopPropagation()} style={{ background: 'white', borderRadius: '12px', width: '440px', maxWidth: '100%', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '700', color: '#111827' }}>Collect Payment</h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#6b7280' }}>
              {dialog.emi.customerName} · LN{1000 + dialog.emi.loanId}
            </p>

            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: '#6b7280' }}>EMI Amount</span>
                <span style={{ fontWeight: '600' }}>{fmt(dialog.emi.amount)}</span>
              </div>
              {dialog.emi.paidAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span style={{ color: '#6b7280' }}>Already Paid</span>
                  <span style={{ fontWeight: '600', color: '#16a34a' }}>{fmt(dialog.emi.paidAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#6b7280' }}>Remaining</span>
                <span style={{ fontWeight: '700', color: '#0369a1' }}>{fmt(dialogRemaining)}</span>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={lbl}>Amount Paying Now</label>
              <input type="number" value={payAmount}
                onChange={ev => { setPayAmount(ev.target.value); setDialogError(''); }}
                style={inp} />
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <button onClick={() => setPayAmount(String(dialogRemaining))}
                  style={{ flex: 1, padding: '6px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>
                  Full ({fmt(dialogRemaining)})
                </button>
                <button onClick={() => setPayAmount(String(Math.round(dialogRemaining / 2)))}
                  style={{ flex: 1, padding: '6px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>
                  Half
                </button>
              </div>
              {isPartial && (
                <p style={{ fontSize: '12px', color: '#1e40af', margin: '8px 0 0' }}>
                  ℹ️ Partial payment — ₹{(dialogRemaining - dialogAmt).toLocaleString('en-IN')} will remain due on this EMI.
                  {dialog.collectPenalty ? ' Penalty will be collected later when the EMI is fully cleared.' : ''}
                </p>
              )}
            </div>
              {dialog.collectPenalty && dialog.emi.penalty > 0 && canWaive && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#92400e' }}>
                  <input type="checkbox" checked={waivePenalty} onChange={ev => { setWaivePenalty(ev.target.checked); setDialogError(''); }} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  Waive the ₹{Number(dialog.emi.penalty).toLocaleString('en-IN')} penalty (manager approval)
                </label>
                {waivePenalty && (
                  <div style={{ marginTop: '10px' }}>
                    <input value={waiveReason} onChange={ev => { setWaiveReason(ev.target.value); setDialogError(''); }}
                      placeholder="Reason for waiving (required) — e.g. family medical emergency"
                      style={{ ...inp, background: 'white' }} />
                    <p style={{ fontSize: '11px', color: '#92400e', margin: '6px 0 0' }}>
                      Applies only when the EMI is fully cleared. This action is logged.
                    </p>
                  </div>
                )}
              </div>
            )}
            <div style={{ marginBottom: '14px' }}>
              <label style={lbl}>Payment Method</label>
              <select value={method} onChange={ev => { setMethod(ev.target.value); setDialogError(''); }} style={inp}>
                <option value="cash">Cash (hand-to-hand)</option>
                <option value="upi">UPI (Paytm / GPay / PhonePe)</option>
                <option value="bank">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="card">Card</option>
              </select>
            </div>

            {method !== 'cash' && (
              <div style={{ marginBottom: '14px' }}>
                <label style={lbl}>
                  {method === 'upi' ? 'UPI Reference / Txn ID' : method === 'bank' ? 'Bank Ref / UTR Number' : method === 'cheque' ? 'Cheque Number' : 'Card Txn Reference'} *
                </label>
                <input value={reference} onChange={ev => { setReference(ev.target.value); setDialogError(''); }}
                  placeholder="Enter the reference from the receipt / SMS"
                  style={inp} />
              </div>
            )}

            {method === 'cash' && (
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#92400e' }}>
                  ⚠️ Cash has no digital proof — it will be recorded as <b>unverified</b>.
                </p>
              </div>
            )}

            {dialogError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' }}>
                {dialogError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={submitCollection} disabled={submitting}
                style={{ flex: 1, background: '#1e40af', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Recording...' : (isPartial ? 'Record Partial Payment' : 'Confirm Payment')}
              </button>
              <button onClick={closeDialog} disabled={submitting}
                style={{ background: 'white', color: '#374151', border: '1px solid #d1d5db', padding: '10px 18px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}