import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { ContextService } from './context.service';
import { PersistenceService } from '../persistence/persistence.service';
import { resolveUserId } from '../common/user.util';

class AckDto {
  @IsString() @MinLength(1) key!: string;
}

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

  @Post('nudges/ack')
  ack(@Body() dto: AckDto, @Headers('x-user-id') userHeader?: string) {
    return this.context.ack(resolveUserId(this.persistence, userHeader), dto.key);
  }
}
