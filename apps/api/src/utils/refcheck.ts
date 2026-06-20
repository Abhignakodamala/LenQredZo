// Reference-format validation for payment proof (Level 2).
// Catches obviously-fake references; real verification needs a payment gateway (Pro feature).

export function validateReference(method: string, reference: string): { ok: boolean; message?: string } {
  const ref = (reference || '').trim();
  const m = (method || 'cash').toLowerCase();

  if (m === 'cash') return { ok: true }; // cash has no reference

  if (!ref) {
    return { ok: false, message: `A reference / transaction ID is required for ${m} payments` };
  }

  if (m === 'upi') {
    // UPI reference / RRN is typically 12 digits.
    if (!/^\d{12}$/.test(ref)) {
      return { ok: false, message: 'UPI reference must be 12 digits (check the payment SMS).' };
    }
  } else if (m === 'bank') {
    // Bank UTR is usually 12-22 alphanumeric characters.
    if (!/^[A-Za-z0-9]{12,22}$/.test(ref)) {
      return { ok: false, message: 'Bank UTR must be 12-22 letters/numbers.' };
    }
  } else if (m === 'cheque') {
    // Cheque number is typically 6 digits.
    if (!/^\d{6}$/.test(ref)) {
      return { ok: false, message: 'Cheque number must be 6 digits.' };
    }
  } else if (m === 'card') {
    // Card txn reference: at least 6 alphanumeric chars.
    if (!/^[A-Za-z0-9]{6,}$/.test(ref)) {
      return { ok: false, message: 'Card reference must be at least 6 letters/numbers.' };
    }
  }

  return { ok: true };
}