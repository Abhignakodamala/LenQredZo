'use client';
import { useState, useEffect } from 'react';

type User = { name?: string; role?: string };

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        setUser(null);
      }
    }
  }, []);

  return (
    <div style={{ position: 'fixed', top: 0, left: '240px', right: 0, height: '60px', background: 'white', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', padding: '0 24px', gap: '16px', zIndex: 100 }}>
      <div style={{ position: 'relative', flex: 1, maxWidth: '420px' }}>
        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px' }}>🔍</span>
        <input placeholder="Search customers, loans, invoices..." style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', background: '#f9fafb', boxSizing: 'border-box', outline: 'none' }} />
      </div>
      <div style={{ flex: 1 }} />
      <button style={{ position: 'relative', background: '#f9fafb', border: '1px solid #e5e7eb', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', fontSize: '16px' }}>
        🔔
        <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ef4444', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>3</span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', cursor: 'pointer' }}>
        <div style={{ width: '32px', height: '32px', background: '#1e40af', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px', fontWeight: 'bold' }}>
          {user?.name?.charAt(0) || 'U'}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#111827' }}>{user?.name || 'User'}</p>
          <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', textTransform: 'capitalize' }}>{user?.role || 'Admin'}</p>
        </div>
        <span style={{ color: '#9ca3af', fontSize: '11px' }}>▼</span>
      </div>
    </div>
  );
}