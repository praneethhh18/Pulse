import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PersistenceService } from '../persistence/persistence.service';
import type {
  CalendarEventDoc,
  DocumentDoc,
  EmailDoc,
  NudgeDoc,
} from '../domain/types';

// ─── The Context Engine ──────────────────────────────────────────────────
// This is the thing no single-purpose app does: it reads across email,
// documents and calendar at once and surfaces what a human would miss.
// Every nudge carries its reason + source records (explainability).

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

@Injectable()
export class ContextService {
  constructor(private readonly persistence: PersistenceService) {}

  async nudges(userId: string): Promise<NudgeDoc[]> {
    const [emails, documents, events] = await Promise.all([
      this.persistence.getRepo<EmailDoc>('email_intelligence').findByUser(userId),
      this.persistence.getRepo<DocumentDoc>('documents').findByUser(userId),
      this.persistence
        .getRepo<CalendarEventDoc>('calendar_events')
        .findByUser(userId),
    ]);

    const nudges: NudgeDoc[] = [
      ...this.scheduleConflicts(userId, events),
      ...this.emailDeadlines(userId, emails),
      ...this.documentExpiries(userId, documents),
    ];

    const sev = { critical: 0, warning: 1, info: 2 } as const;
    return nudges.sort((a, b) => sev[a.severity] - sev[b.severity]);
  }

  // 1) Early flight vs late meeting → "leave by …" (the signature nudge).
  private scheduleConflicts(
    userId: string,
    events: CalendarEventDoc[],
  ): NudgeDoc[] {
    const out: NudgeDoc[] = [];
    const flights = events.filter((e) => e.type === 'flight');
    for (const flight of flights) {
      const flightStart = new Date(flight.startsAt).getTime();
      // a meeting ending within the 14h before the flight
      const clash = events.find((e) => {
        if (e._id === flight._id || !e.endsAt) return false;
        const end = new Date(e.endsAt).getTime();
        const gap = flightStart - end;
        return gap > 0 && gap < 14 * HOUR && new Date(e.endsAt).getHours() >= 20;
      });
      if (!clash) continue;
      const leaveBy = new Date(flightStart - 1.5 * HOUR);
      out.push(
        this.make(userId, {
          kind: 'schedule-conflict',
          severity: 'critical',
          title: 'Tight morning — leave early',
          message: `You have a ${fmtTime(flight.startsAt)} flight but "${clash.title}" runs until ${fmtTime(
            clash.endsAt!,
          )} tonight. You'll need to leave by ${fmtTime(
            leaveBy.toISOString(),
          )}. Want me to set an alarm and book a cab?`,
          reason:
            'A flight departs within 14 hours of a meeting that ends at or after 8 PM, leaving little time to rest and reach the airport.',
          sources: [
            { collection: 'calendar_events', id: flight._id, label: flight.title },
            { collection: 'calendar_events', id: clash._id, label: clash.title },
          ],
          suggestedAction: { label: 'Set alarm & book cab', type: 'alarm+cab' },
        }),
      );
    }
    return out;
  }

  // 2) Important emails with a deadline — including ones already swiped away.
  private emailDeadlines(userId: string, emails: EmailDoc[]): NudgeDoc[] {
    const now = Date.now();
    return emails
      .filter((e) => !e.handled && e.deadline)
      .filter((e) => {
        const dl = new Date(e.deadline!).getTime();
        return dl - now < 7 * DAY; // due within a week
      })
      .map((e) => {
        const days = Math.max(
          0,
          Math.ceil((new Date(e.deadline!).getTime() - now) / DAY),
        );
        const resurfaced = e.dismissed
          ? ' You swiped this away earlier — but it still matters.'
          : '';
        return this.make(userId, {
          kind: 'deadline',
          severity: e.urgency === 'critical' ? 'critical' : 'warning',
          title: days <= 1 ? 'Due very soon' : `Due in ${days} days`,
          message: `${e.summary}${resurfaced}`,
          reason: `Email from ${e.from} was classified "${e.urgency}" with a deadline ${fmtDate(
            e.deadline!,
          )}.`,
          sources: [
            { collection: 'email_intelligence', id: e._id, label: e.subject },
          ],
          suggestedAction: { label: 'Open & handle', type: 'open-email' },
        });
      });
  }

  // 3) Documents about to expire (vision §3.4 expiry intelligence).
  private documentExpiries(userId: string, docs: DocumentDoc[]): NudgeDoc[] {
    const now = Date.now();
    return docs
      .filter((d) => d.expiresAt)
      .filter((d) => {
        const ex = new Date(d.expiresAt!).getTime();
        return ex - now < 60 * DAY && ex - now > -DAY;
      })
      .map((d) => {
        const days = Math.max(
          0,
          Math.ceil((new Date(d.expiresAt!).getTime() - now) / DAY),
        );
        return this.make(userId, {
          kind: 'expiry',
          severity: days <= 30 ? 'warning' : 'info',
          title: `${d.title} expires in ${days} days`,
          message: `Your ${d.title.toLowerCase()} expires on ${fmtDate(
            d.expiresAt!,
          )}. Want Pulse to start the renewal and compare cheaper options?`,
          reason: `Document "${d.title}" has an expiry date within 60 days.`,
          sources: [{ collection: 'documents', id: d._id, label: d.title }],
          suggestedAction: { label: 'Start renewal', type: 'renew' },
        });
      });
  }

  private make(
    userId: string,
    n: Omit<NudgeDoc, '_id' | 'userId' | 'createdAt' | 'updatedAt' | 'firedAt' | 'acknowledged'>,
  ): NudgeDoc {
    const now = new Date().toISOString();
    return {
      _id: randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
      firedAt: now,
      acknowledged: false,
      ...n,
    };
  }
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
