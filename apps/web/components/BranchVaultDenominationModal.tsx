'use client';
import React, { useState } from 'react';

export interface BranchVaultDenominationModalProps {
  expectedAmount?: number;
  branchName?: string;
  cashierName?: string;
  onSuccess?: (vaultRecord: any) => void;
  onClose: () => void;
}

export default function BranchVaultDenominationModal({
  expectedAmount = 0,
  branchName = 'Main Branch',
  cashierName = 'Branch Cashier',
  onSuccess,
  onClose
}: BranchVaultDenominationModalProps) {
  // Denomination note counts
  const [c500, setC500] = useState<number>(0);
  const [c200, setC200] = useState<number>(0);
  const [c100, setC100] = useState<number>(0);
  const [c50, setC50] = useState<number>(0);
  const [c20, setC20] = useState<number>(0);
  const [c10, setC10] = useState<number>(0);
  const [coins, setCoins] = useState<number>(0);

  const [vaultLockerNo, setVaultLockerNo] = useState('VAULT-LOCKER-01');
  const [notes, setNotes] = useState('Daily evening cash collection physically tallied and deposited into safe locker.');
  const [lockedSuccess, setLockedSuccess] = useState<any | null>(null);

  // Compute sub-totals
  const total500 = c500 * 500;
  const total200 = c200 * 200;
  const total100 = c100 * 100;
  const total50 = c50 * 50;
  const total20 = c20 * 20;
  const total10 = c10 * 10;
  const totalCoins = Number(coins || 0);

  const totalCalculatedCash =
    total500 + total200 + total100 + total50 + total20 + total10 + totalCoins;

  const totalNotesCount =
    Number(c500 || 0) +
    Number(c200 || 0) +
    Number(c100 || 0) +
    Number(c50 || 0) +
    Number(c20 || 0) +
    Number(c10 || 0);

  const variance = totalCalculatedCash - expectedAmount;

  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

  const handleDepositToVault = () => {
    if (totalCalculatedCash <= 0) {
      alert('Please enter at least one denomination count before depositing into the safe locker.');
      return;
    }

    const receiptNo = `VAULT-DEP-${Date.now().toString().slice(-6)}`;
    const depositRecord = {
      receiptNo,
      date: new Date().toLocaleString('en-IN'),
      branchName,
      cashierName,
      vaultLockerNo,
      totalCalculatedCash,
      expectedAmount,
      variance,
      totalNotesCount,
      denominations: {
        500: c500,
        200: c200,
        100: c100,
        50: c50,
        20: c20,
        10: c10,
        coins
      },
      notes
    };

    setLockedSuccess(depositRecord);
    if (onSuccess) onSuccess(depositRecord);
  };

  const handlePrintChallan = () => {
    window.print();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px',
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '820px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        border: '1px solid #cbd5e1'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
          color: 'white',
          padding: '18px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🔐</span>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>
                Daily Branch Cashier Denomination & Safe Locker Vault Settlement
              </h2>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#a7f3d0' }}>
              Physical Cash Reconciliation, Note-to-Note Tally & Safe Vault Deposit Slip
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: 'white',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '16px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Success Deposited View */}
          {lockedSuccess ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                background: '#ecfdf5',
                border: '2px dashed #059669',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '32px' }}>🔒</span>
                <h3 style={{ margin: '8px 0 4px', fontSize: '18px', color: '#065f46', fontWeight: '800' }}>
                  Cash Successfully Verified & Locked into Safe Vault!
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#047857' }}>
                  Vault Deposit Voucher No: <strong>{lockedSuccess.receiptNo}</strong> | Locked in <strong>{lockedSuccess.vaultLockerNo}</strong>
                </p>
                <p style={{ margin: '8px 0 0', fontSize: '22px', fontWeight: '900', color: '#065f46' }}>
                  {fmt(lockedSuccess.totalCalculatedCash)}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#065f46' }}>
                  Total Notes Count: <strong>{lockedSuccess.totalNotesCount} notes</strong>
                </p>
              </div>

              {/* Printable Challan Box */}
              <div id="vault-print-challan" style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px',
                fontSize: '12px'
              }}>
                <div style={{ textAlign: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', textTransform: 'uppercase' }}>
                    BRANCH SAFE LOCKER CASH DEPOSIT CHALLAN
                  </h4>
                  <p style={{ margin: '2px 0 0', color: '#64748b' }}>
                    Branch: {branchName} | Deposited by: {cashierName} | Timestamp: {lockedSuccess.date}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                    <span style={{ color: '#64748b', fontSize: '11px' }}>₹500 Notes</span>
                    <p style={{ margin: 0, fontWeight: '700' }}>{c500} pcs = {fmt(total500)}</p>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                    <span style={{ color: '#64748b', fontSize: '11px' }}>₹200 Notes</span>
                    <p style={{ margin: 0, fontWeight: '700' }}>{c200} pcs = {fmt(total200)}</p>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                    <span style={{ color: '#64748b', fontSize: '11px' }}>₹100 Notes</span>
                    <p style={{ margin: 0, fontWeight: '700' }}>{c100} pcs = {fmt(total100)}</p>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                    <span style={{ color: '#64748b', fontSize: '11px' }}>₹50 & Below</span>
                    <p style={{ margin: 0, fontWeight: '700' }}>{fmt(total50 + total20 + total10 + totalCoins)}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '10px' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>System Expected:</span> <strong>{fmt(expectedAmount)}</strong>
                    {variance !== 0 && (
                      <span style={{ marginLeft: '10px', color: variance > 0 ? '#16a34a' : '#dc2626', fontWeight: '700' }}>
                        Variance: {variance > 0 ? `+${fmt(variance)} (Excess)` : `${fmt(variance)} (Shortage)`}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#064e3b' }}>
                    Vault Deposited Total: {fmt(lockedSuccess.totalCalculatedCash)}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', paddingTop: '10px' }}>
                  <div style={{ textAlign: 'center', width: '160px', borderTop: '1px solid #94a3b8' }}>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Cashier Signature</span>
                  </div>
                  <div style={{ textAlign: 'center', width: '160px', borderTop: '1px solid #94a3b8' }}>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Branch Manager Signature</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handlePrintChallan}
                  style={{
                    background: '#0284c7',
                    color: 'white',
                    border: 'none',
                    padding: '9px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  🖨️ Print Deposit Challan
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    padding: '9px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  ✓ Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Expected vs Target Summary Banner */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1.2fr 1fr',
                gap: '12px',
                background: '#f8fafc',
                padding: '14px 18px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>
                    1. System Expected Cash
                  </span>
                  <p style={{ margin: '2px 0 0', fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
                    {fmt(expectedAmount)}
                  </p>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Branch field collections today</span>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>
                    2. Physical Counted Cash
                  </span>
                  <p style={{ margin: '2px 0 0', fontSize: '20px', fontWeight: '800', color: '#059669' }}>
                    {fmt(totalCalculatedCash)}
                  </p>
                  <span style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>
                    {totalNotesCount} physical notes tallied
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>
                    3. Tally Variance
                  </span>
                  <p style={{
                    margin: '2px 0 0',
                    fontSize: '18px',
                    fontWeight: '800',
                    color: variance === 0 ? '#10b981' : variance > 0 ? '#0284c7' : '#ef4444'
                  }}>
                    {variance === 0 ? '✓ TALLIED (₹0)' : variance > 0 ? `+${fmt(variance)} Excess` : `${fmt(variance)} Short`}
                  </p>
                  <span style={{ fontSize: '11px', color: variance === 0 ? '#10b981' : '#ef4444' }}>
                    {variance === 0 ? '100% exact match' : 'Verify physical count'}
                  </span>
                </div>
              </div>

              {/* Note-by-Note Denomination Grid */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>
                  💵 Note Denomination Physical Counter
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '10px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '14px'
                }}>
                  {/* 500 Note */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#0284c7', color: 'white', fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px' }}>
                        ₹500
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>x</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={c500 || ''}
                        onChange={e => setC500(Math.max(0, parseInt(e.target.value) || 0))}
                        style={{ width: '80px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '700', textAlign: 'center' }}
                      />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>= {fmt(total500)}</span>
                  </div>

                  {/* 200 Note */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#f59e0b', color: 'white', fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px' }}>
                        ₹200
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>x</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={c200 || ''}
                        onChange={e => setC200(Math.max(0, parseInt(e.target.value) || 0))}
                        style={{ width: '80px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '700', textAlign: 'center' }}
                      />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>= {fmt(total200)}</span>
                  </div>

                  {/* 100 Note */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#6366f1', color: 'white', fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px' }}>
                        ₹100
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>x</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={c100 || ''}
                        onChange={e => setC100(Math.max(0, parseInt(e.target.value) || 0))}
                        style={{ width: '80px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '700', textAlign: 'center' }}
                      />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>= {fmt(total100)}</span>
                  </div>

                  {/* 50 Note */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#0d9488', color: 'white', fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px' }}>
                        ₹50
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>x</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={c50 || ''}
                        onChange={e => setC50(Math.max(0, parseInt(e.target.value) || 0))}
                        style={{ width: '80px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '700', textAlign: 'center' }}
                      />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>= {fmt(total50)}</span>
                  </div>

                  {/* 20 Note */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#ea580c', color: 'white', fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px' }}>
                        ₹20
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>x</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={c20 || ''}
                        onChange={e => setC20(Math.max(0, parseInt(e.target.value) || 0))}
                        style={{ width: '80px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '700', textAlign: 'center' }}
                      />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>= {fmt(total20)}</span>
                  </div>

                  {/* 10 Note */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#78716c', color: 'white', fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px' }}>
                        ₹10
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>x</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={c10 || ''}
                        onChange={e => setC10(Math.max(0, parseInt(e.target.value) || 0))}
                        style={{ width: '80px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '700', textAlign: 'center' }}
                      />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>= {fmt(total10)}</span>
                  </div>

                  {/* Coins & Mixed Change */}
                  <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f1f5f9', padding: '8px 12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#475569', color: 'white', fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px' }}>
                        Coins / Loose Change (₹)
                      </span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={coins || ''}
                        onChange={e => setCoins(Math.max(0, parseInt(e.target.value) || 0))}
                        style={{ width: '120px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '700', textAlign: 'center' }}
                      />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>= {fmt(totalCoins)}</span>
                  </div>
                </div>
              </div>

              {/* Safe Locker Vault & Remarks */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Safe Locker / Vault Reference
                  </label>
                  <select
                    value={vaultLockerNo}
                    onChange={e => setVaultLockerNo(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: '600',
                      background: 'white'
                    }}
                  >
                    <option value="VAULT-LOCKER-01">Branch Vault Locker #1 (Primary)</option>
                    <option value="VAULT-LOCKER-02">Branch Vault Locker #2 (Disbursal Reserve)</option>
                    <option value="SAFE-CASH-BOX">Cashier Fireproof Safe Cash Box</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Cashier Settlement Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Field cash tallied and locked in safe"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px'
                    }}
                  />
                </div>
              </div>
            </>
          )}

        </div>

        {/* Footer */}
        {!lockedSuccess && (
          <div style={{
            padding: '14px 24px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Branch: <strong>{branchName}</strong> | Verified by: <strong>{cashierName}</strong>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
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
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDepositToVault}
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  border: 'none',
                  color: 'white',
                  padding: '9px 20px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.25)'
                }}
              >
                🔐 Lock Cash into Safe Vault ({fmt(totalCalculatedCash)})
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
