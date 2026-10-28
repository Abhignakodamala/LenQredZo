'use client';
import React, { useState } from 'react';
import { API_URL } from '@/lib/api';

export interface CreditBureauExportModalProps {
  onClose: () => void;
  companyName?: string;
}

export default function CreditBureauExportModal({
  onClose,
  companyName = 'LenQredzo Capital'
}: CreditBureauExportModalProps) {
  const [bureau, setBureau] = useState<'cibil' | 'crif' | 'experian' | 'equifax'>('cibil');
  const [format, setFormat] = useState<'csv' | 'tudf'>('tudf');
  
  // Default to previous month
  const getDefaultMonth = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const [selectedMonth, setSelectedMonth] = useState<string>(getDefaultMonth());
  const [downloading, setDownloading] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ filename: string; date: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Generate list of the past 12 months for the dropdown
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    return {
      value: val,
      label: i === 1 ? `${label} (Previous Closed Month - Recommended)` : i === 0 ? `${label} (Current Month to Date)` : label
    };
  });

  const bureauList = [
    {
      id: 'cibil',
      name: 'TransUnion CIBIL',
      spec: 'TUDF v2.0 Segmented Spec',
      badge: 'Official CIBIL SFTP',
      color: '#0284c7',
      bg: '#f0f9ff',
      border: '#bae6fd'
    },
    {
      id: 'crif',
      name: 'CRIF High Mark',
      spec: 'CRIF Segmented Flat Spec',
      badge: 'NBFC & MFI Standard',
      color: '#0d9488',
      bg: '#f0fdfa',
      border: '#99f6e4'
    },
    {
      id: 'experian',
      name: 'Experian India',
      spec: 'Experian Retail/SME v2',
      badge: 'Direct Upload Ready',
      color: '#7c3aed',
      bg: '#f5f3ff',
      border: '#ddd6fe'
    },
    {
      id: 'equifax',
      name: 'Equifax India',
      spec: 'Equifax Credit Bureau Standard',
      badge: 'CIC Standard',
      color: '#ea580c',
      bg: '#fff7ed',
      border: '#fed7aa'
    }
  ];

  const handleDownload = async () => {
    try {
      setDownloading(true);
      setErrorMessage(null);
      setSuccessInfo(null);

      const token = localStorage.getItem('token') || '';
      const url = `${API_URL}/api/loans/bureau/export?format=${format}&bureau=${bureau}&month=${selectedMonth}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        let errText = 'Failed to generate bureau export';
        try {
          const errJson = await res.json();
          errText = errJson.error || errText;
        } catch {
          errText = await res.text();
        }
        throw new Error(errText);
      }

      // Extract filename from Content-Disposition if present
      const disposition = res.headers.get('Content-Disposition') || '';
      let filename = `${bureau.toUpperCase()}_${format === 'tudf' ? 'TUDF' : 'BUREAU'}_${selectedMonth.replace('-', '')}.${format === 'tudf' ? 'txt' : 'csv'}`;
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setSuccessInfo({
        filename,
        date: new Date().toLocaleTimeString('en-IN')
      });
    } catch (err: any) {
      console.error('Bureau Export error:', err);
      setErrorMessage(err.message || 'Bureau export encountered an unexpected error.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
      backdropFilter: 'blur(3px)'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '720px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        border: '1px solid #e2e8f0'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: 'white',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '18px' }}>📑</span>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', letterSpacing: '-0.01em' }}>
                Monthly Credit Bureau Data Exporter
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
              RBI / CIC Regulatory Submission for CIBIL, CRIF High Mark, Experian & Equifax
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#e2e8f0',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Target Bureau Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>
              1. Select Credit Information Company (CIC)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {bureauList.map(b => {
                const active = bureau === b.id;
                return (
                  <div
                    key={b.id}
                    onClick={() => setBureau(b.id as any)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: active ? `2px solid ${b.color}` : '1px solid #e2e8f0',
                      background: active ? b.bg : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: active ? b.color : '#1e293b' }}>
                        {b.name}
                      </span>
                      {active && (
                        <span style={{ fontSize: '11px', background: b.color, color: 'white', padding: '1px 6px', borderRadius: '10px', fontWeight: '700' }}>
                          ✓ Selected
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>{b.spec}</p>
                    <div style={{ marginTop: '6px' }}>
                      <span style={{ fontSize: '10px', background: active ? 'white' : '#f1f5f9', color: active ? b.color : '#475569', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                        {b.badge}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Month & Format Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
            {/* Reporting Month */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>
                2. Reporting Calendar Month
              </label>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
                  background: 'white',
                  fontWeight: '500'
                }}
              >
                {monthOptions.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <span style={{ display: 'block', fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                * Per RBI mandates, monthly files must be reported by the 7th of the following month.
              </span>
            </div>

            {/* Output File Format */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>
                3. Transmission Format
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setFormat('tudf')}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: format === 'tudf' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                    background: format === 'tudf' ? '#f0f9ff' : '#f8fafc',
                    color: format === 'tudf' ? '#0369a1' : '#475569',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  📄 TUDF v2.0
                  <span style={{ display: 'block', fontSize: '10px', fontWeight: 'normal', color: '#64748b' }}>
                    Segmented (.txt)
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('csv')}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: format === 'csv' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                    background: format === 'csv' ? '#f0f9ff' : '#f8fafc',
                    color: format === 'csv' ? '#0369a1' : '#475569',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  📊 Flat CSV
                  <span style={{ display: 'block', fontSize: '10px', fontWeight: 'normal', color: '#64748b' }}>
                    Excel (.csv)
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Regulatory Data Readiness Check Card */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px 16px'
          }}>
            <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '700', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              🛡️ Regulatory Data Quality & Audit Safeguards
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#16a34a', fontSize: '14px' }}>✓</span>
                <div>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>PII Decryption & Masking</p>
                  <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>Automated AES decryption of PAN & Aadhaar</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#16a34a', fontSize: '14px' }}>✓</span>
                <div>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>3-Digit DPD Calculation</p>
                  <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>Days Past Due (000–900) mapped to IRAC</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#16a34a', fontSize: '14px' }}>✓</span>
                <div>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>Standard Asset Codes</p>
                  <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>01 Standard, 02 Sub-std, 03 Doubtful, 04 Loss</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#16a34a', fontSize: '14px' }}>✓</span>
                <div>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>Immutable Audit Logging</p>
                  <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>Exports logged in compliance audit trail</p>
                </div>
              </div>
            </div>
          </div>

          {/* Feedback & Status Messages */}
          {errorMessage && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '13px'
            }}>
              ⚠️ {errorMessage}
            </div>
          )}

          {successInfo && (
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#15803d',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <p style={{ margin: 0, fontWeight: '700' }}>✓ Export file successfully generated!</p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#166534' }}>
                  Downloaded: <strong>{successInfo.filename}</strong> at {successInfo.date}
                </p>
              </div>
              <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '4px 8px', borderRadius: '6px', fontWeight: '700' }}>
                Ready for SFTP
              </span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Exporting under: <strong style={{ color: '#0f172a' }}>{companyName}</strong>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              disabled={downloading}
              style={{
                background: 'white',
                border: '1px solid #cbd5e1',
                color: '#475569',
                padding: '9px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{
                background: downloading ? '#94a3b8' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                border: 'none',
                color: 'white',
                padding: '9px 20px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: downloading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.2)'
              }}
            >
              {downloading ? '⏳ Generating Bureau File...' : `⬇️ Export ${bureau.toUpperCase()} File`}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
