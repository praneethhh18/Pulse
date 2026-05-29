import { Controller, Get, Headers } from '@nestjs/common';
import { OverviewService } from './overview.service';
import { PersistenceService } from '../persistence/persistence.service';
import { resolveUserId } from '../common/user.util';

@Controller('overview')
export class OverviewController {
  constructor(
    private readonly overview: OverviewService,
    private readonly persistence: PersistenceService,
  ) {}

  @Get()
  get(@Headers('x-user-id') userHeader?: string) {
    return this.overview.get(resolveUserId(this.persistence, userHeader));
  }
}
