'use client';
import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '@/lib/api';
import {
  X,
  Bot,
  Send,
  Smartphone,
  CheckCheck,
  Check,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Copy,
  RefreshCw,
  Phone,
  User,
  Zap,
  Clock,
  ArrowRight
} from 'lucide-react';

export interface WhatsAppBotConsoleModalProps {
  onClose: () => void;
}

interface MessageItem {
  id: string;
  sender: 'customer' | 'bot';
  text: string;
  time: string;
}

export default function WhatsAppBotConsoleModal({ onClose }: WhatsAppBotConsoleModalProps) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('');
  const [inputMsg, setInputMsg] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [botLogs, setBotLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'simulator' | 'logs' | 'webhook'>('simulator');
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Chat conversation in the simulated phone
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'initial-bot',
      sender: 'bot',
      text: '🙏 *Namaste!*\nWelcome to *LenQredzo Capital* WhatsApp Self-Service Assistant 🤖.\n\nReply *Hi* or pick a quick button below to check your Loan Balance, Next EMI, or 1-Tap UPI Pay Link!',
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Load real customers from database on mount
  useEffect(() => {
    const token = localStorage.getItem('token') || '';
    fetch(`${API_URL}/api/customers`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data.customers || []);
        if (list.length > 0) {
          setCustomers(list);
          const first = list[0];
          setSelectedPhone(first.phone || '');
          setSelectedCustomerName(first.name || 'Borrower');
        }
      })
      .catch(err => {
        console.warn('Could not load customers for bot simulator:', err);
        // Fallback default
        setSelectedPhone('9876543210');
        setSelectedCustomerName('Srilakshmi Muppareni');
      });

    fetchLogs();
  }, []);

  const fetchLogs = () => {
    const token = localStorage.getItem('token') || '';
    fetch(`${API_URL}/api/whatsapp/bot/logs`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.messages) {
          setBotLogs(data.messages);
        }
      })
      .catch(() => {});
  };

  const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const phone = e.target.value;
    setSelectedPhone(phone);
    const found = customers.find(c => c.phone === phone);
    if (found) {
      setSelectedCustomerName(found.name);
    }
  };

  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMsg).trim();
    if (!text) return;

    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    // 1. Add customer message
    const customerMsg: MessageItem = {
      id: `c-${Date.now()}`,
      sender: 'customer',
      text,
      time: timeStr
    };

    setMessages(prev => [...prev, customerMsg]);
    setInputMsg('');
    setIsTyping(true);

    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API_URL}/api/whatsapp/bot/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          customer_phone: selectedPhone,
          message_text: text
        })
      });

      const data = await res.json();
      setIsTyping(false);

      if (data.success && data.botReply) {
        const botMsg: MessageItem = {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: data.botReply,
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, botMsg]);
        fetchLogs();
      } else {
        const fallbackMsg: MessageItem = {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: '🙏 *Namaste!*\nSystem busy unnadhi, please try again in a few seconds.',
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, fallbackMsg]);
      }
    } catch {
      setIsTyping(false);
      const errBotMsg: MessageItem = {
        id: `b-${Date.now()}`,
        sender: 'bot',
        text: '🙏 *Namaste!*\\nNetwork reconnecting... Please verify backend API status.',
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errBotMsg]);
    }
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(`${API_URL}/api/whatsapp/webhook`);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  // Render text with clickable links and bold asterisks
  const formatBotText = (text: string) => {
    return text.split('\n').map((line, lIdx) => {
      // Look for URLs
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const parts = line.split(urlRegex);

      return (
        <div key={lIdx} className="min-h-[1.2rem]">
          {parts.map((part, pIdx) => {
            if (part.match(urlRegex)) {
              return (
                <a
                  key={pIdx}
                  href={part}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 underline font-semibold break-all inline-flex items-center gap-0.5 hover:text-emerald-800"
                >
                  {part}
                  <ExternalLink className="w-3 h-3 inline ml-0.5" />
                </a>
              );
            }
            // Parse bold *word*
            const boldParts = part.split(/(\*.*?\*)/g);
            return boldParts.map((bPart, bIdx) => {
              if (bPart.startsWith('*') && bPart.endsWith('*')) {
                return <strong key={bIdx} className="font-bold text-slate-900">{bPart.slice(1, -1)}</strong>;
              }
              return <span key={bIdx}>{bPart}</span>;
            });
          })}
        </div>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[92vh] max-h-[850px] shadow-2xl flex flex-col border border-slate-200 overflow-hidden">
        {/* Modal Top Bar */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Bot className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Customer WhatsApp Interactive Self-Service Bot
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live 24/7 Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Automated NLP auto-replies for Loan Balance, Next EMI, 1-Tap UPI Links, Mini Statements & Support.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab switchers */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
              <button
                onClick={() => setActiveTab('simulator')}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                  activeTab === 'simulator' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                📱 Live Simulator
              </button>
              <button
                onClick={() => { setActiveTab('logs'); fetchLogs(); }}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                  activeTab === 'logs' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                📑 Bot Audit Logs
              </button>
              <button
                onClick={() => setActiveTab('webhook')}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                  activeTab === 'webhook' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                ⚡ Meta Webhook
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Content */}
        <div className="flex-1 flex overflow-hidden bg-slate-50">
          {/* TAB 1: SIMULATOR & PHONE FRAME */}
          {activeTab === 'simulator' && (
            <div className="flex-1 flex overflow-hidden">
              {/* Left Column: Phone Simulator Frame */}
              <div className="w-[430px] shrink-0 p-4 flex flex-col items-center justify-center bg-slate-200 border-r border-slate-300">
                {/* Phone Exterior Frame */}
                <div className="w-[360px] h-[720px] max-h-full bg-slate-900 rounded-[38px] p-3 shadow-2xl border-4 border-slate-800 flex flex-col relative">
                  {/* Phone Speaker Notch */}
                  <div className="w-28 h-4 bg-slate-800 rounded-full mx-auto mb-1.5 shrink-0" />

                  {/* WhatsApp Screen */}
                  <div className="flex-1 bg-[#EFEAE2] rounded-[28px] overflow-hidden flex flex-col border border-slate-700/20">
                    {/* WhatsApp Top Header Bar */}
                    <div className="bg-[#075E54] text-white px-3.5 py-2.5 flex items-center justify-between shadow shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-400 flex items-center justify-center text-slate-900 font-bold text-xs shadow">
                          🤖
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-xs text-white">LenQredzo Assistant</span>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                          </div>
                          <span className="text-[10px] text-emerald-100 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                            Official Verified Bot
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] bg-emerald-800/80 px-2 py-0.5 rounded text-emerald-200 font-mono">
                        Active
                      </span>
                    </div>

                    {/* Chat Bubble Message Stream */}
                    <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
                      <div className="text-center my-1">
                        <span className="bg-[#FFF3C4] text-[#856404] text-[10px] px-2.5 py-0.5 rounded-md shadow-xs border border-[#FFEEBA]">
                          🔒 Messages are end-to-end encrypted & official
                        </span>
                      </div>

                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex ${m.sender === 'customer' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed shadow-sm relative ${
                              m.sender === 'customer'
                                ? 'bg-[#D9FDD3] text-slate-900 rounded-tr-xs border border-emerald-200'
                                : 'bg-white text-slate-800 rounded-tl-xs border border-slate-200/80'
                            }`}
                          >
                            <div className="text-slate-800 space-y-1">
                              {formatBotText(m.text)}
                            </div>
                            <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-slate-400">
                              <span>{m.time}</span>
                              {m.sender === 'customer' && (
                                <CheckCheck className="w-3 h-3 text-blue-500" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="bg-white rounded-2xl px-3 py-1.5 text-[11px] shadow-sm rounded-tl-xs border border-slate-200 flex items-center gap-1.5 text-slate-500">
                            <Bot className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                            <span>LenQredzo Bot is fetching details...</span>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* WhatsApp Input Bar */}
                    <div className="p-2 bg-[#F0F2F5] border-t border-slate-200 flex items-center gap-1.5 shrink-0">
                      <input
                        type="text"
                        value={inputMsg}
                        onChange={e => setInputMsg(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') sendMessage();
                        }}
                        placeholder="Type message (e.g. Hi, 1, 2)..."
                        className="flex-1 bg-white border border-slate-300 rounded-full px-3.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 placeholder:text-slate-400"
                      />
                      <button
                        onClick={() => sendMessage()}
                        disabled={!inputMsg.trim() || isTyping}
                        className="w-8 h-8 rounded-full bg-[#00A884] hover:bg-[#008f6f] disabled:opacity-50 text-white flex items-center justify-center shadow transition cursor-pointer shrink-0"
                      >
                        <Send className="w-3.5 h-3.5 ml-0.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Test Controls & Keyword Triggers */}
              <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-5">
                {/* 1. Borrower Selector Banner */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      👤 Selected Customer for Simulation:
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedPhone}
                        onChange={handleCustomerChange}
                        className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                      >
                        {customers.map((c) => (
                          <option key={c.id} value={c.phone}>
                            {c.name} ({c.phone}) - {c.loans?.length || 0} Loan(s)
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-slate-500">
                        Borrower: <strong className="text-slate-800">{selectedCustomerName}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 font-medium">Custom Phone:</span>
                    <input
                      type="text"
                      value={selectedPhone}
                      onChange={e => setSelectedPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-32 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                {/* 2. One-Tap Quick Trigger Chips */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    One-Tap Test Commands (Click to Send as Customer):
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => sendMessage('Hi')}
                      className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-left transition cursor-pointer group"
                    >
                      <div className="text-xs font-bold text-emerald-800 flex items-center justify-between">
                        <span>👋 Send "Hi"</span>
                        <ArrowRight className="w-3 h-3 text-emerald-600 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                      <span className="text-[10px] text-emerald-600">Triggers Main Interactive Menu</span>
                    </button>

                    <button
                      onClick={() => sendMessage('1')}
                      className="px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-left transition cursor-pointer group"
                    >
                      <div className="text-xs font-bold text-blue-800 flex items-center justify-between">
                        <span>1️⃣ Send "1" or "Balance"</span>
                        <ArrowRight className="w-3 h-3 text-blue-600 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                      <span className="text-[10px] text-blue-600">Loan Balance & Total Outstanding</span>
                    </button>

                    <button
                      onClick={() => sendMessage('2')}
                      className="px-3 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl text-left transition cursor-pointer group"
                    >
                      <div className="text-xs font-bold text-purple-800 flex items-center justify-between">
                        <span>2️⃣ Send "2" or "EMI"</span>
                        <ArrowRight className="w-3 h-3 text-purple-600 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                      <span className="text-[10px] text-purple-600">Next EMI + 1-Tap UPI Pay Link</span>
                    </button>

                    <button
                      onClick={() => sendMessage('3')}
                      className="px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-left transition cursor-pointer group"
                    >
                      <div className="text-xs font-bold text-amber-800 flex items-center justify-between">
                        <span>3️⃣ Send "3" or "Statement"</span>
                        <ArrowRight className="w-3 h-3 text-amber-600 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                      <span className="text-[10px] text-amber-600">Mini Statement (Last 3 Payments)</span>
                    </button>

                    <button
                      onClick={() => sendMessage('4')}
                      className="px-3 py-2 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-xl text-left transition cursor-pointer group"
                    >
                      <div className="text-xs font-bold text-cyan-800 flex items-center justify-between">
                        <span>4️⃣ Send "4" or "Terms"</span>
                        <ArrowRight className="w-3 h-3 text-cyan-600 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                      <span className="text-[10px] text-cyan-600">Sanction Terms & Interest Rate</span>
                    </button>

                    <button
                      onClick={() => sendMessage('5')}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-left transition cursor-pointer group"
                    >
                      <div className="text-xs font-bold text-rose-800 flex items-center justify-between">
                        <span>5️⃣ Send "5" or "Support"</span>
                        <ArrowRight className="w-3 h-3 text-rose-600 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                      <span className="text-[10px] text-rose-600">Branch Manager / Executive Contact</span>
                    </button>
                  </div>
                </div>

                {/* 3. Natural Language Keywords Matrix */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    Multi-Lingual NLP Keyword Matcher (English + Telugu Slang):
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 font-semibold">Intent</th>
                          <th className="py-2 px-3 font-semibold">Supported Slang & Keywords</th>
                          <th className="py-2 px-3 font-semibold">Real-Time Data Delivered</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        <tr>
                          <td className="py-2 px-3 font-bold text-emerald-700">Greeting / Menu</td>
                          <td className="py-2 px-3 font-mono text-slate-600">hi, hello, namaste, namaskaram, menu, options</td>
                          <td className="py-2 px-3">5-Option Interactive Menu</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 font-bold text-blue-700">1. Balance</td>
                          <td className="py-2 px-3 font-mono text-slate-600">1, balance, outstanding, bakaya, baqaya, loan balance</td>
                          <td className="py-2 px-3">Live Unpaid Principal + Total Remaining EMIs</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 font-bold text-purple-700">2. Next EMI Due</td>
                          <td className="py-2 px-3 font-mono text-slate-600">2, emi, due, pay, payment, kattali, kattu, upi</td>
                          <td className="py-2 px-3">Exact Due Date + Late Penalty + 1-Tap UPI URL</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 font-bold text-amber-700">3. Mini Statement</td>
                          <td className="py-2 px-3 font-mono text-slate-600">3, statement, mini statement, history, receipts</td>
                          <td className="py-2 px-3">Last 3 Transactions with UTR & Receipt Confirm</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 font-bold text-rose-700">5. Branch Support</td>
                          <td className="py-2 px-3 font-mono text-slate-600">5, support, manager, agent, branch, helpdesk</td>
                          <td className="py-2 px-3">Branch Location, Manager Phone & Callback alert</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BOT AUDIT LOGS */}
          {activeTab === 'logs' && (
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Live Customer Bot Conversation History</h3>
                  <p className="text-xs text-slate-500">Every question asked by borrowers and automated answers recorded in database.</p>
                </div>
                <button
                  onClick={fetchLogs}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              </div>

              {botLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                  <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-medium">No bot conversations logged yet. Try testing in the simulator!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {botLogs.map((log: any) => (
                    <div
                      key={log.id}
                      className={`p-3.5 rounded-xl border text-xs shadow-xs ${
                        log.direction === 'received'
                          ? 'bg-emerald-50/50 border-emerald-200'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.direction === 'received' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white'
                          }`}>
                            {log.direction === 'received' ? 'CUSTOMER INQUIRY' : 'BOT AUTO-REPLY'}
                          </span>
                          <strong className="text-slate-800">{log.customer?.name || 'Borrower'}</strong>
                          <span className="text-slate-500 font-mono text-[11px]">({log.customer?.phone})</span>
                        </div>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(log.createdAt).toLocaleTimeString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-slate-700 whitespace-pre-wrap font-sans text-[11px] leading-relaxed bg-white/70 p-2.5 rounded-lg border border-slate-200/60">
                        {log.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: META WEBHOOK INTEGRATION GUIDE */}
          {activeTab === 'webhook' && (
            <div className="flex-1 p-6 overflow-y-auto max-w-3xl mx-auto space-y-5">
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Meta WhatsApp Cloud API Webhook Configuration
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Connect your official Meta WhatsApp Business account so incoming customer messages directly trigger this bot in production.
                </p>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      1. Webhook Callback URL:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${API_URL}/api/whatsapp/webhook`}
                        className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800"
                      />
                      <button
                        onClick={handleCopyWebhook}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiedWebhook ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      2. Verify Token (Password for Handshake):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value="lenqredzo_verify_token"
                        className="w-64 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800"
                      />
                      <span className="text-[11px] text-slate-500">
                        Paste this in Meta Developer Portal under "Verify Token" field.
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      3. Subscribed Webhook Fields:
                    </label>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center gap-2">
                      <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md font-mono text-[11px] font-bold">
                        messages
                      </span>
                      <span className="text-[11px] text-slate-600">
                        Tick the "messages" event checkbox in developers.facebook.com WhatsApp configuration.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 text-emerald-900 text-xs leading-relaxed">
                <h4 className="font-bold flex items-center gap-1.5 mb-1 text-emerald-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Zero Cost Sandbox Mode Active
                </h4>
                Meta Cloud API credentials lekunda kuda, mana internal simulator and API server 100% working! Once customer message pampina ventane, database nundi actual loan balance, pending EMIs, and instant payment URL generate aipothundi.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
