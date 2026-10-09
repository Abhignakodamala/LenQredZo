'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { API_URL } from '@/lib/api';
import { getAuthUser, type AuthUser } from '@/lib/authUser';

const ALLOWED = ['owner', 'admin', 'Super Admin'];

type AuditPhoto = {
  id: number;
  action: string;
  entityType: string;
  entityId: number | string | null;
  details: string | null;
  photoData: string;
  createdAt: string;
  userName: string | null;
};

const ACTION_LABELS: Record<string, string> = {
  login_photo: '🔐 Login',
  payment_collected: '💰 Payment Collected',
};

export default function AuditPhotosPage() {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [photos, setPhotos] = useState<AuditPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AuditPhoto | null>(null);
  const [filter, setFilter] = useState<'all' | 'login_photo' | 'payment_collected'>('all');

  useEffect(() => { setMe(getAuthUser()); }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_URL}/api/audit/photos`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || 'Could not load photos');
          setLoading(false);
          return;
        }
        setPhotos(data);
      } catch {
        setError('Could not reach the server.');
      }
      setLoading(false);
    };
    load();
  }, []);

  const allowed = me && ALLOWED.includes(me.role);
  const filtered = filter === 'all' ? photos : photos.filter(p => p.action === filter);

  const card: React.CSSProperties = { background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' };
  const chip = (active: boolean): React.CSSProperties => ({
    padding: '7px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
    border: '1px solid', borderColor: active ? '#1e40af' : '#e5e7eb',
    background: active ? '#1e40af' : 'white', color: active ? 'white' : '#374151'
  });

  if (me && !allowed) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
        <Sidebar />
        <div style={{ marginLeft: '220px', flex: 1, padding: '40px', textAlign: 'center', color: '#6b7280' }}>
          <p style={{ fontSize: '40px', margin: '0 0 8px' }}>🔒</p>
          <p style={{ fontWeight: 600, color: '#111827' }}>Audit photos are for owners and admins only.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '24px', maxWidth: '1100px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>📸 Audit Photos</h2>
          <p style={{ color: '#6b7280', margin: '4px 0 0' }}>Photos captured at login and payment collection, for accountability.</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button onClick={() => setFilter('all')} style={chip(filter === 'all')}>All ({photos.length})</button>
          <button onClick={() => setFilter('login_photo')} style={chip(filter === 'login_photo')}>
            🔐 Logins ({photos.filter(p => p.action === 'login_photo').length})
          </button>
          <button onClick={() => setFilter('payment_collected')} style={chip(filter === 'payment_collected')}>
            💰 Payments ({photos.filter(p => p.action === 'payment_collected').length})
          </button>
        </div>

        {loading && <p style={{ color: '#6b7280' }}>Loading...</p>}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '20px' }}>
            ⚠️ {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div style={{ ...card, textAlign: 'center', color: '#9ca3af', padding: '60px 20px' }}>
            No photos captured yet.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {filtered.map(p => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              aria-label={`View ${ACTION_LABELS[p.action] || p.action} photo`}
              onClick={() => setSelected(p)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelected(p);
                }
              }}
              style={{ ...card, padding: '10px', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: '8px', overflow: 'hidden', background: '#111827', marginBottom: '10px' }}>
                <img src={p.photoData} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827', margin: 0 }}>
                {ACTION_LABELS[p.action] || p.action}
              </p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{p.userName || 'Unknown user'}</p>
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>
                {new Date(p.createdAt).toLocaleString('en-IN')}
              </p>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div onClick={() => setSelected(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.75)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '16px', padding: '20px', maxWidth: '480px', width: '100%' }}>
            <img src={selected.photoData} alt="Captured" style={{ width: '100%', borderRadius: '10px', marginBottom: '14px' }} />
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
              {ACTION_LABELS[selected.action] || selected.action}
            </p>
            <p style={{ fontSize: '13px', color: '#374151', margin: '0 0 2px' }}>{selected.userName || 'Unknown user'}</p>
            <p style={{ fontSize: '12.5px', color: '#6b7280', margin: '0 0 2px' }}>
              {new Date(selected.createdAt).toLocaleString('en-IN')}
            </p>
            {selected.entityType && (
              <p style={{ fontSize: '12.5px', color: '#6b7280', margin: '0 0 2px' }}>
                {selected.entityType} {selected.entityId != null ? `#${selected.entityId}` : ''}
              </p>
            )}
            {selected.details && (
              <p style={{ fontSize: '12.5px', color: '#6b7280', margin: '6px 0 0' }}>{selected.details}</p>
            )}
            <button onClick={() => setSelected(null)} style={{
              marginTop: '14px', width: '100%', padding: '10px', background: '#f3f4f6', border: 'none',
              borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#374151', cursor: 'pointer'
            }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}