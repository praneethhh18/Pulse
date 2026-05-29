import { Module } from '@nestjs/common';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';
import { ContextModule } from '../context/context.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [ContextModule, EmailModule],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
