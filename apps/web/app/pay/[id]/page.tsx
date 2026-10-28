'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { API_URL } from '@/lib/api';

// Number to words helper for official receipt
function numberToWordsINR(num: number): string {
  if (!num || isNaN(num)) return 'Zero Rupees';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
  }

  return convert(Math.floor(num)) + ' Rupees Only';
}

export default function BorrowerPaymentPage() {
  const params = useParams();
  const loanId = params?.id;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Selected EMI & amount
  const [selectedEmiId, setSelectedEmiId] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');

  // UTR submission state
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [payerName, setPayerName] = useState<string>('');
  const [payerPhone, setPayerPhone] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [receipt, setReceipt] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'upi' | 'qr'>('upi');

  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtDateTime = (d?: string) => d ? new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
  }) : '—';

  useEffect(() => {
    if (!loanId) return;

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/api/payments/public/pay/${loanId}`);
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.error || 'Unable to load payment details');
        }

        setData(result);
        if (result.pendingEmis && result.pendingEmis.length > 0) {
          const first = result.pendingEmis[0];
          setSelectedEmiId(first.id);
          setCustomAmount(String(first.remaining));
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Payment link expired or invalid');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [loanId]);

  const selectedEmi = useMemo(() => {
    if (!data?.pendingEmis || !selectedEmiId) return null;
    return data.pendingEmis.find((e: any) => e.id === selectedEmiId);
  }, [data, selectedEmiId]);

  const currentPayAmount = useMemo(() => {
    const num = Math.round(Number(customAmount));
    return isNaN(num) || num <= 0 ? (selectedEmi?.remaining || 0) : num;
  }, [customAmount, selectedEmi]);

  // Construct standard UPI URI parameters
  const upiPayload = useMemo(() => {
    if (!data || !selectedEmi) return null;
    const vpa = data.company?.upiVpa || 'lenqredzo.pay@axisbank';
    const payeeName = data.company?.name || 'LenQredzo Capital';
    const amount = currentPayAmount;
    const txnNote = `EMI LN${1000 + data.loan.id} Inst${selectedEmi.id}`;
    const txnRef = `TXN${Date.now()}`;

    // Standard NPCI UPI URI
    const genericUpi = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(txnNote)}&tr=${txnRef}`;
    
    // Deep links for Indian UPI apps
    const phonepeLink = `phonepe://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(txnNote)}&tr=${txnRef}`;
    const gpayLink = `gpay://upi/pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(txnNote)}&tr=${txnRef}`;
    const paytmLink = `paytmmp://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(txnNote)}&tr=${txnRef}`;

    // Dynamic QR Image URL (SVG / QuickChart QR API)
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(genericUpi)}`;

    return {
      vpa,
      payeeName,
      amount,
      genericUpi,
      phonepeLink,
      gpayLink,
      paytmLink,
      qrUrl
    };
  }, [data, selectedEmi, currentPayAmount]);

  const handleSelectEmi = (emi: any) => {
    setSelectedEmiId(emi.id);
    setCustomAmount(String(emi.remaining));
  };

  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utrNumber.trim()) {
      alert('Please enter your 12-digit UPI Reference / UTR Number from your payment app.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/payments/public/submit-upi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: data.loan.id,
          emiId: selectedEmiId,
          amount: currentPayAmount,
          utr: utrNumber.trim(),
          payerName: payerName.trim() || undefined,
          payerPhone: payerPhone.trim() || undefined
        })
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to verify payment reference');
      }

      setReceipt(resData.receipt);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Payment verification failed. Please re-check UTR.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#475569', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚡</div>
          <div style={{ fontSize: '16px', fontWeight: 700 }}>Connecting to Secure UPI Payment Gateway...</div>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Loading verified borrower details</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: 'white', padding: '32px', borderRadius: '16px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '44px', marginBottom: '12px' }}>⚠️</div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>Payment Link Unavailable</h2>
          <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.5, margin: 0 }}>
            {error || 'This loan account could not be found or all installments have already been cleared.'}
          </p>
        </div>
      </div>
    );
  }

  const company = data.company || {};
  const loan = data.loan || {};
  const borrower = data.borrower || {};
  const pendingEmis = data.pendingEmis || [];

  return (
    <div style={{ minHeight: '100vh', background: '#090d16', padding: '20px 14px', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#0f172a' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        
        {/* ========================================================== */}
        {/* VIEW 1: SUCCESSFUL PAYMENT RECEIPT VOUCHER                 */}
        {/* ========================================================== */}
        {receipt ? (
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            border: '1px solid #e2e8f0'
          }}>
            {/* Top Bar */}
            <div style={{
              background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
              color: 'white',
              padding: '24px 20px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'white',
                color: '#15803d',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                fontWeight: 900,
                marginBottom: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}>
                ✓
              </div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '0.3px' }}>
                PAYMENT CONFIRMED
              </h2>
              <div style={{ fontSize: '13px', color: '#bbf7d0', marginTop: '4px' }}>
                Credited Instantly to {receipt.companyName}
              </div>
            </div>

            {/* Receipt Body */}
            <div style={{ padding: '24px 20px' }}>
              {/* Amount Highlight */}
              <div style={{ textAlign: 'center', paddingBottom: '20px', borderBottom: '1px dashed #cbd5e1', marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Total Amount Paid
                </div>
                <div style={{ fontSize: '34px', fontWeight: 900, color: '#15803d', marginTop: '2px' }}>
                  {fmt(receipt.amount)}
                </div>
                <div style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic', marginTop: '4px' }}>
                  {numberToWordsINR(receipt.amount)}
                </div>
              </div>

              {/* Particulars Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Receipt Ref No:</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>{receipt.receiptNumber}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Bank UTR / Ref:</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>{receipt.utr}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Loan Facility:</span>
                  <span style={{ fontWeight: 700, color: '#0284c7' }}>{receipt.loanRef}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Borrower Name:</span>
                  <span style={{ fontWeight: 700 }}>{receipt.borrowerName}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Date & Time:</span>
                  <span style={{ fontWeight: 600 }}>{fmtDateTime(receipt.paidAt)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Payment Mode:</span>
                  <span style={{ fontWeight: 700, color: '#15803d' }}>Instant UPI Checkout</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Account Status:</span>
                  <span style={{
                    fontWeight: 800,
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: receipt.loanCompleted ? '#dcfce7' : '#f0f9ff',
                    color: receipt.loanCompleted ? '#166534' : '#0369a1'
                  }}>
                    {receipt.loanCompleted ? 'LOAN FULLY CLEARED' : 'INSTALLMENT CREDITED'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    background: '#0f172a',
                    color: 'white',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  🖨️ Print / Save Official Receipt
                </button>

                <button
                  onClick={() => setReceipt(null)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '10px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Return to Loan Overview
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================== */
          /* VIEW 2: MOBILE 1-TAP UPI PAYMENT CHECKOUT                  */
          /* ========================================================== */
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
            border: '1px solid #1e293b'
          }}>
            {/* Header / Verified NBFC Banner */}
            <div style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: 'white',
              padding: '20px',
              borderBottom: '1px solid #334155'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#1e293b', padding: '3px 8px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px' }}>🛡️</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      VERIFIED NBFC PAYMENT GATEWAY
                    </span>
                  </div>
                  <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                    {company.name}
                  </h1>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    Instant EMI Settlement • 256-bit Bank Grade Security
                  </div>
                </div>
              </div>
            </div>

            {/* Borrower & Loan Info Card */}
            <div style={{
              padding: '16px 20px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>BORROWER ACCOUNT</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  {borrower.name}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {borrower.phone} • {loan.type || 'Personal Loan'}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>LOAN REF NO</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0284c7', fontFamily: 'monospace' }}>
                  {loan.loanRef}
                </div>
                <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 700 }}>
                  Active Facility
                </div>
              </div>
            </div>

            {/* Main Form Area */}
            <div style={{ padding: '20px' }}>
              {/* Select EMI Section */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>
                  1. SELECT INSTALLMENT TO CLEAR:
                </label>

                {pendingEmis.length === 0 ? (
                  <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '10px', color: '#166534', fontSize: '13px', fontWeight: 600, textAlign: 'center' }}>
                    🎉 All installments are currently paid in full!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {pendingEmis.map((emi: any, idx: number) => {
                      const isSel = selectedEmiId === emi.id;
                      return (
                        <div
                          key={emi.id}
                          onClick={() => handleSelectEmi(emi)}
                          style={{
                            border: isSel ? '2px solid #0284c7' : '1px solid #cbd5e1',
                            background: isSel ? '#f0f9ff' : '#ffffff',
                            borderRadius: '10px',
                            padding: '12px 14px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.15s'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              border: isSel ? '5px solid #0284c7' : '2px solid #94a3b8',
                              background: '#ffffff'
                            }} />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                                Installment #{idx + 1}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                Due: {emi.dueDateFormatted} {emi.penalty > 0 && <span style={{ color: '#dc2626' }}>• Late fee: +{fmt(emi.penalty)}</span>}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>
                              {fmt(emi.remaining)}
                            </div>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: isSel ? '#0284c7' : '#64748b', textTransform: 'uppercase' }}>
                              {isSel ? 'SELECTED' : 'SELECT'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Amount to Pay */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Payment Amount
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#15803d' }}>
                    {fmt(currentPayAmount)}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Edit ₹:</span>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={e => setCustomAmount(e.target.value)}
                    style={{
                      width: '90px',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 700,
                      textAlign: 'right'
                    }}
                  />
                </div>
              </div>

              {/* Method Switcher Tabs */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('upi')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: activeTab === 'upi' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                    background: activeTab === 'upi' ? '#f0f9ff' : '#ffffff',
                    color: activeTab === 'upi' ? '#0284c7' : '#475569',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  📱 1-Tap UPI Apps (PhonePe/GPay)
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('qr')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: activeTab === 'qr' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                    background: activeTab === 'qr' ? '#f0f9ff' : '#ffffff',
                    color: activeTab === 'qr' ? '#0284c7' : '#475569',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  📷 Scan Dynamic UPI QR Code
                </button>
              </div>

              {/* Tab 1: 1-Tap Mobile UPI Buttons */}
              {activeTab === 'upi' && upiPayload && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '22px' }}>
                  {/* PhonePe Button */}
                  <a
                    href={upiPayload.phonepeLink}
                    style={{
                      background: '#5f259f',
                      color: 'white',
                      textDecoration: 'none',
                      padding: '14px 18px',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 12px rgba(95, 37, 159, 0.25)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>🟣</span>
                      <span>Pay via PhonePe</span>
                    </div>
                    <span style={{ fontSize: '13px', opacity: 0.9 }}>{fmt(currentPayAmount)} ➔</span>
                  </a>

                  {/* Google Pay Button */}
                  <a
                    href={upiPayload.gpayLink}
                    style={{
                      background: '#ffffff',
                      color: '#1f2937',
                      border: '1.5px solid #cbd5e1',
                      textDecoration: 'none',
                      padding: '14px 18px',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>🔵</span>
                      <span>Pay via Google Pay (GPay)</span>
                    </div>
                    <span style={{ fontSize: '13px', color: '#2563eb' }}>{fmt(currentPayAmount)} ➔</span>
                  </a>

                  {/* Paytm Button */}
                  <a
                    href={upiPayload.paytmLink}
                    style={{
                      background: '#00b9f1',
                      color: '#ffffff',
                      textDecoration: 'none',
                      padding: '14px 18px',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 12px rgba(0, 185, 241, 0.25)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>🔷</span>
                      <span>Pay via Paytm UPI</span>
                    </div>
                    <span style={{ fontSize: '13px', opacity: 0.9 }}>{fmt(currentPayAmount)} ➔</span>
                  </a>

                  {/* Any UPI App */}
                  <a
                    href={upiPayload.genericUpi}
                    style={{
                      background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
                      color: 'white',
                      textDecoration: 'none',
                      padding: '14px 18px',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>⚡</span>
                      <span>Any Other UPI / Banking App</span>
                    </div>
                    <span style={{ fontSize: '13px', opacity: 0.9 }}>{fmt(currentPayAmount)} ➔</span>
                  </a>
                </div>
              )}

              {/* Tab 2: Dynamic QR Code View */}
              {activeTab === 'qr' && upiPayload && (
                <div style={{ textAlign: 'center', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '22px' }}>
                  <img
                    src={upiPayload.qrUrl}
                    alt="UPI QR Code"
                    style={{
                      width: '210px',
                      height: '210px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: 'white',
                      padding: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                    }}
                  />
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginTop: '10px' }}>
                    Scan with PhonePe, GPay, Paytm, or BHIM
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    UPI ID: <code style={{ fontWeight: 700, color: '#0284c7' }}>{upiPayload.vpa}</code>
                  </div>
                </div>
              )}

              {/* Step 2: Confirm Payment with UTR */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', marginBottom: '6px', textTransform: 'uppercase' }}>
                  2. SUBMIT 12-DIGIT UPI REFERENCE (UTR)
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                  Once you pay in PhonePe / GPay / Paytm, enter the 12-digit UTR / UPI Ref from your transaction details to immediately generate your official receipt.
                </div>

                <form onSubmit={handleSubmitUtr}>
                  <div style={{ marginBottom: '12px' }}>
                    <input
                      type="text"
                      placeholder="Enter 12-digit UPI UTR (e.g. 429817349120)"
                      value={utrNumber}
                      onChange={e => setUtrNumber(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      background: submitting ? '#64748b' : '#0f172a',
                      color: 'white',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {submitting ? '⏳ Verifying with Banking Ledger...' : '⚡ Confirm Payment & Generate Receipt'}
                  </button>
                </form>
              </div>

              {/* Footer Trust Branding */}
              <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '11px', color: '#94a3b8' }}>
                <div>Authorized Lending Entity: {company.name}</div>
                <div>Support Hotline: {company.supportPhone}</div>
                <div style={{ marginTop: '4px' }}>🔒 End-to-end encrypted · RBI Digital Lending Standard</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
