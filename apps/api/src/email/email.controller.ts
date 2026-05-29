import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { EmailService } from './email.service';
import { PersistenceService } from '../persistence/persistence.service';
import { resolveUserId } from '../common/user.util';

class IngestEmailDto {
  @IsString() @MinLength(1) from!: string;
  @IsString() @MinLength(1) subject!: string;
  @IsString() body!: string;
  @IsOptional() @IsString() receivedAt?: string;
}

@Controller('email')
export class EmailController {
  constructor(
    private readonly email: EmailService,
    private readonly persistence: PersistenceService,
  ) {}

  @Get()
  list(@Headers('x-user-id') userHeader?: string) {
    return this.email.list(resolveUserId(this.persistence, userHeader));
  }

  @Get('matters')
  matters(@Headers('x-user-id') userHeader?: string) {
    return this.email.whatMatters(resolveUserId(this.persistence, userHeader));
  }

  @Post()
  ingest(
    @Body() dto: IngestEmailDto,
    @Headers('x-user-id') userHeader?: string,
  ) {
    return this.email.ingest(resolveUserId(this.persistence, userHeader), dto);
  }

  @Post(':id/handle')
  handle(@Param('id') id: string) {
    return this.email.markHandled(id);
  }
}
