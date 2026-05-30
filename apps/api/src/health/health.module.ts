import { Module } from '@nestjs/common';
import { HealthCompanionController } from './health.controller';
import { HealthCompanionService } from './health.service';

@Module({
  controllers: [HealthCompanionController],
  providers: [HealthCompanionService],
  exports: [HealthCompanionService],
})
export class HealthCompanionModule {}
