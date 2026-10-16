import { apiRequest, setAuthSession, clearAuthSession, getStoredUser, getAuthToken } from './api';
import { User } from '../types';

export interface LoginResult {
  token: string;
  user: User;
}

export async function loginWithCredentials(email: string, password: string): Promise<LoginResult> {
  const data = await apiRequest<LoginResult>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
    requireAuth: false
  });
  return data;
}

export async function uploadAttendancePhoto(token: string, photoBase64: string): Promise<void> {
  try {
    await apiRequest('/api/auth/login-photo', {
      method: 'POST',
      body: { photoData: photoBase64 }
    });
  } catch (err) {
    // Attendance logging shouldn't crash if offline, but logs warning
    console.warn('Attendance photo upload non-fatal failure:', err);
  }
}

export async function saveActiveSession(token: string, user: User): Promise<void> {
  await setAuthSession(token, user);
}

export async function restoreSession(): Promise<{ token: string; user: User } | null> {
  const token = await getAuthToken();
  const user = await getStoredUser();
  if (token && user) {
    return { token, user };
  }
  return null;
}

export async function logout(): Promise<void> {
  await clearAuthSession();
}
