import { Controller, Get, Headers, Post } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { PersistenceService } from '../persistence/persistence.service';
import { resolveUserId } from '../common/user.util';

@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly calendar: CalendarService,
    private readonly persistence: PersistenceService,
  ) {}

  @Get('status')
  status(@Headers('x-user-id') userHeader?: string) {
    return this.calendar.statusFor(resolveUserId(this.persistence, userHeader));
  }

  @Post('sync')
  sync(@Headers('x-user-id') userHeader?: string) {
    return this.calendar.sync(resolveUserId(this.persistence, userHeader));
  }
}
