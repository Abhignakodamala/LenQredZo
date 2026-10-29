'use client';
import React, { useState, useEffect } from 'react';
import { API_URL } from '@/lib/api';

export interface WhatsAppDueReminderModalProps {
  onClose: () => void;
}

export default function WhatsAppDueReminderModal({ onClose }: WhatsAppDueReminderModalProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter state: 'all' | 'due_tomorrow' | 'due_today' | 'overdue'
  const [filter, setFilter] = useState<'all' | 'due_tomorrow' | 'due_today' | 'overdue'>('due_tomorrow');
  
  // Language toggle: 'te' (Telugu / Tanglish) | 'en' (English)
  const [lang, setLang] = useState<'te' | 'en'>('te');

  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchDues = () => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/whatsapp/upcoming-dues`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`
      }
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setData(d);
        } else {
          setError(d.error || 'Failed to fetch upcoming dues');
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Error connecting to WhatsApp alert engine');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDues();
  }, []);

  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

  const items = data?.items || [];
  const filteredItems = items.filter((i: any) => {
    if (filter === 'all') return true;
    return i.timingCategory === filter;
  });

  const handleSendWhatsApp = (item: any) => {
    const rawMsg = lang === 'te' ? item.msgTe : item.msgEn;
    const cleanPhone = (item.customerPhone || '').replace(/\D/g, '').slice(-10);
    const encoded = encodeURIComponent(rawMsg);
    const url = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleCopy = (item: any) => {
    const rawMsg = lang === 'te' ? item.msgTe : item.msgEn;
    navigator.clipboard.writeText(rawMsg);
    setCopiedId(item.emiId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px',
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '880px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        border: '1px solid #cbd5e1'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
          color: 'white',
          padding: '18px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>💬</span>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>
                Automated 24-Hour Advance WhatsApp Due Alert Terminal
              </h2>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#bbf7d0' }}>
              Send pre-formatted payment reminders with direct 1-Tap UPI pay link (Reduces bounces by 40%)
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: 'white',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '16px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Filter & Metric Bar */}
        <div style={{
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Timing Filters */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setFilter('due_tomorrow')}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                background: filter === 'due_tomorrow' ? '#16a34a' : '#e2e8f0',
                color: filter === 'due_tomorrow' ? 'white' : '#475569'
              }}
            >
              ⏰ Due Tomorrow ({data?.dueTomorrowCount ?? 0})
            </button>
            <button
              onClick={() => setFilter('due_today')}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                background: filter === 'due_today' ? '#0284c7' : '#e2e8f0',
                color: filter === 'due_today' ? 'white' : '#475569'
              }}
            >
              📅 Due Today ({data?.dueTodayCount ?? 0})
            </button>
            <button
              onClick={() => setFilter('overdue')}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                background: filter === 'overdue' ? '#dc2626' : '#e2e8f0',
                color: filter === 'overdue' ? 'white' : '#475569'
              }}
            >
              ⚠️ Overdue ({data?.overdueCount ?? 0})
            </button>
            <button
              onClick={() => setFilter('all')}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                background: filter === 'all' ? '#0f172a' : '#e2e8f0',
                color: filter === 'all' ? 'white' : '#475569'
              }}
            >
              All Dues ({data?.totalCount ?? 0})
            </button>
          </div>

          {/* Language Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Template:</span>
            <button
              onClick={() => setLang('te')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                border: lang === 'te' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                background: lang === 'te' ? '#f0fdf4' : 'white',
                color: lang === 'te' ? '#15803d' : '#475569',
                cursor: 'pointer'
              }}
            >
              🇮🇳 Telugu (Tanglish)
            </button>
            <button
              onClick={() => setLang('en')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                border: lang === 'en' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                background: lang === 'en' ? '#f0fdf4' : 'white',
                color: lang === 'en' ? '#15803d' : '#475569',
                cursor: 'pointer'
              }}
            >
              🌐 English
            </button>
          </div>
        </div>

        {/* Body Items List */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              Scanning upcoming EMI schedules for 24-hr advance alerts...
            </div>
          )}

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
              ⚠️ {error}
            </div>
          )}

          {!loading && filteredItems.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <span style={{ fontSize: '32px' }}>🎉</span>
              <p style={{ margin: '8px 0 0', fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>
                No borrowers matching this filter right now!
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                All EMIs due tomorrow have been cleared or no active dues in this window.
              </p>
            </div>
          )}

          {!loading && filteredItems.map((item: any) => {
            const currentMsg = lang === 'te' ? item.msgTe : item.msgEn;

            const timingBadge = 
              item.timingCategory === 'due_tomorrow' ? { bg: '#dcfce7', text: '#15803d', label: '⏰ Due Tomorrow' } :
              item.timingCategory === 'due_today' ? { bg: '#e0f2fe', text: '#0369a1', label: '📅 Due Today' } :
              item.timingCategory === 'overdue' ? { bg: '#fee2e2', text: '#991b1b', label: '⚠️ Overdue' } :
              { bg: '#f1f5f9', text: '#475569', label: 'Upcoming' };

            return (
              <div
                key={item.emiId}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
                }}
              >
                {/* Borrower Top Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                        {item.customerName}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', background: timingBadge.bg, color: timingBadge.text }}>
                        {timingBadge.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      <span style={{ color: '#0284c7', fontWeight: '700' }}>{item.loanRef}</span> • 📞 {item.customerPhone || 'No phone'} • 📍 {item.customerCity}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a' }}>
                      {fmt(item.remainingAmount)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      Due: <strong>{item.dueDateFormatted}</strong>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Message Preview Box */}
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '12px',
                  color: '#166534',
                  lineHeight: '1.4',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '700', color: '#15803d', fontSize: '11px' }}>
                      💬 WhatsApp Pre-formatted Message with 1-Tap Pay Link:
                    </span>
                    <span style={{ fontSize: '10px', color: '#15803d' }}>
                      Includes UPI portal
                    </span>
                  </div>
                  <p style={{ margin: 0 }}>
                    {currentMsg}
                  </p>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Pay Link: <a href={item.payUrl} target="_blank" rel="noreferrer" style={{ color: '#0284c7', fontWeight: '600' }}>{item.payUrl}</a>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleCopy(item)}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        color: '#334155',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      {copiedId === item.emiId ? '✓ Copied!' : '📋 Copy Text'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendWhatsApp(item)}
                      style={{
                        background: '#22c55e',
                        border: 'none',
                        color: 'white',
                        padding: '6px 16px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 4px -1px rgba(34, 197, 94, 0.3)'
                      }}
                    >
                      💬 Send WhatsApp Now
                    </button>
                  </div>
                </div>

              </div>
            );
          })}

        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Showing <strong>{filteredItems.length}</strong> borrower reminder(s)
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={fetchDues}
              style={{
                background: 'white',
                border: '1px solid #cbd5e1',
                color: '#475569',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              🔄 Refresh List
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#0f172a',
                color: 'white',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
