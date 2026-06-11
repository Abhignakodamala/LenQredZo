'use client';
import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) window.location.href = '/dashboard';
    else window.location.href = '/login';
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <p style={{ color: '#6b7280' }}>Loading...</p>
    </div>
  );
}