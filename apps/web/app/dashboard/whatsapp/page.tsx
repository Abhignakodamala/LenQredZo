'use client';

import { useEffect, useRef, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { API_URL } from '@/lib/api';

type Loan = { id: number; status: string; amount: number; emis?: { id: number; amount: number; dueDate: string; status: string; paidAmount?: number }[] };
type Customer = { id: number; name: string; phone: string; hasAadhar: boolean; hasPan: boolean; loans?: Loan[] };
type Message = { id: number; direction: 'sent' | 'received'; message: string; messageType: string; status: string; sentAt: string };
type Settings = { configured: boolean; phone_number_id?: string; company_name?: string };

const messageTypes = [
  ['pending_emi', 'EMI Reminder'], ['receipt', 'Payment Receipt'], ['late_fee', 'Late Fee'],
  ['guarantor_alert', 'Guarantor Alert'], ['credit_confirmation', 'Loan Approved'], ['welcome', 'Welcome'],
  ['greetings', 'Greetings'], ['birthday', 'Birthday Wish'], ['alert', 'Custom Alert'],
  ['cheque_deposit', 'Cheque Deposit'], ['cheque_return', 'Cheque Bounce'], ['receipt_cancel', 'Receipt Cancel'],
  ['penalty', 'Penalty Notice'], ['before_auction', 'Auction Warning'], ['after_auction', 'Post Auction'],
  ['member_enrolment', 'Staff Welcome'], ['membership_renewal', 'Plan Renewal'], ['new_branch', 'New Branch']
] as const;

export default function WhatsAppPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [search, setSearch] = useState('');
  const [inboxFilter, setInboxFilter] = useState<'all' | 'unread' | 'overdue' | 'pending'>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [type, setType] = useState('pending_emi');
  const [customMessage, setCustomMessage] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u.companyName) setCompanyName(u.companyName);
      }
    } catch {}

    fetch(`${API_URL}/api/whatsapp/customers`, { headers: authHeaders() })
      .then(response => {
        if (!response.ok) throw new Error('Could not load customers');
        return response.json();
      })
      .then(data => setCustomers(Array.isArray(data) ? data : []))
      .catch(() => setNotice('Could not load customers'))
      .finally(() => setCustomersLoading(false));

    fetch(`${API_URL}/api/whatsapp/settings`, { headers: authHeaders() })
      .then(response => {
        if (!response.ok) throw new Error('Could not load WhatsApp settings');
        return response.json();
      })
      .then(data => {
        setSettings(data);
        setPhoneNumberId(data.phone_number_id || '');
        if (data.company_name) setCompanyName(data.company_name);
      })
      .catch(() => setNotice('Could not load WhatsApp settings'));

    fetch(`${API_URL}/api/settings`, { headers: authHeaders() })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.company?.name) setCompanyName(data.company.name);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return;
    fetch(`${API_URL}/api/whatsapp/messages/${selected.id}`, { headers: authHeaders() })
      .then(response => response.ok ? response.json() : [])
      .then(data => setMessages(Array.isArray(data) ? data : []))
      .catch(() => setMessages([]));
  }, [selected]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const saveSettings = async () => {
    if (!accessToken.trim() || !phoneNumberId.trim()) { setNotice('Enter both the access token and phone number ID'); return; }
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/whatsapp/settings`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ whatsapp_token: accessToken.trim(), phone_number_id: phoneNumberId.trim() })
      });
      if (!response.ok) throw new Error((await response.json()).message || 'Could not save settings');
      setSettings({ configured: true, phone_number_id: phoneNumberId }); setAccessToken(''); setShowSettings(false); setNotice('WhatsApp settings saved');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not save settings'); }
    setSaving(false);
  };

  useEffect(() => {
    if (selected && companyName) {
      setCustomMessage(getPreviewText(selected, type, companyName));
    }
  }, [companyName]);

  const getPreviewText = (cust = selected, currentType = type, compName = companyName): string => {
    if (!cust) return '';
    const activeLoan = cust.loans?.find(l => l.status === 'active' || l.status === 'pending' || l.status === 'overdue') || cust.loans?.[0];
    const pendingEmi = activeLoan?.emis?.find(e => e.status !== 'paid');
    const loanId = activeLoan ? `LN${1000 + activeLoan.id}` : '';
    const loanAmount = activeLoan ? activeLoan.amount.toLocaleString('en-IN') : '0';
    const emiAmount = pendingEmi ? (pendingEmi.amount - (pendingEmi.paidAmount || 0)).toLocaleString('en-IN') : '0';
    const dueDate = pendingEmi ? new Date(pendingEmi.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'the due date';
    const companySign = compName || companyName || 'Our Finance Team';
    const loanRef = loanId ? ` (Loan ID: ${loanId})` : '';

    switch (currentType) {
      case 'pending_emi':
        return `Hello ${cust.name},\n\nThis is a reminder from ${companySign} regarding your loan${loanRef}.\n\nYour EMI of Rs. ${emiAmount} is due on ${dueDate}.\n\nKindly make the payment on or before the due date. If you need any payment details or have any questions, please feel free to reply to this message.\n\nThank you,\n${companySign}`;

      case 'receipt':
        return `Hello ${cust.name},\n\nWe have received your payment of Rs. ${emiAmount} towards your loan${loanRef}. Thank you for paying on time!\n\nYour account has been updated successfully.\n\nRegards,\n${companySign}`;

      case 'late_fee':
        return `Hello ${cust.name},\n\nWe noticed that your loan EMI of Rs. ${emiAmount} for loan${loanRef} was due on ${dueDate} and is currently pending.\n\nPlease arrange to clear this payment as soon as possible to avoid late payment charges. If you need any assistance or payment options, please reply to this message.\n\nThank you,\n${companySign}`;

      case 'credit_confirmation':
        return `Hello ${cust.name},\n\nWe are glad to inform you that your loan application of Rs. ${loanAmount}${loanRef} has been approved by ${companySign}.\n\nOur team will be in touch with you shortly regarding the next steps.\n\nBest regards,\n${companySign}`;

      case 'welcome':
        return `Hello ${cust.name},\n\nWelcome to ${companySign}! We are pleased to assist you with your loan requirements.\n\nIf you have any questions or need any help with your account, please feel free to reach out to us here.\n\nBest regards,\n${companySign}`;

      case 'alert':
      default:
        return `Hello ${cust.name},\n\nThis is regarding your account with ${companySign}. Please share your updated Aadhaar and PAN documents so we can complete your verification.\n\nYou can reply directly to this message.\n\nThank you,\n${companySign}`;
    }
  };

  const sendMessage = async () => {
    if (!selected) return;
    setSending(true); setNotice('');
    try {
      const activeLoan = selected.loans?.find(l => l.status === 'active' || l.status === 'pending') || selected.loans?.[0];
      const pendingEmi = activeLoan?.emis?.find(e => e.status !== 'paid');

      const messageToSend = (customMessage.trim() || getPreviewText(selected, type, companyName)).trim();

      const payload: Record<string, string> = {
        customer_id: String(selected.id),
        customer_phone: selected.phone,
        customer_name: selected.name,
        message_type: type,
        custom_message: messageToSend
      };

      if (activeLoan) {
        payload.loan_id = `LN${1000 + activeLoan.id}`;
        payload.loan_amount = String(activeLoan.amount);
      }

      if (pendingEmi) {
        const remainingAmount = pendingEmi.amount - (pendingEmi.paidAmount || 0);
        payload.emi_amount = String(remainingAmount);
        payload.due_date = new Date(pendingEmi.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      }

      const response = await fetch(`${API_URL}/api/whatsapp/send`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to send message');
      setNotice('Message sent successfully'); setShowSend(false);
      const history = await fetch(`${API_URL}/api/whatsapp/messages/${selected.id}`, { headers: authHeaders() });
      setMessages(history.ok ? await history.json() : messages);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Server not reachable'); }
    setSending(false);
  };

  const filtered = customers.filter(customer => {
    const matchesSearch = `${customer.name} ${customer.phone}`.toLowerCase().includes(search.toLowerCase());
    const loans = customer.loans || [];
    const matchesFilter = inboxFilter === 'all' || inboxFilter === 'unread' || (inboxFilter === 'overdue' && loans.some(loan => loan.status === 'overdue')) || (inboxFilter === 'pending' && loans.some(loan => loan.emis?.some(emi => emi.status !== 'paid')));
    return matchesSearch && matchesFilter;
  });
  const initials = (name: string) => name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const time = (date: string) => new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const color = (name: string) => ['#25D366', '#1e40af', '#7c3aed', '#dc2626', '#d97706'][name.charCodeAt(0) % 5];
  const avatar = (name: string, size = 44) => <div style={{ width: size, height: size, borderRadius: '50%', background: color(name), display: 'grid', placeItems: 'center', color: 'white', fontWeight: 700, flexShrink: 0 }}>{initials(name)}</div>;

  return <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f2f5' }}>
    <Sidebar />
    <main style={{ marginLeft: 220, flex: 1, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <header style={{ padding: '16px 24px', background: 'white', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><h1 style={{ margin: 0, fontSize: 20, color: '#111827' }}>WhatsApp</h1><p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>Message customers, reminders and notifications.</p></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {notice && <span style={{ color: notice.includes('success') || notice.includes('saved') ? '#15803d' : '#b91c1c', fontSize: 12 }}>{notice}</span>}
          <span style={{ color: settings ? (settings.configured ? '#15803d' : '#b91c1c') : '#6b7280', fontSize: 12 }}>{settings ? (settings.configured ? 'Connected' : 'Not configured') : 'Checking connection...'}</span>
          <button onClick={() => setNotice('Select a message type to use a template')} style={button('#f3f4f6', '#374151')}>Templates</button>
          <button onClick={() => setNotice('Scheduled reminders are available from the API')} style={button('#f3f4f6', '#374151')}>Automation</button>
          <button onClick={() => setShowSettings(true)} style={button('#f3f4f6', '#374151')}>Settings</button>
        </div>
      </header>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <aside style={{ width: 320, background: 'white', borderRight: '1px solid #e5e7eb', overflowY: 'auto' }}>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search customers..." style={{ margin: 12, width: 'calc(100% - 24px)', padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 6, padding: '0 12px 12px', overflowX: 'auto' }}>
            {([['all', 'All'], ['unread', 'Unread'], ['pending', 'Payment pending'], ['overdue', 'Overdue']] as const).map(([value, label]) => <button key={value} onClick={() => setInboxFilter(value)} style={{ ...button(inboxFilter === value ? '#dcfce7' : '#f9fafb', inboxFilter === value ? '#15803d' : '#6b7280'), padding: '6px 9px', whiteSpace: 'nowrap', border: `1px solid ${inboxFilter === value ? '#86efac' : '#e5e7eb'}` }}>{label}</button>)}
          </div>
          {customersLoading ? <p style={{ padding: '0 16px', color: '#6b7280', fontSize: 13 }}>Loading customers...</p> : filtered.map(customer => <button key={customer.id} onClick={() => { setSelected(customer); setShowSend(false); setType('pending_emi'); setCustomMessage(getPreviewText(customer, 'pending_emi', companyName)); }} style={{ width: '100%', display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left', padding: '12px 16px', border: 0, borderBottom: '1px solid #f3f4f6', background: selected?.id === customer.id ? '#f0fdf4' : 'white', cursor: 'pointer' }}>
            {avatar(customer.name)}<span><strong style={{ display: 'block', color: '#111827' }}>{customer.name}</strong><small style={{ color: '#6b7280' }}>{customer.phone}</small></span>
          </button>)}
        </aside>
        <section style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#efeae2' }}>
          {!selected ? <div style={{ margin: 'auto', textAlign: 'center', color: '#6b7280' }}><div style={{ fontSize: 56 }}>💬</div><h2 style={{ color: '#374151' }}>{companyName || 'Finance'} WhatsApp</h2><p>Select a customer to start messaging</p></div> : <>
            <div style={{ background: '#075e54', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {avatar(selected.name, 40)}
                <div>
                  <strong style={{ fontSize: 15 }}>{selected.name}</strong>
                  <small style={{ display: 'block', color: '#b7e1dc', fontSize: 12 }}>{selected.phone}</small>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    const cleanPhone = selected.phone.replace(/\D/g, '');
                    const to = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
                    const text = (customMessage.trim() || getPreviewText(selected, type, companyName)).trim();
                    window.open(`https://web.whatsapp.com/send?phone=${to}&text=${encodeURIComponent(text)}`, '_blank');
                  }}
                  style={{ background: '#25D366', color: 'white', border: 0, borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  💬 Open in WhatsApp
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', marginTop: 40, color: '#9ca3af' }}>
                  <p style={{ margin: 0, fontSize: 14 }}>No messages recorded yet for {selected.name}.</p>
                  <small>Select a template below to preview and send an automated message.</small>
                </div>
              ) : (
                messages.map(message => (
                  <div key={message.id} style={{ display: 'flex', justifyContent: message.direction === 'sent' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                    <div style={{ maxWidth: '70%', padding: '10px 14px', borderRadius: 12, background: message.direction === 'sent' ? '#dcf8c6' : 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>
                      <div style={{ whiteSpace: 'pre-wrap', color: '#111827', fontSize: 13, lineHeight: '1.4' }}>{message.message}</div>
                      <div style={{ textAlign: 'right', marginTop: 4 }}>
                        <small style={{ color: '#9ca3af', fontSize: 10 }}>{time(message.sentAt)} {message.direction === 'sent' ? '✓✓' : ''}</small>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={endRef} />
            </div>

            {/* Modern WhatsApp Composer */}
            <div style={{ background: 'white', borderTop: '1px solid #e5e7eb', padding: '14px 18px', boxShadow: '0 -2px 10px rgba(0,0,0,0.03)' }}>
              {/* Template Chips */}
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Templates:</span>
                {[
                  ['pending_emi', '📅 EMI Reminder'],
                  ['receipt', '🧾 Payment Receipt'],
                  ['late_fee', '⚠️ Overdue Notice'],
                  ['credit_confirmation', '🎉 Loan Approved'],
                  ['welcome', '👋 Welcome'],
                  ['alert', '💬 Custom Text']
                ].map(([val, lbl]) => (
                  <button
                    key={val}
                    onClick={() => {
                      setType(val);
                      setCustomMessage(getPreviewText(selected, val, companyName));
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      border: type === val ? '1.5px solid #25D366' : '1px solid #e5e7eb',
                      background: type === val ? '#dcfce7' : '#f9fafb',
                      color: type === val ? '#15803d' : '#374151',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              {/* Message Editor & Live Preview */}
              <div style={{ position: 'relative', marginTop: 4 }}>
                <textarea
                  value={customMessage || getPreviewText()}
                  onChange={e => setCustomMessage(e.target.value)}
                  placeholder="Type your WhatsApp message..."
                  style={{
                    width: '100%',
                    minHeight: 90,
                    padding: '12px 14px',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    lineHeight: '1.45',
                    border: '1.5px solid #d1d5db',
                    borderRadius: 10,
                    boxSizing: 'border-box',
                    background: '#fdfdfd',
                    resize: 'vertical',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Action Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      const text = (customMessage.trim() || getPreviewText(selected, type, companyName)).trim();
                      navigator.clipboard?.writeText(text);
                      setNotice('Copied message to clipboard!');
                    }}
                    style={{ background: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    📋 Copy Text
                  </button>
                  <button
                    onClick={() => {
                      const cleanPhone = selected.phone.replace(/\D/g, '');
                      const to = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
                      const text = (customMessage.trim() || getPreviewText(selected, type, companyName)).trim();
                      window.open(`https://web.whatsapp.com/send?phone=${to}&text=${encodeURIComponent(text)}`, '_blank');
                    }}
                    style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    ↗ Open WhatsApp Web
                  </button>
                </div>

                <button
                  disabled={sending}
                  onClick={sendMessage}
                  style={{
                    background: '#25D366',
                    color: 'white',
                    border: 0,
                    borderRadius: 8,
                    padding: '9px 20px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: sending ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(37,211,102,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {sending ? '⏳ Sending via Meta...' : '🚀 Send via WhatsApp'}
                </button>
              </div>
            </div>
          </>}
        </section>
        {selected && <aside style={{ width: 290, background: 'white', borderLeft: '1px solid #e5e7eb', overflowY: 'auto', padding: 16 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>{avatar(selected.name, 48)}<div><strong style={{ color: '#111827' }}>{selected.name}</strong><small style={{ display: 'block', color: '#6b7280' }}>{selected.phone}</small></div></div>
          <div style={contextCard}><strong>Customer status</strong><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12 }}><span>KYC</span><b style={{ color: selected.hasAadhar && selected.hasPan ? '#15803d' : '#b45309' }}>{selected.hasAadhar && selected.hasPan ? 'Verified' : 'Pending'}</b></div></div>
          <div style={contextCard}>
            <strong>Loan summary</strong>
            {selected.loans?.length ? selected.loans.map(loan => {
              const pendingEmi = loan.emis?.find(e => e.status !== 'paid');
              return (
                <div key={loan.id} style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #e5e7eb', fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Loan LN{1000 + loan.id}</span>
                    <b style={{ color: loan.status === 'overdue' ? '#dc2626' : '#15803d' }}>{loan.status}</b>
                  </div>
                  <div style={{ color: '#6b7280', marginTop: 4 }}>Principal: ₹{loan.amount.toLocaleString('en-IN')}</div>
                  {pendingEmi && (
                    <div style={{ color: '#dc2626', marginTop: 2, fontWeight: 600 }}>
                      Next Due: ₹{(pendingEmi.amount - (pendingEmi.paidAmount || 0)).toLocaleString('en-IN')} ({new Date(pendingEmi.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})
                    </div>
                  )}
                </div>
              );
            }) : <p style={{ color: '#9ca3af', fontSize: 12 }}>No loans recorded</p>}
          </div>
          <strong style={{ display: 'block', marginBottom: 8 }}>Quick actions</strong><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><button onClick={() => { setType('pending_emi'); setCustomMessage(getPreviewText(selected, 'pending_emi', companyName)); }} style={quickAction}>EMI reminder</button><button onClick={() => { setType('receipt'); setCustomMessage(getPreviewText(selected, 'receipt', companyName)); }} style={quickAction}>Send receipt</button><button onClick={() => { setType('alert'); setCustomMessage(`Hello ${selected.name},\n\nThis is regarding your account with ${companyName || 'our finance team'}. Please share your updated Aadhaar and PAN documents so we can complete your verification.\n\nYou can reply directly to this message with the documents.\n\nThank you,\n${companyName || 'Finance Team'}`); }} style={quickAction}>Request KYC</button><button onClick={() => { setType('late_fee'); setCustomMessage(getPreviewText(selected, 'late_fee', companyName)); }} style={quickAction}>Overdue notice</button></div>
          <a href={`/dashboard/customers/${selected.id}`} style={{ display: 'block', marginTop: 14, textAlign: 'center', color: '#1e40af', fontSize: 12 }}>View customer profile</a>
        </aside>}
      </div>
    </main>
    {showSettings && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'grid', placeItems: 'center', zIndex: 10 }}><div style={{ background: 'white', padding: 28, borderRadius: 12, width: 440, maxWidth: '90vw' }}><h2 style={{ marginTop: 0 }}>WhatsApp Settings</h2><label style={{ display: 'block', marginBottom: 14 }}>Access Token<input type="password" value={accessToken} onChange={event => setAccessToken(event.target.value)} style={inputStyle} /></label><label style={{ display: 'block', marginBottom: 20 }}>Phone Number ID<input value={phoneNumberId} onChange={event => setPhoneNumberId(event.target.value)} style={inputStyle} /></label><button disabled={saving} onClick={saveSettings} style={{ ...button('#25D366', 'white'), width: '100%' }}>{saving ? 'Saving...' : 'Save Settings'}</button><button onClick={() => setShowSettings(false)} style={{ ...button('#f3f4f6', '#374151'), width: '100%', marginTop: 8 }}>Cancel</button></div></div>}
  </div>;
}

const inputStyle = { width: '100%', marginTop: 6, padding: 10, border: '1px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box' as const };
const contextCard = { background: '#f9fafb', border: '1px solid #eef0f2', borderRadius: 8, padding: 12, marginBottom: 16, color: '#374151', fontSize: 13 };
const quickAction = { padding: 9, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', color: '#374151', fontSize: 11, cursor: 'pointer' };
const button = (background: string, color: string) => ({ border: 0, borderRadius: 8, padding: '9px 14px', background, color, fontWeight: 600, cursor: 'pointer' });
