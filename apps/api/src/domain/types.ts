// ─── Pulse domain model ──────────────────────────────────────────────────
// The shape of "a whole life". Phase 0 actively uses: users, documents,
// email_intelligence, calendar_events, context_engine. The remaining
// collections from the vision are declared here so the model is complete and
// later phases plug in without reshaping the foundation.

export type CollectionName =
  | 'users'
  | 'documents'
  | 'email_intelligence'
  | 'calendar_events'
  | 'context_engine'
  // declared for later phases (vision §3) — defined now so nothing is missed:
  | 'price_watches'
  | 'health_records'
  | 'financial_transactions'
  | 'event_briefings'
  | 'call_intelligence'
  | 'relationship_memory'
  | 'integrations'
  | 'user_profile'
  | 'provider_state'
  | 'learning_goals'
  | 'learning_cards'
  | 'trips';

export interface BaseDoc {
  _id: string;
  userId: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface UserDoc extends BaseDoc {
  name: string;
  email: string;
  preferences: {
    quietHoursStart?: number; // 0-23
    quietHoursEnd?: number;
    timezone?: string;
  };
  // living model — grows with use (vision §4 "the learning loop")
  learnedPatterns: Record<string, unknown>;
  consentLedger: { source: string; grantedAt: string }[];
}

export type DocumentCategory =
  | 'identity'
  | 'medical'
  | 'financial'
  | 'legal'
  | 'educational'
  | 'vehicle'
  | 'travel'
  | 'other';

export interface DocumentDoc extends BaseDoc {
  title: string;
  category: DocumentCategory;
  content: string; // OCR'd / extracted text — searchable
  embedding: number[]; // vector for semantic search
  expiresAt?: string; // ISO — drives expiry intelligence
  tags: string[];
  // Attached media (photo/scan of the document)
  hasFile?: boolean;
  fileName?: string;
  fileMime?: string;
  fileData?: string; // base64 — inline storage (demo / no bucket)
  fileKey?: string; // object key in cloud storage (GCS) when configured
}

export type EmailUrgency = 'critical' | 'action' | 'informational' | 'promotional';

export interface EmailDoc extends BaseDoc {
  from: string;
  subject: string;
  body: string;
  receivedAt: string; // ISO
  // intelligence extracted by the agent:
  summary: string; // two plain lines: what it wants + by when
  urgency: EmailUrgency;
  deadline?: string; // ISO if a date/action window was detected
  actionRequired: boolean;
  handled: boolean;
  dismissed: boolean; // swiped away — Pulse may resurface before deadline
  source?: 'seed' | 'manual' | 'gmail'; // where it came from
  sourceId?: string; // provider message id, for dedupe on auto-sync
}

// The "grows with you" layer — a compact, always-injected model of the user,
// built by the background learning loop (see MemoryService). Tier-2 of the
// Hermes memory design (its USER.md): char-capped so it stays high-signal.
export interface UserProfileDoc extends BaseDoc {
  content: string; // bulleted durable facts about the user
  turnCount: number; // how many turns observed
  lastReviewedAt?: string;
}

// Cross-process rate-limit breaker: when a model is throttled, every worker
// (API, cron monitors, background memory loop) reads this and backs off instead
// of piling onto the throttled provider (Hermes' nous_rate_guard, in Mongo).
export interface ProviderStateDoc extends BaseDoc {
  model: string;
  resetAt: string; // ISO — don't use this model until then
  reason: string;
}

// Stored OAuth connection to an external account (Gmail, later Calendar, etc.)
export interface IntegrationDoc extends BaseDoc {
  provider: 'gmail';
  email?: string;
  tokens: string; // encrypted (AES-256-GCM) OAuth token blob
  lastSyncAt?: string;
}

// Travel Companion (vision §3.8) — everything you'd otherwise forget for a trip.
export interface PackItem {
  label: string;
  packed: boolean;
}
export interface TripDoc extends BaseDoc {
  destination: string;
  startsAt: string; // ISO
  endsAt?: string;
  notes?: string;
  packingList: PackItem[];
}

// Learning Companion (vision §3.9) — spaced repetition resurfaces what you're
// about to forget at the optimal moment.
export interface LearningGoalDoc extends BaseDoc {
  topic: string;
}
export interface CardDoc extends BaseDoc {
  goalId: string;
  front: string;
  back: string;
  dueAt: string; // ISO — when to review next
  intervalDays: number;
  reps: number;
  lapses: number;
}

// Financial Pulse (vision §3.7) — spend awareness without spreadsheets.
export type TxnDirection = 'debit' | 'credit';
export interface TransactionDoc extends BaseDoc {
  amount: number; // positive, INR
  direction: TxnDirection;
  category: string;
  merchant: string;
  occurredAt: string; // ISO
  recurring?: boolean;
  notes?: string;
}

// Relationship Memory (vision §3.10) — be the person who always remembers.
export interface ImportantDate {
  label: string; // "Birthday", "Anniversary"
  date: string; // ISO date (year ignored for recurring)
}
export interface FollowUp {
  id: string;
  text: string;
  dueAt?: string; // ISO
  done: boolean;
  createdAt: string;
}
export interface PersonDoc extends BaseDoc {
  name: string;
  relation?: string; // wife, friend, manager…
  notes: string[]; // things they mentioned / details to remember
  importantDates: ImportantDate[];
  followUps: FollowUp[];
  lastInteractionAt?: string;
}

// Health Companion (vision §3.6) — vitals, medications, symptoms over time.
export type HealthKind = 'vital' | 'medication' | 'symptom';
export interface HealthRecordDoc extends BaseDoc {
  kind: HealthKind;
  name: string; // "Blood Pressure", "Weight", "Metformin", "Headache"
  value?: string; // "120/80", "72"
  unit?: string; // "kg", "mg/dL", "bpm"
  notedAt: string; // ISO
  notes?: string;
}

export interface CalendarEventDoc extends BaseDoc {
  title: string;
  startsAt: string; // ISO
  endsAt?: string;
  type: 'interview' | 'doctor' | 'meeting' | 'exam' | 'flight' | 'personal';
  location?: string;
  source?: 'seed' | 'google';
  sourceId?: string; // provider event id, for dedupe on auto-sync
}

// What makes Pulse different — cross-domain connections + proactive nudges.
export interface NudgeDoc extends BaseDoc {
  kind: string; // e.g. 'deadline', 'schedule-conflict', 'expiry', 'pattern'
  key: string; // stable identity (kind + sources) — used for dismiss/ack
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  // EXPLAINABILITY: every nudge stores why it fired + which records caused it.
  reason: string;
  sources: { collection: CollectionName; id: string; label: string }[];
  suggestedAction?: { label: string; type: string };
  firedAt: string; // ISO
  acknowledged: boolean;
}
