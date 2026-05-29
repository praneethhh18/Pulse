import { Injectable, Logger } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';
import { GmailService } from '../gmail/gmail.service';
import type { CalendarEventDoc } from '../domain/types';

const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class CalendarService {
  private readonly logger = new Logger('CalendarService');

  constructor(
    private readonly persistence: PersistenceService,
    private readonly gmail: GmailService,
  ) {}

  private repo() {
    return this.persistence.getRepo<CalendarEventDoc>('calendar_events');
  }

  isConfigured(): boolean {
    return this.gmail.isConfigured();
  }

  async statusFor(userId: string) {
    return {
      configured: this.isConfigured(),
      connected: await this.gmail.isConnected(userId),
    };
  }

  // Pull upcoming events from the user's primary Google Calendar.
  async sync(userId: string): Promise<{ fetched: number; added: number }> {
    const token = await this.gmail.getAccessToken(userId);
    if (!token) return { fetched: 0, added: 0 };

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 45 * DAY).toISOString();
    const url =
      'https://www.googleapis.com/calendar/v3/calendars/primary/events' +
      `?singleEvents=true&orderBy=startTime&maxResults=25` +
      `&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      this.logger.error(`Calendar list failed: ${res.status}`);
      return { fetched: 0, added: 0 };
    }
    const data = (await res.json()) as { items?: any[] };
    const items = data.items ?? [];

    let added = 0;
    for (const ev of items) {
      const startsAt = ev.start?.dateTime ?? ev.start?.date;
      if (!startsAt) continue;
      const existing = await this.repo().findOne({ userId, sourceId: ev.id });
      if (existing) continue;
      await this.repo().insert({
        userId,
        title: ev.summary ?? '(no title)',
        startsAt: new Date(startsAt).toISOString(),
        endsAt: ev.end?.dateTime ?? ev.end?.date,
        type: classify(ev.summary ?? ''),
        location: ev.location,
        source: 'google',
        sourceId: ev.id,
      });
      added++;
    }
    this.logger.log(`Calendar sync ${userId}: ${items.length} fetched, ${added} new`);
    return { fetched: items.length, added };
  }
}

function classify(summary: string): CalendarEventDoc['type'] {
  const s = summary.toLowerCase();
  if (/flight|airport|boarding|trip to/.test(s)) return 'flight';
  if (/doctor|appointment|clinic|hospital|dentist/.test(s)) return 'doctor';
  if (/interview/.test(s)) return 'interview';
  if (/exam|test|quiz/.test(s)) return 'exam';
  if (/meeting|sync|call|review|1:1|standup/.test(s)) return 'meeting';
  return 'personal';
}
