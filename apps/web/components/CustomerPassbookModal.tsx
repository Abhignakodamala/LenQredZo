'use client';
import React, { useState, useMemo } from 'react';
import { API_URL } from '@/lib/api';

type CustomerPassbookModalProps = {
  customer: any;
  onClose: () => void;
};

type LedgerTx = {
  id: string;
  date: string;
  loanId: number;
  loanRef: string;
  loanType: string;
  particulars: string;
  paymentMode: string;
  voucherRef: string;
  debit: number;
  credit: number;
  balance: number;
};

export default function CustomerPassbookModal({ customer, onClose }: CustomerPassbookModalProps) {
  const [selectedLoanId, setSelectedLoanId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  if (!customer) return null;

  const loans = customer.loans || [];
  const company = customer.company || {};
  const branch = customer.branch || {};
  const companyName = company.name || 'FINSMART ENTERPRISES';
  const branchName = branch.name || 'Headquarters Branch';
  const branchAddress = branch.address || 'Hyderabad, Telangana';
  const branchPhone = branch.phone || customer.phone || '9876543210';

  const fmt = (n: number) => '₹' + Math.round(Number(n || 0)).toLocaleString('en-IN');
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtDateTime = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  // Build the complete chronological ledger across loans
  const allLedgerTransactions: LedgerTx[] = useMemo(() => {
    const rawEvents: Array<{
      id: string;
      date: string;
      loanId: number;
      loanRef: string;
      loanType: string;
      particulars: string;
      paymentMode: string;
      voucherRef: string;
      debit: number;
      credit: number;
    }> = [];

    loans.forEach((loan: any) => {
      const loanRef = `LN${1000 + loan.id}`;
      const loanType = (loan.type || 'Personal Loan').toUpperCase();

      // 1. Loan Disbursal Event (Debit - Customer borrows)
      const disbursalDate = loan.disbursedAt || loan.createdAt;
      if (disbursalDate) {
        rawEvents.push({
          id: `disb-${loan.id}`,
          date: disbursalDate,
          loanId: loan.id,
          loanRef,
          loanType,
          particulars: `Loan Disbursed (${loanType}) · ROI: ${loan.interestRate}% ${loan.interestType} · Tenure: ${loan.tenure} ${loan.frequency}s`,
          paymentMode: loan.deductUpfront ? 'BANK / NET' : 'BANK / IMPS',
          voucherRef: `DISB-${loanRef}`,
          debit: Number(loan.amount || 0),
          credit: 0
        });
      }

      // 2. Penalties accrued on EMIs (Debit - added liability)
      if (loan.emis && Array.isArray(loan.emis)) {
        loan.emis.forEach((emi: any, idx: number) => {
          if (emi.penalty && Number(emi.penalty) > 0) {
            rawEvents.push({
              id: `pen-${loan.id}-${emi.id}`,
              date: emi.dueDate || loan.createdAt,
              loanId: loan.id,
              loanRef,
              loanType,
              particulars: `Late Payment Penalty Accrued · Installment #${idx + 1}`,
              paymentMode: 'SYSTEM',
              voucherRef: `PEN-${loanRef}-E${emi.id}`,
              debit: Number(emi.penalty),
              credit: 0
            });
          }
        });
      }

      // 3. Payments made by customer (Credit - reduces liability)
      if (loan.payments && Array.isArray(loan.payments)) {
        loan.payments.forEach((payment: any) => {
          const isForeclosure = payment.reference?.toLowerCase().includes('foreclos') ||
                                (payment.amount >= (loan.amount * 0.8) && loan.status === 'closed');
          const particulars = isForeclosure
            ? `Loan Pre-closure / Settlement Repayment · ${loanRef}`
            : `EMI / Installment Repayment · ${loanRef}`;

          rawEvents.push({
            id: `pay-${payment.id}`,
            date: payment.paidAt || payment.createdAt,
            loanId: loan.id,
            loanRef,
            loanType,
            particulars,
            paymentMode: (payment.method || 'CASH').toUpperCase(),
            voucherRef: payment.reference || payment.razorpayPaymentId || `RCP-${payment.id}`,
            debit: 0,
            credit: Number(payment.amount || 0)
          });
        });
      }
    });

    // Sort chronologically ascending
    rawEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let runningBalance = 0;
    return rawEvents.map(evt => {
      runningBalance += (evt.debit - evt.credit);
      return {
        ...evt,
        balance: Math.max(0, runningBalance) // if closed, avoid negative penny rounding
      };
    });
  }, [loans]);

  // Filter based on selected Loan & Date
  const filteredTransactions = useMemo(() => {
    let result = allLedgerTransactions;

    if (selectedLoanId !== 'all') {
      const lid = Number(selectedLoanId);
      // For single loan, calculate running balance specifically for that loan
      const loanSpecific = allLedgerTransactions.filter(tx => tx.loanId === lid);
      let runBal = 0;
      result = loanSpecific.map(tx => {
        runBal += (tx.debit - tx.credit);
        return { ...tx, balance: Math.max(0, runBal) };
      });
    }

    if (dateFilter === 'month') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      result = result.filter(tx => new Date(tx.date) >= thirtyDaysAgo);
    } else if (dateFilter === 'year') {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      result = result.filter(tx => new Date(tx.date) >= oneYearAgo);
    }

    return result;
  }, [allLedgerTransactions, selectedLoanId, dateFilter]);

  // Summary Metrics
  const activeLoansCount = loans.filter((l: any) => l.status === 'active').length;
  const closedLoansCount = loans.filter((l: any) => l.status === 'closed').length;

  const totalDebits = filteredTransactions.reduce((acc, t) => acc + t.debit, 0);
  const totalCredits = filteredTransactions.reduce((acc, t) => acc + t.credit, 0);
  const currentOutstanding = filteredTransactions.length > 0
    ? filteredTransactions[filteredTransactions.length - 1].balance
    : 0;

  const soaNumber = `SOA-${branch.name ? branch.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() : 'HQ'}-2026-CUST${1000 + customer.id}`;
  const statementGeneratedAt = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['#', 'Date & Time', 'Loan Ref', 'Particulars', 'Payment Mode', 'Voucher / Ref', 'Debit (INR)', 'Credit (INR)', 'Running Balance (INR)'];
    const rows = filteredTransactions.map((tx, idx) => [
      idx + 1,
      `"${fmtDateTime(tx.date)}"`,
      `"${tx.loanRef}"`,
      `"${tx.particulars.replace(/"/g, '""')}"`,
      `"${tx.paymentMode}"`,
      `"${tx.voucherRef}"`,
      tx.debit,
      tx.credit,
      tx.balance
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' +
      [
        `Customer Account Statement / Passbook - ${customer.name} (Customer #${customer.id})`,
        `Statement Ref: ${soaNumber}`,
        `Generated On: ${statementGeneratedAt}`,
        `Branch: ${branchName}`,
        '',
        headers.join(','),
        ...rows.map(e => e.join(',')),
        '',
        `Total Debits:,${totalDebits}`,
        `Total Credits (Repaid):,${totalCredits}`,
        `Current Outstanding Balance:,${currentOutstanding}`
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Passbook_${customer.name.replace(/\s+/g, '_')}_${customer.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleWhatsAppShare = () => {
    const text = `*LEGAL ACCOUNT STATEMENT / PASSBOOK (KHATA)*%0A` +
      `*Lender:* ${companyName} (${branchName})%0A` +
      `*Borrower:* ${customer.name} (ID: #${customer.id})%0A` +
      `*Statement Ref:* ${soaNumber}%0A%0A` +
      `📊 *Financial Summary:*%0A` +
      `• Total Loans Taken: ${loans.length}%0A` +
      `• Total Borrowed / Charges: ${fmt(totalDebits)}%0A` +
      `• Total Amount Repaid: ${fmt(totalCredits)}%0A` +
      `• *Current Net Outstanding:* ${fmt(currentOutstanding)}%0A` +
      `• Account Status: ${currentOutstanding === 0 ? '✅ NIL OUTSTANDING (FULL SETTLED)' : '⏳ ACTIVE BALANCE DUE'}%0A%0A` +
      `Detailed official statement available at branch counter or online portal.%0A_Generated via LenQredzo Core System._`;

    const phone = customer.phone?.replace(/[^0-9]/g, '') || '';
    const cleanPhone = phone.startsWith('91') ? phone : `91${phone}`;
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`, '_blank');
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-passbook-statement, #printable-passbook-statement * {
            visibility: visible;
          }
          #printable-passbook-statement {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div style={{
        background: 'white',
        borderRadius: '16px',
        maxWidth: '960px',
        width: '100%',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Top Control Header (Hidden on Print) */}
        <div className="no-print" style={{
          padding: '14px 24px',
          background: '#0f172a',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #1e293b'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>📖</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                Customer Account Passbook / Statement of Account (SOA)
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                Official borrower ledger · Chronological Debit/Credit running balance
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleWhatsAppShare}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#16a34a',
                color: 'white',
                border: 'none',
                padding: '7px 14px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
              title="Send Account Summary to Customer via WhatsApp"
            >
              💬 WhatsApp Summary
            </button>

            <button
              onClick={handleExportCSV}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#334155',
                color: 'white',
                border: 'none',
                padding: '7px 14px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
              title="Download CSV for Excel / Tally"
            >
              📥 Export CSV
            </button>

            <button
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                padding: '7px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.3)'
              }}
            >
              🖨️ Print Passbook (PDF)
            </button>

            <button
              onClick={onClose}
              style={{
                background: '#1e293b',
                color: '#cbd5e1',
                border: 'none',
                padding: '7px 12px',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filter Strip (Hidden on Print) */}
        <div className="no-print" style={{
          padding: '10px 24px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '18px',
          fontSize: '13px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>Filter Loan:</span>
            <select
              value={selectedLoanId}
              onChange={(e) => setSelectedLoanId(e.target.value)}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: 'white',
                fontSize: '13px',
                fontWeight: 500,
                color: '#0f172a'
              }}
            >
              <option value="all">All Loans (Consolidated Khata - {loans.length})</option>
              {loans.map((l: any) => (
                <option key={l.id} value={l.id}>
                  LN{1000 + l.id} · {l.type.toUpperCase()} ({fmt(l.amount)}) - {l.status.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>Time Period:</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: 'white',
                fontSize: '13px',
                fontWeight: 500,
                color: '#0f172a'
              }}
            >
              <option value="all">All Time (Full Lifetime History)</option>
              <option value="month">Last 30 Days</option>
              <option value="year">Last 1 Year</option>
            </select>
          </div>

          <div style={{ marginLeft: 'auto', color: '#64748b', fontSize: '12px' }}>
            Showing <strong>{filteredTransactions.length}</strong> ledger entries
          </div>
        </div>

        {/* Scrollable Printable Statement Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '32px' }}>
          <div id="printable-passbook-statement" style={{
            maxWidth: '880px',
            margin: '0 auto',
            background: 'white',
            color: '#0f172a',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
          }}>

            {/* Letterhead Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '2.5px solid #0f172a',
              paddingBottom: '16px',
              marginBottom: '20px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {company.logo ? (
                    <img
                      src={company.logo.startsWith('http') ? company.logo : `${API_URL}${company.logo}`}
                      alt={companyName}
                      style={{ height: '36px', maxWidth: '120px', objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      background: '#1e3a8a',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: '18px'
                    }}>
                      L
                    </div>
                  )}
                  <h1 style={{
                    margin: 0,
                    fontSize: '22px',
                    fontWeight: 800,
                    color: '#0f172a',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase'
                  }}>
                    {companyName}
                  </h1>
                </div>
                <p style={{ margin: '4px 0 0 42px', fontSize: '12px', color: '#475569', fontWeight: 500 }}>
                  {branchName} · {branchAddress} · Ph: {branchPhone}
                </p>
                <p style={{ margin: '2px 0 0 42px', fontSize: '11px', color: '#64748b' }}>
                  Authorized Micro-Lending & Enterprise Credit Registry · Reg No: TS-HYD-FIN-2024
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block',
                  background: '#0f172a',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '11px',
                  padding: '3px 10px',
                  borderRadius: '4px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  marginBottom: '6px'
                }}>
                  Official Passbook Ledger
                </span>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                  Ref: <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>{soaNumber}</span>
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                  Issued: {statementGeneratedAt}
                </p>
              </div>
            </div>

            {/* Document Title Banner */}
            <div style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '10px 16px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Statement of Account / Customer Passbook (Khata)
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#475569' }}>
                  Detailed record of disbursements, EMI collections, penalties, and running ledger balance
                </p>
              </div>
              <div style={{
                background: currentOutstanding === 0 ? '#dcfce7' : '#fef3c7',
                border: `1px solid ${currentOutstanding === 0 ? '#86efac' : '#fde68a'}`,
                color: currentOutstanding === 0 ? '#15803d' : '#b45309',
                padding: '5px 12px',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '12px',
                letterSpacing: '0.3px',
                textAlign: 'right'
              }}>
                {currentOutstanding === 0 ? '✓ NIL OUTSTANDING / CLEARED' : `● OUTSTANDING: ${fmt(currentOutstanding)}`}
              </div>
            </div>

            {/* Customer Details & Branch Box */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: '16px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '14px 18px',
              marginBottom: '20px'
            }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Borrower Particulars
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  {customer.name}
                </div>
                <div style={{ fontSize: '12px', color: '#334155', marginTop: '3px' }}>
                  📱 <strong>Phone:</strong> {customer.phone} · 🆔 <strong>Customer ID:</strong> #{customer.id}
                </div>
                <div style={{ fontSize: '12px', color: '#334155', marginTop: '2px' }}>
                  📍 <strong>Address:</strong> {customer.address || customer.street || 'Not provided'}
                  {customer.city ? `, ${customer.city}` : ''}
                  {customer.state ? `, ${customer.state}` : ''}
                </div>
                <div style={{ fontSize: '12px', color: '#334155', marginTop: '2px' }}>
                  🪪 <strong>Aadhaar:</strong> {customer.aadhar || 'Verified on file'} · 💳 <strong>PAN:</strong> {customer.pan || 'Verified on file'}
                </div>
              </div>

              <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Banking & KYC Status
                </div>
                <div style={{ fontSize: '12px', color: '#334155' }}>
                  <strong>KYC Status:</strong>{' '}
                  <span style={{
                    color: customer.kycStatus === 'verified' ? '#15803d' : '#b45309',
                    fontWeight: 700
                  }}>
                    {customer.kycStatus === 'verified' ? '✓ Verified' : customer.kycStatus?.toUpperCase() || 'PENDING'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#334155', marginTop: '3px' }}>
                  <strong>Linked Bank:</strong> {customer.bankName || 'Verified Primary Account'}
                </div>
                <div style={{ fontSize: '12px', color: '#334155', marginTop: '2px' }}>
                  <strong>A/C No:</strong> {customer.bankAccountNumber || '••••••••'} · <strong>IFSC:</strong> {customer.bankIfsc || '—'}
                </div>
                <div style={{ fontSize: '12px', color: '#334155', marginTop: '2px' }}>
                  <strong>Loans Summary:</strong> {loans.length} Total ({activeLoansCount} Active, {closedLoansCount} Settled)
                </div>
              </div>
            </div>

            {/* Financial Summary KPI Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              marginBottom: '22px'
            }}>
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '10px 14px'
              }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Total Debits (Borrowed/Fees)</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                  {fmt(totalDebits)}
                </div>
              </div>

              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '10px 14px'
              }}>
                <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>Total Repaid (Credits)</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
                  {fmt(totalCredits)}
                </div>
              </div>

              <div style={{
                background: currentOutstanding === 0 ? '#f0fdf4' : '#fffbeb',
                border: `1px solid ${currentOutstanding === 0 ? '#bbf7d0' : '#fde68a'}`,
                borderRadius: '8px',
                padding: '10px 14px'
              }}>
                <div style={{ fontSize: '11px', color: currentOutstanding === 0 ? '#166534' : '#92400e', fontWeight: 600 }}>
                  Current Outstanding (Balance)
                </div>
                <div style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: currentOutstanding === 0 ? '#15803d' : '#b45309',
                  marginTop: '4px'
                }}>
                  {fmt(currentOutstanding)}
                </div>
              </div>

              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '10px 14px'
              }}>
                <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600 }}>Total Transactions</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#1d4ed8', marginTop: '4px' }}>
                  {filteredTransactions.length} Entries
                </div>
              </div>
            </div>

            {/* Passbook Chronological Ledger Table */}
            <div style={{
              border: '1.5px solid #cbd5e1',
              borderRadius: '8px',
              overflow: 'hidden',
              marginBottom: '24px'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#0f172a', color: 'white' }}>
                    <th style={{ padding: '9px 10px', textAlign: 'left', width: '35px', fontWeight: 600 }}>#</th>
                    <th style={{ padding: '9px 10px', textAlign: 'left', width: '95px', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '9px 10px', textAlign: 'left', width: '75px', fontWeight: 600 }}>Loan</th>
                    <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600 }}>Particulars / Narration</th>
                    <th style={{ padding: '9px 10px', textAlign: 'center', width: '75px', fontWeight: 600 }}>Mode</th>
                    <th style={{ padding: '9px 10px', textAlign: 'left', width: '105px', fontWeight: 600 }}>Ref / Receipt #</th>
                    <th style={{ padding: '9px 10px', textAlign: 'right', width: '85px', fontWeight: 600 }}>Debit (₹)</th>
                    <th style={{ padding: '9px 10px', textAlign: 'right', width: '85px', fontWeight: 600 }}>Credit (₹)</th>
                    <th style={{ padding: '9px 10px', textAlign: 'right', width: '95px', fontWeight: 700 }}>Balance (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                        No financial transactions found for the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx, idx) => (
                      <tr
                        key={tx.id}
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                          pageBreakInside: 'avoid'
                        }}
                      >
                        <td style={{ padding: '8px 10px', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', fontWeight: 500, color: '#334155' }}>
                          {fmtDate(tx.date)}
                        </td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: '#1e3a8a',
                            background: '#eff6ff',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}>
                            {tx.loanRef}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', color: '#0f172a', fontWeight: 500 }}>
                          {tx.particulars}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: tx.paymentMode.includes('CASH') ? '#fef3c7' : '#e0e7ff',
                            color: tx.paymentMode.includes('CASH') ? '#92400e' : '#3730a3'
                          }}>
                            {tx.paymentMode}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: '11px', color: '#475569' }}>
                          {tx.voucherRef}
                        </td>
                        <td style={{
                          padding: '8px 10px',
                          textAlign: 'right',
                          fontWeight: tx.debit > 0 ? 700 : 400,
                          color: tx.debit > 0 ? '#b91c1c' : '#94a3b8'
                        }}>
                          {tx.debit > 0 ? fmt(tx.debit) : '—'}
                        </td>
                        <td style={{
                          padding: '8px 10px',
                          textAlign: 'right',
                          fontWeight: tx.credit > 0 ? 700 : 400,
                          color: tx.credit > 0 ? '#15803d' : '#94a3b8'
                        }}>
                          {tx.credit > 0 ? fmt(tx.credit) : '—'}
                        </td>
                        <td style={{
                          padding: '8px 10px',
                          textAlign: 'right',
                          fontWeight: 800,
                          color: tx.balance === 0 ? '#15803d' : '#0f172a',
                          background: idx % 2 === 0 ? '#f1f5f9' : '#e2e8f0'
                        }}>
                          {fmt(tx.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #0f172a', fontWeight: 700 }}>
                    <td colSpan={6} style={{ padding: '10px', textAlign: 'right', fontSize: '12px', color: '#0f172a' }}>
                      TOTALS / CLOSING BALANCE:
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#b91c1c', fontSize: '13px' }}>
                      {fmt(totalDebits)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#15803d', fontSize: '13px' }}>
                      {fmt(totalCredits)}
                    </td>
                    <td style={{
                      padding: '10px',
                      textAlign: 'right',
                      color: currentOutstanding === 0 ? '#15803d' : '#0f172a',
                      fontSize: '14px',
                      fontWeight: 800
                    }}>
                      {fmt(currentOutstanding)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Statutory Terms & Declaration */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '32px',
              fontSize: '11px',
              color: '#475569',
              lineHeight: '1.5'
            }}>
              <strong>STATUTORY DECLARATION & AUDIT VERIFICATION:</strong>
              <br />
              1. This Statement of Account (SOA / Passbook) reflects all financial entries posted up to {statementGeneratedAt}.
              <br />
              2. Borrowers are advised to verify all installment credits and receipt numbers. In case of any dispute or uncredited payment, please report in writing to the branch within 7 days of statement date.
              <br />
              3. Full loan closure and legal release of security documents requires an official stamped <strong>No-Objection Certificate (NOC)</strong> issued by the company.
            </div>

            {/* Official Signatures & Seal Block */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '24px',
              marginTop: '20px',
              paddingTop: '16px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '45px' }}></div>
                <div style={{ borderTop: '1.5px dashed #64748b', paddingTop: '6px' }}>
                  <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>{customer.name}</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Borrower's Signature</div>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '45px' }}></div>
                <div style={{ borderTop: '1.5px dashed #64748b', paddingTop: '6px' }}>
                  <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>Field Officer / Cashier</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Verified by Counter Staff</div>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '45px' }}></div>
                <div style={{ borderTop: '1.5px dashed #64748b', paddingTop: '6px' }}>
                  <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>Authorized Signatory</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>{companyName} (Official Seal)</div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
