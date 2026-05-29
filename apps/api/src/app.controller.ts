import { Controller, Get } from '@nestjs/common';
import { PersistenceService } from './persistence/persistence.service';
import { LlmService } from './llm/llm.service';

@Controller()
export class AppController {
  constructor(
    private readonly persistence: PersistenceService,
    private readonly llm: LlmService,
  ) {}

  @Get()
  root() {
    return {
      name: 'Pulse — The Life Agent API',
      status: 'ok',
      tagline: 'Never miss what matters',
    };
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      storage: this.persistence.mode,
      ai: this.llm.live ? 'gemini' : 'demo',
      time: new Date().toISOString(),
    };
  }
}
