import { Module } from '@nestjs/common';
import { GmailController } from './gmail.controller';
import { GmailService } from './gmail.service';
import { GmailMonitor } from './gmail.monitor';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [GmailController],
  providers: [GmailService, GmailMonitor],
  exports: [GmailService],
})
export class GmailModule {}
