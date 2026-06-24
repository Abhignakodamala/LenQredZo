'use client';
import { useState, useRef, useEffect, CSSProperties } from 'react';

type Customer = { id: number; name: string; phone?: string };

type CustomerSearchSelectProps = {
  customers: Customer[];
  value: string;
  onChange: (id: string) => void;
  style?: CSSProperties;
};

export default function CustomerSearchSelect({
  customers,
  value,
  onChange,
  style,
}: CustomerSearchSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = customers.find(c => String(c.id) === String(value));

  useEffect(() => {
    setQuery(selected ? selected.name : '');
  }, [selected?.id, selected?.name]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    (c.phone || '').includes(query)
  );

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box',
  };

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input
        style={{ ...inputStyle, ...style }}
        placeholder="Type a customer name..."
        value={query}
        onFocus={() => setOpen(true)}
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange('');
        }}
      />
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 20,
          background: 'white',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          marginTop: '4px',
          maxHeight: '220px',
          overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}>
          {filtered.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: '13px', color: '#9ca3af' }}>
              No customers match "{query}"
            </div>
          )}
          {filtered.map(c => (
            <div
              key={c.id}
              onClick={() => {
                onChange(String(c.id));
                setQuery(c.name);
                setOpen(false);
              }}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                cursor: 'pointer',
                background: String(c.id) === String(value) ? '#eff6ff' : 'white',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = String(c.id) === String(value) ? '#eff6ff' : 'white'; }}
            >
              <div style={{ fontWeight: 600, color: '#111827' }}>{c.name}</div>
              {c.phone && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{c.phone}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
