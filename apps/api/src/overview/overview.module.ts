import { Module } from '@nestjs/common';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';
import { ContextModule } from '../context/context.module';
import { EmailModule } from '../email/email.module';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [ContextModule, EmailModule, MemoryModule],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
