import { Injectable } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';
import { LlmService } from '../llm/llm.service';
import { DocumentsService } from '../documents/documents.service';
import { EmailService } from '../email/email.service';
import { ContextService } from '../context/context.service';
import { MemoryService } from '../memory/memory.service';
import { HealthCompanionService } from '../health/health.service';
import { FinanceService } from '../finance/finance.service';
import { RelationshipsService } from '../relationships/relationships.service';
import { LearningService } from '../learning/learning.service';
import { languageDirective } from '../common/lang.util';
import { formatInr } from '../common/finance.util';
import type { CalendarEventDoc, PersonDoc } from '../domain/types';

export interface AgentReply {
  answer: string;
  sources: { type: string; label: string }[];
  mode: 'live' | 'demo';
}

interface LifeContext {
  healthSummary: {
    vitals: { name: string; latest?: string; unit?: string }[];
    medications: { name: string; value?: string }[];
  };
  financeSummary: {
    total: number;
    categories: { name: string; amount: number; deltaPct: number | null }[];
  };
  people: PersonDoc[];
  dueCards: number;
}

@Injectable()
export class AgentService {
  constructor(
    private readonly persistence: PersistenceService,
    private readonly llm: LlmService,
    private readonly documents: DocumentsService,
    private readonly email: EmailService,
    private readonly context: ContextService,
    private readonly memory: MemoryService,
    private readonly health: HealthCompanionService,
    private readonly finance: FinanceService,
    private readonly relationships: RelationshipsService,
    private readonly learning: LearningService,
  ) {}

  // Answers grounded in the user's WHOLE life — documents, mail, calendar,
  // nudges, health, money, people and learning.
  async chat(userId: string, message: string, lang = 'en'): Promise<AgentReply> {
    const [docs, matters, nudges, events, profile, healthSummary, financeSummary, people, dueCards] =
      await Promise.all([
        this.documents.search(userId, message, 3),
        this.email.whatMatters(userId),
        this.context.nudges(userId),
        this.persistence
          .getRepo<CalendarEventDoc>('calendar_events')
          .findByUser(userId),
        this.memory.getProfileText(userId),
        this.health.summary(userId),
        this.finance.summary(userId),
        this.relationships.list(userId),
        this.learning.countDue(userId),
      ]);
    const life = { healthSummary, financeSummary, people, dueCards };

    const upcoming = events
      .filter((e) => new Date(e.startsAt).getTime() > Date.now())
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 3);

    const sources = [
      ...docs.map((d) => ({ type: 'document', label: d.title })),
      ...nudges.slice(0, 2).map((n) => ({ type: 'nudge', label: n.title })),
    ];

    const transcript = [{ role: 'user' as const, text: message }];

    if (this.llm.live) {
      const ctx = this.buildContext(docs, matters, nudges, upcoming, life);
      const profileBlock = profile
        ? `\n\nWhat you know about this user (their profile):\n${profile}`
        : '';
      const langClause = languageDirective(lang);
      const answer = await this.llm.generate(
        `User asks: "${message}"\n\nHere is everything Pulse knows that's relevant:\n${ctx}\n\nAnswer helpfully and concisely as Pulse, the user's life agent. Reference specifics.`,
        `You are Pulse, a proactive personal life agent. Be warm, concise, specific. Never invent facts not in the context.${profileBlock}${langClause ? `\n\n${langClause}` : ''}`,
      );
      // Learn from this turn in the background — never blocks the reply.
      this.memory.reviewAsync(userId, [...transcript, { role: 'pulse', text: answer }]);
      return { answer, sources, mode: 'live' };
    }

    const answer = this.demoAnswer(message, docs, matters, nudges, upcoming, profile, life);
    this.memory.reviewAsync(userId, [...transcript, { role: 'pulse', text: answer }]);
    return { answer, sources, mode: 'demo' };
  }

  private buildContext(
    docs: { title: string; content: string }[],
    matters: { subject: string; summary: string }[],
    nudges: { title: string; message: string }[],
    upcoming: CalendarEventDoc[],
    life: LifeContext,
  ): string {
    const parts: string[] = [];
    if (docs.length)
      parts.push(
        'RELEVANT DOCUMENTS:\n' +
          docs.map((d) => `- ${d.title}: ${d.content}`).join('\n'),
      );
    if (matters.length)
      parts.push(
        'EMAILS THAT NEED ATTENTION:\n' +
          matters.map((m) => `- ${m.subject}: ${m.summary}`).join('\n'),
      );
    if (nudges.length)
      parts.push(
        'ACTIVE NUDGES:\n' +
          nudges.map((n) => `- ${n.title}: ${n.message}`).join('\n'),
      );
    if (upcoming.length)
      parts.push(
        'UPCOMING EVENTS:\n' +
          upcoming
            .map((e) => `- ${e.title} at ${new Date(e.startsAt).toLocaleString()}`)
            .join('\n'),
      );

    const f = life.financeSummary;
    if (f?.categories?.length)
      parts.push(
        `SPENDING (last 30 days, total ${formatInr(f.total)}):\n` +
          f.categories
            .slice(0, 5)
            .map(
              (c) =>
                `- ${c.name}: ${formatInr(c.amount)}${c.deltaPct != null ? ` (${c.deltaPct >= 0 ? '+' : ''}${c.deltaPct}% vs prev)` : ''}`,
            )
            .join('\n'),
      );

    const h = life.healthSummary;
    if (h?.vitals?.length)
      parts.push(
        'HEALTH (latest):\n' +
          h.vitals.map((v) => `- ${v.name}: ${v.latest}${v.unit ? ' ' + v.unit : ''}`).join('\n') +
          (h.medications.length ? `\nMedications: ${h.medications.map((m) => m.name).join(', ')}` : ''),
      );

    if (life.people?.length)
      parts.push(
        'PEOPLE:\n' +
          life.people
            .map(
              (p) =>
                `- ${p.name}${p.relation ? ` (${p.relation})` : ''}${p.notes.length ? ': ' + p.notes.join('; ') : ''}` +
                (p.importantDates.length
                  ? `; ${p.importantDates.map((d) => `${d.label} ${new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`).join(', ')}`
                  : ''),
            )
            .join('\n'),
      );

    if (life.dueCards > 0)
      parts.push(`LEARNING: ${life.dueCards} flashcard(s) due for review.`);

    return parts.join('\n\n') || 'No relevant context found.';
  }

  // Deterministic, genuinely useful answer for DEMO MODE (no Gemini key).
  private demoAnswer(
    message: string,
    docs: { title: string; content: string; score?: number }[],
    matters: { subject: string; summary: string }[],
    nudges: { title: string; message: string }[],
    upcoming: CalendarEventDoc[],
    profile: string | undefined,
    life: LifeContext,
  ): string {
    const q = message.toLowerCase();
    const lines: string[] = [];

    // Money
    if (/spen[dt]|money|budget|expense|cost|finance|saving/.test(q) && life.financeSummary.categories.length) {
      const f = life.financeSummary;
      const top = f.categories[0];
      return `💰 In the last 30 days you've spent ${formatInr(f.total)}. Top category: ${top.name} (${formatInr(top.amount)})${top.deltaPct != null && top.deltaPct >= 25 ? ` — up ${top.deltaPct}% vs the prior 30 days` : ''}.`;
    }
    // Health
    if (/health|\bbp\b|blood pressure|weight|sugar|vital|medication|medicine|doctor/.test(q) && life.healthSummary.vitals.length) {
      const h = life.healthSummary;
      const vitals = h.vitals.map((v) => `${v.name}: ${v.latest}${v.unit ? ' ' + v.unit : ''}`).join(', ');
      const meds = h.medications.length ? ` Medications: ${h.medications.map((m) => m.name).join(', ')}.` : '';
      return `❤️ Your latest readings — ${vitals}.${meds}`;
    }
    // People (by name, or birthdays/follow-ups)
    const named = life.people.find((p) => q.includes(p.name.toLowerCase()));
    if (named) {
      const bits = [
        named.relation ? `your ${named.relation}` : null,
        named.notes.length ? `you noted: ${named.notes.join('; ')}` : null,
        named.importantDates.length
          ? named.importantDates.map((d) => `${d.label} on ${new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}`).join(', ')
          : null,
        named.followUps.filter((f) => !f.done).length
          ? `open follow-up: ${named.followUps.filter((f) => !f.done).map((f) => f.text).join('; ')}`
          : null,
      ].filter(Boolean);
      return `👥 ${named.name} — ${bits.join('. ')}.`;
    }
    if (/learn|review|study|flashcard|practice|revise/.test(q)) {
      return life.dueCards > 0
        ? `🎓 You have ${life.dueCards} flashcard(s) due for review. Open Learn for a quick session.`
        : `🎓 Nothing due to review right now — you're all caught up.`;
    }

    // "What do you know about me?" → reflect the learned profile.
    if (/about me|know about me|who am i|my profile|remember about me/.test(q)) {
      return profile
        ? `Here's what I've learned about you so far:\n\n${profile}\n\n(I keep this updated quietly as we talk.)`
        : "I'm still learning about you. Tell me things like “remember I'm vegetarian” or “my wife's name is Asha” and I'll remember them.";
    }

    if (profile) {
      lines.push(`🧠 I remember: ${profile.split('\n')[0].replace(/^- /, '')}`);
    }

    const top = docs[0];
    if (top && (top.score ?? 0) > 0.05) {
      lines.push(`📄 From your "${top.title}": ${top.content}`);
    }

    if (/today|schedule|plan|day|upcoming|next/.test(q) && upcoming.length) {
      lines.push(
        `📅 Coming up: ` +
          upcoming
            .map(
              (e) =>
                `${e.title} (${new Date(e.startsAt).toLocaleString('en-IN', {
                  weekday: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })})`,
            )
            .join(', ') +
          '.',
      );
    }

    if (/email|mail|deadline|due|pending|miss/.test(q) && matters.length) {
      lines.push(
        `📧 Needs you: ` + matters.map((m) => m.subject).join('; ') + '.',
      );
    }

    if (nudges.length) {
      lines.push(`⚡ Right now I'd flag: ${nudges[0].message}`);
    }

    if (!lines.length) {
      lines.push(
        "I'm watching your documents, email and calendar. Ask me things like \"what's my passport number\", \"what's due this week\", or \"what's my plan today\".",
      );
    }

    lines.push('\n(Demo mode — add a Gemini key for full natural-language reasoning.)');
    return lines.join('\n\n');
  }
}
