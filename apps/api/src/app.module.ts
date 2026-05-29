import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { PersistenceModule } from './persistence/persistence.module';
import { LlmModule } from './llm/llm.module';
import { DocumentsModule } from './documents/documents.module';
import { EmailModule } from './email/email.module';
import { ContextModule } from './context/context.module';
import { AgentModule } from './agent/agent.module';
import { OverviewModule } from './overview/overview.module';
import { GmailModule } from './gmail/gmail.module';
import { CalendarModule } from './calendar/calendar.module';
import { PrivacyModule } from './privacy/privacy.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    AuthModule,
    PersistenceModule,
    LlmModule,
    DocumentsModule,
    EmailModule,
    ContextModule,
    AgentModule,
    OverviewModule,
    GmailModule,
    CalendarModule,
    PrivacyModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
