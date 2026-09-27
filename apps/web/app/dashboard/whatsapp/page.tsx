'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import Sidebar from '@/components/Sidebar';
import { API_URL } from '@/lib/api';

export default function WhatsAppPage() {
  const [token, setToken] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const input: CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' };
  const card: CSSProperties = { background: 'white', padding: 24, borderRadius: 12, border: '1px solid #e5e7eb', maxWidth: 760 };

  useEffect(() => {
    fetch(`${API_URL}/api/whatsapp/settings`, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } })
      .then(async response => response.ok ? response.json() : Promise.reject(new Error('Could not load WhatsApp settings')))
      .then(data => { setConfigured(Boolean(data.configured)); setPhoneNumberId(data.phone_number_id || ''); })
      .catch(error => setMessage(`❌ ${error.message}`))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!token.trim() || !phoneNumberId.trim()) { setMessage('❌ Enter both the access token and phone number ID'); return; }
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/whatsapp/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ whatsapp_token: token.trim(), phone_number_id: phoneNumberId.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not save WhatsApp settings');
      setToken(''); setConfigured(true); setMessage('✅ WhatsApp connected successfully');
    } catch (error: any) { setMessage(`❌ ${error.message}`); }
    setSaving(false);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
      <Sidebar />
      <main style={{ marginLeft: 220, padding: 32, flex: 1 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 26, color: '#111827' }}>WhatsApp Messaging</h1>
          <p style={{ margin: '6px 0 0', color: '#6b7280' }}>Connect WhatsApp Cloud API for customer reminders and receipts.</p>
        </div>
        {loading ? <p style={{ color: '#6b7280' }}>Loading WhatsApp settings...</p> : (
          <div style={card}>
            {message && <div style={{ background: message.startsWith('✅') ? '#dcfce7' : '#fef2f2', color: message.startsWith('✅') ? '#166534' : '#b91c1c', padding: '10px 12px', borderRadius: 8, marginBottom: 18, fontSize: 13 }}>{message}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <label style={{ color: '#374151', fontSize: 13, fontWeight: 600 }}>Meta Access Token
                <input type="password" value={token} onChange={event => setToken(event.target.value)} placeholder={configured ? 'Enter a new token to replace it' : 'Paste access token'} style={{ ...input, marginTop: 6 }} />
              </label>
              <label style={{ color: '#374151', fontSize: 13, fontWeight: 600 }}>Phone Number ID
                <input value={phoneNumberId} onChange={event => setPhoneNumberId(event.target.value)} placeholder="Meta phone number ID" style={{ ...input, marginTop: 6 }} />
              </label>
            </div>
            <button onClick={save} disabled={saving} style={{ marginTop: 18, padding: '10px 20px', background: '#128C7E', color: 'white', border: 0, borderRadius: 8, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : configured ? 'Update WhatsApp' : 'Connect WhatsApp'}</button>
            {configured && <p style={{ color: '#16a34a', fontSize: 12, marginBottom: 0 }}>Connected. Your access token is stored encrypted.</p>}
          </div>
        )}
      </main>
    </div>
  );
}
