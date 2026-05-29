import { initializeApp, getApps } from 'firebase/app';
import * as fbAuth from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase Auth is active only when these EXPO_PUBLIC_FIREBASE_* env vars are
// set (apps/mobile/.env). Without them, the app runs in single-user demo mode
// with no login — matching the backend's demo behavior.
const cfg = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const authEnabled = !!(cfg.apiKey && cfg.projectId && cfg.appId);

let auth: fbAuth.Auth | null = null;

if (authEnabled) {
  const app = getApps().length ? getApps()[0] : initializeApp(cfg as any);
  try {
    auth = fbAuth.initializeAuth(app, {
      // RN persistence so the session survives app restarts.
      persistence: (fbAuth as any).getReactNativePersistence(AsyncStorage),
    });
  } catch {
    auth = fbAuth.getAuth(app);
  }
}

export { auth };

export async function getIdToken(): Promise<string | null> {
  if (!auth?.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

export function signIn(email: string, password: string) {
  return fbAuth.signInWithEmailAndPassword(auth!, email, password);
}
export function signUp(email: string, password: string) {
  return fbAuth.createUserWithEmailAndPassword(auth!, email, password);
}
export function signOutUser() {
  return fbAuth.signOut(auth!);
}
export function watchAuth(cb: (user: fbAuth.User | null) => void): () => void {
  if (!auth) {
    cb(null);
    return () => {};
  }
  return fbAuth.onAuthStateChanged(auth, cb);
}
export function currentEmail(): string | undefined {
  return auth?.currentUser?.email ?? undefined;
}
