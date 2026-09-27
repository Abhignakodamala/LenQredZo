'use client';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_URL } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
type Stats = {
  totalDisbursed: number; totalCollections: number; activeCustomers: number;
  activeLoans: number; totalLoans: number; npaPercentage: number;
  netProfit: number; disbursedChange: number | null; collectionChange: number | null;
  collectionEfficiency: number;
  recentLoans: { id: number; type: string; amount: number; status: string; customer: { name: string } | null; createdAt: string }[];
  aiInsights: { icon: string; title: string; description: string; level: string; levelColor: string; levelBg: string }[];
  branchPerformance: { name: string; totalDisbursed: number; collected: number; efficiency: number }[];
};
type TodayData = {
  overdueCount: number; overdueAmount: number;
  dueTodayAmount: number; dueTodayCount: number;
  dueToday: { id: number; customerName: string; loanId: number; amount: number; phone?: string; dueDate: string }[];
  recentActivity: { customerName: string; loanId: number; amount: number; date: string }[];
};
type Health = {
  database: string; aiService: string; payments: string; server: string;
  backup: string; security: string; failedPayments: number; kycPending: number;
};
type User = { name?: string; role?: string };

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
const fmtTime = (d: string) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '';
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' }) : '';

function StatusDot({ status }: { status: string }) {
  const color = status === 'healthy' ? '#16a34a' : status === 'warning' ? '#d97706' : '#dc2626';
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 6 }} />;
}

function ChangeTag({ val }: { val: number | null }) {
  if (val === null) return null;
  const up = val >= 0;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: up ? '#16a34a' : '#dc2626', background: up ? '#dcfce7' : '#fee2e2', padding: '2px 6px', borderRadius: 20 }}>
      {up ? '▲' : '▼'} {Math.abs(val)}% vs last month
    </span>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
const MENU = [
  { name: 'Dashboard', icon: '⊞', href: '/dashboard' },
  { name: 'Customers', icon: '👥', href: '/dashboard/customers' },
  { name: 'Loans', icon: '💰', href: '/dashboard/loans' },
  { name: 'Collections', icon: '📋', href: '/dashboard/collections' },
  { name: 'Payments', icon: '💳', href: '/dashboard/payments' },
  { name: 'Analytics', icon: '📈', href: '/dashboard/analytics' },
  { name: 'AI Insights', icon: '🤖', href: '/dashboard/ai' },
  { name: 'Branches', icon: '🏢', href: '/dashboard/branches' },
  { name: 'Staff', icon: '👔', href: '/dashboard/staff' },
  { name: 'Settings', icon: '⚙️', href: '/dashboard/settings' },
];

const OWNER_ROLES = ['owner', 'admin', 'Super Admin'];
const ROLE_LABELS: Record<string, string> = {
  owner: 'Finance Owner', admin: 'Finance Owner', 'Super Admin': 'Super Admin',
  branch_manager: 'Branch Manager', loan_officer: 'Loan Officer',
  accountant: 'Accountant', collection_agent: 'Collection Agent',
};

function Sidebar({ user }: { user: User | null }) {
  const [path, setPath] = useState('');
  useEffect(() => { setPath(window.location.pathname); }, []);
  const isOwner = OWNER_ROLES.includes(user?.role || '');
  const menu = MENU.filter(m => m.name !== 'Staff' || isOwner);
  const roleLabel = ROLE_LABELS[user?.role || ''] || user?.role || 'User';

  return (
    <div style={{ width: 220, background: '#0f172a', height: '100vh', position: 'fixed', left: 0, top: 0, display: 'flex', flexDirection: 'column', zIndex: 100 }}>
      {/* Logo */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b' }}>
        <Image
          src="/lenqredzo-logo-transparent.png"
          alt="LenQredZo"
          width={150}
          height={100}
          style={{ objectFit: 'contain' }}
          priority
        />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
        {menu.map(item => {
          const active = path === item.href || (item.href !== '/dashboard' && path.startsWith(item.href));
          return (
            <a key={item.name} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
              borderRadius: 8, marginBottom: 2, textDecoration: 'none', fontSize: 13,
              fontWeight: active ? 600 : 400,
              background: active ? '#1e40af' : 'transparent',
              color: active ? 'white' : '#94a3b8',
              transition: 'all 0.15s'
            }}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              <span>{item.name}</span>
              {active && <span style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: 'white' }} />}
            </a>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #1e40af, #7c3aed)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 700 }}>
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, margin: 0, color: 'white' }}>{user?.name || 'User'}</p>
            <p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>{roleLabel}</p>
          </div>
        </div>
        <button onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = '/login'; }}
          style={{ width: '100%', padding: '7px', background: 'transparent', color: '#ef4444', border: '1px solid #3f172a', borderRadius: 7, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          🚪 Logout
        </button>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [today, setToday] = useState<TodayData | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [todayLabel, setTodayLabel] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [msgModal, setMsgModal] = useState<{ name: string; phone?: string; amount: number } | null>(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) try { setUser(JSON.parse(stored)); } catch {}
    setTodayLabel(new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }));
    const token = localStorage.getItem('token') || '';
    const h = { headers: { Authorization: `Bearer ${token}` } };
    Promise.all([
      fetch(`${API_URL}/api/dashboard/stats`, h).then(r => r.json()).catch(() => null),
      fetch(`${API_URL}/api/dashboard/today`, h).then(r => r.json()).catch(() => null),
      fetch(`${API_URL}/api/dashboard/health`, h).then(r => r.json()).catch(() => null),
    ]).then(([s, t, hh]) => {
      setStats(s); setToday(t); setHealth(hh);
      setLoading(false);
    });
  }, []);

  const sendWhatsAppCloudMessage = async () => {
    if (!msgModal?.phone) return;
    setSendingWhatsApp(true);
    try {
      const response = await fetch(`${API_URL}/api/whatsapp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          message_type: 'pending_emi',
          customer_name: msgModal.name,
          customer_phone: `91${msgModal.phone.replace(/\D/g, '').replace(/^91/, '')}`,
          emi_amount: String(msgModal.amount)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not send WhatsApp message');
      setMsgModal(null);
      window.alert('WhatsApp message sent successfully.');
    } catch (error: any) {
      window.alert(error.message || 'Could not send WhatsApp message. Configure WhatsApp in Settings first.');
    }
    setSendingWhatsApp(false);
  };

  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus();
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(o => !o); }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchOpen]);

  const card: React.CSSProperties = { background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '18px 20px' };
  const overdueCount = today?.overdueCount ?? 0;
  const overdueAmount = today?.overdueAmount ?? 0;

  // KPI cards
  const kpiCards = [
    { label: 'Total Disbursed', value: fmt(stats?.totalDisbursed), sub: `${stats?.totalLoans || 0} total loans`, change: stats?.disbursedChange ?? null, icon: '💸', accent: '#1e40af', bg: '#eff6ff' },
    { label: 'Total Collections', value: fmt(stats?.totalCollections), sub: 'received till date', change: stats?.collectionChange ?? null, icon: '📥', accent: '#16a34a', bg: '#f0fdf4' },
    { label: 'Active Customers', value: String(stats?.activeCustomers ?? 0), sub: `${stats?.activeLoans || 0} active loans`, change: null, icon: '👥', accent: '#7c3aed', bg: '#f5f3ff' },
    { label: "Today's Due", value: fmt(today?.dueTodayAmount), sub: `${today?.dueTodayCount || 0} EMIs due today`, change: null, icon: '📅', accent: '#d97706', bg: '#fffbeb' },
    { label: 'NPA (30+ Days)', value: `${stats?.npaPercentage ?? 0}%`, sub: 'non-performing assets', change: null, icon: '⚠️', accent: '#dc2626', bg: '#fef2f2' },
  ];

  // Alerts from real data
  const alerts = [
    overdueCount > 0 ? { icon: '⚠️', color: '#dc2626', bg: '#fef2f2', title: `${overdueCount} accounts overdue`, sub: `Total overdue: ${fmt(overdueAmount)}` } : null,
    (health?.kycPending ?? 0) > 0 ? { icon: '🪪', color: '#d97706', bg: '#fffbeb', title: `KYC pending verification`, sub: `${health?.kycPending} customers awaiting` } : null,
    (health?.failedPayments ?? 0) > 0 ? { icon: '❌', color: '#dc2626', bg: '#fef2f2', title: `${health?.failedPayments} failed payments`, sub: 'Review payment records' } : null,
    { icon: '📊', color: '#1e40af', bg: '#eff6ff', title: `Collection efficiency ${stats?.collectionEfficiency ?? 0}%`, sub: 'vs all due EMIs' },
  ].filter(Boolean) as { icon: string; color: string; bg: string; title: string; sub: string }[];

  const healthItems = [
    { label: 'Database', status: health?.database || 'checking' },
    { label: 'Payments', status: health?.payments || 'checking' },
    { label: 'Server', status: health?.server || 'checking' },
    { label: 'Backup', status: health?.backup || 'checking' },
    { label: 'Security', status: health?.security || 'checking' },
    { label: 'AI Service', status: health?.aiService || 'checking' },
  ];

  const healthyCount = healthItems.filter(h => h.status === 'healthy').length;
  const healthPct = Math.round((healthyCount / healthItems.length) * 100);

  const topBranch = stats?.branchPerformance?.[0];
  const topAiInsight = stats?.aiInsights?.[1]; // collection efficiency

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar user={user} />

      {/* Search overlay */}
      {searchOpen && (
        <div onClick={() => setSearchOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #e5e7eb', gap: 10 }}>
              <span style={{ fontSize: 18 }}>🔍</span>
              <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers, loans, invoices..." style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: '#111827' }} />
              <kbd style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>ESC</kbd>
            </div>
            <div style={{ padding: '12px 18px' }}>
              {['New Loan', 'Add Customer', 'Collect EMI', 'View Collections'].map(q => (
                <div key={q} onClick={() => { setSearchOpen(false); router.push(q === 'New Loan' ? '/dashboard/loans' : q === 'Add Customer' ? '/dashboard/customers' : '/dashboard/collections'); }}
                  style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span>→</span> {q}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Message modal */}
      {msgModal && (
        <div onClick={() => setMsgModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: 24, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Contact Customer</h3>
            <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 16px' }}>EMI due: {fmt(msgModal.amount)}</p>
            <div style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{msgModal.name}</p>
              {msgModal.phone && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>📱 +91 {msgModal.phone}</p>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {msgModal.phone && (
                <button onClick={sendWhatsAppCloudMessage} disabled={sendingWhatsApp}
                  style={{ flex: 1, padding: '9px', background: '#128C7E', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: sendingWhatsApp ? 'default' : 'pointer', opacity: sendingWhatsApp ? 0.7 : 1 }}>
                  {sendingWhatsApp ? 'Sending...' : 'Send API'}
                </button>
              )}
              {msgModal.phone && (
                <a href={`https://wa.me/91${msgModal.phone}?text=Dear ${encodeURIComponent(msgModal.name)}, your EMI of ${fmt(msgModal.amount)} is due. Please pay at the earliest.`}
                  target="_blank" rel="noreferrer"
                  style={{ flex: 1, padding: '9px', background: '#25D366', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}>
                  💬 WhatsApp
                </a>
              )}
              {msgModal.phone && (
                <a href={`sms:${msgModal.phone}?body=Dear ${msgModal.name}, your EMI of ${fmt(msgModal.amount)} is due. Please pay at the earliest.`}
                  style={{ flex: 1, padding: '9px', background: '#1e40af', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}>
                  📱 SMS
                </a>
              )}
              <button onClick={() => setMsgModal(null)} style={{ flex: 1, padding: '9px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginLeft: 220, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        {/* Top Navbar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'white', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Search */}
          <button onClick={() => setSearchOpen(true)} style={{ flex: 1, maxWidth: 420, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'text', color: '#9ca3af', fontSize: 13 }}>
            <span>🔍</span>
            <span>Search customers, loans, invoices...</span>
            <kbd style={{ marginLeft: 'auto', fontSize: 11, background: '#e5e7eb', padding: '1px 5px', borderRadius: 4 }}>Ctrl K</kbd>
          </button>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Notification bell */}
            <button style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 4 }}>
              🔔
              {overdueCount > 0 && (
                <span style={{ position: 'absolute', top: 0, right: 0, width: 16, height: 16, background: '#dc2626', borderRadius: '50%', fontSize: 9, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {overdueCount > 9 ? '9+' : overdueCount}
                </span>
              )}
            </button>

            {/* Calendar */}
            <button style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
              📅 <span suppressHydrationWarning>{todayLabel || 'Loading...'}</span>
            </button>

            {/* User */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #1e40af, #7c3aed)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 700 }}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>{user?.name || 'User'}</p>
                <p style={{ margin: 0, fontSize: 10, color: '#6b7280' }}>{ROLE_LABELS[user?.role || ''] || user?.role}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div style={{ padding: '24px', flex: 1 }}>

          {/* Welcome */}
          <div style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>
              Welcome back, {user?.name?.split(' ')[0] || 'there'}! 👋
            </h2>
            <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: 14 }}>Here is what's happening with your business today.</p>
          </div>

          {/* Overdue Banner */}
          {overdueCount > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: '#dc2626', fontSize: 14 }}>⚠️ {overdueCount} EMIs overdue — {fmt(overdueAmount)} pending</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#991b1b' }}>Follow up with customers to recover dues.</p>
              </div>
              <Link href="/dashboard/collections" style={{ background: '#dc2626', color: 'white', padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                View Overdue →
              </Link>
            </div>
          )}

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
            {kpiCards.map(c => (
              <div key={c.label} style={{ ...card, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <p style={{ color: '#6b7280', fontSize: 11, margin: 0, fontWeight: 500 }}>{c.label}</p>
                  <div style={{ width: 32, height: 32, background: c.bg, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{c.icon}</div>
                </div>
                <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: '#111827' }}>{loading ? '...' : c.value}</p>
                <p style={{ color: '#6b7280', fontSize: 11, margin: '0 0 6px' }}>{c.sub}</p>
                {c.change !== null && <ChangeTag val={c.change} />}
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111827' }}>Quick Actions</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { icon: '👤', label: 'Add Customer', sub: 'Register new customer', href: '/dashboard/customers', bg: '#f0fdf4', color: '#16a34a' },
                { icon: '➕', label: 'New Loan', sub: 'Create & disburse', href: '/dashboard/loans', bg: '#eff6ff', color: '#1e40af' },
                { icon: '💳', label: 'Collect EMI', sub: 'Collect payment', href: '/dashboard/collections', bg: '#fffbeb', color: '#d97706' },
                { icon: '📊', label: 'View Analytics', sub: 'Business reports', href: '/dashboard/analytics', bg: '#f5f3ff', color: '#7c3aed' },
              ].map(q => (
                <Link key={q.label} href={q.href} style={{ ...card, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                  <div style={{ width: 38, height: 38, background: q.bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{q.icon}</div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#111827' }}>{q.label}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{q.sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Three column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.3fr 1fr', gap: 16, marginBottom: 20 }}>

            {/* Today's Collections Due */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111827' }}>📅 Today's Collections Due</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>{fmt(today?.dueTodayAmount)} · {today?.dueTodayCount || 0} EMIs</p>
                </div>
                <Link href="/dashboard/collections" style={{ fontSize: 12, color: '#1e40af', fontWeight: 600, textDecoration: 'none' }}>View All →</Link>
              </div>
              {loading ? <p style={{ color: '#9ca3af', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Loading...</p>
                : !today?.dueToday?.length ? <p style={{ color: '#9ca3af', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>✅ No collections due today</p>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {today.dueToday.slice(0, 6).map((e, i) => (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < 5 ? '1px solid #f3f4f6' : 'none' }}>
                        {/* Avatar */}
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: `hsl(${(e.customerName?.charCodeAt(0) || 0) * 10 % 360}, 60%, 85%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#374151', flexShrink: 0 }}>
                          {e.customerName?.charAt(0)?.toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.customerName}</p>
                          <p style={{ margin: 0, fontSize: 11, color: '#1e40af' }}>LN{1000 + e.loanId}</p>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827', flexShrink: 0 }}>{fmt(e.amount)}</p>
                        {/* Message button */}
                        <button onClick={() => setMsgModal({ name: e.customerName, phone: e.phone, amount: e.amount })}
                          style={{ padding: '5px 8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#16a34a', flexShrink: 0 }} title="Send reminder">
                          💬
                        </button>
                      </div>
                    ))}
                    {(today.dueToday.length > 6) && (
                      <Link href="/dashboard/collections" style={{ display: 'block', textAlign: 'center', padding: '8px 0', fontSize: 12, color: '#6b7280', textDecoration: 'none' }}>
                        +{today.dueToday.length - 6} more
                      </Link>
                    )}
                  </div>
                )}
            </div>

            {/* Recent Loans Disbursed */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111827' }}>💸 Recent Loans Disbursed</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>{stats?.totalLoans || 0} total loans</p>
                </div>
                <Link href="/dashboard/loans" style={{ fontSize: 12, color: '#1e40af', fontWeight: 600, textDecoration: 'none' }}>View All →</Link>
              </div>
              {loading ? <p style={{ color: '#9ca3af', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Loading...</p>
                : !stats?.recentLoans?.length ? <p style={{ color: '#9ca3af', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No loans yet</p>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {stats.recentLoans.map((l, i) => (
                      <div key={l.id} onClick={() => router.push(`/dashboard/loans/${l.id}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < stats.recentLoans.length - 1 ? '1px solid #f3f4f6' : 'none', cursor: 'pointer' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: `hsl(${(l.customer?.name?.charCodeAt(0) || 0) * 15 % 360}, 55%, 85%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#374151', flexShrink: 0 }}>
                          {l.customer?.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.customer?.name || 'Unknown'}</p>
                          <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>LN{1000 + l.id} · {l.type}</p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>{fmt(l.amount)}</p>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 20, background: l.status === 'active' ? '#dcfce7' : '#eff6ff', color: l.status === 'active' ? '#16a34a' : '#1e40af' }}>
                            {l.status === 'active' ? 'Disbursed' : l.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            {/* Alerts + System Health */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Alerts */}
              <div style={{ ...card, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111827' }}>🔔 Alerts</p>
                </div>
                {loading ? <p style={{ color: '#9ca3af', fontSize: 12, padding: '10px 0' }}>Loading...</p>
                  : alerts.length === 0 ? <p style={{ color: '#16a34a', fontSize: 12 }}>✅ All clear, no alerts</p>
                  : alerts.slice(0, 3).map((a, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', background: a.bg, borderRadius: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 14 }}>{a.icon}</span>
                      <div>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: a.color }}>{a.title}</p>
                        <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{a.sub}</p>
                      </div>
                    </div>
                  ))}
              </div>

              {/* System Health */}
              <div style={card}>
                <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: '#111827' }}>⚙️ System Health</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ position: 'relative', width: 52, height: 52 }}>
                    <svg viewBox="0 0 36 36" style={{ width: 52, height: 52, transform: 'rotate(-90deg)' }}>
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                      <circle cx="18" cy="18" r="14" fill="none" stroke={healthPct >= 80 ? '#16a34a' : '#d97706'} strokeWidth="3"
                        strokeDasharray={`${(healthPct / 100) * 87.96} 87.96`} strokeLinecap="round" />
                    </svg>
                    <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#111827' }}>{healthPct}%</span>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>System {healthPct >= 80 ? 'Healthy' : 'Warning'}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{healthyCount}/{healthItems.length} services up</p>
                  </div>
                </div>
                {healthItems.map(h => (
                  <div key={h.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: '#374151' }}><StatusDot status={h.status} />{h.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: h.status === 'healthy' ? '#16a34a' : h.status === 'warning' ? '#d97706' : '#dc2626', textTransform: 'capitalize' }}>{h.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom row: AI Insight + Recent Activity + Top Performer */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

            {/* AI Business Insight */}
            <div style={{ ...card, background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)', border: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>✨</span>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'white' }}>AI Business Insight</p>
              </div>
              {stats?.aiInsights?.map((insight, i) => (
                <div key={i} style={{ marginBottom: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.08)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'white' }}>{insight.icon} {insight.title}</p>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: insight.levelBg, color: insight.levelColor }}>{insight.level}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>{insight.description}</p>
                </div>
              ))}
              {!stats?.aiInsights?.length && loading && <p style={{ color: '#64748b', fontSize: 12 }}>Loading insights...</p>}
            </div>

            {/* Recent Activity */}
            <div style={card}>
              <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: '#111827' }}>🕐 Recent Activity</p>
              {loading ? <p style={{ color: '#9ca3af', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Loading...</p>
                : !today?.recentActivity?.length ? <p style={{ color: '#9ca3af', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No activity yet</p>
                : today.recentActivity.map((a, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, marginBottom: 10, borderBottom: i < today.recentActivity.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{a.customerName}</p>
                      <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>LN{1000 + a.loanId} · {fmtDate(a.date)} · {fmtTime(a.date)} IST</p>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>+{fmt(a.amount)}</span>
                  </div>
                ))}
            </div>

            {/* Top Performer */}
            <div style={card}>
              <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: '#111827' }}>🏆 Branch Performance</p>
              {loading ? <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>Loading...</p>
                : !stats?.branchPerformance?.length ? <p style={{ color: '#9ca3af', fontSize: 13 }}>No branches yet</p>
                : stats.branchPerformance.map((b, i) => (
                  <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: i === 0 ? '#fef9c3' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{b.name}</p>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: b.efficiency >= 80 ? '#16a34a' : '#d97706' }}>{b.efficiency}%</p>
                      </div>
                      <div style={{ marginTop: 4, height: 4, background: '#f3f4f6', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${b.efficiency}%`, background: b.efficiency >= 80 ? '#16a34a' : '#d97706', borderRadius: 2 }} />
                      </div>
                      <p style={{ margin: '3px 0 0', fontSize: 10, color: '#6b7280' }}>{fmt(b.totalDisbursed)} disbursed</p>
                    </div>
                  </div>
                ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
