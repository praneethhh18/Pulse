import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CalendarMonitor } from './calendar.monitor';
import { GmailModule } from '../gmail/gmail.module';

@Module({
  imports: [GmailModule],
  controllers: [CalendarController],
  providers: [CalendarService, CalendarMonitor],
  exports: [CalendarService],
})
export class CalendarModule {}
