import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Synchronized local Wi-Fi IP (192.168.1.20) for mobile devices, 10.0.2.2 for Android emulator, localhost for web/iOS
const DEFAULT_HOST = Platform.select({
  android: '192.168.1.20',
  ios: '192.168.1.20',
  default: 'localhost'
});

export const DEFAULT_API_URL = `http://${DEFAULT_HOST}:5000`;
export const DEFAULT_CLIENT_URL = `http://${DEFAULT_HOST}:3000`;

let currentApiUrl = DEFAULT_API_URL;

export async function getApiUrl(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem('app_api_url');
    if (saved && saved.trim()) {
      currentApiUrl = saved.trim().replace(/\/+$/, '');
      return currentApiUrl;
    }
  } catch {}
  return DEFAULT_API_URL;
}

export async function setApiUrl(newUrl: string): Promise<void> {
  const clean = newUrl.trim().replace(/\/+$/, '');
  currentApiUrl = clean;
  await AsyncStorage.setItem('app_api_url', clean);
}

export async function getClientUrl(): Promise<string> {
  const api = await getApiUrl();
  return api.replace(':5000', ':3000');
}

export async function checkServerConnection(urlToTest?: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const base = urlToTest || (await getApiUrl());
  const testUrl = `${base}/api/health`;
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(testUrl, { signal: controller.signal });
    clearTimeout(timeout);
    return { ok: res.ok, latencyMs: Date.now() - start };
  } catch (err: any) {
    return { ok: false, latencyMs: Date.now() - start, error: err.message || 'Offline' };
  }
}
