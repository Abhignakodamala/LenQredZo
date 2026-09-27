import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { API_URL } from './api';

async function readResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'WebAuthn request failed');
  return data;
}

export async function loginWithPasskey(email: string) {
  const options = await readResponse(await fetch(`${API_URL}/api/auth/webauthn/authenticate/options`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }));
  const response = await startAuthentication({ optionsJSON: options });
  return readResponse(await fetch(`${API_URL}/api/auth/webauthn/authenticate/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, response }),
  }));
}

export async function registerPasskey(token: string, nickname: string) {
  const headers = { Authorization: `Bearer ${token}` };
  const options = await readResponse(await fetch(`${API_URL}/api/auth/webauthn/register/options`, { method: 'POST', headers }));
  const response = await startRegistration({ optionsJSON: options });
  return readResponse(await fetch(`${API_URL}/api/auth/webauthn/register/verify`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...response, nickname }),
  }));
}

export async function listPasskeys(token: string) {
  return readResponse(await fetch(`${API_URL}/api/auth/webauthn/passkeys`, {
    headers: { Authorization: `Bearer ${token}` },
  }));
}

export async function deletePasskey(token: string, id: string) {
  return readResponse(await fetch(`${API_URL}/api/auth/webauthn/passkeys/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }));
}
