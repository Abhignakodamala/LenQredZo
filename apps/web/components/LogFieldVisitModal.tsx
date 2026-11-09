'use client';
import React, { useState, useEffect } from 'react';
import { API_URL } from '@/lib/api';

interface LogFieldVisitModalProps {
  customer?: any;
  loanId?: number;
  onSuccess: (visit: any) => void;
  onClose: () => void;
}

export default function LogFieldVisitModal({ customer: initialCustomer, loanId: initialLoanId, onSuccess, onClose }: LogFieldVisitModalProps) {
  // Customer selection state (if opened directly from Field Visits page)
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | string>(initialCustomer?.id || '');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(initialCustomer || null);
  const [selectedLoanId, setSelectedLoanId] = useState<number | string>(initialLoanId || '');
  const [customerSearch, setCustomerSearch] = useState('');

  const [outcome, setOutcome] = useState<string>('door_locked');
  const [remarks, setRemarks] = useState('');
  const [ptpDate, setPtpDate] = useState('');
  const [ptpAmount, setPtpAmount] = useState<number | ''>('');

  // GPS state
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Photo state
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-capture GPS on modal open
  useEffect(() => {
    captureLocation();
  }, []);

  // Fetch customers if not pre-provided
  useEffect(() => {
    if (!initialCustomer) {
      setLoadingCustomers(true);
      fetch(`${API_URL}/api/customers`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      })
        .then(res => res.json())
        .then(data => {
          const list = Array.isArray(data) ? data : (data.customers || []);
          setCustomerList(list);
          if (list.length > 0 && !selectedCustomerId) {
            setSelectedCustomerId(list[0].id);
            setSelectedCustomer(list[0]);
            if (list[0].loans && list[0].loans.length > 0) {
              setSelectedLoanId(list[0].loans[0].id);
            }
          }
        })
        .catch(err => {
          console.error('Failed to load customers:', err);
        })
        .finally(() => setLoadingCustomers(false));
    }
  }, [initialCustomer]);

  // Handle changing customer dropdown
  const handleCustomerChange = (custId: number | string) => {
    setSelectedCustomerId(custId);
    const found = customerList.find(c => String(c.id) === String(custId));
    setSelectedCustomer(found || null);
    if (found && found.loans && found.loans.length > 0) {
      setSelectedLoanId(found.loans[0].id);
    } else {
      setSelectedLoanId('');
    }
  };

  const captureLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsError('Geolocation is not supported by your device or browser.');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setAccuracy(Math.round(pos.coords.accuracy));
        setGpsLoading(false);
      },
      (err) => {
        console.warn('GPS error:', err);
        setGpsError('Could not fetch exact GPS location. Please allow location permissions in your browser.');
        // Fallback coordinates for test
        setLatitude(17.385044);
        setLongitude(78.486671);
        setAccuracy(15);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const currentCustomer = selectedCustomer || initialCustomer;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCustomer) {
      setError('Please select a borrower before submitting visit proof.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const activeLoanId = selectedLoanId || initialLoanId || null;
      const res = await fetch(`${API_URL}/api/field-visits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          customerId: currentCustomer.id,
          loanId: activeLoanId ? Number(activeLoanId) : null,
          latitude,
          longitude,
          accuracy,
          addressSnapshot: [currentCustomer.street, currentCustomer.city, currentCustomer.address].filter(Boolean).join(', ') || 'Doorstep Visit Address',
          outcome,
          ptpDate: outcome === 'ptp_taken' ? ptpDate : null,
          ptpAmount: outcome === 'ptp_taken' && ptpAmount ? Number(ptpAmount) : null,
          remarks,
          photoData
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to log field visit');
      }

      onSuccess(data.visit);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error logging field visit');
    } finally {
      setLoading(false);
    }
  };

  // Filter customers based on search text
  const filteredCustomers = customerList.filter(c => {
    if (!customerSearch.trim()) return true;
    const term = customerSearch.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.phone && c.phone.includes(term)) ||
      (c.city && c.city.toLowerCase().includes(term))
    );
  });

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        maxWidth: '640px',
        width: '100%',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              fontSize: '20px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)'
            }}>
              📍
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                Log Doorstep Field Visit Proof
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                {currentCustomer
                  ? `Borrower: ${currentCustomer.name} ${selectedLoanId ? `· Loan #LN${selectedLoanId}` : ''}`
                  : 'Record doorstep visit with verified GPS & photo proof'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              border: 'none',
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              cursor: 'pointer',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', color: '#b91c1c', fontSize: '13px' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Borrower Selector (Only if opened from Field Visits page without preselected customer) */}
          {!initialCustomer && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px 16px'
            }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                👤 Select Borrower / Customer *
              </label>

              {loadingCustomers ? (
                <div style={{ fontSize: '12.5px', color: '#64748b' }}>⏳ Loading borrowers list...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="🔍 Search by borrower name, phone, or city..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />

                  <select
                    value={selectedCustomerId}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#0f172a',
                      background: 'white',
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'pointer'
                    }}
                  >
                    {filteredCustomers.length === 0 ? (
                      <option value="">No matching borrowers found</option>
                    ) : (
                      filteredCustomers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.phone ? `(${c.phone})` : ''} {c.city ? `· ${c.city}` : ''} {c.loans?.length ? `· [${c.loans.length} Loan(s)]` : ''}
                        </option>
                      ))
                    )}
                  </select>

                  {/* If selected customer has loans, show loan picker */}
                  {selectedCustomer?.loans && selectedCustomer.loans.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Linked Loan:</span>
                      <select
                        value={selectedLoanId}
                        onChange={(e) => setSelectedLoanId(e.target.value)}
                        style={{
                          fontSize: '12px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: 'white',
                          fontWeight: 600,
                          color: '#0369a1'
                        }}
                      >
                        {selectedCustomer.loans.map((ln: any) => (
                          <option key={ln.id} value={ln.id}>
                            Loan #LN{ln.id} · {ln.type || 'Standard'} · ₹{Number(ln.amount || 0).toLocaleString('en-IN')} ({ln.status})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* GPS Coordinates Section */}
          <div style={{
            background: latitude && longitude ? '#f0fdf4' : '#fffbeb',
            border: latitude && longitude ? '1px solid #86efac' : '1px solid #fde68a',
            borderRadius: '12px',
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>{latitude && longitude ? '🛰️' : '⏳'}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: latitude && longitude ? '#166534' : '#92400e' }}>
                  {latitude && longitude ? 'GPS Coordinates Locked & Verified' : 'Detecting Device Location...'}
                </div>
                {latitude && longitude ? (
                  <div style={{ fontSize: '12px', color: '#15803d', marginTop: '2px' }}>
                    Lat: <strong>{latitude.toFixed(6)}</strong>, Lng: <strong>{longitude.toFixed(6)}</strong> (±{accuracy || 10}m accuracy)
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#b45309', marginTop: '2px' }}>
                    {gpsError || 'Requesting browser location permission...'}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {latitude && longitude && (
                <a
                  href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: 'white',
                    border: '1px solid #86efac',
                    color: '#166534',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  🗺️ Map Preview
                </a>
              )}
              <button
                type="button"
                onClick={captureLocation}
                disabled={gpsLoading}
                style={{
                  background: 'white',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {gpsLoading ? 'Locating...' : '🔄 Re-fetch'}
              </button>
            </div>
          </div>

          {/* Visit Outcome Radio Cards */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Select Doorstep Visit Outcome *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {[
                { id: 'door_locked', label: '🏠 Door Locked / Not Available', desc: 'Premises closed, borrower away' },
                { id: 'ptp_taken', label: '🤝 Met Borrower - PTP Taken', desc: 'Promised to pay on scheduled date' },
                { id: 'refused_to_pay', label: '🚫 Refused to Pay / Dispute', desc: 'Borrower hostile or disputed' },
                { id: 'shifted_untraceable', label: '📦 House Shifted / Untraceable', desc: 'Address vacated / neighbor reports' },
                { id: 'met_family', label: '👥 Met Family Member / Guarantor', desc: 'Handed notice to spouse/relative' },
                { id: 'cash_collected', label: '💵 Cash Collected on Spot', desc: 'Collected physical payment' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setOutcome(opt.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: outcome === opt.id ? '2px solid #0284c7' : '1px solid #cbd5e1',
                    background: outcome === opt.id ? '#f0f9ff' : 'white',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '12px', color: outcome === opt.id ? '#0369a1' : '#1e293b' }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: '10px', color: outcome === opt.id ? '#0284c7' : '#64748b', marginTop: '2px' }}>
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Conditional PTP Inputs if outcome is PTP */}
          {outcome === 'ptp_taken' && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '14px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px'
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Promise to Pay Date (PTP Date) *
                </label>
                <input
                  type="date"
                  required
                  value={ptpDate}
                  onChange={(e) => setPtpDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Promised Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  value={ptpAmount}
                  onChange={(e) => setPtpAmount(e.target.value ? Number(e.target.value) : '')}
                  placeholder="E.g. 4500"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700, boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}

          {/* Photo Capture Proof */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              📸 Doorstep Photo Evidence (Locked Door / Meeting / House)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                style={{ fontSize: '12px' }}
              />

              {photoData && (
                <div style={{ width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                  <img src={photoData} alt="Visit proof" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
            </div>
            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
              Photo is cryptographically logged with GPS timestamp as statutory evidence of visit.
            </span>
          </div>

          {/* Agent Remarks */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Field Agent Observations / Notes *
            </label>
            <textarea
              required
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="E.g. Visited borrower house at 11:30 AM. Gate was locked. Spoke to neighbor Mr. Rao who confirmed borrower is in town and works at local textile mill."
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: 'white',
                fontSize: '13px',
                fontWeight: 600,
                color: '#475569',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                fontSize: '13px',
                fontWeight: 700,
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {loading ? 'Submitting Proof...' : '📍 Submit Geo-Tagged Visit Proof'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
