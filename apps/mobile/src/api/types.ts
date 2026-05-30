// Mirrors the Pulse API responses (Phase 0).

export type Urgency = 'critical' | 'action' | 'informational' | 'promotional';
export type Severity = 'critical' | 'warning' | 'info';

export interface NudgeSource {
  collection: string;
  id: string;
  label: string;
}

export interface Nudge {
  _id: string;
  kind: string;
  key: string;
  title: string;
  message: string;
  severity: Severity;
  reason: string;
  sources: NudgeSource[];
  suggestedAction?: { label: string; type: string };
}

export interface MatterEmail {
  _id: string;
  subject: string;
  from: string;
  summary: string;
  urgency: Urgency;
  deadline?: string;
  dismissed: boolean;
}

export interface CalendarEvent {
  _id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  type: string;
  location?: string;
}

export interface Overview {
  greetingName: string;
  mode: { storage: 'mongo' | 'memory'; ai: 'gemini' | 'demo' };
  stats: { documents: number; watching: number; nudges: number };
  nudges: Nudge[];
  matters: MatterEmail[];
  upcoming: CalendarEvent[];
}

export interface DocumentItem {
  _id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  expiresAt?: string;
  score?: number;
  hasFile?: boolean;
  fileName?: string;
  fileMime?: string;
}

export interface EmailItem {
  _id: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
  summary: string;
  urgency: Urgency;
  deadline?: string;
  actionRequired: boolean;
  handled: boolean;
  dismissed: boolean;
}

export interface AgentReply {
  answer: string;
  sources: { type: string; label: string }[];
  mode: 'live' | 'demo';
}

export interface Person {
  _id: string;
  name: string;
  relation?: string;
  notes: string[];
  importantDates: { label: string; date: string }[];
  followUps: { id: string; text: string; dueAt?: string; done: boolean; createdAt: string }[];
}

export interface HealthSummary {
  counts: { total: number; vitals: number; medications: number };
  vitals: { name: string; latest?: string; unit?: string; notedAt: string; trend: string[] }[];
  medications: { name: string; value?: string; notes?: string; notedAt: string }[];
  symptoms: { name: string; notes?: string; notedAt: string }[];
}
