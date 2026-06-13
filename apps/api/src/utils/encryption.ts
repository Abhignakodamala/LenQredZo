import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV is standard for GCM

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY || '';
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return key;
}

// Encrypts a string. Returns "iv:authTag:ciphertext" (all base64).
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

// Decrypts a value produced by encrypt(). If the value isn't in
// encrypted form (legacy plaintext that hasn't been migrated yet),
// it is returned unchanged so nothing crashes during rollout.
export function decrypt(payload: string): string {
  if (!payload) return '';
  const parts = payload.split(':');
  if (parts.length !== 3) return payload; // legacy plaintext passthrough
  try {
    const [ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return payload; // tampered/unreadable — return raw rather than crash
  }
}

// Masks an Aadhaar for display: shows only the last 4 digits.
export function maskAadhaar(aadhaar: string): string {
  if (!aadhaar) return '';
  return 'XXXX XXXX ' + aadhaar.slice(-4);
}

// Masks a PAN for display: shows first 2 and last 2 characters.
export function maskPan(pan: string): string {
  if (!pan) return '';
  if (pan.length < 5) return pan;
  return pan.slice(0, 2) + 'XXXXX'.slice(0, pan.length - 4) + pan.slice(-2);
}