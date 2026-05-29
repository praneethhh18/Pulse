// User-timezone-aware time. A life-agent that says "good morning" at 3am or
// reminds in the wrong zone loses trust instantly — so every user-facing time
// is formatted in the user's IANA timezone, never the server's, never naive.
// Ported discipline from Hermes' hermes_time.py (always-aware, safe fallback).

const DEFAULT_TZ = process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata';

function isValidTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Resolve a timezone from a request header, falling back safely. Never throws. */
export function resolveTimezone(header?: string): string {
  const tz = header?.trim();
  if (tz && isValidTz(tz)) return tz;
  if (isValidTz(DEFAULT_TZ)) return DEFAULT_TZ;
  return 'UTC';
}

export function fmtTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: tz,
  });
}

export function fmtDate(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: tz,
  });
}

export function fmtDateTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz,
  });
}

/** Hour-of-day (0-23) in the user's timezone — for greetings/quiet hours. */
export function hourInTz(tz: string, date = new Date()): number {
  const h = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: tz,
  }).format(date);
  return parseInt(h, 10) % 24;
}
