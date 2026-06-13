'use client';
import { useState, useEffect } from 'react';

export default function ActivityLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/audit', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const iconFor = (action: string) => {
    if (action === 'MARK_EMI_PAID') return '💰';
    if (action === 'CREATE_LOAN') return '📄';
    if (action === 'UPDATE_LOAN_STATUS') return '🔄';
    if (action === 'CREATE_CUSTOMER') return '➕';
    if (action === 'UPDATE_CUSTOMER') return '✏️';
    if (action === 'DELETE_CUSTOMER') return '🗑️';
    return '•';
  };

  const card = { background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '20px' };

  return (
    <div style={card}>
      <h3 style={{ fontWeight: '700', fontSize: '16px', margin: '0 0 16px' }}>🕒 Recent Activity</h3>
      {loading ? (
        <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Loading activity...</p>
      ) : logs.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>No activity recorded yet.</p>
      ) : (
        <div>
          {logs.map((log) => (
            <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ fontSize: '18px', lineHeight: '20px' }}>{iconFor(log.action)}</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '14px', color: '#111827' }}>{log.details || log.action}</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9ca3af' }}>
                  by {log.userName || 'Unknown'} · {timeAgo(log.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
