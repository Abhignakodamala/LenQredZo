'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { deletePasskey, listPasskeys } from '@/lib/webauthn';

type Passkey = {
  id: string;
  nickname: string | null;
  deviceType: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

export default function ManagePasskeys() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    const loadPasskeys = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Your session has expired. Please log in again.');
        setLoading(false);
        return;
      }

      try {
        setPasskeys(await listPasskeys(token));
        setError('');
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load registered devices.');
      } finally {
        setLoading(false);
      }
    };

    const handlePasskeysUpdated = () => { void loadPasskeys(); };
    void loadPasskeys();
    window.addEventListener('passkeys:updated', handlePasskeysUpdated);
    return () => window.removeEventListener('passkeys:updated', handlePasskeysUpdated);
  }, []);

  const handleRemove = async (passkey: Passkey) => {
    if (!window.confirm('Remove this passkey? This device will no longer be able to sign in biometrically until it is registered again.')) return;

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Your session has expired. Please log in again.');
      return;
    }

    setRemovingId(passkey.id);
    setError('');
    try {
      await deletePasskey(token, passkey.id);
      setPasskeys(current => current.filter(item => item.id !== passkey.id));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove this passkey.');
    } finally {
      setRemovingId(null);
    }
  };

  const row: CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
    padding: '10px 0', borderBottom: '1px solid #f3f4f6'
  };

  return (
    <div style={{ marginTop: '18px', borderTop: '1px solid #e5e7eb', paddingTop: '14px' }}>
      <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 10px', color: '#374151' }}>Registered devices</p>
      {loading && <p style={{ fontSize: '12px', color: '#6b7280' }}>Loading registered devices...</p>}
      {error && <p role="alert" style={{ fontSize: '12px', color: '#dc2626', margin: '0 0 10px' }}>{error}</p>}
      {!loading && !error && passkeys.length === 0 && (
        <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>No passkeys registered.</p>
      )}
      {passkeys.map(passkey => {
        const synced = passkey.deviceType === 'multiDevice';
        return (
          <div key={passkey.id} style={row}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span role="img" aria-label={synced ? 'Synced passkey' : 'Device-bound passkey'} title={synced ? 'Synced passkey' : 'Device-bound passkey'}>
                {synced ? '☁️' : '💻'}
              </span>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>{passkey.nickname || 'This device'}</p>
                <p style={{ fontSize: '11px', color: '#6b7280', margin: '3px 0 0' }}>
                  Added {new Date(passkey.createdAt).toLocaleDateString('en-IN')}
                  {' · '}
                  {passkey.lastUsedAt
                    ? `Last used ${new Date(passkey.lastUsedAt).toLocaleDateString('en-IN')}`
                    : 'Never used yet'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleRemove(passkey)}
              disabled={removingId === passkey.id}
              style={{ background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: removingId === passkey.id ? 'wait' : 'pointer', opacity: removingId === passkey.id ? 0.6 : 1 }}
            >
              {removingId === passkey.id ? 'Removing...' : 'Remove'}
            </button>
          </div>
        );
      })}
    </div>
  );
}