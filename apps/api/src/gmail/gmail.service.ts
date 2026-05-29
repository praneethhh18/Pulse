import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { PersistenceService } from '../persistence/persistence.service';
import { EmailService } from '../email/email.service';
import type { IntegrationDoc } from '../domain/types';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

@Injectable()
export class GmailService {
  private readonly logger = new Logger('GmailService');
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly redirectUri: string;

  constructor(
    private readonly config: ConfigService,
    private readonly persistence: PersistenceService,
    private readonly email: EmailService,
  ) {
    this.clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    this.clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    this.redirectUri =
      this.config.get<string>('GOOGLE_OAUTH_REDIRECT') ||
      'http://localhost:4000/gmail/callback';
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  private newClient(): OAuth2Client {
    return new OAuth2Client(this.clientId, this.clientSecret, this.redirectUri);
  }

  private repo() {
    return this.persistence.getRepo<IntegrationDoc>('integrations');
  }

  getAuthUrl(userId: string): string {
    return this.newClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
      state: userId,
    });
  }

  async handleCallback(code: string, state: string): Promise<{ email?: string }> {
    const userId = state || this.persistence.demoUserId;
    const client = this.newClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    let email: string | undefined;
    try {
      const res = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        { headers: { Authorization: `Bearer ${tokens.access_token}` } },
      );
      if (res.ok) email = (await res.json()).email;
    } catch {
      /* non-fatal */
    }

    const existing = await this.repo().findOne({ userId, provider: 'gmail' });
    if (existing) {
      await this.repo().update(existing._id, {
        tokens: tokens as Record<string, unknown>,
        email,
      });
    } else {
      await this.repo().insert({
        userId,
        provider: 'gmail',
        tokens: tokens as Record<string, unknown>,
        email,
      });
    }
    this.logger.log(`Gmail connected for ${userId} (${email ?? 'unknown'})`);
    return { email };
  }

  async isConnected(userId: string): Promise<boolean> {
    return !!(await this.repo().findOne({ userId, provider: 'gmail' }));
  }

  // Returns a valid (auto-refreshed) access token for the user's Google
  // account, persisting any refreshed credentials. Shared by Gmail + Calendar.
  async getAccessToken(userId: string): Promise<string | null> {
    if (!this.isConfigured()) return null;
    const integ = await this.repo().findOne({ userId, provider: 'gmail' });
    if (!integ) return null;
    const client = this.newClient();
    client.setCredentials(integ.tokens);
    const at = await client.getAccessToken();
    const token = typeof at === 'string' ? at : at?.token;
    if (token) {
      await this.repo().update(integ._id, {
        tokens: client.credentials as Record<string, unknown>,
      });
    }
    return token ?? null;
  }

  async statusFor(userId: string) {
    const integ = await this.repo().findOne({ userId, provider: 'gmail' });
    return {
      configured: this.isConfigured(),
      connected: !!integ,
      email: integ?.email,
      lastSyncAt: integ?.lastSyncAt,
    };
  }

  // Fetch recent inbox mail, classify + store (dedup by message id).
  async sync(userId: string): Promise<{ fetched: number; added: number }> {
    if (!this.isConfigured()) return { fetched: 0, added: 0 };
    const integ = await this.repo().findOne({ userId, provider: 'gmail' });
    if (!integ) return { fetched: 0, added: 0 };

    const client = this.newClient();
    client.setCredentials(integ.tokens);
    const at = await client.getAccessToken();
    const token = typeof at === 'string' ? at : at?.token;
    if (!token) return { fetched: 0, added: 0 };
    // persist any refreshed tokens
    await this.repo().update(integ._id, {
      tokens: client.credentials as Record<string, unknown>,
    });

    const auth = { Authorization: `Bearer ${token}` };
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&q=' +
        encodeURIComponent('in:inbox newer_than:7d'),
      { headers: auth },
    );
    if (!listRes.ok) {
      this.logger.error(`Gmail list failed: ${listRes.status}`);
      return { fetched: 0, added: 0 };
    }
    const list = (await listRes.json()) as { messages?: { id: string }[] };
    const ids = (list.messages ?? []).map((m) => m.id);

    let added = 0;
    for (const id of ids) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        { headers: auth },
      );
      if (!msgRes.ok) continue;
      const msg = await msgRes.json();
      const parsed = parseMessage(msg);
      const created = await this.email.ingestExternal(userId, {
        from: parsed.from,
        subject: parsed.subject,
        body: parsed.body,
        receivedAt: parsed.date,
        source: 'gmail',
        sourceId: id,
      });
      if (created) added++;
    }

    await this.repo().update(integ._id, { lastSyncAt: new Date().toISOString() });
    this.logger.log(`Gmail sync ${userId}: ${ids.length} fetched, ${added} new`);
    return { fetched: ids.length, added };
  }
}

// ─── Gmail message parsing ───────────────────────────────────────────────
function header(payload: any, name: string): string {
  const h = (payload?.headers ?? []).find(
    (x: any) => x.name?.toLowerCase() === name.toLowerCase(),
  );
  return h?.value ?? '';
}

function b64urlDecode(data: string): string {
  try {
    return Buffer.from(
      data.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf8');
  } catch {
    return '';
  }
}

function findPart(parts: any[], mime: string): any | undefined {
  for (const p of parts) {
    if (p.mimeType === mime && p.body?.data) return p;
    if (p.parts) {
      const nested = findPart(p.parts, mime);
      if (nested) return nested;
    }
  }
  return undefined;
}

function decodeBody(payload: any): string {
  if (!payload) return '';
  if (payload.body?.data) return b64urlDecode(payload.body.data);
  if (payload.parts) {
    const plain = findPart(payload.parts, 'text/plain');
    if (plain) return b64urlDecode(plain.body.data);
    const html = findPart(payload.parts, 'text/html');
    if (html) return stripHtml(b64urlDecode(html.body.data));
  }
  return '';
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseMessage(msg: any): {
  from: string;
  subject: string;
  body: string;
  date: string;
} {
  const p = msg.payload;
  const dateHeader = header(p, 'Date');
  const date = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();
  return {
    from: header(p, 'From') || 'unknown',
    subject: header(p, 'Subject') || '(no subject)',
    body: (decodeBody(p) || msg.snippet || '').slice(0, 4000),
    date,
  };
}
