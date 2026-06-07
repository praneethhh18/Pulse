import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { hashEmbed, MOCK_EMBED_DIM } from './embeddings';
import { PersistenceService } from '../persistence/persistence.service';
import {
  FailoverReason,
  RETRYABLE,
  classifyGeminiError,
  jitteredBackoffMs,
  sleep,
} from './resilience';
import type { EmailUrgency, ProviderStateDoc } from '../domain/types';

export interface EmailClassification {
  summary: string;
  urgency: EmailUrgency;
  deadline?: string; // ISO
  actionRequired: boolean;
}

// ─── LLM abstraction ─────────────────────────────────────────────────────
// One interface; Gemini when GEMINI_API_KEY is set, deterministic mock when
// not. The rest of the app is provider-agnostic (lesson from Hermes' design).
@Injectable()
export class LlmService {
  private readonly logger = new Logger('LlmService');
  private gemini?: GoogleGenerativeAI;
  private readonly model: string;
  private readonly embedModel: string;
  private readonly fallbackModels: string[];
  private readonly maxRetries: number;
  readonly live: boolean;
  readonly embedSignature: string; // identifies the embedder that produced a vector

  constructor(
    private readonly config: ConfigService,
    private readonly persistence: PersistenceService,
  ) {
    const key = this.config.get<string>('GEMINI_API_KEY');
    this.model = this.config.get<string>('GEMINI_MODEL') || 'gemini-2.5-pro';
    this.embedModel =
      this.config.get<string>('GEMINI_EMBED_MODEL') || 'gemini-embedding-001';
    this.fallbackModels = (this.config.get<string>('GEMINI_FALLBACK_MODELS') || '')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    this.maxRetries = Number(this.config.get('LLM_MAX_RETRIES') ?? 3);
    this.live = !!key;
    this.embedSignature = this.live ? this.embedModel : `mock@${MOCK_EMBED_DIM}`;
    if (this.live) {
      this.gemini = new GoogleGenerativeAI(key as string);
      this.logger.log(
        `LLM live — ${this.model}${this.fallbackModels.length ? ` (fallbacks: ${this.fallbackModels.join(', ')})` : ''}`,
      );
    } else {
      this.logger.warn('LLM in DEMO MODE (no GEMINI_API_KEY) — mock intelligence');
    }
  }

  // ─── Resilience layer (retry + model fallback + cross-process breaker) ───
  private breakerRepo() {
    return this.persistence.getRepo<ProviderStateDoc>('provider_state');
  }

  private async isBroken(model: string): Promise<boolean> {
    const s = await this.breakerRepo().findOne({ model });
    return !!s && new Date(s.resetAt).getTime() > Date.now();
  }

  private async trip(model: string, ms: number, reason: string): Promise<void> {
    const resetAt = new Date(Date.now() + ms).toISOString();
    const existing = await this.breakerRepo().findOne({ model });
    if (existing) await this.breakerRepo().update(existing._id, { resetAt, reason });
    else await this.breakerRepo().insert({ userId: '_system', model, resetAt, reason });
    this.logger.warn(`breaker tripped for ${model} (${reason}) until ${resetAt}`);
  }

  private cooldownMs(reason: FailoverReason): number {
    if (reason === FailoverReason.BILLING) return 5 * 60_000;
    if (reason === FailoverReason.RATE_LIMIT) return 60_000;
    return 20_000; // overloaded
  }

  // Runs a generation across the model chain: retry transient errors with
  // jittered backoff, switch model on rate-limit/billing/overload, trip the
  // shared breaker so other workers back off too.
  private async runGeneration(call: (model: string) => Promise<string>): Promise<string> {
    const models = [this.model, ...this.fallbackModels];
    let lastErr: unknown;
    for (const model of models) {
      if (await this.isBroken(model)) {
        this.logger.warn(`skipping ${model} — breaker open`);
        continue;
      }
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          return await call(model);
        } catch (e) {
          lastErr = e;
          const reason = classifyGeminiError(e);
          this.logger.warn(`gemini ${model} ${reason} (attempt ${attempt}/${this.maxRetries})`);
          if (
            reason === FailoverReason.SAFETY_BLOCKED ||
            reason === FailoverReason.AUTH ||
            reason === FailoverReason.CONTEXT_OVERFLOW
          ) {
            throw e; // unrecoverable — don't retry or switch
          }
          if (reason === FailoverReason.RATE_LIMIT || reason === FailoverReason.BILLING) {
            await this.trip(model, this.cooldownMs(reason), reason);
            break; // straight to next model
          }
          if (RETRYABLE.has(reason) && attempt < this.maxRetries) {
            await sleep(jitteredBackoffMs(attempt));
            continue;
          }
          if (reason === FailoverReason.OVERLOADED) {
            await this.trip(model, this.cooldownMs(reason), reason);
          }
          break; // exhausted / model_not_found → next model
        }
      }
    }
    throw lastErr ?? new Error('All models exhausted');
  }

  private async runWithRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        const reason = classifyGeminiError(e);
        if (!RETRYABLE.has(reason) || attempt === this.maxRetries) throw e;
        this.logger.warn(`${label} ${reason} — retrying (${attempt})`);
        await sleep(jitteredBackoffMs(attempt));
      }
    }
    throw lastErr;
  }

  async embed(text: string): Promise<number[]> {
    if (this.gemini) {
      try {
        return await this.runWithRetry('embed', async () => {
          const m = this.gemini!.getGenerativeModel({ model: this.embedModel });
          // Match the offline embedder's dimension so vectors stay comparable
          // (cosine needs equal lengths across mock-seeded and live docs).
          const r = await m.embedContent({
            content: { role: 'user', parts: [{ text }] },
            outputDimensionality: MOCK_EMBED_DIM,
          } as any);
          return r.embedding.values;
        });
      } catch (e) {
        this.logger.error(`embed failed, falling back to mock: ${e}`);
      }
    }
    return hashEmbed(text);
  }

  // Vision OCR — reads text from a document photo. Live with Gemini; in demo
  // mode returns '' (the caller falls back to the user's typed description).
  async ocrImage(base64: string, mimeType: string): Promise<string> {
    if (this.gemini) {
      try {
        return await this.runGeneration(async (model) => {
          const m = this.gemini!.getGenerativeModel({ model });
          const r = await m.generateContent([
            { inlineData: { data: base64, mimeType } },
            {
              text: 'Extract all readable text from this document image. Return only the extracted text, no commentary.',
            },
          ]);
          return r.response.text().trim();
        });
      } catch (e) {
        this.logger.error(`ocrImage failed: ${e}`);
      }
    }
    return '';
  }

  async generate(prompt: string, system?: string): Promise<string> {
    if (this.gemini) {
      try {
        return await this.runGeneration(async (model) => {
          const m = this.gemini!.getGenerativeModel({
            model,
            systemInstruction: system,
          });
          const r = await m.generateContent(prompt);
          return r.response.text();
        });
      } catch (e) {
        this.logger.error(`generate failed, falling back to mock: ${e}`);
      }
    }
    return this.mockGenerate(prompt, system);
  }

  async classifyEmail(input: {
    from: string;
    subject: string;
    body: string;
  }): Promise<EmailClassification> {
    if (this.gemini) {
      try {
        const prompt = `Analyse this email and reply ONLY with strict JSON:
{"summary": "<two short lines: what it wants and by when>", "urgency": "critical|action|informational|promotional", "deadline": "<ISO 8601 date or null>", "actionRequired": <true|false>}

FROM: ${input.from}
SUBJECT: ${input.subject}
BODY: ${input.body}`;
        const raw = await this.generate(
          prompt,
          'You are Pulse, a precise email triage agent. Output only JSON.',
        );
        const json = JSON.parse(raw.replace(/```json|```/g, '').trim());
        return {
          summary: String(json.summary ?? input.subject),
          urgency: normaliseUrgency(json.urgency),
          deadline: json.deadline && json.deadline !== 'null' ? json.deadline : undefined,
          actionRequired: !!json.actionRequired,
        };
      } catch (e) {
        this.logger.error(`classifyEmail failed, using heuristic: ${e}`);
      }
    }
    return heuristicClassify(input);
  }

  // ─── Mock generation (demo mode) ───────────────────────────────────────
  private mockGenerate(prompt: string, _system?: string): string {
    const p = prompt.toLowerCase();
    if (p.includes('briefing')) {
      return 'Here is your briefing: review the attached documents, confirm the time and location, and prepare your key questions. Everything you saved for this event is ready offline.';
    }
    return "Based on everything I'm watching across your life, here's what matters most right now. (Connect a Gemini key to unlock full reasoning.)";
  }
}

function normaliseUrgency(v: unknown): EmailUrgency {
  const s = String(v);
  if (s === 'critical' || s === 'action' || s === 'informational' || s === 'promotional')
    return s;
  return 'informational';
}

// ─── Heuristic email triage (demo mode) ──────────────────────────────────
// Genuinely useful keyword/date analysis so the Guardian looks intelligent
// without any API key.
function heuristicClassify(input: {
  from: string;
  subject: string;
  body: string;
}): EmailClassification {
  const text = `${input.subject} ${input.body}`.toLowerCase();

  const criticalWords = [
    'urgent', 'immediately', 'final notice', 'suspend', 'overdue', 'fraud',
    'expire', 'deadline', 'last day', 'action required', 'verify', 'penalty',
  ];
  const actionWords = [
    'confirm', 'reply', 'submit', 'complete', 'review', 'sign', 'pay',
    'schedule', 'rsvp', 'apply', 'update', 'response needed',
  ];
  const promoWords = ['sale', 'offer', '% off', 'discount', 'deal', 'newsletter', 'unsubscribe'];

  const has = (words: string[]) => words.some((w) => text.includes(w));

  let urgency: EmailUrgency = 'informational';
  if (has(promoWords)) urgency = 'promotional';
  if (has(actionWords)) urgency = 'action';
  if (has(criticalWords)) urgency = 'critical';

  const deadline = extractDeadline(text);
  const actionRequired = urgency === 'critical' || urgency === 'action';

  const what =
    urgency === 'critical'
      ? 'Time-sensitive — needs your attention'
      : urgency === 'action'
        ? 'Action requested from you'
        : urgency === 'promotional'
          ? 'Promotional — low priority'
          : 'For your information';
  const by = deadline
    ? `by ${new Date(deadline).toLocaleDateString()}`
    : 'no explicit deadline';
  const summary = `${what}. ${cap(input.subject)} — ${by}.`;

  return { summary, urgency, deadline, actionRequired };
}

function extractDeadline(text: string): string | undefined {
  // "within 3 days", "in 5 days"
  const rel = text.match(/(?:within|in)\s+(\d{1,2})\s+days?/);
  if (rel) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(rel[1], 10));
    return d.toISOString();
  }
  // ISO-ish or "on 12 June" style left to live LLM; keep demo deterministic.
  if (text.includes('today')) return new Date().toISOString();
  if (text.includes('tomorrow')) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString();
  }
  return undefined;
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
