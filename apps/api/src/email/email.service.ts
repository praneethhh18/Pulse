import { Injectable } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';
import { LlmService } from '../llm/llm.service';
import type { EmailDoc, EmailUrgency } from '../domain/types';

const URGENCY_RANK: Record<EmailUrgency, number> = {
  critical: 0,
  action: 1,
  informational: 2,
  promotional: 3,
};

export interface IngestEmailInput {
  from: string;
  subject: string;
  body: string;
  receivedAt?: string;
}

@Injectable()
export class EmailService {
  constructor(
    private readonly persistence: PersistenceService,
    private readonly llm: LlmService,
  ) {}

  private repo() {
    return this.persistence.getRepo<EmailDoc>('email_intelligence');
  }

  async list(userId: string) {
    const emails = await this.repo().findByUser(userId);
    return emails.sort((a, b) => {
      const r = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
      if (r !== 0) return r;
      return (b.receivedAt ?? '').localeCompare(a.receivedAt ?? '');
    });
  }

  // The Guardian view: what actually needs you, including important things you
  // already swiped away (vision §3.2 — "resurfaces it before the deadline").
  async whatMatters(userId: string) {
    const emails = await this.list(userId);
    return emails.filter(
      (e) => !e.handled && (e.actionRequired || e.dismissed),
    );
  }

  async ingest(userId: string, input: IngestEmailInput): Promise<EmailDoc> {
    const c = await this.llm.classifyEmail(input);
    return this.repo().insert({
      userId,
      from: input.from,
      subject: input.subject,
      body: input.body,
      receivedAt: input.receivedAt ?? new Date().toISOString(),
      summary: c.summary,
      urgency: c.urgency,
      deadline: c.deadline,
      actionRequired: c.actionRequired,
      handled: false,
      dismissed: false,
    });
  }

  async markHandled(id: string): Promise<EmailDoc | null> {
    return this.repo().update(id, { handled: true });
  }

  // Used by auto-sync (Gmail). Dedupes by provider message id so polling the
  // same inbox repeatedly never creates duplicates.
  async ingestExternal(
    userId: string,
    input: IngestEmailInput & { source: EmailDoc['source']; sourceId: string },
  ): Promise<EmailDoc | null> {
    const existing = await this.repo().findOne({
      userId,
      sourceId: input.sourceId,
    });
    if (existing) return null;

    const c = await this.llm.classifyEmail(input);
    return this.repo().insert({
      userId,
      from: input.from,
      subject: input.subject,
      body: input.body,
      receivedAt: input.receivedAt ?? new Date().toISOString(),
      summary: c.summary,
      urgency: c.urgency,
      deadline: c.deadline,
      actionRequired: c.actionRequired,
      handled: false,
      dismissed: false,
      source: input.source,
      sourceId: input.sourceId,
    });
  }
}
