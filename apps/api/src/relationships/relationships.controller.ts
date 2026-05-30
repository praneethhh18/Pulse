import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { RelationshipsService } from './relationships.service';
import { PersistenceService } from '../persistence/persistence.service';
import { resolveUserId } from '../common/user.util';

class AddPersonDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() relation?: string;
}
class NoteDto {
  @IsString() @MinLength(1) text!: string;
}
class DateDto {
  @IsString() @MinLength(1) label!: string;
  @IsString() @MinLength(1) date!: string;
}
class FollowUpDto {
  @IsString() @MinLength(1) text!: string;
  @IsOptional() @IsString() dueAt?: string;
}

@Controller('people')
export class RelationshipsController {
  constructor(
    private readonly people: RelationshipsService,
    private readonly persistence: PersistenceService,
  ) {}

  private uid(h?: string) {
    return resolveUserId(this.persistence, h);
  }

  @Get()
  list(@Headers('x-user-id') h?: string) {
    return this.people.list(this.uid(h));
  }

  @Get(':id')
  get(@Param('id') id: string, @Headers('x-user-id') h?: string) {
    return this.people.get(this.uid(h), id);
  }

  @Post()
  add(@Body() dto: AddPersonDto, @Headers('x-user-id') h?: string) {
    return this.people.addPerson(this.uid(h), dto);
  }

  @Post(':id/notes')
  note(@Param('id') id: string, @Body() dto: NoteDto, @Headers('x-user-id') h?: string) {
    return this.people.addNote(this.uid(h), id, dto.text);
  }

  @Post(':id/dates')
  date(@Param('id') id: string, @Body() dto: DateDto, @Headers('x-user-id') h?: string) {
    return this.people.addDate(this.uid(h), id, dto.label, dto.date);
  }

  @Post(':id/followups')
  followup(@Param('id') id: string, @Body() dto: FollowUpDto, @Headers('x-user-id') h?: string) {
    return this.people.addFollowUp(this.uid(h), id, dto.text, dto.dueAt);
  }

  @Post(':id/followups/:fid/done')
  done(@Param('id') id: string, @Param('fid') fid: string, @Headers('x-user-id') h?: string) {
    return this.people.completeFollowUp(this.uid(h), id, fid);
  }
}
