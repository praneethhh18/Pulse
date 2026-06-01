import { API_URL } from '../config';
import type {
  AgentReply,
  DocumentItem,
  EmailItem,
  FinanceSummary,
  HealthSummary,
  LearningCard,
  LearningGoal,
  Nudge,
  Overview,
  Person,
  PhoneSignal,
  Trip,
} from './types';

// Optional auth-token provider (set by the app when Firebase Auth is enabled).
let authTokenGetter: (() => Promise<string | null>) | null = null;
export function setAuthTokenGetter(fn: () => Promise<string | null>) {
  authTokenGetter = fn;
}

// The device's IANA timezone, so the backend formats every time in the user's
// local zone (never the server's).
let deviceTz = 'UTC';
try {
  deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
} catch {
  /* keep UTC */
}

// Current UI language — the backend uses it so the agent answers in this language.
let currentLang = 'en';
export function setApiLanguage(lang: string) {
  currentLang = lang || 'en';
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = authTokenGetter ? await authTokenGetter() : null;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-timezone': deviceTz,
      'x-language': currentLang,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  overview: () => req<Overview>('/overview'),
  nudges: () => req<Nudge[]>('/context/nudges'),
  // Phone awareness: the device batches raw signals (notifications, SMS, calls)
  // and posts them; Pulse perceives them — learning + proactive reminders.
  ingestSignals: (signals: PhoneSignal[]) =>
    req<{ ingested: number; processed: number; learned: number; reminders: Nudge[] }>(
      '/me/signals',
      { method: 'POST', body: JSON.stringify({ signals }) },
    ),
  recentSignals: () => req<PhoneSignal[]>('/me/signals'),
  // Reason over signals the phone has uploaded but not yet processed.
  perceiveSignals: () =>
    req<{ processed: number; learned: number; reminders: Nudge[] }>('/me/signals/perceive', {
      method: 'POST',
    }),
  ackNudge: (key: string) =>
    req<{ ok: boolean }>('/context/nudges/ack', {
      method: 'POST',
      body: JSON.stringify({ key }),
    }),
  documents: () => req<DocumentItem[]>('/documents'),
  searchDocuments: (q: string) =>
    req<DocumentItem[]>(`/documents/search?q=${encodeURIComponent(q)}`),
  addDocument: (body: {
    title: string;
    category: string;
    content?: string;
    tags?: string[];
    expiresAt?: string;
    fileName?: string;
    mimeType?: string;
    base64?: string;
  }) => req<DocumentItem>('/documents', { method: 'POST', body: JSON.stringify(body) }),
  emails: () => req<EmailItem[]>('/email'),
  ingestEmail: (body: { from: string; subject: string; body: string }) =>
    req<EmailItem>('/email', { method: 'POST', body: JSON.stringify(body) }),
  handleEmail: (id: string) =>
    req<EmailItem>(`/email/${id}/handle`, { method: 'POST' }),
  draftReply: (id: string) =>
    req<{ subject: string; draft: string }>(`/email/${id}/draft`, { method: 'POST' }),
  ask: (message: string) =>
    req<AgentReply>('/agent/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  health: () => req<{ status: string; storage: string; ai: string }>('/health'),
  gmailStatus: () =>
    req<{
      configured: boolean;
      connected: boolean;
      email?: string;
      lastSyncAt?: string;
    }>('/gmail/status'),
  gmailAuthUrl: () =>
    req<{ configured: boolean; url: string | null }>('/gmail/auth-url'),
  gmailSync: () =>
    req<{ fetched: number; added: number }>('/gmail/sync', { method: 'POST' }),
  calendarStatus: () =>
    req<{ configured: boolean; connected: boolean }>('/calendar/status'),
  calendarSync: () =>
    req<{ fetched: number; added: number }>('/calendar/sync', { method: 'POST' }),
  dataSummary: () =>
    req<{ counts: Record<string, number>; total: number }>('/me/data'),
  exportData: () =>
    req<{ totalRecords: number; categories: number; exportedAt: string }>('/me/export'),
  deleteAllData: () =>
    req<{ ok: boolean; total: number }>('/me', { method: 'DELETE' }),
  profile: () =>
    req<{
      content: string;
      facts: string[];
      turnCount: number;
      lastReviewedAt?: string;
    }>('/me/profile'),
  people: () => req<Person[]>('/people'),
  addPerson: (body: { name: string; relation?: string }) =>
    req<Person>('/people', { method: 'POST', body: JSON.stringify(body) }),
  addPersonNote: (id: string, text: string) =>
    req<Person>(`/people/${id}/notes`, { method: 'POST', body: JSON.stringify({ text }) }),
  addPersonFollowUp: (id: string, text: string, dueAt?: string) =>
    req<Person>(`/people/${id}/followups`, {
      method: 'POST',
      body: JSON.stringify({ text, dueAt }),
    }),
  completeFollowUp: (id: string, fid: string) =>
    req<Person>(`/people/${id}/followups/${fid}/done`, { method: 'POST' }),
  learningGoals: () => req<LearningGoal[]>('/me/learning/goals'),
  dueCards: () => req<LearningCard[]>('/me/learning/due'),
  createGoal: (topic: string) =>
    req<unknown>('/me/learning/goals', { method: 'POST', body: JSON.stringify({ topic }) }),
  reviewCard: (id: string, grade: 'again' | 'good') =>
    req<unknown>(`/me/learning/cards/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ grade }),
    }),
  trips: () => req<Trip[]>('/me/trips'),
  addTrip: (body: { destination: string; startsAt: string; endsAt?: string }) =>
    req<Trip>('/me/trips', { method: 'POST', body: JSON.stringify(body) }),
  togglePack: (tripId: string, index: number) =>
    req<Trip>(`/me/trips/${tripId}/pack/${index}`, { method: 'POST' }),
  financeSummary: () => req<FinanceSummary>('/me/finance/summary'),
  addTransaction: (body: {
    amount: number;
    category: string;
    merchant: string;
    direction?: 'debit' | 'credit';
  }) => req('/me/finance/transactions', { method: 'POST', body: JSON.stringify(body) }),
  healthSummary: () => req<HealthSummary>('/me/health/summary'),
  addHealthRecord: (body: {
    kind: 'vital' | 'medication' | 'symptom';
    name: string;
    value?: string;
    unit?: string;
    notes?: string;
  }) => req('/me/health/records', { method: 'POST', body: JSON.stringify(body) }),
  briefing: (eventId: string) =>
    req<{
      event: { title: string; startsAt: string; location?: string; type: string };
      briefing: string;
      sources: { type: string; label: string }[];
    }>(`/briefings/event/${eventId}`),
};

export { API_URL };
