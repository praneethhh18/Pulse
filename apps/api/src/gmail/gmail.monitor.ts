import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GmailService } from './gmail.service';
import { PersistenceService } from '../persistence/persistence.service';

// Server-side monitoring: this is what makes Pulse proactive. It polls the
// connected inbox on an interval so new mail is read + triaged without the
// user ever opening the app. (Phase 1 upgrades this to Gmail push + Cloud
// Scheduler; the interval poller is the Phase 0 equivalent.)
@Injectable()
export class GmailMonitor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('GmailMonitor');
  private timer?: ReturnType<typeof setInterval>;
  private readonly intervalMs: number;

  constructor(
    private readonly gmail: GmailService,
    private readonly persistence: PersistenceService,
    private readonly config: ConfigService,
  ) {
    this.intervalMs =
      Number(this.config.get('GMAIL_POLL_SECONDS') ?? 120) * 1000;
  }

  onModuleInit() {
    if (!this.gmail.isConfigured()) {
      this.logger.warn('Gmail not configured — auto-monitor disabled.');
      return;
    }
    this.logger.log(`Gmail auto-monitor on (every ${this.intervalMs / 1000}s)`);
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    // first run shortly after boot
    setTimeout(() => this.tick(), 8000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    try {
      const r = await this.gmail.sync(this.persistence.demoUserId);
      if (r.added > 0) this.logger.log(`Auto-sync: ${r.added} new email(s)`);
    } catch (e) {
      this.logger.error(`Auto-sync failed: ${e}`);
    }
  }
}
