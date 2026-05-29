import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { DocumentsService } from './documents.service';
import { PersistenceService } from '../persistence/persistence.service';
import { resolveUserId } from '../common/user.util';
import type { DocumentCategory } from '../domain/types';

const CATEGORIES: DocumentCategory[] = [
  'identity',
  'medical',
  'financial',
  'legal',
  'educational',
  'vehicle',
  'travel',
  'other',
];

class CreateDocumentDto {
  @IsString() @MinLength(1) title!: string;
  @IsIn(CATEGORIES) category!: DocumentCategory;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsString() expiresAt?: string;
  // optional attached photo/scan
  @IsOptional() @IsString() fileName?: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @IsString() base64?: string;
}

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly persistence: PersistenceService,
  ) {}

  @Get()
  list(@Headers('x-user-id') userHeader?: string) {
    return this.documents.list(resolveUserId(this.persistence, userHeader));
  }

  @Get('search')
  search(@Query('q') q: string, @Headers('x-user-id') userHeader?: string) {
    return this.documents.search(resolveUserId(this.persistence, userHeader), q);
  }

  @Get(':id/file')
  async file(@Param('id') id: string, @Headers('x-user-id') userHeader?: string) {
    const f = await this.documents.getFile(
      resolveUserId(this.persistence, userHeader),
      id,
    );
    if (!f) throw new NotFoundException('No file for this document');
    return f;
  }

  @Post()
  create(@Body() dto: CreateDocumentDto, @Headers('x-user-id') userHeader?: string) {
    return this.documents.create(resolveUserId(this.persistence, userHeader), dto);
  }
}
