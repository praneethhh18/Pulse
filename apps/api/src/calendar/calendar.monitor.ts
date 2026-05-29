import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarService } from './calendar.service';
import { PersistenceService } from '../persistence/persistence.service';

// Server-side calendar monitoring — keeps Pulse's view of your schedule fresh
// so the Context Engine can fire scheduling nudges (e.g. early flight after a
// late meeting) from your real calendar.
@Injectable()
export class CalendarMonitor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('CalendarMonitor');
  private timer?: ReturnType<typeof setInterval>;
  private readonly intervalMs: number;

  constructor(
    private readonly calendar: CalendarService,
    private readonly persistence: PersistenceService,
    private readonly config: ConfigService,
  ) {
    this.intervalMs =
      Number(this.config.get('CALENDAR_POLL_SECONDS') ?? 300) * 1000;
  }

  onModuleInit() {
    if (!this.calendar.isConfigured()) {
      this.logger.warn('Calendar not configured — auto-monitor disabled.');
      return;
    }
    this.logger.log(`Calendar auto-monitor on (every ${this.intervalMs / 1000}s)`);
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    setTimeout(() => this.tick(), 12000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    try {
      const r = await this.calendar.sync(this.persistence.demoUserId);
      if (r.added > 0) this.logger.log(`Auto-sync: ${r.added} new event(s)`);
    } catch (e) {
      this.logger.error(`Auto-sync failed: ${e}`);
    }
  }
}
