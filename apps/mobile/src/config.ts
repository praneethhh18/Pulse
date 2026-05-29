import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Where the Pulse API lives.
//
// Priority:
//   1. EXPO_PUBLIC_API_URL if you set it (apps/mobile/.env)
//   2. Auto-detect: use the SAME host your phone used to reach Metro
//      (e.g. 192.168.50.211) on port 4000 — works on any Wi-Fi, no config.
//   3. Fallback to localhost / emulator address.

const API_PORT = 4000;

function metroHost(): string | undefined {
  const c: any = Constants;
  const candidates: (string | undefined)[] = [
    c.expoConfig?.hostUri,
    c.expoGoConfig?.debuggerHost,
    c.expoGoConfig?.hostUri,
    c.manifest2?.extra?.expoGo?.debuggerHost,
    c.manifest?.debuggerHost,
    c.manifest?.hostUri,
  ];
  for (const cand of candidates) {
    if (cand && typeof cand === 'string') return cand.split(':')[0];
  }
  return undefined;
}

const fromEnv = process.env.EXPO_PUBLIC_API_URL;
const host = metroHost();

const fallback = host
  ? `http://${host}:${API_PORT}`
  : Platform.OS === 'android'
    ? `http://10.0.2.2:${API_PORT}`
    : `http://localhost:${API_PORT}`;

export const API_URL = fromEnv && fromEnv.length ? fromEnv : fallback;
