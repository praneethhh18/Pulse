import { Controller, Get, Headers, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { GmailService } from './gmail.service';
import { PersistenceService } from '../persistence/persistence.service';
import { resolveUserId } from '../common/user.util';

@Controller('gmail')
export class GmailController {
  constructor(
    private readonly gmail: GmailService,
    private readonly persistence: PersistenceService,
  ) {}

  @Get('status')
  status(@Headers('x-user-id') userHeader?: string) {
    return this.gmail.statusFor(resolveUserId(this.persistence, userHeader));
  }

  @Get('auth-url')
  authUrl(@Headers('x-user-id') userHeader?: string) {
    const userId = resolveUserId(this.persistence, userHeader);
    if (!this.gmail.isConfigured()) {
      return { configured: false, url: null };
    }
    return { configured: true, url: this.gmail.getAuthUrl(userId) };
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      const { email } = await this.gmail.handleCallback(code, state);
      res.type('html').send(successPage(email));
    } catch (e) {
      res.type('html').send(errorPage((e as Error).message));
    }
  }

  @Post('sync')
  sync(@Headers('x-user-id') userHeader?: string) {
    return this.gmail.sync(resolveUserId(this.persistence, userHeader));
  }
}

function successPage(email?: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{background:#141726;color:#F5F7FE;font-family:system-ui;display:flex;height:100vh;margin:0;align-items:center;justify-content:center;text-align:center}
.card{background:#1B1F31;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:32px;max-width:340px}
h1{font-size:20px} p{color:#B8BED4}</style></head>
<body><div class="card"><h1>⚡ Gmail connected</h1>
<p>${email ? email + ' is now connected.' : 'Your inbox is now connected.'}</p>
<p>Return to Pulse — your mail will start syncing automatically.</p></div></body></html>`;
}

function errorPage(msg: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{background:#141726;color:#F5F7FE;font-family:system-ui;display:flex;height:100vh;margin:0;align-items:center;justify-content:center;text-align:center}
.card{background:#1B1F31;border:1px solid rgba(255,84,112,.4);border-radius:20px;padding:32px;max-width:340px}</style></head>
<body><div class="card"><h1>Couldn't connect</h1><p>${msg}</p></div></body></html>`;
}
