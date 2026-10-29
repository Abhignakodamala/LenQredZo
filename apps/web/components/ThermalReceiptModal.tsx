'use client';
import React, { useRef } from 'react';

export interface ThermalReceiptModalProps {
  receipt: {
    receiptNo?: string;
    date?: string;
    companyName?: string;
    branchName?: string;
    collectorName?: string;
    borrowerName?: string;
    borrowerPhone?: string;
    loanRef?: string;
    emiNumber?: number | string;
    totalEmis?: number | string;
    emiAmount?: number;
    penaltyAmount?: number;
    totalPaid?: number;
    remainingBalance?: number;
    paymentMethod?: string;
    referenceUtr?: string;
  };
  onClose: () => void;
}

export default function ThermalReceiptModal({ receipt, onClose }: ThermalReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d?: string) => d ? new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }) : new Date().toLocaleString('en-IN');

  const receiptNo = receipt.receiptNo || `RCT-${Date.now().toString().slice(-8)}`;
  const dateFormatted = fmtDate(receipt.date);
  const company = receipt.companyName || 'LENQREDZO CAPITAL';
  const branch = receipt.branchName || 'Main Branch';
  const collector = receipt.collectorName || 'Field Officer';
  const borrower = receipt.borrowerName || 'Borrower';
  const phone = receipt.borrowerPhone || '';
  const loanRef = receipt.loanRef || 'LN1001';
  const emiPaid = Number(receipt.emiAmount || 0);
  const penalty = Number(receipt.penaltyAmount || 0);
  const total = Number(receipt.totalPaid || (emiPaid + penalty));
  const remaining = Number(receipt.remainingBalance || 0);
  const method = (receipt.paymentMethod || 'CASH').toUpperCase();
  const utr = receipt.referenceUtr || '';

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const text = `*OFFICIAL PAYMENT RECEIPT* 🧾\n` +
      `*${company}*\n` +
      `--------------------------------\n` +
      `Receipt No: *${receiptNo}*\n` +
      `Date: ${dateFormatted}\n` +
      `Borrower: *${borrower}*\n` +
      `Loan Account: *${loanRef}*\n` +
      `EMI Amount: *${fmt(emiPaid)}*\n` +
      (penalty > 0 ? `Late Penalty: *${fmt(penalty)}*\n` : '') +
      `*Total Paid:* *${fmt(total)}* (${method})\n` +
      (utr ? `UTR/Ref: ${utr}\n` : '') +
      `Remaining Balance: *${fmt(remaining)}*\n` +
      `Collected By: ${collector}\n` +
      `--------------------------------\n` +
      `_Thank you for your timely repayment!_`;

    const encoded = encodeURIComponent(text);
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const url = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px',
      backdropFilter: 'blur(4px)'
    }}>
      {/* Thermal Print Media Styling for 58mm / 80mm ESC/POS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #thermal-slip-container, #thermal-slip-container * {
            visibility: visible;
          }
          #thermal-slip-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 58mm !important;
            margin: 0 !important;
            padding: 4mm !important;
            box-shadow: none !important;
            border: none !important;
            font-family: 'Courier New', Courier, monospace !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div style={{
        background: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '440px',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden',
        border: '1px solid #cbd5e1'
      }}>
        {/* Header (No print) */}
        <div className="no-print" style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: 'white',
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🖨️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800' }}>
                Field Thermal Receipt (58mm)
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                Portable Bluetooth POS / Thermal Printer Slip
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#e2e8f0',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ✕
          </button>
        </div>

        {/* 58mm Thermal Receipt Simulation View */}
        <div style={{ padding: '16px', overflowY: 'auto', background: '#f1f5f9', display: 'flex', justifyContent: 'center' }}>
          
          <div
            id="thermal-slip-container"
            ref={printRef}
            style={{
              width: '280px',
              background: '#ffffff',
              padding: '16px 14px',
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: '11px',
              color: '#111827',
              lineHeight: 1.35,
              border: '1px dashed #94a3b8',
              borderRadius: '6px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
            }}
          >
            {/* Header / Logo */}
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '900', letterSpacing: '0.04em' }}>
                {company.toUpperCase()}
              </h3>
              <p style={{ margin: '1px 0 0', fontSize: '10px' }}>MICROFINANCE & RETAIL LENDING</p>
              <p style={{ margin: '1px 0 0', fontSize: '9px', color: '#475569' }}>Branch: {branch}</p>
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            <div style={{ textAlign: 'center', fontWeight: '700', fontSize: '10px', margin: '4px 0' }}>
              *** PAYMENT ACKNOWLEDGMENT ***
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Receipt Meta */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Receipt:</span>
                <strong>{receiptNo}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Date:</span>
                <span>{dateFormatted}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Officer:</span>
                <span>{collector}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Borrower Details */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Loan Ref:</span>
                <strong>{loanRef}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Borrower:</span>
                <strong>{borrower.slice(0, 18)}</strong>
              </div>
              {phone && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Mobile:</span>
                  <span>{phone}</span>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Breakdown */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>EMI Installment:</span>
                <span>{fmt(emiPaid)}</span>
              </div>
              {penalty > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Late Fee / Penalty:</span>
                  <span>{fmt(penalty)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '12px', margin: '4px 0' }}>
                <span>TOTAL COLLECTED:</span>
                <span>{fmt(total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Paid Mode:</span>
                <strong>{method}</strong>
              </div>
              {utr && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                  <span>UTR / Ref:</span>
                  <span>{utr}</span>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Balance Remaining */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700' }}>
                <span>Remaining Balance:</span>
                <span>{fmt(remaining)}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Footer & QR Simulation */}
            <div style={{ textAlign: 'center', marginTop: '6px' }}>
              <div style={{
                display: 'inline-block',
                background: '#000',
                color: '#fff',
                padding: '4px 8px',
                fontSize: '9px',
                fontWeight: '700',
                borderRadius: '3px',
                marginBottom: '4px'
              }}>
                [ VERIFIED OFFICIAL SLIP ]
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '8.5px', color: '#475569' }}>
                Valid electronic acknowledgement of debt repayment.
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '9px', fontWeight: 'bold' }}>
                ~ THANK YOU ~
              </p>
            </div>

          </div>

        </div>

        {/* Action Buttons (No print) */}
        <div className="no-print" style={{
          padding: '12px 16px',
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px'
        }}>
          <button
            type="button"
            onClick={handleWhatsAppShare}
            style={{
              background: '#22c55e',
              color: 'white',
              border: 'none',
              padding: '10px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            💬 Share WhatsApp
          </button>

          <button
            type="button"
            onClick={handlePrint}
            style={{
              background: '#0284c7',
              color: 'white',
              border: 'none',
              padding: '10px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            🖨️ Print 58mm Slip
          </button>
        </div>

      </div>
    </div>
  );
}
