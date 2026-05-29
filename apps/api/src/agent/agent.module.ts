import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { DocumentsModule } from '../documents/documents.module';
import { EmailModule } from '../email/email.module';
import { ContextModule } from '../context/context.module';

@Module({
  imports: [DocumentsModule, EmailModule, ContextModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
