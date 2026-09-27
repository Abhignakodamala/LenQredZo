'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

type User = { name?: string; role?: string };

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

  const isOwner = OWNER_ROLES.includes(user?.role || '');

  // Staff link is shown only to owners; insert it just before Settings.
  const menuItems = [...baseMenuItems];
  if (isOwner) {
    const settingsIdx = menuItems.findIndex(m => m.name === 'Settings');
    menuItems.splice(settingsIdx, 0, { name: 'Staff', icon: '🧑‍💼', href: '/dashboard/staff' });
  }

  const roleLabel = ROLE_LABELS[user?.role || ''] || user?.role || 'User';

  return (
    <div style={{width:'220px',background:'#0f172a',height:'100vh',position:'fixed',left:0,top:0,borderRight:'1px solid #1e293b',display:'flex',flexDirection:'column'}}>
      
      {/* Logo */}
      <div style={{padding:'16px 20px', borderBottom:'1px solid #1e293b'}}>
  <Image
    src="/lenqredzo-logo-transparent.png"
    alt="LenQredzo"
    width={150}
    height={99}
    style={{
      width:'150px',
      height:'auto',
      objectFit:'contain',
      display:'block',
      filter: 'none',
    }}
  />
      </div>

      {/* Nav */}
      <nav style={{padding:'12px 8px',flex:1,overflowY:'auto'}}>
  {menuItems.map((item) => {
    const isActive = pathname === item.href;
    return (
      <a key={item.name} href={item.href} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',padding:'10px 8px',borderRadius:'8px',marginBottom:'2px',textDecoration:'none',fontSize:'14px',fontWeight:isActive?'600':'400',background:isActive?'#1e40af':'transparent',color:isActive?'white':'#cbd5e1'}}>
        <span>{item.icon}</span>
        <span style={{flex:1}}>{item.name}</span>
      </a>
    );
  })}
</nav>

      {/* User + Logout */}
      <div style={{padding:'16px',borderTop:'1px solid #1e293b'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px'}}>
          <div style={{width:'32px',height:'32px',background:'#1e40af',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:'12px',fontWeight:'bold'}}>
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div>
            <p style={{fontSize:'13px',fontWeight:'600',margin:0,color:'white'}}>{user?.name || 'User'}</p>
            <p style={{fontSize:'11px',color:'#94a3b8',margin:0}}>{roleLabel}</p>
          </div>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }}
          style={{width:'100%',padding:'8px',background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}
        >
          Logout
        </button>
      </div>

    </div>
  );
}