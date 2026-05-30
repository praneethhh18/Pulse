import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { LearningService } from './learning.service';
import { PersistenceService } from '../persistence/persistence.service';
import { resolveUserId } from '../common/user.util';
import { resolveLanguage } from '../common/lang.util';

class GoalDto {
  @IsString() @MinLength(1) topic!: string;
}
class CardDto {
  @IsString() @MinLength(1) goalId!: string;
  @IsString() @MinLength(1) front!: string;
  @IsString() @MinLength(1) back!: string;
}
class ReviewDto {
  @IsIn(['again', 'good']) grade!: 'again' | 'good';
}

@Controller('me/learning')
export class LearningController {
  constructor(
    private readonly learning: LearningService,
    private readonly persistence: PersistenceService,
  ) {}

  private uid(h?: string) {
    return resolveUserId(this.persistence, h);
  }

  @Get('goals')
  goals(@Headers('x-user-id') h?: string) {
    return this.learning.listGoals(this.uid(h));
  }

  @Get('due')
  due(@Headers('x-user-id') h?: string, @Query('goalId') goalId?: string) {
    return this.learning.dueCards(this.uid(h), goalId);
  }

  @Post('goals')
  createGoal(
    @Body() dto: GoalDto,
    @Headers('x-user-id') h?: string,
    @Headers('x-language') lang?: string,
  ) {
    return this.learning.createGoal(this.uid(h), dto.topic, resolveLanguage(lang));
  }

  @Post('cards')
  addCard(@Body() dto: CardDto, @Headers('x-user-id') h?: string) {
    return this.learning.addCard(this.uid(h), dto.goalId, dto.front, dto.back);
  }

  @Post('cards/:id/review')
  review(@Param('id') id: string, @Body() dto: ReviewDto, @Headers('x-user-id') h?: string) {
    return this.learning.review(this.uid(h), id, dto.grade);
  }
}
