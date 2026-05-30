import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { TravelService } from './travel.service';
import { PersistenceService } from '../persistence/persistence.service';
import { resolveUserId } from '../common/user.util';
import { resolveLanguage } from '../common/lang.util';

class TripDto {
  @IsString() @MinLength(1) destination!: string;
  @IsString() @MinLength(1) startsAt!: string;
  @IsOptional() @IsString() endsAt?: string;
  @IsOptional() @IsString() notes?: string;
}

@Controller('me/trips')
export class TravelController {
  constructor(
    private readonly travel: TravelService,
    private readonly persistence: PersistenceService,
  ) {}

  private uid(h?: string) {
    return resolveUserId(this.persistence, h);
  }

  @Get()
  list(@Headers('x-user-id') h?: string) {
    return this.travel.list(this.uid(h));
  }

  @Post()
  add(
    @Body() dto: TripDto,
    @Headers('x-user-id') h?: string,
    @Headers('x-language') lang?: string,
  ) {
    return this.travel.addTrip(this.uid(h), dto, resolveLanguage(lang));
  }

  @Post(':id/pack/:index')
  toggle(@Param('id') id: string, @Param('index') index: string, @Headers('x-user-id') h?: string) {
    return this.travel.toggleItem(this.uid(h), id, parseInt(index, 10));
  }
}
