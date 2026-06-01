import { Injectable, Logger } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';
import { LlmService } from '../llm/llm.service';
import type { UserProfileDoc } from '../domain/types';

// Char cap forces consolidation instead of unbounded growth (Hermes USER.md = 1375).
const PROFILE_MAX_CHARS = 1800;

export interface MemoryOp {
  op: 'add' | 'replace' | 'remove';
  text?: string; // for add / replace (new text)
  find?: string; // for replace / remove (substring to match)
}

export interface TurnMessage {
  role: 'user' | 'pulse';
  text: string;
}

@Injectable()
export class MemoryService {
  private readonly logger = new Logger('MemoryService');

  constructor(
    private readonly persistence: PersistenceService,
    private readonly llm: LlmService,
  ) {}

  private repo() {
    return this.persistence.getRepo<UserProfileDoc>('user_profile');
  }

  async getProfile(userId: string): Promise<UserProfileDoc> {
    const existing = await this.repo().findOne({ userId });
    if (existing) return existing;
    return this.repo().insert({ userId, content: '', turnCount: 0 });
  }

  async getProfileText(userId: string): Promise<string> {
    return (await this.getProfile(userId)).content;
  }

  async clear(userId: string): Promise<{ ok: boolean }> {
    const p = await this.repo().findOne({ userId });
    if (p) await this.repo().update(p._id, { content: '', turnCount: 0 });
    return { ok: true };
  }

  // ─── Operation-based edits with a hard char budget (Hermes memory_tool) ──
  private applyOps(content: string, ops: MemoryOp[]): string {
    let lines = content
      ? content.split('\n').map((l) => l.trim()).filter(Boolean)
      : [];

    for (const op of ops) {
      if (op.op === 'add' && op.text) {
        const fact = normalize(op.text);
        // skip near-duplicates
        if (!lines.some((l) => similar(l, fact))) lines.push(`- ${fact}`);
      } else if (op.op === 'replace' && op.find && op.text) {
        lines = lines.map((l) =>
          l.toLowerCase().includes(op.find!.toLowerCase())
            ? `- ${normalize(op.text!)}`
            : l,
        );
      } else if (op.op === 'remove' && op.find) {
        lines = lines.filter(
          (l) => !l.toLowerCase().includes(op.find!.toLowerCase()),
        );
      }
    }

    let result = lines.join('\n');
    // Enforce cap: drop oldest entries until under budget (keep newest facts).
    while (result.length > PROFILE_MAX_CHARS && lines.length > 1) {
      lines.shift();
      result = lines.join('\n');
    }
    return result.slice(0, PROFILE_MAX_CHARS);
  }

  /**
   * Apply externally-extracted durable facts (e.g. from the perception loop
   * reasoning over phone signals) into the same char-capped profile.
   */
  async learnFacts(userId: string, ops: MemoryOp[]): Promise<number> {
    const clean = (ops ?? []).filter((o) => o && o.op);
    if (!clean.length) return 0;
    const profile = await this.getProfile(userId);
    const content = this.applyOps(profile.content, clean);
    if (content !== profile.content) {
      await this.repo().update(profile._id, {
        content,
        lastReviewedAt: new Date().toISOString(),
      });
      this.logger.log(`learned ${clean.length} fact(s) from signals for ${userId}`);
    }
    return clean.length;
  }

  /** Fire-and-forget: never blocks the user's reply. */
  reviewAsync(userId: string, transcript: TurnMessage[]): void {
    setImmediate(() => {
      this.review(userId, transcript).catch((e) =>
        this.logger.error(`background review failed: ${e}`),
      );
    });
  }

  // ─── The background learning loop ───────────────────────────────────────
  async review(
    userId: string,
    transcript: TurnMessage[],
  ): Promise<{ applied: number }> {
    const profile = await this.getProfile(userId);
    const ops = this.llm.live
      ? await this.extractWithGemini(profile.content, transcript)
      : extractHeuristic(transcript);

    if (ops.length) {
      const content = this.applyOps(profile.content, ops);
      await this.repo().update(profile._id, {
        content,
        turnCount: profile.turnCount + 1,
        lastReviewedAt: new Date().toISOString(),
        // provenance: this write came from the background reviewer
      });
      this.logger.log(`learned ${ops.length} fact(s) for ${userId}`);
    } else {
      await this.repo().update(profile._id, {
        turnCount: profile.turnCount + 1,
      });
    }
    return { applied: ops.length };
  }

  private async extractWithGemini(
    current: string,
    transcript: TurnMessage[],
  ): Promise<MemoryOp[]> {
    const convo = transcript
      .map((m) => `${m.role === 'user' ? 'User' : 'Pulse'}: ${m.text}`)
      .join('\n');
    const prompt = `CURRENT PROFILE (durable facts about the user):
${current || '(empty)'}

NEW CONVERSATION:
${convo}

Decide what, if anything, to remember long-term about the USER. Reply with ONLY strict JSON:
{"operations":[{"op":"add","text":"..."},{"op":"replace","find":"old substring","text":"new fact"},{"op":"remove","find":"substring"}]}

CAPTURE (high value): stable identity (name, family, location, job), durable preferences, dietary/health constraints, recurring needs, how the user wants Pulse to behave, important relationships/dates.
DO NOT CAPTURE: one-off task details, anything time-bound that won't matter next week, transient errors or system issues, or facts already present in the profile.
If nothing is worth remembering, return {"operations":[]}.`;
    try {
      const raw = await this.llm.generate(
        prompt,
        'You are Pulse\'s memory keeper. Extract only durable, high-signal facts about the user. Output only JSON.',
      );
      const json = JSON.parse(raw.replace(/```json|```/g, '').trim());
      const ops = Array.isArray(json.operations) ? json.operations : [];
      return ops.filter((o: MemoryOp) => o && o.op);
    } catch (e) {
      this.logger.error(`extract failed: ${e}`);
      return [];
    }
  }
}

// ─── Demo-mode heuristic extractor (no Gemini key) ───────────────────────
// Pulls durable facts from the user's own statements so the loop visibly works.
function extractHeuristic(transcript: TurnMessage[]): MemoryOp[] {
  const ops: MemoryOp[] = [];
  const userText = transcript
    .filter((m) => m.role === 'user')
    .map((m) => m.text)
    .join(' ');

  const add = (text: string) => ops.push({ op: 'add', text });
  const m = (re: RegExp) => userText.match(re);

  let r: RegExpMatchArray | null;
  if ((r = m(/\b(?:my name is|call me|i am|i'm)\s+([A-Z][a-z]+)\b/)))
    add(`Name: ${r[1]}`);
  if ((r = m(/\bremember (?:that )?(.+?)(?:\.|$)/i))) add(cap(r[1]));
  if ((r = m(/\bi (?:prefer|like|love) (.+?)(?:\.|$)/i)))
    add(`Prefers ${low(r[1])}`);
  if ((r = m(/\bi (?:don'?t like|hate|dislike) (.+?)(?:\.|$)/i)))
    add(`Dislikes ${low(r[1])}`);
  if ((r = m(/\bi(?:'m| am)\s+(vegetarian|vegan|non-vegetarian|eggetarian)\b/i)))
    add(`Dietary: ${low(r[1])}`);
  if ((r = m(/\b(?:i(?:'m| am) )?allergic to (.+?)(?:\.|$)/i)))
    add(`Allergic to ${low(r[1])}`);
  if ((r = m(/\bi live in (.+?)(?:\.|$)/i))) add(`Lives in ${cap(r[1])}`);
  if ((r = m(/\bi work (?:as|at) (.+?)(?:\.|$)/i))) add(`Works ${low(r[1])}`);
  if ((r = m(/\bmy (wife|husband|partner|mother|father|mom|dad|son|daughter|boss|manager|friend)(?:'s name)? (?:is |named )([A-Z][a-z]+)/i)))
    add(`${cap(r[1])}: ${r[2]}`);

  // dedupe within this batch
  const seen = new Set<string>();
  return ops.filter((o) => {
    const k = (o.text ?? '').toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function normalize(s: string): string {
  return s.replace(/^[-•\s]+/, '').replace(/\s+/g, ' ').trim();
}
function similar(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  const nb = b.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  return na.includes(nb) || nb.includes(na);
}
function cap(s: string): string {
  s = s.trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function low(s: string): string {
  return s.trim().toLowerCase();
}
