import { Injectable } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';
import { LlmService } from '../llm/llm.service';
import { ContextService } from '../context/context.service';
import { EmailService } from '../email/email.service';
import type {
  CalendarEventDoc,
  DocumentDoc,
  UserDoc,
} from '../domain/types';

@Injectable()
export class OverviewService {
  constructor(
    private readonly persistence: PersistenceService,
    private readonly llm: LlmService,
    private readonly context: ContextService,
    private readonly email: EmailService,
  ) {}

  async get(userId: string) {
    const [user, nudges, matters, docs, events] = await Promise.all([
      this.persistence.getRepo<UserDoc>('users').findOne({ userId }),
      this.context.nudges(userId),
      this.email.whatMatters(userId),
      this.persistence.getRepo<DocumentDoc>('documents').findByUser(userId),
      this.persistence
        .getRepo<CalendarEventDoc>('calendar_events')
        .findByUser(userId),
    ]);

    const upcoming = events
      .filter((e) => new Date(e.startsAt).getTime() > Date.now() - 3600_000)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 4);

    return {
      greetingName: user?.name ?? 'there',
      mode: {
        storage: this.persistence.mode,
        ai: this.llm.live ? 'gemini' : 'demo',
      },
      stats: {
        documents: docs.length,
        watching: matters.length + nudges.length,
        nudges: nudges.length,
      },
      nudges,
      matters: matters.map((m) => ({
        _id: m._id,
        subject: m.subject,
        from: m.from,
        summary: m.summary,
        urgency: m.urgency,
        deadline: m.deadline,
        dismissed: m.dismissed,
      })),
      upcoming,
    };
  }
}
