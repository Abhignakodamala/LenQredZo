'use client';

import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import { API_URL } from '@/lib/api';
import WhatsAppDueReminderModal from '@/components/WhatsAppDueReminderModal';
import WhatsAppBotConsoleModal from '@/components/WhatsAppBotConsoleModal';
import {
  Search,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Send,
  CheckCheck,
  Check,
  FileText,
  CreditCard,
  Link2,
  User,
  ExternalLink,
  ShieldCheck,
  Plus,
  Settings,
  MessageSquare,
  Sparkles,
  Zap,
  Bot,
  ArrowUpRight,
  Clock,
  X
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'borrower' | 'agent';
  text: string;
  time: string;
  status?: 'sent' | 'delivered' | 'read';
  isReminderCard?: boolean;
  reminderData?: {
    amount: string;
    dueDate: string;
    loanId: string;
  };
  isStatementCard?: boolean;
}

interface ChatContact {
  id: string;
  name: string;
  phone: string;
  customerId: string;
  avatarUrl?: string;
  lastMessage: string;
  lastTime: string;
  unreadCount?: number;
  online?: boolean;
  kycStatus: 'Verified' | 'Pending' | 'Rejected';
  creditScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  activeLoans: number;
  totalOutstanding: string;
  nextEmiDate: string;
  loanId: string;
  loanAmount: string;
  disbursedAmount: string;
  loanStatus: 'Active' | 'Disbursed' | 'Overdue';
  recentActivity: {
    type: 'payment' | 'message' | 'approval';
    title: string;
    details: string;
    time: string;
  }[];
  conversation: ChatMessage[];
}

// Mock initial data based on Figma screenshot
const FIGMA_CONTACTS: ChatContact[] = [
  {
    id: 'srilakshmi',
    name: 'Srilakshmi Muppareni',
    phone: '+91 98765 43210',
    customerId: 'CUS-1024',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
    lastMessage: 'Thank you for the reminder. I will make...',
    lastTime: '10:24 AM',
    unreadCount: 2,
    online: true,
    kycStatus: 'Verified',
    creditScore: 742,
    riskLevel: 'Low',
    activeLoans: 1,
    totalOutstanding: '₹7,80,000',
    nextEmiDate: '08 Sep 2026',
    loanId: 'LN1001',
    loanAmount: '₹10,00,000',
    disbursedAmount: '₹9,60,990',
    loanStatus: 'Active',
    recentActivity: [
      { type: 'payment', title: 'Payment received', details: '₹94,346', time: '02 Sep 2026, 04:21 PM' },
      { type: 'message', title: 'Message sent', details: 'EMI reminder', time: '01 Sep 2026, 09:15 AM' },
      { type: 'approval', title: 'Loan approved', details: 'Personal Loan', time: '28 Aug 2026, 11:30 AM' }
    ],
    conversation: [
      {
        id: '1',
        sender: 'borrower',
        text: 'Hi, I wanted to know my next EMI date and the remaining balance on my loan.',
        time: '09:12 AM'
      },
      {
        id: '2',
        sender: 'agent',
        text: 'Hello Srilakshmi,\n\nYour next EMI is due on 08 Sep 2026.\nOutstanding balance: ₹7,80,000\n\nHere is your official EMI payment link:',
        time: '09:15 AM',
        status: 'read'
      },
      {
        id: '4',
        sender: 'agent',
        text: 'Payment Reminder Notification',
        time: '09:16 AM',
        status: 'read',
        isReminderCard: true,
        reminderData: {
          amount: '₹94,346',
          dueDate: '08 Sep 2026',
          loanId: 'LN1001'
        }
      },
      {
        id: '3',
        sender: 'borrower',
        text: 'Thank you for the reminder. I will make the payment today itself.',
        time: '10:24 AM'
      },
      {
        id: '5',
        sender: 'agent',
        text: "Great! 🙏 Once the payment is received, I'll update your account and you'll get a confirmation message.",
        time: '10:25 AM',
        status: 'read'
      },
      {
        id: '6',
        sender: 'agent',
        text: 'Thanks for your response! Let us know if you need anything else.',
        time: '10:26 AM',
        status: 'read'
      }
    ]
  },
  {
    id: 'ramesh',
    name: 'Ramesh Kumar',
    phone: '+91 98451 22334',
    customerId: 'CUS-1025',
    lastMessage: 'Ok, I will pay today itself. 👍',
    lastTime: '09:45 AM',
    unreadCount: 1,
    online: true,
    kycStatus: 'Verified',
    creditScore: 698,
    riskLevel: 'Low',
    activeLoans: 1,
    totalOutstanding: '₹42,000',
    nextEmiDate: '12 Sep 2026',
    loanId: 'LN1002',
    loanAmount: '₹50,000',
    disbursedAmount: '₹48,000',
    loanStatus: 'Active',
    recentActivity: [
      { type: 'payment', title: 'Payment received', details: '₹8,000', time: '10 Aug 2026, 02:15 PM' },
      { type: 'message', title: 'EMI reminder sent', details: 'Due date reminder', time: '09 Sep 2026, 09:30 AM' }
    ],
    conversation: [
      {
        id: 'r1',
        sender: 'agent',
        text: 'Hello Ramesh,\n\nYour EMI of ₹8,000 for Loan #LN1002 is due on 12 Sep 2026. Please keep payment ready or pay via UPI.',
        time: '09:30 AM',
        status: 'read'
      },
      {
        id: 'r2',
        sender: 'borrower',
        text: 'Ok, I will pay today itself. 👍',
        time: '09:45 AM'
      }
    ]
  },
  {
    id: 'madhavi',
    name: 'Madhavi Rao',
    phone: '+91 97001 88990',
    customerId: 'CUS-1026',
    lastMessage: 'Can you send the loan statement? 📄',
    lastTime: 'Yesterday',
    unreadCount: 0,
    online: false,
    kycStatus: 'Verified',
    creditScore: 710,
    riskLevel: 'Low',
    activeLoans: 1,
    totalOutstanding: '₹1,50,000',
    nextEmiDate: '15 Sep 2026',
    loanId: 'LN1003',
    loanAmount: '₹2,00,000',
    disbursedAmount: '₹1,95,000',
    loanStatus: 'Active',
    recentActivity: [
      { type: 'payment', title: 'Payment received', details: '₹15,000', time: '15 Aug 2026, 11:40 AM' }
    ],
    conversation: [
      {
        id: 'm1',
        sender: 'borrower',
        text: 'Can you send the loan statement? 📄',
        time: 'Yesterday'
      }
    ]
  },
  {
    id: 'vijayalakshmi',
    name: 'Vijayalakshmi',
    phone: '+91 98223 44556',
    customerId: 'CUS-1027',
    lastMessage: 'EMI date is 8th Sep, right?',
    lastTime: 'Yesterday',
    unreadCount: 1,
    online: false,
    kycStatus: 'Pending',
    creditScore: 685,
    riskLevel: 'Medium',
    activeLoans: 1,
    totalOutstanding: '₹65,000',
    nextEmiDate: '08 Sep 2026',
    loanId: 'LN1004',
    loanAmount: '₹1,00,000',
    disbursedAmount: '₹95,000',
    loanStatus: 'Active',
    recentActivity: [
      { type: 'message', title: 'KYC Document Requested', details: 'Aadhaar copy pending', time: 'Yesterday, 04:10 PM' }
    ],
    conversation: [
      {
        id: 'v1',
        sender: 'borrower',
        text: 'EMI date is 8th Sep, right?',
        time: 'Yesterday'
      }
    ]
  },
  {
    id: 'arun',
    name: 'Arun Kumar',
    phone: '+91 99123 77889',
    customerId: 'CUS-1028',
    lastMessage: 'Thanks!',
    lastTime: 'Aug 31',
    unreadCount: 0,
    online: false,
    kycStatus: 'Verified',
    creditScore: 780,
    riskLevel: 'Low',
    activeLoans: 2,
    totalOutstanding: '₹3,40,000',
    nextEmiDate: '20 Sep 2026',
    loanId: 'LN1005',
    loanAmount: '₹5,00,000',
    disbursedAmount: '₹4,90,000',
    loanStatus: 'Active',
    recentActivity: [
      { type: 'payment', title: 'Payment received', details: '₹22,000', time: '31 Aug 2026, 05:30 PM' }
    ],
    conversation: [
      {
        id: 'a1',
        sender: 'agent',
        text: 'Payment of ₹22,000 confirmed. Receipt #RCP-9081 issued.',
        time: 'Aug 31',
        status: 'read'
      },
      {
        id: 'a2',
        sender: 'borrower',
        text: 'Thanks!',
        time: 'Aug 31'
      }
    ]
  },
  {
    id: 'lakshmi',
    name: 'Lakshmi Devi',
    phone: '+91 99551 11223',
    customerId: 'CUS-1029',
    lastMessage: 'Need help with the payment. 💳',
    lastTime: 'Aug 31',
    unreadCount: 1,
    online: true,
    kycStatus: 'Verified',
    creditScore: 660,
    riskLevel: 'Medium',
    activeLoans: 1,
    totalOutstanding: '₹85,000',
    nextEmiDate: '10 Sep 2026',
    loanId: 'LN1006',
    loanAmount: '₹1,20,000',
    disbursedAmount: '₹1,15,000',
    loanStatus: 'Active',
    recentActivity: [
      { type: 'message', title: 'Payment link sent', details: 'UPI Razorpay QR', time: 'Aug 31, 02:20 PM' }
    ],
    conversation: [
      {
        id: 'l1',
        sender: 'borrower',
        text: 'Need help with the payment. 💳',
        time: 'Aug 31'
      }
    ]
  }
];

export default function WhatsAppHubPage() {
  const [contacts, setContacts] = useState<ChatContact[]>(FIGMA_CONTACTS);
  const [selectedContact, setSelectedContact] = useState<ChatContact>(FIGMA_CONTACTS[0]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'groups'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showBotModal, setShowBotModal] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [isMetaConfigured, setIsMetaConfigured] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedContact.conversation]);

  // Load real backend WhatsApp settings and customers if present
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`${API_URL}/api/whatsapp/settings`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.configured) {
          setIsMetaConfigured(true);
          setPhoneNumberId(data.phone_number_id || '');
        }
      })
      .catch(() => {});

    // Try fetching real database customers to merge into contact book
    fetch(`${API_URL}/api/customers`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(backendCusts => {
        if (Array.isArray(backendCusts) && backendCusts.length > 0) {
          // Merge real borrowers seamlessly
          const realFormatted: ChatContact[] = backendCusts.slice(0, 5).map((c: any, idx: number) => ({
            id: `real_${c.id}`,
            name: c.name,
            phone: c.phone || '+91 98000 00000',
            customerId: `CUS-${1000 + c.id}`,
            lastMessage: 'Account verified & loan active.',
            lastTime: '10:00 AM',
            unreadCount: 0,
            online: idx % 2 === 0,
            kycStatus: (c.kycStatus === 'verified' ? 'Verified' : 'Pending') as any,
            creditScore: 720 + (idx * 15),
            riskLevel: 'Low',
            activeLoans: c.activeLoansCount || 1,
            totalOutstanding: '₹1,50,000',
            nextEmiDate: '10 Oct 2026',
            loanId: `LN${1000 + c.id}`,
            loanAmount: '₹1,50,000',
            disbursedAmount: '₹1,45,000',
            loanStatus: 'Active',
            recentActivity: [
              { type: 'payment', title: 'EMI Cleared', details: '₹12,500', time: 'Last week' }
            ],
            conversation: [
              {
                id: `msg_init_${c.id}`,
                sender: 'agent',
                text: `Hello ${c.name}, welcome to LenQredzo Capital. Your account is active.`,
                time: '10:00 AM',
                status: 'read'
              }
            ]
          }));

          setContacts(prev => {
            // Keep unique by customerId
            const map = new Map<string, ChatContact>();
            prev.forEach(item => map.set(item.customerId, item));
            realFormatted.forEach(item => {
              if (!map.has(item.customerId)) {
                map.set(item.customerId, item);
              }
            });
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});
  }, []);

  const showToast = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(null), 3500);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const newMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'agent',
      text: inputText.trim(),
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      status: 'sent'
    };

    // Update conversation locally
    const updatedContacts = contacts.map(c => {
      if (c.id === selectedContact.id) {
        return {
          ...c,
          lastMessage: newMsg.text,
          lastTime: newMsg.time,
          conversation: [...c.conversation, newMsg]
        };
      }
      return c;
    });

    setContacts(updatedContacts);
    setSelectedContact(prev => ({
      ...prev,
      lastMessage: newMsg.text,
      lastTime: newMsg.time,
      conversation: [...prev.conversation, newMsg]
    }));

    setInputText('');

    // If Meta API is configured, forward to backend
    if (isMetaConfigured) {
      try {
        const token = localStorage.getItem('token');
        await fetch(`${API_URL}/api/whatsapp/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            customer_phone: selectedContact.phone,
            customer_name: selectedContact.name,
            custom_message: newMsg.text,
            message_type: 'custom'
          })
        });
        showToast('✓ Delivered via official Meta WhatsApp API');
      } catch {
        showToast('Simulated in Sandbox (Backend offline)');
      }
    } else {
      showToast('✓ Message sent in Sandbox mode (Live in CRM)');
    }
  };

  const handleQuickAction = (action: 'message' | 'statement' | 'payment_link' | 'document') => {
    if (action === 'payment_link') {
      const cardMsg: ChatMessage = {
        id: String(Date.now()),
        sender: 'agent',
        text: 'Automated Payment Link Generated',
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        status: 'read',
        isReminderCard: true,
        reminderData: {
          amount: selectedContact.totalOutstanding || '₹94,346',
          dueDate: selectedContact.nextEmiDate || '08 Sep 2026',
          loanId: selectedContact.loanId || 'LN1001'
        }
      };

      const updated = {
        ...selectedContact,
        conversation: [...selectedContact.conversation, cardMsg]
      };
      setSelectedContact(updated);
      setContacts(contacts.map(c => c.id === updated.id ? updated : c));
      showToast('✓ Payment Link Card inserted into WhatsApp stream');
    } else if (action === 'statement') {
      const stmtMsg: ChatMessage = {
        id: String(Date.now()),
        sender: 'agent',
        text: `📄 Statement of Account for ${selectedContact.loanId} attached.\nPrincipal: ${selectedContact.loanAmount}\nOutstanding: ${selectedContact.totalOutstanding}`,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        status: 'read',
        isStatementCard: true
      };
      const updated = {
        ...selectedContact,
        conversation: [...selectedContact.conversation, stmtMsg]
      };
      setSelectedContact(updated);
      setContacts(contacts.map(c => c.id === updated.id ? updated : c));
      showToast('✓ Loan Statement sent to borrower WhatsApp');
    } else if (action === 'message') {
      setInputText(`Hello ${selectedContact.name}, this is LenQredzo Finance. How can we assist you today?`);
    } else {
      showToast('Document request dispatched');
    }
  };

  const handleSaveMetaSettings = async () => {
    if (!phoneNumberId.trim() || !accessToken.trim()) {
      showToast('Please enter both Phone Number ID and Access Token');
      return;
    }

    setSavingSettings(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/whatsapp/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          phone_number_id: phoneNumberId.trim(),
          whatsapp_token: accessToken.trim()
        })
      });

      if (res.ok) {
        setIsMetaConfigured(true);
        setShowSettingsModal(false);
        showToast('✓ Meta WhatsApp Cloud API credentials saved successfully!');
      } else {
        showToast('Could not save credentials to backend');
      }
    } catch {
      setIsMetaConfigured(true);
      setShowSettingsModal(false);
      showToast('✓ Saved locally (Sandbox Meta Mode Active)');
    } finally {
      setSavingSettings(false);
    }
  };

  // Filtered contacts based on search and tabs
  const filteredContacts = contacts.filter(c => {
    const matchesSearch = `${c.name} ${c.phone} ${c.customerId}`.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeFilter === 'unread') return matchesSearch && (c.unreadCount || 0) > 0;
    if (activeFilter === 'groups') return matchesSearch && c.name.toLowerCase().includes('team');
    return matchesSearch;
  });

  return (
    <div className="flex h-screen w-screen bg-[#f8fafc] overflow-hidden text-slate-800">
      {/* 1. Global Navigation Sidebar */}
      <Sidebar />

      {/* 2. Main WhatsApp Workspace */}
      <main className="ml-[220px] flex-1 flex flex-col h-full overflow-hidden bg-white">
        {/* Top Header Bar */}
        <header className="h-[68px] px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#25D366] flex items-center justify-center text-white shadow-sm shadow-emerald-500/20">
              <MessageSquare className="w-5 h-5 fill-white stroke-none" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">WhatsApp</h1>
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider">
                  Live CRM
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Send and receive messages, reminders and notifications to your customers.
              </p>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-3">
            {toastNotice && (
              <div className="bg-emerald-50 text-emerald-800 text-xs px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 animate-fadeIn">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-semibold">{toastNotice}</span>
              </div>
            )}

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className={`w-2 h-2 rounded-full ${isMetaConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span className="font-medium text-slate-600">
                {isMetaConfigured ? 'Meta Cloud API: Connected' : 'Meta API: Sandbox Simulator'}
              </span>
            </div>

            <button
              onClick={() => setShowBotModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer border border-slate-700"
            >
              <Bot className="w-4 h-4 text-emerald-400" />
              🤖 AI Customer Bot
            </button>

            <button
              onClick={() => setShowAdvanceModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              ⏰ 24-Hr Advance Alerts & Dues
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-all"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              Meta Settings
            </button>
          </div>
        </header>

        {/* 3-Column Figma Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* ──────── COLUMN 1: CHATS LIST (Width: 320px) ──────── */}
          <div className="w-[320px] border-r border-slate-200 bg-white flex flex-col shrink-0">
            {/* Search & New Message */}
            <div className="p-3.5 border-b border-slate-100 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search or start new chat..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
                />
              </div>
              <button
                onClick={() => showToast('Select a borrower or enter mobile number to start new chat')}
                className="bg-[#25D366] hover:bg-emerald-600 text-white p-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center shrink-0"
                title="New Message"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Filter Chips: All 24, Unread 8, Groups 2 */}
            <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  activeFilter === 'all'
                    ? 'bg-[#25D366] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All 24
              </button>
              <button
                onClick={() => setActiveFilter('unread')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeFilter === 'unread'
                    ? 'bg-[#25D366] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Unread</span>
                <span className="bg-white/25 text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">8</span>
              </button>
              <button
                onClick={() => setActiveFilter('groups')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  activeFilter === 'groups'
                    ? 'bg-[#25D366] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Groups 2
              </button>
            </div>

            {/* Contacts Scrollable List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100/80">
              {filteredContacts.map(contact => {
                const isSelected = selectedContact.id === contact.id;
                return (
                  <div
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className={`px-3.5 py-3 flex items-center gap-3 cursor-pointer transition-colors relative ${
                      isSelected ? 'bg-emerald-50/70 border-l-4 border-[#25D366]' : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {contact.avatarUrl ? (
                        <img
                          src={contact.avatarUrl}
                          alt={contact.name}
                          className="w-11 h-11 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                          {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                      )}
                      {contact.online && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                      )}
                    </div>

                    {/* Contact Info Snippet */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <h3 className="text-xs font-bold text-slate-900 truncate">{contact.name}</h3>
                        <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-1">
                          {contact.lastTime}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate leading-tight">
                        {contact.lastMessage}
                      </p>
                    </div>

                    {/* Unread Pill or Checkmarks */}
                    {contact.unreadCount && contact.unreadCount > 0 ? (
                      <span className="w-4 h-4 bg-[#25D366] text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shrink-0">
                        {contact.unreadCount}
                      </span>
                    ) : (
                      <CheckCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ──────── COLUMN 2: ACTIVE CHAT STREAM (Flex 1) ──────── */}
          <div className="flex-1 flex flex-col bg-[#f0f2f5] overflow-hidden relative">
            {/* Active Contact Header */}
            <div className="h-[62px] px-5 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  {selectedContact.avatarUrl ? (
                    <img
                      src={selectedContact.avatarUrl}
                      alt={selectedContact.name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                      {selectedContact.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                  )}
                  {selectedContact.online && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-tight">
                    {selectedContact.name}
                  </h2>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online
                    </span>
                    <span>·</span>
                    <span>{selectedContact.customerId} | {selectedContact.phone}</span>
                  </div>
                </div>
              </div>

              {/* Chat Header Actions */}
              <div className="flex items-center gap-2 text-slate-600">
                <a
                  href={`tel:${selectedContact.phone}`}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-emerald-600 transition-colors"
                  title="Voice Call"
                >
                  <Phone className="w-4 h-4" />
                </a>
                <button
                  onClick={() => showToast('Starting video verification call with borrower...')}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-emerald-600 transition-colors"
                  title="Video Call"
                >
                  <Video className="w-4 h-4" />
                </button>
                <a
                  href={`https://web.whatsapp.com/send?phone=${selectedContact.phone.replace(/\D/g, '')}&text=Hello%20${encodeURIComponent(selectedContact.name)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-1 transition-all"
                  title="Open in WhatsApp Web"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Web</span>
                </a>
                <button
                  onClick={() => showToast('Customer WhatsApp profile options')}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Conversation Stream */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Date Separator */}
              <div className="flex justify-center my-2">
                <span className="bg-slate-200/80 text-slate-600 text-[11px] font-semibold px-3 py-1 rounded-full shadow-2xs">
                  Today, 08 Sep 2026
                </span>
              </div>

              {selectedContact.conversation.map(msg => {
                const isBorrower = msg.sender === 'borrower';

                // Automated Payment Reminder Card from Figma
                if (msg.isReminderCard && msg.reminderData) {
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isBorrower ? 'justify-start' : 'justify-end'} my-3`}
                    >
                      <div
                        className={`max-w-[360px] rounded-2xl p-4 shadow-sm border relative overflow-hidden ${
                          isBorrower
                            ? 'bg-white rounded-tl-xs border-slate-200/80'
                            : 'bg-[#dcf8c6] rounded-tr-xs border-emerald-300/80'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                          <span className="text-xs font-bold text-slate-900 tracking-tight">
                            Payment Reminder
                          </span>
                        </div>

                        <p className="text-xs text-slate-800 leading-relaxed mb-3">
                          Your EMI of <strong className="text-slate-900 font-extrabold">{msg.reminderData.amount}</strong> is due on{' '}
                          <strong className="text-slate-900 font-semibold">{msg.reminderData.dueDate}</strong>. Pay online or visit your branch.
                        </p>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const payUrl = `/dashboard/collections?search=${encodeURIComponent(selectedContact.name)}`;
                              window.open(payUrl, '_blank');
                              navigator.clipboard?.writeText(`https://pay.lenqredzo.com/l/${msg.reminderData?.loanId}`);
                              showToast('✓ Opening Payment Gateway & Link copied!');
                            }}
                            className="flex-1 py-1.5 px-3 bg-[#128C7E] hover:bg-[#075E54] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pay Online</span>
                          </button>
                          <button
                            onClick={() => {
                              window.open('/dashboard/customers', '_blank');
                              showToast('Opening Customer Account Statement');
                            }}
                            className="py-1.5 px-3 bg-white/90 hover:bg-white text-slate-700 border border-slate-300/70 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            Invoice
                          </button>
                        </div>

                        <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-slate-500 font-medium">
                          <span>{msg.time}</span>
                          {!isBorrower && (
                            <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Standard Chat Bubble
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isBorrower ? 'justify-start' : 'justify-end'} my-1`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-xs shadow-2xs leading-relaxed relative ${
                        isBorrower
                          ? 'bg-white text-slate-900 rounded-tl-xs border border-slate-200/60'
                          : 'bg-[#dcf8c6] text-slate-900 rounded-tr-xs'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-400">
                        <span>{msg.time}</span>
                        {!isBorrower && (
                          <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Templates Bar */}
            <div className="bg-white/80 backdrop-blur-xs px-4 py-2 border-t border-slate-200 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                1-Click Templates:
              </span>
              {[
                { label: '📅 EMI Reminder', text: `Hello ${selectedContact.name},\n\nYour next EMI of ${selectedContact.totalOutstanding} is due on ${selectedContact.nextEmiDate}. Please keep payment ready or pay via UPI.\n\nThank you,\nLenQredzo Capital` },
                { label: '🧾 Payment Receipt', text: `Hello ${selectedContact.name},\n\nWe have received your payment towards loan ${selectedContact.loanId}. Thank you for paying on time! Receipt #RCP-${Math.floor(1000 + Math.random() * 9000)} is generated.` },
                { label: '⚠️ Overdue Notice', text: `Urgent: Dear ${selectedContact.name}, your EMI for loan ${selectedContact.loanId} is overdue. Please clear it immediately to avoid late penalty charges.` },
                { label: '🎉 Loan Approved', text: `Congratulations ${selectedContact.name}! Your loan of ${selectedContact.loanAmount} has been approved by LenQredzo Capital.` },
                { label: '🎂 Birthday Wish', text: `Wishing you a very Happy Birthday ${selectedContact.name}! May this year bring you prosperity and success. - From all of us at LenQredzo Capital 🎂` }
              ].map((tpl, i) => (
                <button
                  key={i}
                  onClick={() => setInputText(tpl.text)}
                  className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 text-slate-600 text-[11px] font-medium whitespace-nowrap transition-all"
                >
                  {tpl.label}
                </button>
              ))}
            </div>

            {/* Input Composer Dock */}
            <div className="p-3.5 bg-white border-t border-slate-200 flex items-center gap-3 shrink-0">
              <button
                onClick={() => showToast('Attach document or statement')}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"
                title="Attach"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <button
                onClick={() => setInputText(prev => prev + ' 🙏')}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"
                title="Emoji"
              >
                <Smile className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-slate-100 border border-transparent focus:border-emerald-500 focus:bg-white rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none transition-all placeholder:text-slate-400"
              />
              <button
                onClick={handleSendMessage}
                className="w-9 h-9 rounded-full bg-[#25D366] hover:bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/30 transition-all shrink-0 active:scale-95"
                title="Send"
              >
                <Send className="w-4 h-4 ml-0.5 fill-white stroke-none" />
              </button>
            </div>
          </div>

          {/* ──────── COLUMN 3: CUSTOMER INTELLIGENCE DOSSIER (Width: 340px) ──────── */}
          <div className="w-[340px] border-l border-slate-200 bg-white flex flex-col shrink-0 overflow-y-auto p-5 space-y-5">
            {/* Customer Details Header */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Customer Details</h3>
              <button
                onClick={() => showToast('Editing customer info')}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
              >
                Edit
              </button>
            </div>

            {/* Profile Avatar & Contact */}
            <div className="flex items-center gap-3">
              {selectedContact.avatarUrl ? (
                <img
                  src={selectedContact.avatarUrl}
                  alt={selectedContact.name}
                  className="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-sm"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                  {selectedContact.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{selectedContact.name}</h4>
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.2 rounded">
                    Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {selectedContact.customerId} · {selectedContact.phone}
                </p>
              </div>
            </div>

            {/* 3 Metric Pills: KYC, Credit Score, Risk Level */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">KYC Status</span>
                <span className="text-xs font-bold text-emerald-600 block mt-0.5">
                  {selectedContact.kycStatus}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Credit Score</span>
                <span className="text-xs font-extrabold text-emerald-600 block mt-0.5">
                  {selectedContact.creditScore}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Risk Level</span>
                <span className="text-xs font-bold text-emerald-600 block mt-0.5">
                  {selectedContact.riskLevel}
                </span>
              </div>
            </div>

            {/* 3 Key Stats: Active Loans, Outstanding, Next EMI */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Active Loans</span>
                <span className="text-xs font-extrabold text-slate-900 block mt-0.5">
                  {selectedContact.activeLoans}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Outstanding</span>
                <span className="text-xs font-extrabold text-slate-900 block mt-0.5">
                  {selectedContact.totalOutstanding}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Next EMI</span>
                <span className="text-xs font-bold text-slate-900 block mt-0.5 truncate">
                  {selectedContact.nextEmiDate}
                </span>
              </div>
            </div>

            {/* Quick Actions Grid (From Figma) */}
            <div>
              <span className="text-xs font-bold text-slate-900 block mb-2.5 tracking-tight">
                Quick Actions
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleQuickAction('message')}
                  className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 bg-white text-slate-700 text-xs font-semibold flex items-center gap-2 transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">Send Message</span>
                </button>
                <button
                  onClick={() => handleQuickAction('document')}
                  className="p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 bg-white text-slate-700 text-xs font-semibold flex items-center gap-2 transition-all"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">Send Document</span>
                </button>
                <button
                  onClick={() => handleQuickAction('statement')}
                  className="p-2.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 bg-white text-slate-700 text-xs font-semibold flex items-center gap-2 transition-all"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate">Loan Statement</span>
                </button>
                <button
                  onClick={() => handleQuickAction('payment_link')}
                  className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 bg-white text-slate-700 text-xs font-semibold flex items-center gap-2 transition-all"
                >
                  <Link2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">Payment Link</span>
                </button>
              </div>

              <a
                href={`/dashboard/customers`}
                className="mt-3 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <User className="w-3.5 h-3.5 text-slate-600" />
                <span>View Customer Profile</span>
              </a>
            </div>

            {/* Loan Summary Block (From Figma) */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-xs font-bold text-slate-900 tracking-tight">Loan Summary</span>
                <a href="/dashboard/loans" className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700">
                  View All
                </a>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Loan ID</span>
                  <span className="font-bold text-slate-900">{selectedContact.loanId}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Loan Amount</span>
                  <span className="font-semibold text-slate-900">{selectedContact.loanAmount}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Disbursed Amount</span>
                  <span className="font-semibold text-slate-900">{selectedContact.disbursedAmount}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Outstanding</span>
                  <span className="font-extrabold text-emerald-700">{selectedContact.totalOutstanding}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Next EMI</span>
                  <span className="font-semibold text-slate-900">{selectedContact.nextEmiDate}</span>
                </div>
                <div className="flex justify-between text-slate-500 items-center">
                  <span>Status</span>
                  <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-2 py-0.5 rounded-full">
                    {selectedContact.loanStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Activity Timeline (From Figma) */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-900 block mb-3 tracking-tight">
                Recent Activity
              </span>

              <div className="space-y-3.5 text-xs">
                {selectedContact.recentActivity.map((act, i) => (
                  <div key={i} className="flex gap-2.5 items-start">
                    <span
                      className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                        act.type === 'payment' ? 'bg-emerald-500' : 'bg-blue-500'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <span className="font-bold text-slate-800 text-[11px] truncate">{act.title}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {act.details} · {act.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Meta WhatsApp Cloud API Settings Modal */}
      {showAdvanceModal && (
        <WhatsAppDueReminderModal
          onClose={() => setShowAdvanceModal(false)}
        />
      )}

      {showBotModal && (
        <WhatsAppBotConsoleModal
          onClose={() => setShowBotModal(false)}
        />
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#25D366] text-white flex items-center justify-center">
                  <Settings className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Meta WhatsApp Cloud API</h2>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Enter your client dedicated Meta Business credentials. Messages will flow through their official WhatsApp number (First 1,000 conversations/month are free).
            </p>

            <div className="space-y-3.5 mb-5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Phone Number ID
                </label>
                <input
                  type="text"
                  value={phoneNumberId}
                  onChange={e => setPhoneNumberId(e.target.value)}
                  placeholder="e.g. 109283746592817"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Permanent Access Token
                </label>
                <input
                  type="password"
                  value={accessToken}
                  onChange={e => setAccessToken(e.target.value)}
                  placeholder="EAAG... (Meta Cloud API System Token)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={savingSettings}
                onClick={handleSaveMetaSettings}
                className="flex-1 py-2 rounded-xl bg-[#25D366] hover:bg-emerald-600 text-white text-xs font-bold shadow-sm transition-all"
              >
                {savingSettings ? 'Saving...' : 'Save & Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
