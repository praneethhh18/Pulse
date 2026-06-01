import { Module } from '@nestjs/common';
import { PerceptionService } from './perception.service';
import { PerceptionController } from './perception.controller';
import { PersistenceModule } from '../persistence/persistence.module';
import { LlmModule } from '../llm/llm.module';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [PersistenceModule, LlmModule, MemoryModule],
  controllers: [PerceptionController],
  providers: [PerceptionService],
  exports: [PerceptionService],
})
export class PerceptionModule {}
