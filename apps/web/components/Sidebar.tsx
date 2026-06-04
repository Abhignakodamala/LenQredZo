'use client';
import { usePathname } from 'next/navigation';

const menuItems = [
  { name: 'Dashboard', icon: '📊', href: '/dashboard' },
  { name: 'Customers', icon: '👥', href: '/dashboard/customers' },
  { name: 'Loans', icon: '💰', href: '/dashboard/loans' },
  { name: 'Collections', icon: '📋', href: '/dashboard/collections' },
  { name: 'Payments', icon: '💳', href: '/dashboard/payments' },
  { name: 'Analytics', icon: '📈', href: '/dashboard/analytics' },
  { name: 'AI Analysis', icon: '🤖', href: '/dashboard/ai' },
  { name: 'Branches', icon: '🏢', href: '/dashboard/branches' },
  { name: 'Settings', icon: '⚙️', href: '/dashboard/settings' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div style={{width:'240px',background:'white',height:'100vh',position:'fixed',left:0,top:0,borderRight:'1px solid #e5e7eb',display:'flex',flexDirection:'column'}}>
      <div style={{padding:'20px 16px',borderBottom:'1px solid #e5e7eb'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <div style={{width:'32px',height:'32px',background:'#1e40af',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:'bold',fontSize:'14px'}}>F</div>
          <div>
            <p style={{fontWeight:'bold',fontSize:'15px',color:'#1e40af',margin:0}}>FinSmart</p>
            <p style={{fontSize:'11px',color:'#6b7280',margin:0}}>Finance Management</p>
          </div>
        </div>
      </div>
      <nav style={{padding:'12px 8px',flex:1,overflowY:'auto'}}>
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <a key={item.name} href={item.href} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',borderRadius:'8px',marginBottom:'2px',textDecoration:'none',fontSize:'14px',fontWeight:isActive?'600':'400',background:isActive?'#eff6ff':'transparent',color:isActive?'#1e40af':'#374151'}}>
              <span>{item.icon}</span>
              <span>{item.name}</span>
            </a>
          );
        })}
      </nav>
    <div style={{padding:'16px',borderTop:'1px solid #e5e7eb'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px'}}>
          <div style={{width:'32px',height:'32px',background:'#1e40af',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:'12px',fontWeight:'bold'}}>RB</div>
          <div>
            <p style={{fontSize:'13px',fontWeight:'600',margin:0}}>Ramesh Babu</p>
            <p style={{fontSize:'11px',color:'#6b7280',margin:0}}>Super Admin</p>
          </div>
        </div>
        <button onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = '/login'; }} style={{width:'100%',padding:'8px',background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>
          Logout
        </button>
      </div> 
    </div>
  );
}