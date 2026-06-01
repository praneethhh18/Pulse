import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PerceptionService, PhoneSignalInput } from './perception.service';
import { PersistenceService } from '../persistence/persistence.service';
import { resolveUserId } from '../common/user.util';
import type { PhoneSignalKind } from '../domain/types';

const KINDS: PhoneSignalKind[] = ['notification', 'sms', 'call', 'app_usage', 'location', 'other'];

class SignalDto implements PhoneSignalInput {
  @IsIn(KINDS) kind!: PhoneSignalKind;
  @IsOptional() @IsString() app?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsObject() meta?: Record<string, unknown>;
  @IsOptional() @IsString() occurredAt?: string;
}

class IngestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SignalDto)
  signals!: SignalDto[];
}

// The phone-awareness endpoint. The device batches raw signals (notifications,
// SMS, calls) and posts them here; Pulse perceives them — learning + reminders.
@Controller('me/signals')
export class PerceptionController {
  constructor(
    private readonly perception: PerceptionService,
    private readonly persistence: PersistenceService,
  ) {}

  // Ingest a batch and reason over it in one shot (returns any new reminders).
  @Post()
  ingest(@Body() dto: IngestDto, @Headers('x-user-id') userHeader?: string) {
    return this.perception.ingestAndPerceive(
      resolveUserId(this.persistence, userHeader),
      dto.signals,
    );
  }

  // Recent raw signals (debug / a "what Pulse has seen" view).
  @Get()
  recent(@Headers('x-user-id') userHeader?: string) {
    return this.perception.recent(resolveUserId(this.persistence, userHeader));
  }

  // Force a perception pass over anything still unprocessed.
  @Post('perceive')
  perceive(@Headers('x-user-id') userHeader?: string) {
    return this.perception.perceive(resolveUserId(this.persistence, userHeader));
  }
}
