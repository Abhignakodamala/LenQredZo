'use client';
import { ChangeEvent, DragEvent, useState, useEffect, useRef } from 'react';
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
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: string; isPdf: boolean }[]>([]);
  const [importing, setImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<{ addedCount: number; skippedCount: number; skipped: SkipReason[] } | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [validation, setValidation] = useState<{ valid: number; invalid: number; errors: SkipReason[] }>({ valid: 0, invalid: 0, errors: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMe(getAuthUser()); }, []);

  const resetAll = () => {
    setRows([]);
    setUploadedFiles([]);
    setPreview([]);
    setValidation({ valid: 0, invalid: 0, errors: [] });
    setError('');
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;
    setError('');
    setResult(null);
    setPreview([]);
    setValidation({ valid: 0, invalid: 0, errors: [] });

    const fileMeta = files.map(f => ({
      name: f.name,
      size: `${(f.size / 1024).toFixed(1)} KB`,
      isPdf: f.name.toLowerCase().endsWith('.pdf')
    }));
    setUploadedFiles(fileMeta);

    // 1. Process PDF documents
    const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
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
          setError('Could not extract customer details from the selected PDF(s). Please check the file content.');
          setRows([]);
          return;
        }

        setRows(parsedRows);
        buildPreviewAndValidate(parsedRows);
        return;
      } catch (pdfErr) {
        console.error(pdfErr);
        setError('Failed to process PDF document. Please verify the document format.');
        setRows([]);
        return;
      }
    }

    // 2. Process Spreadsheet (Excel or CSV)
    const spreadsheetFile = files[0];
    const reader = new FileReader();
    reader.onload = (ev: ProgressEvent<FileReader>) => {
      try {
        const res = ev.target?.result;
        if (!res) throw new Error('File load failed');
        const wb = XLSX.read(res, { type: 'array' });
        const firstSheetName = wb.SheetNames[0] ?? null;
        const sheet = wb.Sheets[firstSheetName || ''];
        const rawJson = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as ImportRow[];

        const cleanedRows: ImportRow[] = [];
        for (const r of rawJson) {
          const norm = normalizeRow(r);
          if (norm.name || norm.phone || norm.email || norm.address || norm.aadhar || norm.pan) {
            cleanedRows.push(norm);
          }
        }

        if (cleanedRows.length === 0) {
          setError('No valid customer data found. Please ensure the file has column headers and customer records.');
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
    reader.readAsArrayBuffer(spreadsheetFile);
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  function buildPreviewAndValidate(json: ImportRow[]) {
    const p: PreviewRow[] = [];
    const errs: SkipReason[] = [];
    for (let i = 0; i < Math.min(json.length, 5); i++) {
      const r = json[i] || {};
      p.push({
        rowNum: i + 1,
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
      const rowNum = i + 1;
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
    if (rows.length === 0) { setError('Please select a file to import first.'); return; }
    if (rows.length > 2000) { setError('Too many rows. Please import at most 2000 at a time.'); return; }
    setImporting(true);
    try {
      const payload = onlyValid ? { rows: rows.filter((_r, i) => !validation.errors.find(e => e.row === i + 1)) } : { rows };
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

  const allowed = me && ALLOWED.includes(me.role);
  const card = { background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: '20px' } as any;

  if (me && !allowed) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
        <Sidebar />
        <div style={{ marginLeft: '220px', flex: 1, padding: '40px', textAlign: 'center', color: '#6b7280' }}>
          <p style={{ fontSize: '40px', margin: '0 0 8px' }}>🔒</p>
          <p style={{ fontWeight: 600, color: '#111827' }}>Customer importing is reserved for owners and branch managers.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '32px', maxWidth: '1000px' }}>
        
        {/* Page Header */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>📥</span> Import Customers
          </h2>
          <p style={{ color: '#64748b', margin: '6px 0 0', fontSize: '14px' }}>
            Directly upload your customer profiles or spreadsheets to add them to your FinSmart database.
          </p>
        </div>

        {/* HERO UPLOAD ZONE (Front & Center) */}
        <div style={card}>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? '#2563eb' : '#cbd5e1'}`,
              background: isDragging ? '#eff6ff' : '#f8fafc',
              borderRadius: '14px',
              padding: '48px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".xlsx,.xls,.csv,.pdf"
              onChange={onFileInputChange}
              style={{ display: 'none' }}
            />

            <div style={{ fontSize: '48px', marginBottom: '12px' }}>
              {isDragging ? '📂' : '⬆️'}
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px' }}>
              {isDragging ? 'Drop your customer files here' : 'Drag & drop customer files, or click to browse'}
            </h3>

            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px', maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto' }}>
              Upload customer profile documents or batch spreadsheets. All fields are auto-detected and extracted.
            </p>

            {/* Supported Formats Pills */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ffffff', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', color: '#dc2626', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                📄 Customer PDFs (.pdf)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ffffff', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', color: '#16a34a', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                📊 Excel (.xlsx, .xls)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ffffff', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', color: '#0284c7', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                📝 CSV (.csv)
              </span>
            </div>
          </div>

          {/* Active File Pills */}
          {uploadedFiles.length > 0 && (
            <div style={{ marginTop: '20px', background: '#f1f5f9', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>✓</span>
                  <span>{uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} selected</span>
                  <span style={{ fontSize: '12px', background: '#e2e8f0', padding: '2px 8px', borderRadius: '12px', color: '#475569', fontWeight: '600' }}>
                    {rows.length} customers detected
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  {uploadedFiles.map(f => f.name).join(' · ')}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); resetAll(); }}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                ✕ Change Files
              </button>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '14px 18px', borderRadius: '12px', fontSize: '14px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* CUSTOMER PREVIEW & VALIDATION TABLE */}
        {rows.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '17px', margin: 0, color: '#0f172a' }}>
                  Extracted Customer Records {rows.length <= 5 ? `(${rows.length})` : `(Showing first 5 of ${rows.length})`}
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
                  Preview applicant particulars before saving them into the company database.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '14px', fontSize: '12px', fontWeight: '700' }}>
                  ✓ {validation.valid} Valid
                </span>
                {validation.invalid > 0 && (
                  <span style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: '14px', fontSize: '12px', fontWeight: '700' }}>
                    ✕ {validation.invalid} Issues
                  </span>
                )}
              </div>
            </div>

            <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['#', 'Full Name', 'Phone Number', 'Email', 'Residential Address', 'Aadhaar', 'PAN', 'Branch'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', fontSize: '12px', color: '#475569', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map(r => (
                    <tr key={r.rowNum} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px', fontSize: '13px', color: '#94a3b8' }}>{r.rowNum}</td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{r.name || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', fontFamily: 'monospace', color: '#1e293b' }}>{r.phone || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', color: '#64748b' }}>{r.email || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', color: '#475569', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.address}>
                        {r.address || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', color: '#64748b', fontFamily: 'monospace' }}>{r.aadhar || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', color: '#0f172a', fontWeight: '600', fontFamily: 'monospace' }}>{r.pan || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', color: '#2563eb', fontWeight: '500' }}>{r.branch || 'Default Branch'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Validation errors if any */}
            {validation.invalid > 0 && (
              <div style={{ marginTop: '14px', maxHeight: '110px', overflowY: 'auto', border: '1px solid #fee2e2', background: '#fff5f5', borderRadius: '10px', padding: '6px' }}>
                {validation.errors.map((e, i) => (
                  <div key={i} style={{ padding: '6px 10px', fontSize: '12px', color: '#991b1b' }}>
                    Record {e.row}: {e.name} — {e.reason}
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              {validation.invalid > 0 && (
                <button
                  onClick={() => doImport(false)}
                  disabled={importing || rows.length === 0}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Import All {rows.length} Records
                </button>
              )}
              <button
                onClick={() => doImport(true)}
                disabled={importing || validation.valid === 0}
                style={{
                  background: '#16a34a',
                  border: 'none',
                  color: '#ffffff',
                  padding: '12px 26px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: (importing || validation.valid === 0) ? 'not-allowed' : 'pointer',
                  opacity: (importing || validation.valid === 0) ? 0.6 : 1,
                  boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)'
                }}
              >
                {importing ? 'Importing Customers...' : `✓ Import ${validation.valid} Customers`}
              </button>
            </div>
          </div>
        )}

        {/* RESULTS CARD */}
        {result && (
          <div style={card}>
            <h3 style={{ fontWeight: 800, fontSize: '18px', margin: '0 0 14px', color: '#0f172a' }}>
              🎉 Import Completed
            </h3>
            <div style={{ display: 'flex', gap: '14px', marginBottom: '18px' }}>
              <div style={{ flex: 1, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#16a34a' }}>{result.addedCount}</div>
                <div style={{ fontSize: '13px', color: '#15803d', fontWeight: 600 }}>Successfully Added</div>
              </div>
              <div style={{ flex: 1, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#dc2626' }}>{result.skippedCount}</div>
                <div style={{ fontSize: '13px', color: '#b91c1c', fontWeight: 600 }}>Skipped (Existing / Duplicates)</div>
              </div>
            </div>

            {result.skipped && result.skipped.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#475569', margin: '0 0 8px' }}>Skipped entries:</p>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  {result.skipped.map((s: SkipReason, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                      <span style={{ color: '#1e293b', fontWeight: 500 }}>Row {s.row}: {s.name}</span>
                      <span style={{ color: '#dc2626', fontSize: '12px' }}>{s.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
              <Link
                href="/dashboard/customers"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#1e3a8a',
                  color: '#ffffff',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  textDecoration: 'none'
                }}
              >
                <span>👥</span> View All Customers →
              </Link>
              <button
                onClick={resetAll}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Upload Another File
              </button>
            </div>
          </div>
        )}

        {/* DISCREET OPTIONAL HELPER LINK (At the bottom) */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              💡 Don&apos;t have a file ready yet?
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
              Download a blank format to enter customer particulars manually before uploading:
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={downloadTemplateExcel}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer'
              }}
            >
              ⬇ Blank Excel (.xlsx)
            </button>
            <button
              onClick={downloadTemplateCsv}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer'
              }}
            >
              ⬇ Blank CSV (.csv)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
