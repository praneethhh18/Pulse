import { Controller, Get, Headers } from '@nestjs/common';
import { ContextService } from './context.service';
import { PersistenceService } from '../persistence/persistence.service';
import { resolveUserId } from '../common/user.util';

@Controller('context')
export class ContextController {
  constructor(
    private readonly context: ContextService,
    private readonly persistence: PersistenceService,
  ) {}

  @Get('nudges')
  nudges(@Headers('x-user-id') userHeader?: string) {
    return this.context.nudges(resolveUserId(this.persistence, userHeader));
  }
}
