'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { getAuthUser } from '@/lib/authUser';
import { API_URL } from '@/lib/api';

const PRESETS = [
  { id: 'portfolio_health', label: 'Portfolio Health Check', icon: '🩺', desc: "Overall health of your loan book" },
  { id: 'risk_assessment', label: 'Risk Assessment', icon: '⚠️', desc: 'Main risks in simple terms' },
  { id: 'collection_strategy', label: 'Collection Strategy', icon: '📈', desc: 'Ideas to improve collections' },
];

const ALLOWED = ['owner', 'admin', 'Super Admin', 'branch_manager', 'accountant'];

export default function AIAnalysisPage() {
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [activePrompt, setActivePrompt] = useState('');

  useEffect(() => { setMe(getAuthUser()); }, []);

  const run = async (prompt_type: string, q = '') => {
    setLoading(true);
    setError('');
    setResult(null);
    setActivePrompt(prompt_type === 'custom' ? 'custom' : prompt_type);
    try {
      const res = await fetch(`${API_URL}/api/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ prompt_type, question: q })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Could not get analysis.');
        setLoading(false);
        return;
      }
      setResult(data);
    } catch (err) {
      console.error(err);
      setError('Could not reach the server. Make sure the API and AI service are running.');
    }
    setLoading(false);
  };

  const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

  // Mount-safe role guard
  const allowed = me && ALLOWED.includes(me.role);

  if (me && !allowed) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
        <Sidebar />
        <div style={{ marginLeft: '220px', flex: 1, padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: '#6b7280' }}>
            <p style={{ fontSize: '40px', margin: '0 0 8px' }}>🔒</p>
            <p style={{ fontWeight: 600, color: '#111827' }}>AI Analysis is for owners, managers and accountants.</p>
            <p style={{ fontSize: 13 }}>You don't have access to this page.</p>
          </div>
        </div>
      </div>
    );
  }

  const stats = result?.stats;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '24px' }}>

        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>🤖 AI Analysis</h2>
          <p style={{ color: '#6b7280', margin: 0 }}>Plain-language insights on your portfolio, powered by Google Gemini</p>
        </div>

        {/* Preset buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => run(p.id)} disabled={loading}
              style={{
                textAlign: 'left', background: 'white', border: activePrompt === p.id ? '2px solid #1e40af' : '1px solid #e5e7eb',
                borderRadius: '12px', padding: '18px', cursor: loading ? 'default' : 'pointer', opacity: loading && activePrompt !== p.id ? 0.6 : 1
              }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>{p.icon}</div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#111827' }}>{p.label}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{p.desc}</div>
            </button>
          ))}
        </div>

        {/* Custom question */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '18px', marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
            Or ask your own question (aggregate numbers only — no customer names/Aadhaar/PAN)
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input value={question} onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && question.trim() && !loading) run('custom', question.trim()); }}
              placeholder="e.g. what is my biggest risk right now?"
              style={{ flex: 1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }} />
            <button onClick={() => question.trim() && run('custom', question.trim())} disabled={loading || !question.trim()}
              style={{ background: '#1e40af', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: (loading || !question.trim()) ? 'default' : 'pointer', opacity: (loading || !question.trim()) ? 0.6 : 1 }}>
              Ask
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            <p style={{ fontSize: '15px', margin: 0 }}>🤔 Thinking… asking Gemini to analyze your portfolio.</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '14px 16px', borderRadius: '12px', fontSize: '14px' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div>
            {/* Stats analyzed */}
            {stats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                {[
                  { label: 'Total Disbursed', value: fmt(stats.total_disbursed) },
                  { label: 'Total Collected', value: fmt(stats.total_collected) },
                  { label: 'Overdue Amount', value: fmt(stats.overdue_amount) },
                  { label: 'NPA %', value: `${stats.npa_percentage}%` },
                  { label: 'Active Loans', value: stats.active_loans },
                  { label: 'Customers', value: stats.total_customers },
                  { label: 'Collection Efficiency', value: `${stats.collection_efficiency}%` },
                  { label: 'High-risk Customers', value: stats.high_risk_customers },
                ].map(s => (
                  <div key={s.label} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px 14px' }}>
                    <p style={{ color: '#6b7280', fontSize: '11px', margin: '0 0 4px' }}>{s.label}</p>
                    <p style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: '#111827' }}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Insight */}
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <span style={{ fontSize: '20px' }}>💡</span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>AI Insight</h3>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#9ca3af' }}>model: {result.model}</span>
              </div>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.7', color: '#374151', margin: 0 }}>
                {result.insight}
              </p>
            </div>

            {/* Disclaimer */}
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '14px 16px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#92400e', lineHeight: '1.6' }}>
                ⚠️ {result.disclaimer}
              </p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div style={{ background: 'white', border: '1px dashed #d1d5db', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
            <p style={{ fontSize: '15px', margin: 0 }}>Pick an analysis above or ask a question to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}