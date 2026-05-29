import { Controller, Get, Headers } from '@nestjs/common';
import { OverviewService } from './overview.service';
import { PersistenceService } from '../persistence/persistence.service';
import { resolveUserId } from '../common/user.util';
import { resolveTimezone } from '../common/time.util';

@Controller('overview')
export class OverviewController {
  constructor(
    private readonly overview: OverviewService,
    private readonly persistence: PersistenceService,
  ) {}

  @Get()
  get(
    @Headers('x-user-id') userHeader?: string,
    @Headers('x-timezone') tzHeader?: string,
  ) {
    return this.overview.get(
      resolveUserId(this.persistence, userHeader),
      resolveTimezone(tzHeader),
    );
  }
}
