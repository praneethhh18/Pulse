import { Controller, Get, Headers, Param } from '@nestjs/common';
import { BriefingService } from './briefing.service';
import { PersistenceService } from '../persistence/persistence.service';
import { resolveUserId } from '../common/user.util';

@Controller('briefings')
export class BriefingController {
  constructor(
    private readonly briefing: BriefingService,
    private readonly persistence: PersistenceService,
  ) {}

  @Get('event/:eventId')
  forEvent(@Param('eventId') eventId: string, @Headers('x-user-id') userHeader?: string) {
    return this.briefing.forEvent(resolveUserId(this.persistence, userHeader), eventId);
  }
}
