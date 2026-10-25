'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { API_URL } from '@/lib/api';

type User = { name?: string; role?: string };
type Company = { name?: string; logo?: string | null };

const ALL_MENU_ITEMS = [
  { name: 'Dashboard', icon: '📊', href: '/dashboard' },
  { name: 'Customers', icon: '👥', href: '/dashboard/customers' },
  { name: 'Loans', icon: '💰', href: '/dashboard/loans' },
  { name: 'Collections', icon: '📋', href: '/dashboard/collections' },
  { name: 'Payments', icon: '💳', href: '/dashboard/payments' },
  { name: 'Analytics', icon: '📈', href: '/dashboard/analytics' },
  { name: 'AI Analysis', icon: '🤖', href: '/dashboard/ai' },
  { name: 'WhatsApp', icon: '💬', href: '/dashboard/whatsapp' },
  { name: 'Branches', icon: '🏢', href: '/dashboard/branches' },
  { name: 'Staff', icon: '🧑‍💼', href: '/dashboard/staff' },
  { name: 'Audit Photos', icon: '📸', href: '/dashboard/audit-photos' },
  { name: 'Settings', icon: '⚙️', href: '/dashboard/settings' },
];

function normalizeRoleName(role?: string): string {
  if (!role) return 'collection_agent';
  const lower = role.toLowerCase().trim().replace(/[-\s]+/g, '_');
  if (lower === 'super_admin' || lower === 'admin') return 'owner';
  if (lower === 'manager') return 'branch_manager';
  if (lower === 'agent') return 'collection_agent';
  return lower;
}

// Role-Based Access Control (RBAC) Menu Whitelist:
// Staff members ONLY see the navigation links that relate strictly to their work.
const ROLE_ALLOWED_ROUTES: Record<string, string[]> = {
  // Finance Owner / Super Admin: Full company-wide visibility
  owner: [
    '/dashboard',
    '/dashboard/customers',
    '/dashboard/loans',
    '/dashboard/collections',
    '/dashboard/payments',
    '/dashboard/analytics',
    '/dashboard/ai',
    '/dashboard/whatsapp',
    '/dashboard/branches',
    '/dashboard/staff',
    '/dashboard/audit-photos',
    '/dashboard/settings',
  ],

  // Branch Manager: Branch operations & collections (no company settings, no staff salary config, no global branch setup)
  branch_manager: [
    '/dashboard',
    '/dashboard/customers',
    '/dashboard/loans',
    '/dashboard/collections',
    '/dashboard/payments',
    '/dashboard/analytics',
    '/dashboard/ai',
    '/dashboard/whatsapp',
    '/dashboard/audit-photos',
  ],

  // Loan Officer: Underwriting, loan applications & AI credit assessment, with view access to collections and payments
  loan_officer: [
    '/dashboard',
    '/dashboard/customers',
    '/dashboard/loans',
    '/dashboard/collections',
    '/dashboard/payments',
    '/dashboard/ai',
    '/dashboard/whatsapp',
    '/dashboard/audit-photos',
  ],

  // Accountant: Ledgers, collections, payments & financial analytics, with view access to customers and loans
  accountant: [
    '/dashboard',
    '/dashboard/customers',
    '/dashboard/loans',
    '/dashboard/collections',
    '/dashboard/payments',
    '/dashboard/analytics',
    '/dashboard/whatsapp',
  ],

  // Collection Agent: Field visits, borrower contacts, daily EMI collections, loan schedules, payment receipts & WhatsApp
  collection_agent: [
    '/dashboard',
    '/dashboard/customers',
    '/dashboard/loans',
    '/dashboard/collections',
    '/dashboard/payments',
    '/dashboard/whatsapp',
    '/dashboard/audit-photos',
  ],

  // Recovery Officer: Overdue recovery, loan schedules, customer records, payment receipts, field visit proofs & WhatsApp
  recovery_officer: [
    '/dashboard',
    '/dashboard/customers',
    '/dashboard/loans',
    '/dashboard/collections',
    '/dashboard/payments',
    '/dashboard/whatsapp',
    '/dashboard/audit-photos',
  ],
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Finance Owner',
  admin: 'Finance Owner',
  'Super Admin': 'Super Admin',
  super_admin: 'Super Admin',
  branch_manager: 'Branch Manager',
  Manager: 'Branch Manager',
  loan_officer: 'Loan Officer',
  accountant: 'Accountant',
  Accountant: 'Accountant',
  collection_agent: 'Collection Agent',
  Agent: 'Collection Agent',
  recovery_officer: 'Recovery Officer',
};

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    // 1. Load user from storage
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        setUser(null);
      }
    }

    // 2. Load company from storage and fresh from API
    const loadCompany = async () => {
      const storedComp = localStorage.getItem('company');
      if (storedComp) {
        try {
          const parsed = JSON.parse(storedComp);
          if (parsed && typeof parsed === 'object') {
            setCompany(parsed);
          }
        } catch {
          // ignore
        }
      }

      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await fetch(`${API_URL}/api/settings`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.company) {
              setCompany(data.company);
              localStorage.setItem('company', JSON.stringify(data.company));
            }
          }
        } catch {
          // ignore network failure
        }
      }
    };

    loadCompany();
    window.addEventListener('company:updated', loadCompany);

    // Event listener for mobile toggle
    const handleOpenMobile = () => setMobileDrawerOpen(true);
    const handleCloseMobile = () => setMobileDrawerOpen(false);
    window.addEventListener('open-mobile-sidebar', handleOpenMobile);
    window.addEventListener('close-mobile-sidebar', handleCloseMobile);

    return () => {
      window.removeEventListener('company:updated', loadCompany);
      window.removeEventListener('open-mobile-sidebar', handleOpenMobile);
      window.removeEventListener('close-mobile-sidebar', handleCloseMobile);
    };
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  // Determine allowed routes strictly by user role
  const normRole = normalizeRoleName(user?.role);
  const allowedHrefs = ROLE_ALLOWED_ROUTES[normRole] || ROLE_ALLOWED_ROUTES['collection_agent'];
  const menuItems = ALL_MENU_ITEMS.filter(m => allowedHrefs.includes(m.href));

  const roleLabel = ROLE_LABELS[user?.role || ''] || user?.role || 'Staff Member';

  const renderLogo = () => {
    const customLogoUrl = company?.logo && !logoError
      ? (company.logo.startsWith('http') ? company.logo : `${API_URL}${company.logo}`)
      : null;

    return (
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {customLogoUrl ? (
            <img
              src={customLogoUrl}
              alt={company?.name || 'Company Logo'}
              onError={() => setLogoError(true)}
              style={{
                maxHeight: '44px',
                maxWidth: '170px',
                objectFit: 'contain',
                display: 'block'
              }}
            />
          ) : (
            <Image
              src="/lenqredzo-logo-transparent.png"
              alt="LenQredzo"
              width={140}
              height={44}
              priority
              style={{
                width: '140px',
                height: 'auto',
                maxHeight: '44px',
                objectFit: 'contain',
                display: 'block'
              }}
            />
          )}

          {company?.name && (
            <span
              style={{
                fontSize: '11px',
                color: '#94a3b8',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {company.name}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderNavLinks = () => (
    <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
      {menuItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.name}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              textDecoration: 'none',
              marginBottom: '4px',
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
        style={{
          width: '100%',
          padding: '8px',
          background: '#fef2f2',
          color: '#dc2626',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          fontSize: '13px',
          cursor: 'pointer',
          fontWeight: 600
        }}
      >
        Logout
      </button>
    </div>
  );

  return (
    <>
      {/* 1. DESKTOP PERMANENT SIDEBAR */}
      <aside
        className="desktop-only-sidebar"
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
        {renderLogo()}
        {renderNavLinks()}
        {renderUserBlock()}
      </aside>

      {/* 2. MOBILE SLIDING DRAWER BACKDROP */}
      {mobileDrawerOpen && (
        <div
          className="mobile-drawer-overlay"
          onClick={() => setMobileDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            zIndex: 9998,
            backdropFilter: 'blur(3px)'
          }}
        />
      )}

      {/* 3. MOBILE SLIDING DRAWER */}
      <div
        className="mobile-drawer-container"
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          width: '270px',
          background: '#0f172a',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          transform: mobileDrawerOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '4px 0 25px rgba(0, 0, 0, 0.5)',
          borderRight: '1px solid #1e293b'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '12px' }}>
          <div style={{ flex: 1 }}>{renderLogo()}</div>
          <button
            onClick={() => setMobileDrawerOpen(false)}
            style={{
              background: '#1e293b',
              border: 'none',
              color: '#94a3b8',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>
        {renderNavLinks()}
        {renderUserBlock()}
      </div>
    </>
  );
}
