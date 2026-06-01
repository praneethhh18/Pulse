import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
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

  // Ingest a batch. The live phone stream posts with ?defer=1 (just store —
  // cheap, no LLM per notification); the app later triggers a perceive pass.
  // Without defer, it ingests AND reasons in one shot (used for testing/manual).
  @Post()
  ingest(
    @Body() dto: IngestDto,
    @Query('defer') defer?: string,
    @Headers('x-user-id') userHeader?: string,
  ) {
    const userId = resolveUserId(this.persistence, userHeader);
    if (defer === '1' || defer === 'true') {
      return this.perception
        .ingest(userId, dto.signals)
        .then((rows) => ({ ingested: rows.length, deferred: true }));
    }
    return this.perception.ingestAndPerceive(userId, dto.signals);
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
