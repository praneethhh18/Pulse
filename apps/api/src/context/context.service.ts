import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PersistenceService } from '../persistence/persistence.service';
import { MemoryService } from '../memory/memory.service';
import { fmtDate, fmtTime } from '../common/time.util';
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
  constructor(
    private readonly persistence: PersistenceService,
    private readonly memory: MemoryService,
  ) {}

  async nudges(userId: string, tz = 'Asia/Kolkata'): Promise<NudgeDoc[]> {
    const [emails, documents, events, profile] = await Promise.all([
      this.persistence.getRepo<EmailDoc>('email_intelligence').findByUser(userId),
      this.persistence.getRepo<DocumentDoc>('documents').findByUser(userId),
      this.persistence
        .getRepo<CalendarEventDoc>('calendar_events')
        .findByUser(userId),
      this.memory.getProfileText(userId),
    ]);

    const nudges: NudgeDoc[] = [
      ...this.scheduleConflicts(userId, events, tz),
      ...this.emailDeadlines(userId, emails, tz),
      ...this.needsAction(userId, emails),
      ...this.documentExpiries(userId, documents, tz),
      ...this.busyDays(userId, events, tz),
      ...this.profilePrep(userId, profile, events, tz),
    ];

    // Hide anything the user has dismissed.
    const acked = await this.ackedKeys(userId);
    const visible = nudges.filter((n) => !acked.has(n.key));

    const sev = { critical: 0, warning: 1, info: 2 } as const;
    return visible.sort((a, b) => sev[a.severity] - sev[b.severity]);
  }

  // Dismissing a nudge stores its key so it won't resurface.
  async ack(userId: string, key: string): Promise<{ ok: boolean }> {
    const repo = this.persistence.getRepo<any>('context_engine');
    const existing = await repo.findOne({ userId, kind: '_ack', key });
    if (!existing) await repo.insert({ userId, kind: '_ack', key });
    return { ok: true };
  }

  private async ackedKeys(userId: string): Promise<Set<string>> {
    const repo = this.persistence.getRepo<any>('context_engine');
    const docs = await repo.findByUser(userId, { kind: '_ack' });
    return new Set(docs.map((d: any) => d.key));
  }

  // 1) Early flight vs late meeting → "leave by …" (the signature nudge).
  private scheduleConflicts(
    userId: string,
    events: CalendarEventDoc[],
    tz: string,
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
          message: `You have a ${fmtTime(flight.startsAt, tz)} flight but "${clash.title}" runs until ${fmtTime(
            clash.endsAt!,
            tz,
          )} tonight. You'll need to leave by ${fmtTime(
            leaveBy.toISOString(),
            tz,
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
  private emailDeadlines(userId: string, emails: EmailDoc[], tz: string): NudgeDoc[] {
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
            tz,
          )}.`,
          sources: [
            { collection: 'email_intelligence', id: e._id, label: e.subject },
          ],
          suggestedAction: { label: 'Open & handle', type: 'open-email' },
        });
      });
  }

  // 3) Documents about to expire (vision §3.4 expiry intelligence).
  private documentExpiries(userId: string, docs: DocumentDoc[], tz: string): NudgeDoc[] {
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
            tz,
          )}. Want Pulse to start the renewal and compare cheaper options?`,
          reason: `Document "${d.title}" has an expiry date within 60 days.`,
          sources: [{ collection: 'documents', id: d._id, label: d.title }],
          suggestedAction: { label: 'Start renewal', type: 'renew' },
        });
      });
  }

  // Action-required emails that have no explicit deadline (the deadline ones
  // are already covered above) — still need a reply.
  private needsAction(userId: string, emails: EmailDoc[]): NudgeDoc[] {
    return emails
      .filter((e) => !e.handled && e.actionRequired && !e.deadline)
      .map((e) =>
        this.make(userId, {
          kind: 'needs-action',
          severity: 'warning',
          title: 'Waiting on you',
          message: e.summary,
          reason: `Email from ${e.from} needs an action and hasn't been handled yet.`,
          sources: [
            { collection: 'email_intelligence', id: e._id, label: e.subject },
          ],
          suggestedAction: { label: 'Open & handle', type: 'open-email' },
        }),
      );
  }

  // Any day with 3+ events — offer a prepared rundown.
  private busyDays(userId: string, events: CalendarEventDoc[], tz: string): NudgeDoc[] {
    const upcoming = events.filter(
      (e) => new Date(e.startsAt).getTime() > Date.now(),
    );
    const byDay = new Map<string, CalendarEventDoc[]>();
    for (const e of upcoming) {
      const day = new Date(e.startsAt).toISOString().slice(0, 10);
      const list = byDay.get(day) ?? [];
      list.push(e);
      byDay.set(day, list);
    }
    const out: NudgeDoc[] = [];
    for (const [day, evs] of byDay) {
      if (evs.length < 3) continue;
      out.push(
        this.make(userId, {
          kind: 'busy-day',
          severity: 'info',
          title: `Busy day — ${evs.length} events`,
          message: `You have ${evs.length} events on ${new Date(day).toLocaleDateString(
            'en-IN',
            { weekday: 'long', day: 'numeric', month: 'short', timeZone: tz },
          )}. Want a prepared rundown the night before?`,
          reason: `${evs.length} calendar events fall on the same day.`,
          sources: evs.slice(0, 5).map((e) => ({
            collection: 'calendar_events' as const,
            id: e._id,
            label: e.title,
          })),
        }),
      );
    }
    return out;
  }

  // The Context Engine using MEMORY: connect what Pulse has learned about the
  // user to an upcoming event, and offer a personalised prep. This is the
  // grow-with-you profile paying off in the *proactive* surface, not just chat.
  private profilePrep(
    userId: string,
    profile: string,
    events: CalendarEventDoc[],
    tz: string,
  ): NudgeDoc[] {
    if (!profile) return [];
    const facts = profile.split('\n').map((l) => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
    const now = Date.now();
    const soon = (e: CalendarEventDoc) => {
      const t = new Date(e.startsAt).getTime();
      return t > now && t - now < 3 * DAY;
    };

    const pick = (re: RegExp) => facts.filter((f) => re.test(f.toLowerCase()));
    const out: NudgeDoc[] = [];

    // Doctor visit + remembered health facts.
    const doctor = events.find((e) => e.type === 'doctor' && soon(e));
    const health = pick(/allerg|vegetarian|vegan|dietary|diabet|blood|medication|pressure|health/);
    if (doctor && health.length) {
      out.push(
        this.make(userId, {
          kind: 'profile-prep',
          severity: 'info',
          title: 'Prep for your doctor visit',
          message: `Before "${doctor.title}" on ${fmtDate(doctor.startsAt, tz)}, want me to bring up what I know about your health? I remember: ${health.join('; ')}.`,
          reason: 'An upcoming doctor appointment matches health facts in your profile.',
          sources: [
            { collection: 'calendar_events', id: doctor._id, label: doctor.title },
            { collection: 'user_profile', id: 'profile', label: 'What Pulse knows about you' },
          ],
          suggestedAction: { label: 'Build my health brief', type: 'briefing' },
        }),
      );
    }

    // Interview + remembered job/skill facts.
    const interview = events.find((e) => e.type === 'interview' && soon(e));
    const work = pick(/work|job|engineer|developer|role|skill|company/);
    if (interview && work.length) {
      out.push(
        this.make(userId, {
          kind: 'profile-prep',
          severity: 'info',
          title: 'Prep for your interview',
          message: `"${interview.title}" is on ${fmtDate(interview.startsAt, tz)}. I can tailor prep to what I know about you: ${work.join('; ')}.`,
          reason: 'An upcoming interview matches work/skill facts in your profile.',
          sources: [
            { collection: 'calendar_events', id: interview._id, label: interview.title },
            { collection: 'user_profile', id: 'profile', label: 'What Pulse knows about you' },
          ],
          suggestedAction: { label: 'Build my interview brief', type: 'briefing' },
        }),
      );
    }

    return out;
  }

  private make(
    userId: string,
    n: Omit<
      NudgeDoc,
      '_id' | 'userId' | 'key' | 'createdAt' | 'updatedAt' | 'firedAt' | 'acknowledged'
    >,
  ): NudgeDoc {
    const now = new Date().toISOString();
    const key = `${n.kind}:${n.sources.map((s) => s.id).sort().join(',')}`;
    return {
      _id: randomUUID(),
      userId,
      key,
      createdAt: now,
      updatedAt: now,
      firedAt: now,
      acknowledged: false,
      ...n,
    };
  }
}
