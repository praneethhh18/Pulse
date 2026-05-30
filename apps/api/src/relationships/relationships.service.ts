import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PersistenceService } from '../persistence/persistence.service';
import type { PersonDoc } from '../domain/types';

@Injectable()
export class RelationshipsService {
  constructor(private readonly persistence: PersistenceService) {}

  private repo() {
    return this.persistence.getRepo<PersonDoc>('relationship_memory');
  }

  list(userId: string) {
    return this.repo()
      .findByUser(userId)
      .then((p) => p.sort((a, b) => a.name.localeCompare(b.name)));
  }

  async get(userId: string, id: string): Promise<PersonDoc> {
    const p = await this.repo().findOne({ _id: id, userId });
    if (!p) throw new NotFoundException('Person not found');
    return p;
  }

  addPerson(userId: string, input: { name: string; relation?: string }) {
    return this.repo().insert({
      userId,
      name: input.name.trim(),
      relation: input.relation?.trim() || undefined,
      notes: [],
      importantDates: [],
      followUps: [],
    });
  }

  async addNote(userId: string, id: string, text: string) {
    const p = await this.get(userId, id);
    return this.repo().update(id, {
      notes: [...p.notes, text.trim()],
      lastInteractionAt: new Date().toISOString(),
    });
  }

  async addDate(userId: string, id: string, label: string, date: string) {
    const p = await this.get(userId, id);
    return this.repo().update(id, {
      importantDates: [...p.importantDates, { label: label.trim(), date }],
    });
  }

  async addFollowUp(userId: string, id: string, text: string, dueAt?: string) {
    const p = await this.get(userId, id);
    const followUp = {
      id: randomUUID(),
      text: text.trim(),
      dueAt,
      done: false,
      createdAt: new Date().toISOString(),
    };
    return this.repo().update(id, { followUps: [...p.followUps, followUp] });
  }

  async completeFollowUp(userId: string, id: string, fid: string) {
    const p = await this.get(userId, id);
    return this.repo().update(id, {
      followUps: p.followUps.map((f) => (f.id === fid ? { ...f, done: true } : f)),
    });
  }
}
