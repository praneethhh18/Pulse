import * as Native from '../../modules/pulse-notifications';
import { API_URL } from '../config';
import { api } from '../api/client';

// App-facing wrapper around the native notification listener. Everything here is
// safe to call in Expo Go (it just no-ops) — the capability only truly turns on
// in a dev/production build where the native module is compiled in.
export const phoneAwareness = {
  /** Is the native capture module compiled into this build? */
  available: (): boolean => Native.isAvailable(),

  /** Has the user granted "Notification access" in system settings? */
  permissionGranted: (): boolean => Native.isPermissionGranted(),

  /** Open the system screen to grant notification access. */
  enable: (): void => Native.openSettings(),

  /** Point the background service at this backend + user. Call on startup. */
  configure: (userId = 'demo-user'): void => Native.configure(API_URL, userId),

  /** Reason over whatever the service has uploaded; returns new reminders. */
  sync: () => api.perceiveSignals(),
};
