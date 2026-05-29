import { Injectable } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';
import { LlmService } from '../llm/llm.service';
import { DocumentsService } from '../documents/documents.service';
import { EmailService } from '../email/email.service';
import { ContextService } from '../context/context.service';
import type { CalendarEventDoc } from '../domain/types';

export interface AgentReply {
  answer: string;
  sources: { type: string; label: string }[];
  mode: 'live' | 'demo';
}

@Injectable()
export class AgentService {
  constructor(
    private readonly persistence: PersistenceService,
    private readonly llm: LlmService,
    private readonly documents: DocumentsService,
    private readonly email: EmailService,
    private readonly context: ContextService,
  ) {}

  // Answers grounded in the user's own life — documents, mail, calendar, nudges.
  async chat(userId: string, message: string): Promise<AgentReply> {
    const [docs, matters, nudges, events] = await Promise.all([
      this.documents.search(userId, message, 3),
      this.email.whatMatters(userId),
      this.context.nudges(userId),
      this.persistence
        .getRepo<CalendarEventDoc>('calendar_events')
        .findByUser(userId),
    ]);

    const upcoming = events
      .filter((e) => new Date(e.startsAt).getTime() > Date.now())
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 3);

    const sources = [
      ...docs.map((d) => ({ type: 'document', label: d.title })),
      ...nudges.slice(0, 2).map((n) => ({ type: 'nudge', label: n.title })),
    ];

    if (this.llm.live) {
      const ctx = this.buildContext(docs, matters, nudges, upcoming);
      const answer = await this.llm.generate(
        `User asks: "${message}"\n\nHere is everything Pulse knows that's relevant:\n${ctx}\n\nAnswer helpfully and concisely as Pulse, the user's life agent. Reference specifics.`,
        'You are Pulse, a proactive personal life agent. Be warm, concise, specific. Never invent facts not in the context.',
      );
      return { answer, sources, mode: 'live' };
    }

    return {
      answer: this.demoAnswer(message, docs, matters, nudges, upcoming),
      sources,
      mode: 'demo',
    };
  }

  private buildContext(
    docs: { title: string; content: string }[],
    matters: { subject: string; summary: string }[],
    nudges: { title: string; message: string }[],
    upcoming: CalendarEventDoc[],
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
    return parts.join('\n\n') || 'No relevant context found.';
  }

  // Deterministic, genuinely useful answer for DEMO MODE (no Gemini key).
  private demoAnswer(
    message: string,
    docs: { title: string; content: string; score?: number }[],
    matters: { subject: string; summary: string }[],
    nudges: { title: string; message: string }[],
    upcoming: CalendarEventDoc[],
  ): string {
    const q = message.toLowerCase();
    const lines: string[] = [];

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
