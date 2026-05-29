import { Controller, Get, Headers, Param } from '@nestjs/common';
import { BriefingService } from './briefing.service';
import { PersistenceService } from '../persistence/persistence.service';
import { resolveUserId } from '../common/user.util';
import { resolveTimezone } from '../common/time.util';

@Controller('briefings')
export class BriefingController {
  constructor(
    private readonly briefing: BriefingService,
    private readonly persistence: PersistenceService,
  ) {}

  @Get('event/:eventId')
  forEvent(
    @Param('eventId') eventId: string,
    @Headers('x-user-id') userHeader?: string,
    @Headers('x-timezone') tzHeader?: string,
  ) {
    return this.briefing.forEvent(
      resolveUserId(this.persistence, userHeader),
      eventId,
      resolveTimezone(tzHeader),
    );
  }
}
