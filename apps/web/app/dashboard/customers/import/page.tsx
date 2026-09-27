'use client';
import { ChangeEvent, useState, useEffect } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import Sidebar from '@/components/Sidebar';
import { API_URL } from '@/lib/api';
import { getAuthUser, type AuthUser } from '@/lib/authUser';

const ALLOWED = ['owner', 'admin', 'Super Admin', 'branch_manager'];

type ImportRow = { [key: string]: string | number };
type SkipReason = { row: number; name: string; reason: string };

type PreviewRow = { rowNum: number; name: string; phone: string; email: string; address: string; aadhar: string; pan: string; branch: string };

export default function BulkImportPage() {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ addedCount: number; skippedCount: number; skipped: SkipReason[] } | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [validation, setValidation] = useState<{ valid: number; invalid: number; errors: SkipReason[] }>({ valid: 0, invalid: 0, errors: [] });

  useEffect(() => { setMe(getAuthUser()); }, []);

  const downloadTemplate = () => {
    const headers = [['name', 'phone', 'email', 'address', 'aadhar', 'pan', 'branch']];
    const example = [['Ramesh Kumar', '9876543210', 'ramesh@example.com', 'Hyderabad', '123412341234', 'ABCDE1234F', 'Main Branch']];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, 'LenQredZo_Customer_Import_Template.xlsx');
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    setError('');
    setResult(null);
    setPreview([]);
    setValidation({ valid: 0, invalid: 0, errors: [] });
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev: ProgressEvent<FileReader>) => {
      try {
        const result = ev.target?.result;
        if (!result) throw new Error('File load failed');
        const wb = XLSX.read(result, { type: 'array' });
        const firstSheetName = wb.SheetNames[0] ?? null;
        setSheetName(firstSheetName);
        const sheet = wb.Sheets[firstSheetName || ''];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as ImportRow[];
        setRows(json);
        buildPreviewAndValidate(json);
      } catch (err) {
        console.error(err);
        setError('Could not read this file. Please upload the .xlsx template.');
        setRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  function buildPreviewAndValidate(json: ImportRow[]) {
    const p: PreviewRow[] = [];
    const errs: SkipReason[] = [];
    for (let i = 0; i < Math.min(json.length, 5); i++) {
      const r = json[i] || {};
      p.push({
        rowNum: i + 2,
        name: String(r.name ?? r.Name ?? '') as string,
        phone: String(r.phone ?? r.Phone ?? '') as string,
        email: String(r.email ?? r.Email ?? '') as string,
        address: String(r.address ?? r.Address ?? '') as string,
        aadhar: String(r.aadhar ?? r.Aadhaar ?? r.aadhaar ?? '') as string,
        pan: String(r.pan ?? r.PAN ?? r.Pan ?? '') as string,
        branch: String(r.branch ?? r.Branch ?? '') as string
      });
    }

    // quick validation over all rows (not just preview)
    let valid = 0, invalid = 0;
    for (let i = 0; i < json.length; i++) {
      const r = json[i] || {};
      const rowNum = i + 2;
      const name = String(r.name ?? r.Name ?? '').trim();
      const phone = String(r.phone ?? r.Phone ?? '').trim();
      const aadhar = String(r.aadhar ?? r.Aadhaar ?? r.aadhaar ?? '').replace(/\s/g, '').trim();
      let badReason = '';
      if (!name) badReason = 'Name is required';
      else if (!phone) badReason = 'Phone is required';
      else if (aadhar && !/^\d{12}$/.test(aadhar)) badReason = 'Aadhaar must be 12 digits';
      if (badReason) { invalid++; errs.push({ row: rowNum, name: name || '(blank)', reason: badReason }); }
      else valid++;
    }

    setPreview(p);
    setValidation({ valid, invalid, errors: errs });
  }

  const doImport = async (onlyValid = false) => {
    setError('');
    setResult(null);
    if (rows.length === 0) { setError('Please upload a filled template first.'); return; }
    if (rows.length > 2000) { setError('Too many rows. Please import at most 2000 at a time.'); return; }
    setImporting(true);
    try {
      const payload = onlyValid ? { rows: rows.filter((r, i) => !validation.errors.find(e => e.row === i + 2)) } : { rows };
      const res = await fetch(`${API_URL}/api/customers/bulk-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify(payload)
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
  const card = { background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '20px' } as any;
  const btn = { background: '#1e40af', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600 as const, cursor: 'pointer' };

  if (me && !allowed) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
        <Sidebar />
        <div style={{ marginLeft: '220px', flex: 1, padding: '40px', textAlign: 'center', color: '#6b7280' }}>
          <p style={{ fontSize: '40px', margin: '0 0 8px' }}>🔒</p>
          <p style={{ fontWeight: 600, color: '#111827' }}>Bulk import is for owners and managers only.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '24px', maxWidth: '920px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>📥 Bulk Import Customers</h2>
          <p style={{ color: '#6b7280', margin: 0 }}>Upload your existing customers from an Excel sheet</p>
        </div>

        <div style={card}>
          <h3 style={{ fontWeight: 700, fontSize: '16px', margin: '0 0 8px' }}>Step 1 — Download the template</h3>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px' }}>
            Fill your customers into this Excel file. Keep the column names as they are. Name and Phone are required;
            Email, Address, Aadhaar, PAN and Branch are optional. The Branch name must match a branch you&apos;ve already created.
          </p>
          <button onClick={downloadTemplate} style={{ ...btn, background: '#059669' }}>⬇ Download Excel Template</button>
        </div>

        <div style={card}>
          <h3 style={{ fontWeight: 700, fontSize: '16px', margin: '0 0 8px' }}>Step 1 — Upload your filled file</h3>
          <input type="file" accept=".xlsx,.xls" onChange={onFile} style={{ fontSize: '14px' }} />
          {fileName && (
            <p style={{ fontSize: '13px', color: '#374151', margin: '12px 0 0' }}>
              📄 {fileName} — <strong>{rows.length}</strong> rows detected {sheetName && <span style={{ color: '#6b7280' }}>· read sheet: {sheetName}</span>}
            </p>
          )}
          {rows.length === 0 && fileName && (
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>No data rows found — ensure you filled the template and didn't only upload headers.</p>
          )}
          {rows.length > 2000 && (
            <p style={{ fontSize: '13px', color: '#b91c1c', marginTop: '8px' }}>This file has more than 2000 rows; split it before importing.</p>
          )}
        </div>
        
 <div style={card}>
          <h3 style={{ fontWeight: 700, fontSize: '16px', margin: '0 0 8px' }}>Step 2 — Download the template</h3>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px' }}>
            Fill your customers into this Excel file. Keep the column names as they are. Name and Phone are required;
            Email, Address, Aadhaar, PAN and Branch are optional. The Branch name must match a branch you&apos;ve already created.
          </p>
          <button onClick={downloadTemplate} style={{ ...btn, background: '#059669' }}>⬇ Download Excel Template</button>
        </div>


        {rows.length > 0 && (
          <div style={card}>
            <h3 style={{ fontWeight: 700, fontSize: '16px', margin: '0 0 8px' }}>Preview (first 5 rows)</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: 0 }}>We read the first sheet of your workbook. Showing a quick preview and validation.</p>
            <div style={{ overflowX: 'auto', marginTop: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                    {['Row', 'Name', 'Phone', 'Email', 'Aadhaar', 'PAN', 'Branch'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map(r => (
                    <tr key={r.rowNum} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', fontSize: '13px' }}>{r.rowNum}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 700 }}>{r.name || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px' }}>{r.phone || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: '#6b7280' }}>{r.email || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: '#6b7280' }}>{r.aadhar || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: '#6b7280' }}>{r.pan || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px' }}>{r.branch || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
              <div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>{validation.valid} valid rows · {validation.invalid} problems</div>
                {validation.invalid > 0 && (
                  <div style={{ marginTop: '8px', maxHeight: '140px', overflowY: 'auto', border: '1px solid #f3f4f6', borderRadius: '8px' }}>
                    {validation.errors.map((e, i) => (
                      <div key={i} style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }}>
                        Row {e.row}: {e.name} — {e.reason}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => doImport(false)} disabled={importing || rows.length === 0}
                  style={{ ...btn, opacity: (importing || rows.length === 0) ? 0.6 : 1 }}>
                  {importing ? 'Importing...' : `Import all ${rows.length} rows`}
                </button>
                <button onClick={() => doImport(true)} disabled={importing || validation.valid === 0}
                  style={{ ...btn, background: '#059669', opacity: (importing || validation.valid === 0) ? 0.6 : 1 }}>
                  {importing ? 'Importing...' : `Import ${validation.valid} valid rows`}
                </button>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '12px' }}>Tip: If some rows are skipped, fix them in your spreadsheet and re-upload only the problematic rows.</p>
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '20px' }}>
            ⚠️ {error}
          </div>
        )}

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
                  {result.skipped.map((s: SkipReason, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }}>
                      <span style={{ color: '#374151' }}>Row {s.row}: {s.name}</span>
                      <span style={{ color: '#dc2626' }}>{s.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Link href="/dashboard/customers" style={{ display: 'inline-block', marginTop: '16px', color: '#1e40af', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}>
              → View customers
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

