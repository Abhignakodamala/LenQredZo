'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { API_URL } from '@/lib/api';

type LoginEvent = {
  id: number;
  method: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

function describeDevice(userAgent: string | null) {
  if (!userAgent) return 'Unknown browser and device';

  const browser = userAgent.includes('Edg/')
    ? 'Microsoft Edge'
    : userAgent.includes('Chrome/')
      ? 'Chrome'
      : userAgent.includes('Firefox/')
        ? 'Firefox'
        : userAgent.includes('Safari/')
          ? 'Safari'
          : 'Browser';
  const version = userAgent.match(/(?:Edg|Chrome|Firefox|Version)\/([\d.]+)/)?.[1];
  const platform = /Windows/i.test(userAgent)
    ? 'Windows'
    : /Android/i.test(userAgent)
      ? 'Android'
      : /iPhone|iPad|iPod/i.test(userAgent)
        ? 'iOS'
        : /Mac OS X/i.test(userAgent)
          ? 'macOS'
          : /Linux/i.test(userAgent)
            ? 'Linux'
            : 'Unknown device';

  return `${browser}${version ? ` ${version.split('.')[0]}` : ''} · ${platform}`;
}

export default function SecurityDeviceInfo() {
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadHistory = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Your session has expired. Please log in again.');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/login-history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json') ? await response.json() : null;
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('The API does not recognize the login history endpoint. Restart the API server and try again.');
          }
          throw new Error(data?.message || `Could not load login history (${response.status})`);
        }
        if (!Array.isArray(data)) throw new Error('The API returned an invalid login history response.');
        setEvents(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load login history');
      } finally {
        setLoading(false);
      }
    };

    void loadHistory();
  }, []);

  const row: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 0',
    borderBottom: '1px solid #f3f4f6',
  };

  return (
    <section style={{ background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '20px' }}>
      <h3 style={{ fontWeight: 700, fontSize: '16px', margin: '0 0 4px', color: '#111827' }}>
        Security &amp; Device Info
      </h3>
      <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 14px' }}>
        Recent successful sign-ins to your account.
      </p>

      {loading && <p style={{ fontSize: '13px', color: '#6b7280' }}>Loading login history...</p>}
      {error && <p role="alert" style={{ fontSize: '13px', color: '#dc2626' }}>{error}</p>}
      {!loading && !error && events.length === 0 && (
        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
          No login history yet. Successful sign-ins will appear here.
        </p>
      )}
      {events.map((event, index) => (
        <div key={event.id} style={{ ...row, borderBottom: index === events.length - 1 ? 'none' : row.borderBottom }}>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>
              {index === 0 ? 'Last login' : new Date(event.createdAt).toLocaleString('en-IN')}
            </p>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>
              {index === 0 && `${new Date(event.createdAt).toLocaleString('en-IN')} · `}
              {describeDevice(event.userAgent)}
              {' · '}
              {event.method[0].toUpperCase() + event.method.slice(1)}
            </p>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '3px 0 0' }}>
              IP address: {event.ipAddress || 'Unavailable'}
            </p>
          </div>
          <span style={{ color: '#15803d', background: '#f0fdf4', padding: '5px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>
            Successful
          </span>
        </div>
      ))}
    </section>
  );
}
