import { Module } from '@nestjs/common';
import { BriefingController } from './briefing.controller';
import { BriefingService } from './briefing.service';
import { DocumentsModule } from '../documents/documents.module';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [DocumentsModule, MemoryModule],
  controllers: [BriefingController],
  providers: [BriefingService],
})
export class BriefingModule {}
