import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Default to local Wi-Fi IP for physical devices, or localhost/10.0.2.2 for emulators
const DEFAULT_HOST = Platform.select({
  android: '192.168.0.186',
  ios: '192.168.0.186',
  default: 'localhost'
});

export const DEFAULT_API_URL = `http://${DEFAULT_HOST}:5000`;

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
