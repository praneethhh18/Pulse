import { Injectable, NotFoundException } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';
import { LlmService } from '../llm/llm.service';
import { MemoryService } from '../memory/memory.service';
import { languageDirective } from '../common/lang.util';
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
    private readonly memory: MemoryService,
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

  // Vision §3.2: "drafts your response with one tap — you review and send."
  // Personalised by the user's learned profile. Never sends.
  async draftReply(
    userId: string,
    id: string,
    lang = 'en',
  ): Promise<{ subject: string; draft: string }> {
    const email = await this.repo().findOne({ _id: id, userId });
    if (!email) throw new NotFoundException('Email not found');
    const profile = await this.memory.getProfileText(userId);

    if (this.llm.live) {
      const langClause = languageDirective(lang);
      const draft = await this.llm.generate(
        `Draft a concise, polite reply to the email below — first person, ready to send, no placeholders. Sign off with the user's name if it's in their profile.
${profile ? `USER PROFILE:\n${profile}\n` : ''}
FROM: ${email.from}
SUBJECT: ${email.subject}
BODY: ${email.body}

Reply with ONLY the email body text.`,
        `You are Pulse, drafting an email reply in the user's voice. Be brief and natural.${langClause ? ` ${langClause}` : ''}`,
      );
      return { subject: `Re: ${email.subject}`, draft: draft.trim() };
    }
    return { subject: `Re: ${email.subject}`, draft: heuristicDraft(email, profile) };
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

// Demo-mode reply draft (no Gemini): a polite, sendable template tuned by urgency
// and signed with the user's learned name.
function heuristicDraft(email: EmailDoc, profile: string): string {
  const name = profile.match(/name:\s*(.+)/i)?.[1]?.trim();
  const text = `${email.subject} ${email.body}`.toLowerCase();
  let body: string;
  if (email.urgency === 'critical' || /kyc|verify|deadline|overdue|suspend/.test(text)) {
    body = `Thank you for the notice regarding "${email.subject}". I acknowledge it and will complete the required action within the stated window.`;
  } else if (/interview|confirm|availability|meeting|rsvp/.test(text)) {
    body = `Thank you for the email. I confirm my availability and look forward to it. Please let me know if anything further is needed from my side.`;
  } else if (email.actionRequired) {
    body = `Thanks for reaching out about "${email.subject}". I'll take care of this and follow up shortly.`;
  } else {
    body = `Thank you for your email regarding "${email.subject}". Noted, and I'll get back to you if anything is needed.`;
  }
  return `${body}\n\nBest regards,\n${name ?? ''}`.trimEnd();
}
