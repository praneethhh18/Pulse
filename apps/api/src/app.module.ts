import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PersistenceModule } from './persistence/persistence.module';
import { LlmModule } from './llm/llm.module';
import { DocumentsModule } from './documents/documents.module';
import { EmailModule } from './email/email.module';
import { ContextModule } from './context/context.module';
import { AgentModule } from './agent/agent.module';
import { OverviewModule } from './overview/overview.module';
import { GmailModule } from './gmail/gmail.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PersistenceModule,
    LlmModule,
    DocumentsModule,
    EmailModule,
    ContextModule,
    AgentModule,
    OverviewModule,
    GmailModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
