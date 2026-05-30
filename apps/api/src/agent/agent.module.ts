import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { DocumentsModule } from '../documents/documents.module';
import { EmailModule } from '../email/email.module';
import { ContextModule } from '../context/context.module';
import { MemoryModule } from '../memory/memory.module';
import { HealthCompanionModule } from '../health/health.module';
import { FinanceModule } from '../finance/finance.module';
import { RelationshipsModule } from '../relationships/relationships.module';
import { LearningModule } from '../learning/learning.module';

@Module({
  imports: [
    DocumentsModule,
    EmailModule,
    ContextModule,
    MemoryModule,
    HealthCompanionModule,
    FinanceModule,
    RelationshipsModule,
    LearningModule,
  ],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
