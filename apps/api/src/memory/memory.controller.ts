import { Controller, Delete, Get, Headers } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { PersistenceService } from '../persistence/persistence.service';
import { resolveUserId } from '../common/user.util';

@Controller('me/profile')
export class MemoryController {
  constructor(
    private readonly memory: MemoryService,
    private readonly persistence: PersistenceService,
  ) {}

  @Get()
  async get(@Headers('x-user-id') userHeader?: string) {
    const p = await this.memory.getProfile(resolveUserId(this.persistence, userHeader));
    return {
      content: p.content,
      facts: p.content ? p.content.split('\n').filter(Boolean) : [],
      turnCount: p.turnCount,
      lastReviewedAt: p.lastReviewedAt,
    };
  }

  @Delete()
  clear(@Headers('x-user-id') userHeader?: string) {
    return this.memory.clear(resolveUserId(this.persistence, userHeader));
  }
}
