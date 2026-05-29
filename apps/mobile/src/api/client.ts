import { API_URL } from '../config';
import type {
  AgentReply,
  DocumentItem,
  EmailItem,
  Nudge,
  Overview,
} from './types';

// Optional auth-token provider (set by the app when Firebase Auth is enabled).
let authTokenGetter: (() => Promise<string | null>) | null = null;
export function setAuthTokenGetter(fn: () => Promise<string | null>) {
  authTokenGetter = fn;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = authTokenGetter ? await authTokenGetter() : null;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
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
};

export { API_URL };
