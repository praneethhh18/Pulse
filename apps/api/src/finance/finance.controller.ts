import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { FinanceService } from './finance.service';
import { PersistenceService } from '../persistence/persistence.service';
import { resolveUserId } from '../common/user.util';

class AddTransactionDto {
  @IsNumber() amount!: number;
  @IsOptional() @IsIn(['debit', 'credit']) direction?: 'debit' | 'credit';
  @IsString() @MinLength(1) category!: string;
  @IsString() @MinLength(1) merchant!: string;
  @IsOptional() @IsString() occurredAt?: string;
}

@Controller('me/finance')
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly persistence: PersistenceService,
  ) {}

  @Get('summary')
  summary(@Headers('x-user-id') h?: string) {
    return this.finance.summary(resolveUserId(this.persistence, h));
  }

  @Get('transactions')
  list(@Headers('x-user-id') h?: string) {
    return this.finance.list(resolveUserId(this.persistence, h));
  }

  @Post('transactions')
  add(@Body() dto: AddTransactionDto, @Headers('x-user-id') h?: string) {
    return this.finance.add(resolveUserId(this.persistence, h), dto);
  }
}
