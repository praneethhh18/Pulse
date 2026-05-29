import { Injectable, NotFoundException } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';
import { LlmService } from '../llm/llm.service';
import { DocumentsService } from '../documents/documents.service';
import { MemoryService } from '../memory/memory.service';
import { fmtDateTime } from '../common/time.util';
import { languageDirective } from '../common/lang.util';
import type { CalendarEventDoc } from '../domain/types';

// Vision §3.3 — Offline Life Briefing. Before an important moment, Pulse pulls
// together everything it knows (documents, profile, the event) into a prepared,
// skimmable briefing. Personalised by the grow-with-you profile.
@Injectable()
export class BriefingService {
  constructor(
    private readonly persistence: PersistenceService,
    private readonly llm: LlmService,
    private readonly documents: DocumentsService,
    private readonly memory: MemoryService,
  ) {}

  async forEvent(userId: string, eventId: string, tz = 'Asia/Kolkata', lang = 'en') {
    const event = await this.persistence
      .getRepo<CalendarEventDoc>('calendar_events')
      .findOne({ _id: eventId, userId });
    if (!event) throw new NotFoundException('Event not found');

    const [docs, profile] = await Promise.all([
      this.documents.search(userId, `${event.title} ${event.type}`, 3),
      this.memory.getProfileText(userId),
    ]);
    const relevant = docs.filter((d) => (d.score ?? 0) > 0.05);

    const briefing = this.llm.live
      ? await this.generateLive(event, relevant, profile, tz, lang)
      : this.generateDemo(event, relevant, profile, tz);

    return {
      event: {
        title: event.title,
        startsAt: event.startsAt,
        location: event.location,
        type: event.type,
      },
      briefing,
      sources: relevant.map((d) => ({ type: 'document', label: d.title })),
    };
  }

  private async generateLive(
    event: CalendarEventDoc,
    docs: { title: string; content: string }[],
    profile: string,
    tz: string,
    lang: string,
  ): Promise<string> {
    const docBlock = docs.length
      ? docs.map((d) => `- ${d.title}: ${d.content}`).join('\n')
      : '(none)';
    const langClause = languageDirective(lang);
    return this.llm.generate(
      `Create a concise, skimmable pre-event briefing (markdown bullets).
EVENT: ${event.title} (${event.type}) at ${fmtDateTime(event.startsAt, tz)}${event.location ? `, ${event.location}` : ''}
${profile ? `WHAT YOU KNOW ABOUT THE USER:\n${profile}\n` : ''}
RELEVANT DOCUMENTS:
${docBlock}

Include: one line on what this is; what to bring/prepare; 3-4 smart questions or points to raise; anything from their documents or profile worth flagging. Keep it tight.`,
      `You are Pulse preparing the user for an event. Be practical, specific, and brief.${langClause ? ` ${langClause}` : ''}`,
    );
  }

  private generateDemo(
    event: CalendarEventDoc,
    docs: { title: string; content: string }[],
    profile: string,
    tz: string,
  ): string {
    const parts: string[] = [];
    parts.push(`**${event.title}**`);
    parts.push(`${fmtDateTime(event.startsAt, tz)}${event.location ? ` · ${event.location}` : ''}`);
    parts.push('');
    parts.push('**Prepare:**');
    for (const item of prepFor(event.type)) parts.push(`- ${item}`);
    if (docs.length) {
      parts.push('');
      parts.push('**From your vault:**');
      for (const d of docs) parts.push(`- ${d.title}`);
    }
    if (profile) {
      parts.push('');
      parts.push('**Pulse remembers about you:**');
      for (const f of profile.split('\n').filter(Boolean).slice(0, 5))
        parts.push(`- ${f.replace(/^[-•]\s*/, '')}`);
    }
    parts.push('');
    parts.push('_(Connect Gemini for a fully reasoned briefing.)_');
    return parts.join('\n');
  }
}

function prepFor(type: string): string[] {
  switch (type) {
    case 'doctor':
      return [
        'Bring recent reports and your current medications',
        'Note your symptoms and when they started',
        'Questions: any tests due? changes to medication?',
      ];
    case 'interview':
      return [
        'Research the company’s recent news',
        'Review the role vs your resume; prep 2-3 examples',
        'Questions: team, success metrics, next steps',
      ];
    case 'meeting':
      return [
        'Review the last discussion and open action items',
        'Set a clear agenda and desired outcome',
        'Bring any relevant numbers or documents',
      ];
    case 'flight':
      return [
        'Carry ID/passport and boarding pass',
        'Check in online; reach the airport ~2h early',
        'Confirm gate and baggage rules',
      ];
    case 'exam':
      return ['Revise key notes and formula sheet', 'Carry hall ticket and ID', 'Arrive early, stay calm'];
    default:
      return ['Confirm the time and location', 'Bring any relevant documents', 'Note your key points'];
  }
}
