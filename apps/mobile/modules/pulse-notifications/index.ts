import { requireOptionalNativeModule } from 'expo';

// requireOptionalNativeModule returns null when the native module isn't present
// (e.g. in Expo Go or on iOS), so importing this never crashes — callers just
// see isAvailable() === false and degrade gracefully.
const Native = requireOptionalNativeModule('PulseNotifications');

export function isAvailable(): boolean {
  return Native != null;
}

export function isPermissionGranted(): boolean {
  return Native?.isPermissionGranted?.() ?? false;
}

export function openSettings(): void {
  Native?.openSettings?.();
}

export function configure(apiUrl: string, userId: string): void {
  Native?.configure?.(apiUrl, userId);
}
