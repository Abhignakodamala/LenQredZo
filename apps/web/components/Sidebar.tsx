'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { API_URL } from '@/lib/api';

type User = { name?: string; role?: string };
type Company = { name?: string; logo?: string | null };

const baseMenuItems = [
  { name: 'Dashboard', icon: '📊', href: '/dashboard' },
  { name: 'Customers', icon: '👥', href: '/dashboard/customers' },
  { name: 'Loans', icon: '💰', href: '/dashboard/loans' },
  { name: 'Collections', icon: '📋', href: '/dashboard/collections' },
  { name: 'Payments', icon: '💳', href: '/dashboard/payments' },
  { name: 'Analytics', icon: '📈', href: '/dashboard/analytics' },
  { name: 'AI Analysis', icon: '🤖', href: '/dashboard/ai' },
  { name: 'WhatsApp', icon: '💬', href: '/dashboard/whatsapp' },
  { name: 'Branches', icon: '🏢', href: '/dashboard/branches' },
  { name: 'Settings', icon: '⚙️', href: '/dashboard/settings' },
];

// Only owner-level roles can manage staff.
const OWNER_ROLES = ['owner', 'admin', 'Super Admin'];

const ROLE_LABELS: Record<string, string> = {
  owner: 'Finance Owner',
  admin: 'Finance Owner',
  'Super Admin': 'Super Admin',
  branch_manager: 'Branch Manager',
  loan_officer: 'Loan Officer',
  accountant: 'Accountant',
  collection_agent: 'Collection Agent',
  recovery_officer: 'Recovery Officer',
};

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        setUser(null);
      }
    }

    const loadCompany = () => {
      const storedComp = localStorage.getItem('company');
      if (storedComp) {
        try {
          setCompany(JSON.parse(storedComp));
        } catch {
          setCompany(null);
        }
      }
    };
    loadCompany();
    window.addEventListener('company:updated', loadCompany);
    return () => window.removeEventListener('company:updated', loadCompany);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isOwner = OWNER_ROLES.includes(user?.role || '');

  // Staff link is shown only to owners; insert it just before Settings.
  const menuItems = [...baseMenuItems];
  if (isOwner) {
    const settingsIdx = menuItems.findIndex(m => m.name === 'Settings');
    menuItems.splice(
      settingsIdx,
      0,
      { name: 'Staff', icon: '🧑‍💼', href: '/dashboard/staff' },
      { name: 'Audit Photos', icon: '📸', href: '/dashboard/audit-photos' }
    );
  }

  const roleLabel = ROLE_LABELS[user?.role || ''] || user?.role || 'User';

  const renderNavLinks = () => (
    <nav style={{ padding: '12px 8px', flex: 1, overflowY: 'auto' }}>
      {menuItems.map((item) => {
        const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : (pathname === item.href || pathname.startsWith(item.href + '/'));
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              marginBottom: '2px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: isActive ? '600' : '400',
              background: isActive ? '#1e40af' : 'transparent',
              color: isActive ? 'white' : '#cbd5e1'
            }}
          >
            <span>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );

  const renderUserBlock = () => (
    <div style={{ padding: '16px', borderTop: '1px solid #1e293b' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{ width: '32px', height: '32px', background: '#1e40af', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px', fontWeight: 'bold' }}>
          {user?.name?.charAt(0) || 'U'}
        </div>
        <div style={{ overflow: 'hidden' }}>
          <p style={{ fontSize: '13px', fontWeight: '600', margin: 0, color: 'white', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {user?.name || 'User'}
          </p>
          <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>{roleLabel}</p>
        </div>
      </div>
      <button
        onClick={() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }}
        style={{ width: '100%', padding: '8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
      >
        Sign Out
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile Top Header (Visible on screen <= 768px) */}
      <div
        className="mobile-top-bar"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '56px',
          background: '#0f172a',
          borderBottom: '1px solid #1e293b',
          zIndex: 998,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px'
        }}
      >
        <button
          onClick={() => setMobileOpen(prev => !prev)}
          style={{
            background: 'none',
            border: 'none',
            color: '#ffffff',
            fontSize: '22px',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '6px'
          }}
          aria-label="Toggle Menu"
        >
          {mobileOpen ? '✕' : '☰'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Image
            src="/lenqredzo-logo-transparent.png"
            alt="LenQredzo"
            width={110}
            height={32}
            priority
            style={{ width: '110px', height: 'auto', objectFit: 'contain' }}
          />
        </div>

        <div style={{ width: '28px', height: '28px', background: '#1e40af', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '11px', fontWeight: 'bold' }}>
          {user?.name?.charAt(0) || 'U'}
        </div>
      </div>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 999,
            backdropFilter: 'blur(2px)'
          }}
        />
      )}

      {/* Mobile Sliding Drawer */}
      <div
        className="mobile-drawer"
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          width: '260px',
          background: '#0f172a',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease-in-out',
          boxShadow: '4px 0 24px rgba(0,0,0,0.5)',
          borderRight: '1px solid #1e293b'
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Image
            src="/lenqredzo-logo-transparent.png"
            alt="LenQredzo"
            width={130}
            height={36}
            style={{ width: '130px', height: 'auto', objectFit: 'contain' }}
          />
          <button
            onClick={() => setMobileOpen(false)}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
        {renderNavLinks()}
        {renderUserBlock()}
      </div>

      {/* Desktop Fixed Sidebar (Visible on screen > 768px) */}
      <div
        className="desktop-sidebar"
        style={{
          width: '220px',
          background: '#0f172a',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          borderRight: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 40
        }}
      >
        {/* Logo */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b' }}>
          {company?.logo ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <img
                src={company.logo.startsWith('http') ? company.logo : `${API_URL}${company.logo}`}
                alt={company.name || 'Company Logo'}
                style={{
                  maxHeight: '44px',
                  maxWidth: '170px',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
              {company.name && (
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {company.name}
                </span>
              )}
            </div>
          ) : (
            <Image
              src="/lenqredzo-logo-transparent.png"
              alt="LenQredzo"
              width={150}
              height={99}
              priority
              style={{
                width: '150px',
                height: 'auto',
                objectFit: 'contain',
                display: 'block'
              }}
            />
          )}
        </div>

        {/* Nav Links */}
        {renderNavLinks()}

        {/* User + Logout */}
        {renderUserBlock()}
      </div>
    </>
  );
}