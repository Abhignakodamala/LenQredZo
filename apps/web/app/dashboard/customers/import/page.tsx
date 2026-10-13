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

/**
 * Normalizes common variations of column headers from spreadsheets
 */
function normalizeRow(r: any): ImportRow {
  const getField = (keys: string[]) => {
    for (const k of keys) {
      if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
        return String(r[k]).trim();
      }
    }
    for (const k of keys) {
      const lowerK = k.toLowerCase().replace(/[\s_-]/g, '');
      for (const actualKey of Object.keys(r)) {
        if (actualKey.toLowerCase().replace(/[\s_-]/g, '') === lowerK) {
          const val = String(r[actualKey]).trim();
          if (val !== '') return val;
        }
      }
    }
    return '';
  };

  const name = getField(['name', 'Name', 'Customer Name', 'Full Name', 'Customer', 'Applicant Name']);
  let phone = getField(['phone', 'Phone', 'Mobile', 'Mobile Number', 'Phone Number', 'Contact', 'Contact Number']);
  phone = phone.replace(/\D/g, '').slice(-10);
  const email = getField(['email', 'Email', 'Email Address', 'Email ID']);
  const address = getField(['address', 'Address', 'Residential Address', 'Location', 'City']);
  let aadhar = getField(['aadhar', 'Aadhaar', 'Aadhar', 'Aadhaar Number', 'Aadhar No', 'UID']);
  aadhar = aadhar.replace(/[\s-]/g, '').trim();
  const pan = getField(['pan', 'PAN', 'Pan', 'PAN Card', 'PAN Number', 'Pan No']).toUpperCase();
  const branch = getField(['branch', 'Branch', 'Branch Name', 'Assigned Branch']);

  return { name, phone, email, address, aadhar, pan, branch };
}

/**
 * Extracts structured customer data from text streams of customer profile PDFs
 */
function extractCustomerFromPdfText(text: string): ImportRow {
  const matches: string[] = [];
  const regex = /\((.*?)\)\s*Tj/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    matches.push(m[1].replace(/\\([()\\])/g, '$1'));
  }
  const fullText = matches.join('\n');

  const get = (re: RegExp) => {
    const res = fullText.match(re);
    return res ? res[1].trim() : '';
  };

  const name = get(/(?:Full Name|Applicant Name|Customer Name|Name)[:\s]+([^\n]+)/i) || (matches.length > 4 ? matches[4] : '');
  const rawPhone = get(/(?:Phone Number|Phone|Mobile|Contact)[:\s]+([^\n]+)/i);
  const phone = rawPhone.replace(/\D/g, '').slice(-10);
  const email = get(/(?:Email|E-mail)[:\s]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  const address = get(/(?:Residential Address|Address|Location)[:\s]+([^\n]+)/i);
  let aadhar = get(/(?:Aadhaar Number|Aadhaar|Aadhar)[:\s]+([^\n]+)/i);
  aadhar = aadhar.replace(/[\s-]/g, '').trim();
  const pan = get(/(?:PAN Card|PAN Number|PAN)[:\s]+([A-Z]{5}[0-9]{4}[A-Z])/i);
  const branch = get(/(?:Assigned Branch|Branch)[:\s]+([^\n]+)/i);

  return { name, phone, email, address, aadhar, pan, branch };
}

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

  const downloadTemplateExcel = () => {
    const headers = [['name', 'phone', 'email', 'address', 'aadhar', 'pan', 'branch']];
    const example = [
      ['Rajesh Verma', '9876543210', 'rajesh.verma@example.com', 'Ameerpet, Hyderabad', '849210293847', 'ABCDE1234F', 'Main Branch'],
      ['Priya Sharma', '9823011223', 'priya.sharma91@example.com', 'Jubilee Hills, Hyderabad', '334190284712', 'BKWPS9912K', 'Main Branch']
    ];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, 'LenQredZo_Customer_Import_Template.xlsx');
  };

  const downloadTemplateCsv = () => {
    const csvContent =
      'name,phone,email,address,aadhar,pan,branch\n' +
      'Rajesh Verma,9876543210,rajesh.verma@example.com,"Ameerpet, Hyderabad",849210293847,ABCDE1234F,Main Branch\n' +
      'Priya Sharma,9823011223,priya.sharma91@example.com,"Jubilee Hills, Hyderabad",334190284712,BKWPS9912K,Main Branch\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'LenQredZo_Customer_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    setError('');
    setResult(null);
    setPreview([]);
    setValidation({ valid: 0, invalid: 0, errors: [] });
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    setFileName(fileList.map(f => f.name).join(', '));

    // Handle PDF files directly
    const pdfFiles = fileList.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length > 0) {
      try {
        const parsedRows: ImportRow[] = [];
        for (const file of pdfFiles) {
          const text = await file.text();
          const customer = extractCustomerFromPdfText(text);
          if (customer.name || customer.phone) {
            parsedRows.push(customer);
          }
        }

        if (parsedRows.length === 0) {
          setError('Could not extract customer details from the selected PDF(s). Please verify the document format.');
          setRows([]);
          return;
        }

        setSheetName(`Customer Profile PDF (${parsedRows.length} applicant${parsedRows.length > 1 ? 's' : ''})`);
        setRows(parsedRows);
        buildPreviewAndValidate(parsedRows);
        return;
      } catch (pdfErr) {
        console.error(pdfErr);
        setError('Failed to parse customer PDF document. Please upload a valid customer profile or Excel template.');
        setRows([]);
        return;
      }
    }

    // Handle Excel (.xlsx, .xls) and CSV (.csv) files
    const file = fileList[0];
    const reader = new FileReader();
    reader.onload = (ev: ProgressEvent<FileReader>) => {
      try {
        const res = ev.target?.result;
        if (!res) throw new Error('File load failed');
        const wb = XLSX.read(res, { type: 'array' });
        const firstSheetName = wb.SheetNames[0] ?? null;
        setSheetName(firstSheetName);
        const sheet = wb.Sheets[firstSheetName || ''];
        const rawJson = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as ImportRow[];

        // Normalize rows and skip completely empty lines
        const cleanedRows: ImportRow[] = [];
        for (const r of rawJson) {
          const norm = normalizeRow(r);
          if (norm.name || norm.phone || norm.email || norm.address || norm.aadhar || norm.pan) {
            cleanedRows.push(norm);
          }
        }

        if (cleanedRows.length === 0) {
          setError('No customer rows found. Ensure your file contains headers and valid applicant details.');
          setRows([]);
          return;
        }

        setRows(cleanedRows);
        buildPreviewAndValidate(cleanedRows);
      } catch (err) {
        console.error(err);
        setError('Could not read this file. Please upload an Excel (.xlsx), CSV, or customer profile PDF.');
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
        name: String(r.name || ''),
        phone: String(r.phone || ''),
        email: String(r.email || ''),
        address: String(r.address || ''),
        aadhar: String(r.aadhar || ''),
        pan: String(r.pan || ''),
        branch: String(r.branch || '')
      });
    }

    let valid = 0, invalid = 0;
    for (let i = 0; i < json.length; i++) {
      const r = json[i] || {};
      const rowNum = i + 2;
      const name = String(r.name || '').trim();
      const phone = String(r.phone || '').trim();
      const aadhar = String(r.aadhar || '').replace(/[\s-]/g, '').trim();

      let badReason = '';
      if (!name) badReason = 'Name is required';
      else if (!phone || phone.length < 10) badReason = 'Valid 10-digit Phone is required';
      else if (aadhar && !/^\d{12}$/.test(aadhar) && !/^X{4}-?X{4}-?\d{4}$/i.test(aadhar)) {
        badReason = 'Aadhaar must be 12 digits';
      }

      if (badReason) {
        invalid++;
        errs.push({ row: rowNum, name: name || '(blank)', reason: badReason });
      } else {
        valid++;
      }
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
      const payload = onlyValid ? { rows: rows.filter((_r, i) => !validation.errors.find(e => e.row === i + 2)) } : { rows };
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
  const btn = { background: '#1e40af', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600 as const, cursor: 'pointer' };

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
      <div style={{ marginLeft: '220px', flex: 1, padding: '24px', maxWidth: '960px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>📥 Import Customers</h2>
          <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: '14px' }}>
            Batch import your borrower accounts from Excel spreadsheets, CSV files, or Customer Profile PDFs.
          </p>
        </div>

        {/* Step 1: Template Download */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
            <h3 style={{ fontWeight: 700, fontSize: '16px', margin: 0 }}>Step 1 — Download sample template</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={downloadTemplateExcel} style={{ ...btn, background: '#059669', fontSize: '13px', padding: '8px 14px' }}>
                ⬇ Excel Template (.xlsx)
              </button>
              <button onClick={downloadTemplateCsv} style={{ ...btn, background: '#0284c7', fontSize: '13px', padding: '8px 14px' }}>
                ⬇ CSV Template (.csv)
              </button>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, lineHeight: '1.5' }}>
            Fill customer records into the template. Name and Phone are required; Email, Address, Aadhaar, PAN, and Branch are optional.
            <br />
            <span style={{ color: '#4338ca', fontWeight: 500 }}>
              💡 Pro-Tip: You can also upload customer profile PDF documents directly from the <strong>sample-customer-pdfs</strong> folder!
            </span>
          </p>
        </div>

        {/* Step 2: Upload File */}
        <div style={card}>
          <h3 style={{ fontWeight: 700, fontSize: '16px', margin: '0 0 8px' }}>Step 2 — Upload your customer file(s)</h3>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 14px' }}>
            Accepts <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.csv</strong>, or <strong>.pdf</strong> customer profile documents. You can select single or multiple files.
          </p>
          <input
            type="file"
            multiple
            accept=".xlsx,.xls,.csv,.pdf"
            onChange={onFile}
            style={{ fontSize: '14px', padding: '8px 0' }}
          />

          {fileName && (
            <div style={{ marginTop: '14px', background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: '13px', color: '#1e293b', margin: 0, fontWeight: 600 }}>
                📄 {fileName}
              </p>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
                <strong>{rows.length}</strong> customer records identified {sheetName && `· ${sheetName}`}
              </p>
            </div>
          )}
          {rows.length > 2000 && (
            <p style={{ fontSize: '13px', color: '#b91c1c', marginTop: '8px' }}>This file has more than 2000 rows; please split it before importing.</p>
          )}
        </div>

        {/* Preview & Validation */}
        {rows.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h3 style={{ fontWeight: 700, fontSize: '16px', margin: 0 }}>
                Preview {rows.length <= 5 ? `(${rows.length} records)` : `(first 5 of ${rows.length} records)`}
              </h3>
              <span style={{ fontSize: '12px', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', color: '#475569', fontWeight: 600 }}>
                Ready to Import
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 12px' }}>
              Review customer profile details before committing them to the company database.
            </p>
            <div style={{ overflowX: 'auto', marginTop: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                    {['#', 'Name', 'Phone', 'Email', 'Address', 'Aadhaar', 'PAN', 'Branch'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map(r => (
                    <tr key={r.rowNum} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: '#6b7280' }}>{r.rowNum}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 700, color: '#111827' }}>{r.name || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', fontFamily: 'monospace' }}>{r.phone || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: '#6b7280' }}>{r.email || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: '#4b5563', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.address}>
                        {r.address || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: '#6b7280', fontFamily: 'monospace' }}>{r.aadhar || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: '#111827', fontWeight: 600, fontFamily: 'monospace' }}>{r.pan || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: '#4338ca', fontWeight: 500 }}>{r.branch || 'Default Branch'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '13px', color: '#4b5563', fontWeight: 500 }}>
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>{validation.valid} valid rows</span>
                  {validation.invalid > 0 && (
                    <span style={{ color: '#dc2626', fontWeight: 700, marginLeft: '6px' }}>· {validation.invalid} problematic</span>
                  )}
                </div>
                {validation.invalid > 0 && (
                  <div style={{ marginTop: '8px', maxHeight: '120px', overflowY: 'auto', border: '1px solid #fee2e2', background: '#fff5f5', borderRadius: '8px', padding: '4px' }}>
                    {validation.errors.map((e, i) => (
                      <div key={i} style={{ padding: '6px 10px', fontSize: '12px', color: '#991b1b' }}>
                        Row {e.row}: {e.name} — {e.reason}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => doImport(false)}
                  disabled={importing || rows.length === 0}
                  style={{ ...btn, opacity: (importing || rows.length === 0) ? 0.6 : 1 }}
                >
                  {importing ? 'Importing...' : `Import all ${rows.length} rows`}
                </button>
                {validation.invalid > 0 && (
                  <button
                    onClick={() => doImport(true)}
                    disabled={importing || validation.valid === 0}
                    style={{ ...btn, background: '#059669', opacity: (importing || validation.valid === 0) ? 0.6 : 1 }}
                  >
                    {importing ? 'Importing...' : `Import ${validation.valid} valid rows`}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '20px' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Results Card */}
        {result && (
          <div style={card}>
            <h3 style={{ fontWeight: 700, fontSize: '16px', margin: '0 0 12px' }}>🎉 Import Results</h3>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1, background: '#dcfce7', border: '1px solid #86efac', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#16a34a' }}>{result.addedCount}</div>
                <div style={{ fontSize: '12px', color: '#15803d', fontWeight: 600 }}>Successfully Added</div>
              </div>
              <div style={{ flex: 1, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#dc2626' }}>{result.skippedCount}</div>
                <div style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 600 }}>Skipped (Duplicates / Incomplete)</div>
              </div>
            </div>
            {result.skipped && result.skipped.length > 0 && (
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>Skipped records:</p>
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                  {result.skipped.map((s: SkipReason, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }}>
                      <span style={{ color: '#374151', fontWeight: 500 }}>Row {s.row}: {s.name}</span>
                      <span style={{ color: '#dc2626', fontSize: '12px' }}>{s.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Link
              href="/dashboard/customers"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '16px',
                color: '#1e40af',
                fontWeight: 600,
                fontSize: '14px',
                textDecoration: 'none'
              }}
            >
              <span>👥</span> View all customers in dashboard →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
