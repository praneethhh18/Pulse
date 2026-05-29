import { Body, Controller, Headers, Post } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { AgentService } from './agent.service';
import { PersistenceService } from '../persistence/persistence.service';
import { resolveUserId } from '../common/user.util';

class ChatDto {
  @IsString() @MinLength(1) message!: string;
}

@Controller('agent')
export class AgentController {
  constructor(
    private readonly agent: AgentService,
    private readonly persistence: PersistenceService,
  ) {}

  @Post('chat')
  chat(@Body() dto: ChatDto, @Headers('x-user-id') userHeader?: string) {
    return this.agent.chat(
      resolveUserId(this.persistence, userHeader),
      dto.message,
    );
  }
}
