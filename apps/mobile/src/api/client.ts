import { API_URL } from '../config';
import type {
  AgentReply,
  DocumentItem,
  EmailItem,
  Nudge,
  Overview,
} from './types';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
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
};

export { API_URL };
