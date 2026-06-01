import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PersistenceService } from '../persistence/persistence.service';
import { LlmService } from '../llm/llm.service';
import { MemoryService, MemoryOp } from '../memory/memory.service';
import type { NudgeDoc, PhoneSignalDoc, PhoneSignalKind } from '../domain/types';

// ─── The Perception Loop ───────────────────────────────────────────────────
// This is what turns Pulse from "an app you ask" into "the well-wisher who's
// with you". The phone streams raw signals (notifications from any app, SMS,
// calls). Pulse OBSERVES them and does two things a friend would:
//   1) quietly LEARNS durable facts about you (who you bank with, your habits)
//   2) PROACTIVELY reminds you of what you'd forget (a bill due, someone waiting
//      on a reply, an appointment) — with a reason, like a person who cares.
// Nobody narrates their life; Pulse perceives it.

export interface PhoneSignalInput {
  kind: PhoneSignalKind;
  app?: string;
  title?: string;
  body?: string;
  meta?: Record<string, unknown>;
  occurredAt?: string;
}

interface PerceivedReminder {
  title: string;
  message: string;
  reason: string;
  severity: 'info' | 'warning' | 'critical';
  sourceIndex?: number;
}

interface PerceiveResult {
  ingested: number;
  processed: number;
  learned: number;
  reminders: NudgeDoc[];
}

// How many recent signals one perception pass reasons over.
const BATCH = 40;
// Marketing/OTP/social noise the agent should never nag about.
const IGNORE = /\b(otp|one[- ]?time|verification code|verify code|promo|sale|% off|offer|coupon|cashback|deal|liked your|followed you|started following|reacted)\b/i;

@Injectable()
export class PerceptionService {
  private readonly logger = new Logger('Perception');

  constructor(
    private readonly persistence: PersistenceService,
    private readonly llm: LlmService,
    private readonly memory: MemoryService,
  ) {}

  private repo() {
    return this.persistence.getRepo<PhoneSignalDoc>('phone_signals');
  }
  private ctx() {
    return this.persistence.getRepo<any>('context_engine');
  }

  /** Store raw signals from the device. */
  async ingest(userId: string, inputs: PhoneSignalInput[]): Promise<PhoneSignalDoc[]> {
    const now = new Date().toISOString();
    const out: PhoneSignalDoc[] = [];
    for (const s of inputs ?? []) {
      if (!s || !s.kind) continue;
      const doc = await this.repo().insert({
        userId,
        kind: s.kind,
        app: s.app,
        title: s.title,
        body: s.body,
        meta: s.meta,
        occurredAt: s.occurredAt || now,
        processed: false,
      });
      out.push(doc);
    }
    return out;
  }

  /** Ingest a batch and immediately reason over it — the realistic entry point. */
  async ingestAndPerceive(userId: string, inputs: PhoneSignalInput[]): Promise<PerceiveResult> {
    const ingested = (await this.ingest(userId, inputs)).length;
    const r = await this.perceive(userId);
    return { ...r, ingested };
  }

  /** Reason over the unprocessed signals: learn + surface reminders. */
  async perceive(userId: string): Promise<PerceiveResult> {
    const pending = (await this.repo().findByUser(userId, { processed: false }))
      .sort((a, b) => (a.occurredAt ?? '').localeCompare(b.occurredAt ?? ''))
      .slice(-BATCH);
    if (!pending.length) return { ingested: 0, processed: 0, learned: 0, reminders: [] };

    const profile = await this.memory.getProfileText(userId);
    const { facts, reminders } = this.llm.live
      ? await this.perceiveWithGemini(profile, pending)
      : perceiveHeuristic(pending);

    const learned = await this.memory.learnFacts(userId, facts);
    const saved = await this.persistReminders(userId, reminders, pending);

    // Mark everything we looked at as processed so it's not re-reasoned.
    for (const s of pending) await this.repo().update(s._id, { processed: true });

    this.logger.log(
      `perceived ${pending.length} signal(s) for ${userId}: ${learned} learned, ${saved.length} reminder(s)`,
    );
    return { ingested: 0, processed: pending.length, learned, reminders: saved };
  }

  async recent(userId: string, limit = 50): Promise<PhoneSignalDoc[]> {
    const all = await this.repo().findByUser(userId);
    return all
      .sort((a, b) => (b.occurredAt ?? '').localeCompare(a.occurredAt ?? ''))
      .slice(0, limit);
  }

  // Persist reminders as generated nudges in context_engine, deduped by key,
  // so the Context Engine surfaces them on Home alongside the rule-based ones.
  private async persistReminders(
    userId: string,
    reminders: PerceivedReminder[],
    signals: PhoneSignalDoc[],
  ): Promise<NudgeDoc[]> {
    const out: NudgeDoc[] = [];
    for (const r of reminders ?? []) {
      if (!r?.title || !r?.message) continue;
      const src =
        r.sourceIndex != null && signals[r.sourceIndex] ? signals[r.sourceIndex] : undefined;
      const key = `perceived:${src ? src._id : hash(r.title)}`;
      const existing = await this.ctx().findOne({ userId, generated: true, key });
      if (existing) continue;
      const now = new Date().toISOString();
      const nudge = {
        _id: randomUUID(),
        userId,
        generated: true, // marks a perception-derived nudge
        kind: 'reminder',
        key,
        title: r.title,
        message: r.message,
        severity: severityOf(r.severity),
        reason: r.reason || 'Noticed from your phone activity.',
        sources: src
          ? [{ collection: 'phone_signals', id: src._id, label: src.app || src.title || 'Phone' }]
          : [],
        firedAt: now,
        acknowledged: false,
      };
      await this.ctx().insert(nudge);
      out.push(nudge as unknown as NudgeDoc);
    }
    return out;
  }

  private async perceiveWithGemini(
    profile: string,
    signals: PhoneSignalDoc[],
  ): Promise<{ facts: MemoryOp[]; reminders: PerceivedReminder[] }> {
    const list = signals
      .map((s, i) => {
        const when = s.occurredAt ? new Date(s.occurredAt).toLocaleString('en-IN') : '';
        return `[${i}] (${s.kind}${s.app ? ` · ${s.app}` : ''}${when ? ` · ${when}` : ''}) ${
          s.title ? s.title + ' — ' : ''
        }${s.body ?? ''}`.trim();
      })
      .join('\n');

    const prompt = `WHAT PULSE ALREADY KNOWS ABOUT THE USER:
${profile || '(nothing yet)'}

RECENT PHONE SIGNALS (notifications, messages, calls the user received):
${list}

You are Pulse — a trusted well-wisher who quietly watches over this person's phone so they never drop something that matters. Do TWO things:

1) LEARN — durable facts worth remembering long-term (who they bank with, recurring bills/subscriptions, people they're close to, habits, preferences). NOT one-off or time-bound details.
2) REMIND — proactively flag only what the user might FORGET or that NEEDS action soon: a bill/payment due, an appointment or booking, someone waiting on a reply, a deadline, a delivery. Be warm and specific, like a friend who remembers for them. Set "sourceIndex" to the [index] of the signal that prompted it.

IGNORE entirely: OTPs/verification codes, marketing/promotions, social-media noise, anything spammy or trivial.

Reply with ONLY strict JSON:
{"facts":[{"op":"add","text":"..."}],"reminders":[{"title":"short","message":"warm, specific, 1-2 sentences","reason":"why this matters / what you noticed","severity":"info|warning|critical","sourceIndex":0}]}
severity: critical = urgent/today, warning = soon (days), info = good to know. If nothing is worth learning or reminding, return {"facts":[],"reminders":[]}.`;

    try {
      const raw = await this.llm.generate(
        prompt,
        "You are Pulse's perception loop. You observe a person's phone and act like a caring, discreet well-wisher. Output only JSON.",
      );
      const json = JSON.parse(raw.replace(/```json|```/g, '').trim());
      const facts: MemoryOp[] = Array.isArray(json.facts)
        ? json.facts.filter((o: MemoryOp) => o && o.op)
        : [];
      const reminders: PerceivedReminder[] = Array.isArray(json.reminders)
        ? json.reminders.filter((r: PerceivedReminder) => r && r.title && r.message)
        : [];
      return { facts, reminders };
    } catch (e) {
      this.logger.error(`perceive (gemini) failed, falling back to heuristic: ${e}`);
      return perceiveHeuristic(signals);
    }
  }
}

function severityOf(s: string): 'info' | 'warning' | 'critical' {
  return s === 'critical' || s === 'warning' ? s : 'info';
}

// Stable, dependency-free hash for nudge keys (djb2).
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

// ─── Demo-mode perception (no Gemini key) ────────────────────────────────────
// Keyword-driven so the loop visibly works (and tests are deterministic).
function perceiveHeuristic(signals: PhoneSignalDoc[]): {
  facts: MemoryOp[];
  reminders: PerceivedReminder[];
} {
  const facts: MemoryOp[] = [];
  const reminders: PerceivedReminder[] = [];
  const seenFact = new Set<string>();

  signals.forEach((s, i) => {
    const text = `${s.title ?? ''} ${s.body ?? ''}`.trim();
    if (!text || IGNORE.test(text)) return;
    const low = text.toLowerCase();

    if (/\b(due|payment|pay |bill|outstanding|e-?mi|minimum amount|recharge|renew|overdue)\b/.test(low)) {
      reminders.push({
        title: 'A payment looks due',
        message: `${s.app ? s.app + ': ' : ''}${text}`.slice(0, 160),
        reason: 'This notification mentions a payment or bill — easy to forget.',
        severity: /overdue|today|last date/.test(low) ? 'critical' : 'warning',
        sourceIndex: i,
      });
      if (s.app && !seenFact.has(s.app)) {
        seenFact.add(s.app);
        facts.push({ op: 'add', text: `Has bills/payments via ${s.app}` });
      }
    } else if (/\b(interview|appointment|appt|booked|reservation|meeting|scheduled)\b/.test(low)) {
      reminders.push({
        title: "Something's scheduled",
        message: `${s.app ? s.app + ': ' : ''}${text}`.slice(0, 160),
        reason: 'Looks like an appointment or booking you might want a heads-up on.',
        severity: 'info',
        sourceIndex: i,
      });
    } else if (s.kind === 'sms' || s.kind === 'notification') {
      if (/\b(can you|please|waiting|reply|let me know|are you coming|call me back)\b/.test(low)) {
        reminders.push({
          title: 'Someone may be waiting on you',
          message: `${s.title ? s.title + ': ' : ''}${s.body ?? text}`.slice(0, 160),
          reason: 'This message seems to expect a reply from you.',
          severity: 'info',
          sourceIndex: i,
        });
      }
    }
  });

  return { facts, reminders };
}
