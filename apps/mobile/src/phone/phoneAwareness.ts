import * as Native from '../../modules/pulse-notifications';
import { API_URL } from '../config';
import { api } from '../api/client';

// App-facing wrapper around the native notification listener. Every native call
// is wrapped so a failure (missing module in Expo Go, or any native exception)
// can NEVER crash the app — it just degrades to "unavailable".
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const phoneAwareness = {
  /** Is the native capture module compiled into this build? */
  available: (): boolean => safe(() => Native.isAvailable(), false),

  /** Has the user granted "Notification access" in system settings? */
  permissionGranted: (): boolean => safe(() => Native.isPermissionGranted(), false),

  /** Open the system screen to grant notification access. */
  enable: (): void => safe(() => Native.openSettings(), undefined),

  /** Point the background service at this backend + user. Call on startup. */
  configure: (userId = 'demo-user'): void =>
    safe(() => Native.configure(API_URL, userId), undefined),

  /** Reason over whatever the service has uploaded; returns new reminders. */
  sync: () => api.perceiveSignals(),
};
