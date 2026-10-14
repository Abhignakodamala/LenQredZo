'use client';
import { useState, useEffect, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import { getAuthUser } from '@/lib/authUser';
import { API_URL } from '@/lib/api';

const PRESETS = [
  { id: 'portfolio_health', label: 'Portfolio Health Check', icon: '🩺', desc: "Comprehensive solvency, capital health & growth roadmap" },
  { id: 'risk_assessment', label: 'Risk Assessment', icon: '⚠️', desc: 'Credit risk classification, default probability & safeguards' },
  { id: 'collection_strategy', label: 'Collection Strategy', icon: '📈', desc: 'Cash velocity, liquidity levers & recovery protocols' },
];

const ALLOWED = ['owner', 'admin', 'Super Admin', 'branch_manager', 'accountant'];

/**
 * Safely parses inline markdown asterisks (**text**) into styled React bold elements
 * so raw asterisks are never visible to the user.
 */
function renderInlineFormatting(text: string) {
  if (!text) return null;
  // Match **bold text**
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const clean = part.slice(2, -2).trim();
      return (
        <strong key={index} style={{ color: '#0f172a', fontWeight: 700 }}>
          {clean}
        </strong>
      );
    }
    return part;
  });
}

/**
 * Parses and renders executive-level financial analysis into institutional cards,
 * categorized sections, styled bullet points, and numbered action items.
 */
function FormattedAnalysisView({ text }: { text: string }) {
  const sections = useMemo(() => {
    if (!text) return [];

    // Normalize text and split by markdown headers or double bold headers
    const rawLines = text.split('\n');
    const parsedSections: { title: string; lines: string[] }[] = [];
    let currentTitle = 'Executive Analysis';
    let currentLines: string[] = [];

    const isHeaderLine = (line: string) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('###') || trimmed.startsWith('##')) return true;
      if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length < 60) return true;
      if (trimmed.startsWith('**') && trimmed.includes(':**') && trimmed.length < 50) return true;
      return false;
    };

    const extractHeaderTitle = (line: string) => {
      return line.replace(/^#+\s*/, '').replace(/\*\*/g, '').replace(/:$/, '').trim();
    };

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (isHeaderLine(line)) {
        if (currentLines.length > 0) {
          parsedSections.push({ title: currentTitle, lines: currentLines });
          currentLines = [];
        }
        currentTitle = extractHeaderTitle(line);
      } else {
        if (line.trim().length > 0) {
          currentLines.push(line.trim());
        }
      }
    }

    if (currentLines.length > 0) {
      parsedSections.push({ title: currentTitle, lines: currentLines });
    }

    return parsedSections;
  }, [text]);

  // Determine section styling and theme icon
  const getSectionTheme = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('summary') || t.includes('overview') || t.includes('diagnostic')) {
      return {
        icon: '📊',
        badgeBg: '#eff6ff',
        badgeColor: '#1d4ed8',
        borderColor: '#bfdbfe',
        cardBg: '#ffffff'
      };
    }
    if (t.includes('good') || t.includes('strength') || t.includes('capital health') || t.includes('positive')) {
      return {
        icon: '🛡️',
        badgeBg: '#f0fdf4',
        badgeColor: '#15803d',
        borderColor: '#bbf7d0',
        cardBg: '#fcfdfd'
      };
    }
    if (t.includes('risk') || t.includes('vulnerabilit') || t.includes('bad') || t.includes('exposure') || t.includes('vigilance')) {
      return {
        icon: '⚠️',
        badgeBg: '#fef3c7',
        badgeColor: '#92400e',
        borderColor: '#fde68a',
        cardBg: '#fffdf9'
      };
    }
    if (t.includes('step') || t.includes('recommend') || t.includes('directive') || t.includes('action') || t.includes('roadmap') || t.includes('protocol')) {
      return {
        icon: '🎯',
        badgeBg: '#ede9fe',
        badgeColor: '#6d28d9',
        borderColor: '#ddd6fe',
        cardBg: '#faf9fe'
      };
    }
    return {
      icon: '📌',
      badgeBg: '#f1f5f9',
      badgeColor: '#334155',
      borderColor: '#e2e8f0',
      cardBg: '#ffffff'
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {sections.map((section, sIdx) => {
        const theme = getSectionTheme(section.title);

        return (
          <div
            key={sIdx}
            style={{
              background: theme.cardBg,
              border: `1px solid ${theme.borderColor}`,
              borderRadius: '12px',
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}
          >
            {/* Section Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '18px' }}>{theme.icon}</span>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                {section.title}
              </h4>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: theme.badgeBg,
                  color: theme.badgeColor
                }}
              >
                Financial Analysis
              </span>
            </div>

            {/* Section Content Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {section.lines.map((line, lIdx) => {
                // Check if line is a numbered item (e.g. "1. Investigate..." or "1) Plan...")
                const numMatch = line.match(/^(\d+)[\.\)]\s*(.*)/);
                if (numMatch) {
                  const num = numMatch[1];
                  const itemContent = numMatch[2];
                  return (
                    <div
                      key={lIdx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        background: '#ffffff',
                        border: '1px solid #f1f5f9',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.015)'
                      }}
                    >
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: '#1e40af',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: '700',
                          flexShrink: 0,
                          marginTop: '1px'
                        }}
                      >
                        {num}
                      </div>
                      <div style={{ fontSize: '13.5px', lineHeight: 1.6, color: '#334155' }}>
                        {renderInlineFormatting(itemContent)}
                      </div>
                    </div>
                  );
                }

                // Check if line is a bullet item (e.g. "- Point" or "• Point" or "* Point")
                const bulletMatch = line.match(/^[\-\*•]\s*(.*)/);
                if (bulletMatch) {
                  const bulletContent = bulletMatch[1];
                  return (
                    <div key={lIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '2px 0' }}>
                      <span style={{ color: '#2563eb', fontSize: '16px', lineHeight: '20px', flexShrink: 0 }}>•</span>
                      <div style={{ fontSize: '13.5px', lineHeight: 1.6, color: '#334155' }}>
                        {renderInlineFormatting(bulletContent)}
                      </div>
                    </div>
                  );
                }

                // Standard paragraph
                return (
                  <p key={lIdx} style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.65, color: '#334155' }}>
                    {renderInlineFormatting(line)}
                  </p>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AIAnalysisPage() {
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [activePrompt, setActivePrompt] = useState('portfolio_health');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMe(getAuthUser());
  }, []);

  const run = async (prompt_type: string, q = '') => {
    setLoading(true);
    setError('');
    setResult(null);
    setActivePrompt(prompt_type === 'custom' ? 'custom' : prompt_type);
    try {
      const res = await fetch(`${API_URL}/api/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
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

  const handleCopyReport = () => {
    if (!result?.insight) return;
    const cleanText = result.insight.replace(/\*\*/g, '');
    navigator.clipboard.writeText(cleanText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

  const allowed = me && ALLOWED.includes(me.role);

  if (me && !allowed) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
        <Sidebar />
        <div style={{ marginLeft: '220px', flex: 1, padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: '#6b7280' }}>
            <p style={{ fontSize: '40px', margin: '0 0 8px' }}>🔒</p>
            <p style={{ fontWeight: 600, color: '#111827' }}>AI Analysis is for owners, managers and accountants.</p>
            <p style={{ fontSize: 13 }}>You do not have access to this page.</p>
          </div>
        </div>
      </div>
    );
  }

  const stats = result?.stats;
  const isPrime = stats?.npa_percentage === 0 && stats?.overdue_amount === 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '28px', maxWidth: '1180px' }}>

        {/* Page Header */}
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                🤖 Institutional Portfolio Intelligence
              </h2>
              <span style={{ background: '#dbeafe', color: '#1e40af', fontSize: '11px', fontWeight: '700', padding: '3px 9px', borderRadius: '12px' }}>
                Google Gemini 2.5
              </span>
            </div>
            <p style={{ color: '#64748b', fontSize: '13.5px', margin: '4px 0 0' }}>
              Executive-grade portfolio health diagnostics, solvency analysis, and risk modeling.
            </p>
          </div>
        </div>

        {/* Analysis Preset Selection Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => run(p.id)}
              disabled={loading}
              style={{
                textAlign: 'left',
                background: activePrompt === p.id ? '#ffffff' : '#ffffff',
                border: activePrompt === p.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '18px 20px',
                cursor: loading ? 'default' : 'pointer',
                opacity: loading && activePrompt !== p.id ? 0.6 : 1,
                boxShadow: activePrompt === p.id ? '0 4px 14px rgba(37,99,235,0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '24px' }}>{p.icon}</span>
                {activePrompt === p.id && (
                  <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }}>
                    Active
                  </span>
                )}
              </div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>{p.label}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', lineHeight: 1.4 }}>{p.desc}</div>
            </button>
          ))}
        </div>

        {/* Custom Management Query Box */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px 20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>
            💬 Or submit a custom inquiry to the AI Credit Analyst:
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && question.trim() && !loading) run('custom', question.trim()); }}
              placeholder="e.g. assess my portfolio collection rate and identify capital expansion bottlenecks..."
              style={{ flex: 1, padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13.5px', outline: 'none' }}
            />
            <button
              onClick={() => question.trim() && run('custom', question.trim())}
              disabled={loading || !question.trim()}
              style={{
                background: '#1e40af',
                color: '#ffffff',
                border: 'none',
                padding: '10px 22px',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: (loading || !question.trim()) ? 'default' : 'pointer',
                opacity: (loading || !question.trim()) ? 0.6 : 1,
                whiteSpace: 'nowrap'
              }}
            >
              Run Diagnostic
            </button>
          </div>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '48px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>🧠</div>
            <p style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a', margin: '0 0 6px' }}>
              Synthesizing Portfolio Diagnostic...
            </p>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              Querying Google Gemini 2.5 with verified balance sheet and repayment metrics.
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '14px 18px', borderRadius: '12px', fontSize: '13.5px', marginBottom: '20px' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Results Container */}
        {result && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Financial Health Overview Bar */}
            {stats && (
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>📋</span>
                    <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: '700', color: '#0f172a' }}>
                      Verified Financial Baseline
                    </h3>
                  </div>
                  <span
                    style={{
                      background: isPrime ? '#f0fdf4' : '#fffbeb',
                      color: isPrime ? '#15803d' : '#b45309',
                      border: `1px solid ${isPrime ? '#bbf7d0' : '#fde68a'}`,
                      fontSize: '12px',
                      fontWeight: '700',
                      padding: '4px 10px',
                      borderRadius: '12px'
                    }}
                  >
                    {isPrime ? '🟢 Prime Portfolio Tier (0% NPA)' : '🟡 Active Portfolio Watch'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {[
                    { label: 'Cumulative Disbursed', value: fmt(stats.total_disbursed), highlight: false },
                    { label: 'Repayments Collected', value: fmt(stats.total_collected), highlight: false },
                    { label: 'Overdue Exposure', value: fmt(stats.overdue_amount), highlight: stats.overdue_amount > 0 },
                    { label: 'NPA Ratio', value: `${stats.npa_percentage}%`, highlight: stats.npa_percentage > 0 },
                    { label: 'Active Loan Accounts', value: stats.active_loans, highlight: false },
                    { label: 'Customer Base', value: stats.total_customers, highlight: false },
                    { label: 'Collection Efficiency', value: `${stats.collection_efficiency}%`, highlight: false },
                    { label: 'Delinquent Accounts', value: `${stats.high_risk_customers} accounts`, highlight: stats.high_risk_customers > 0 },
                  ].map(s => (
                    <div
                      key={s.label}
                      style={{
                        background: '#f8fafc',
                        border: `1px solid ${s.highlight ? '#fecaca' : '#e2e8f0'}`,
                        borderRadius: '10px',
                        padding: '12px 14px'
                      }}
                    >
                      <p style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '0 0 4px' }}>
                        {s.label}
                      </p>
                      <p style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: s.highlight ? '#dc2626' : '#0f172a' }}>
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Structured Executive Advisory Report */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px 28px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
              
              {/* Report Header Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#eff6ff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                    📈
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                      Executive Financial Advisory Report
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                      Analyzed by {result.model} · Strict aggregate metrics privacy policy
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={handleCopyReport}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '6px 14px',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      color: '#334155',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {copied ? '✓ Copied to Clipboard' : '📋 Copy Report'}
                  </button>
                  <button
                    onClick={() => window.print()}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '6px 14px',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      color: '#334155',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    🖨️ Print Report
                  </button>
                </div>
              </div>

              {/* Formatted Sections with no ugly asterisks */}
              <FormattedAnalysisView text={result.insight} />

            </div>

            {/* Regulatory & Advisory Disclaimer */}
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ fontSize: '18px' }}>⚖️</span>
              <p style={{ margin: 0, fontSize: '12px', color: '#92400e', lineHeight: 1.6 }}>
                <strong>Advisory Disclaimer:</strong> {result.disclaimer}
              </p>
            </div>

          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div style={{ background: '#ffffff', border: '1.5px dashed #cbd5e1', borderRadius: '16px', padding: '56px 24px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
            <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
              Institutional Portfolio Advisory
            </h4>
            <p style={{ fontSize: '13.5px', color: '#64748b', maxWidth: '480px', margin: '0 auto 20px', lineHeight: 1.5 }}>
              Select one of the analytical diagnostics above (Portfolio Health Check, Risk Assessment, or Collection Strategy) or enter a custom management query.
            </p>
            <button
              onClick={() => run('portfolio_health')}
              style={{
                background: '#1e40af',
                color: '#ffffff',
                border: 'none',
                padding: '10px 22px',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              🩺 Run Portfolio Health Check
            </button>
          </div>
        )}

      </div>
    </div>
  );
}