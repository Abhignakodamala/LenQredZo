'use client';
import { useState, useEffect } from 'react';
// Type definitions for 'xlsx' may not be installed in this project. Ignore TS module not found error.
// @ts-ignore: TS2307
import * as XLSX from 'xlsx';
import Sidebar from '@/components/Sidebar';
import { API_URL } from '@/lib/api';
import { getAuthUser } from '@/lib/authUser';

const ALLOWED = ['owner', 'admin', 'Super Admin', 'branch_manager'];

export default function BulkImportPage() {
  const [me, setMe] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => { setMe(getAuthUser()); }, []);

  const downloadTemplate = () => {
    const headers = [['name', 'phone', 'email', 'address', 'aadhar', 'pan', 'branch']];
    const example = [['Ramesh Kumar', '9876543210', 'ramesh@example.com', 'Hyderabad', '123412341234', 'ABCDE1234F', 'Main Branch']];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, 'FinSmart_Customer_Import_Template.xlsx');
  };

  const onFile = (e: any) => {
    setError('');
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev: any) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        setRows(json as any[]);
      } catch (err) {
        console.error(err);
        setError('Could not read this file. Please upload the .xlsx template.');
        setRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const doImport = async () => {
    setError('');
    if (rows.length === 0) { setError('Please upload a filled template first.'); return; }
    setImporting(true);
    try {
      const res = await fetch(`${API_URL}/api/customers/bulk-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ rows })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Import failed.'); setImporting(false); return; }
      setResult(data);
    } catch (err) {
      console.error(err);
      setError('Could not reach the server.');
    }
    setImporting(false);
  };

  const allowed = me && ALLOWED.includes(me.role);
  const card = { background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '20px' };
  const btn = { background: '#1e40af', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600 as any, cursor: 'pointer' };

  if (me && !allowed) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
        <Sidebar />
        <div style={{ marginLeft: '240px', flex: 1, padding: '40px', textAlign: 'center', color: '#6b7280' }}>
          <p style={{ fontSize: '40px', margin: '0 0 8px' }}>🔒</p>
          <p style={{ fontWeight: 600, color: '#111827' }}>Bulk import is for owners and managers only.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '240px', flex: 1, padding: '24px', maxWidth: '820px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>📥 Bulk Import Customers</h2>
          <p style={{ color: '#6b7280', margin: 0 }}>Upload your existing customers from an Excel sheet</p>
        </div>

        <div style={card}>
          <h3 style={{ fontWeight: 700, fontSize: '16px', margin: '0 0 8px' }}>Step 1 — Download the template</h3>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px' }}>
            Fill your customers into this Excel file. Keep the column names as they are. Name and Phone are required;
            Email, Address, Aadhaar, PAN and Branch are optional. The Branch name must match a branch you've already created.
          </p>
          <button onClick={downloadTemplate} style={{ ...btn, background: '#059669' }}>⬇ Download Excel Template</button>
        </div>

        <div style={card}>
          <h3 style={{ fontWeight: 700, fontSize: '16px', margin: '0 0 8px' }}>Step 2 — Upload your filled file</h3>
          <input type="file" accept=".xlsx,.xls" onChange={onFile} style={{ fontSize: '14px' }} />
          {fileName && (
            <p style={{ fontSize: '13px', color: '#374151', margin: '12px 0 0' }}>
              📄 {fileName} — <strong>{rows.length}</strong> rows detected
            </p>
          )}
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '20px' }}>
            ⚠️ {error}
          </div>
        )}

        <div style={card}>
          <h3 style={{ fontWeight: 700, fontSize: '16px', margin: '0 0 8px' }}>Step 3 — Import</h3>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px' }}>
            We'll check each row and add the valid ones. Aadhaar and PAN are encrypted on save.
          </p>
          <button onClick={doImport} disabled={importing || rows.length === 0}
            style={{ ...btn, opacity: (importing || rows.length === 0) ? 0.6 : 1 }}>
            {importing ? 'Importing...' : `Import ${rows.length || ''} Customers`}
          </button>
        </div>

        {result && (
          <div style={card}>
            <h3 style={{ fontWeight: 700, fontSize: '16px', margin: '0 0 12px' }}>Import Results</h3>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1, background: '#dcfce7', border: '1px solid #86efac', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a' }}>{result.addedCount}</div>
                <div style={{ fontSize: '12px', color: '#15803d' }}>Added</div>
              </div>
              <div style={{ flex: 1, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>{result.skippedCount}</div>
                <div style={{ fontSize: '12px', color: '#b91c1c' }}>Skipped</div>
              </div>
            </div>
            {result.skipped && result.skipped.length > 0 && (
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>Skipped rows:</p>
                <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                  {result.skipped.map((s: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }}>
                      <span style={{ color: '#374151' }}>Row {s.row}: {s.name}</span>
                      <span style={{ color: '#dc2626' }}>{s.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <a href="/dashboard/customers" style={{ display: 'inline-block', marginTop: '16px', color: '#1e40af', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}>
              → View customers
            </a>
          </div>
        )}
      </div>
    </div>
  );
}