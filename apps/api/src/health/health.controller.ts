import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { HealthCompanionService } from './health.service';
import { PersistenceService } from '../persistence/persistence.service';
import { resolveUserId } from '../common/user.util';
import type { HealthKind } from '../domain/types';

const KINDS: HealthKind[] = ['vital', 'medication', 'symptom'];

class AddHealthDto {
  @IsIn(KINDS) kind!: HealthKind;
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() value?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() notes?: string;
}

// Note: the app's liveness check lives at GET /health (AppController). This
// feature is namespaced under /me/health to avoid any clash.
@Controller('me/health')
export class HealthCompanionController {
  constructor(
    private readonly health: HealthCompanionService,
    private readonly persistence: PersistenceService,
  ) {}

  @Get('summary')
  summary(@Headers('x-user-id') userHeader?: string) {
    return this.health.summary(resolveUserId(this.persistence, userHeader));
  }

  @Get('records')
  records(@Headers('x-user-id') userHeader?: string) {
    return this.health.list(resolveUserId(this.persistence, userHeader));
  }

  @Post('records')
  add(@Body() dto: AddHealthDto, @Headers('x-user-id') userHeader?: string) {
    return this.health.add(resolveUserId(this.persistence, userHeader), dto);
  }
}
