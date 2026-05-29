import { Controller, Delete, Get, Headers } from '@nestjs/common';
import { PrivacyService } from './privacy.service';
import { PersistenceService } from '../persistence/persistence.service';
import { resolveUserId } from '../common/user.util';

@Controller('me')
export class PrivacyController {
  constructor(
    private readonly privacy: PrivacyService,
    private readonly persistence: PersistenceService,
  ) {}

  @Get('data')
  summary(@Headers('x-user-id') userHeader?: string) {
    return this.privacy.summary(resolveUserId(this.persistence, userHeader));
  }

  @Get('export')
  export(@Headers('x-user-id') userHeader?: string) {
    return this.privacy.exportAll(resolveUserId(this.persistence, userHeader));
  }

  @Delete()
  deleteAll(@Headers('x-user-id') userHeader?: string) {
    return this.privacy.deleteEverything(resolveUserId(this.persistence, userHeader));
  }
}
