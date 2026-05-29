import { Injectable, Logger } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';
import type { CollectionName } from '../domain/types';

// Vision §3.15: "your data is yours" — export everything in readable form, and
// delete everything permanently. These power the user's data controls.

// Fields we never include in an export (vectors, raw file bytes, secrets).
const STRIP = ['embedding', 'fileData', 'tokens'];

function clean<T extends Record<string, any>>(doc: T): Partial<T> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(doc)) {
    if (!STRIP.includes(k)) out[k] = v;
  }
  return out as Partial<T>;
}

@Injectable()
export class PrivacyService {
  private readonly logger = new Logger('Privacy');

  constructor(private readonly persistence: PersistenceService) {}

  // Everything Pulse knows about you, in plain JSON.
  async exportAll(userId: string) {
    const data: Record<string, unknown[]> = {};
    let total = 0;
    for (const name of this.persistence.listCollections()) {
      const repo = this.persistence.getRepo<any>(name);
      const rows = (await repo.findByUser(userId)).map(clean);
      if (rows.length) {
        data[name] = rows;
        total += rows.length;
      }
    }
    return {
      exportedAt: new Date().toISOString(),
      userId,
      totalRecords: total,
      categories: Object.keys(data).length,
      data,
    };
  }

  // Counts only — for a quick "what does Pulse hold on me" summary.
  async summary(userId: string) {
    const counts: Record<string, number> = {};
    for (const name of this.persistence.listCollections()) {
      const rows = await this.persistence.getRepo<any>(name).findByUser(userId);
      if (rows.length) counts[name] = rows.length;
    }
    return { counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
  }

  // Permanent, irreversible deletion of all the user's data.
  async deleteEverything(userId: string) {
    const deleted: Record<string, number> = {};
    let total = 0;
    for (const name of this.persistence.listCollections() as CollectionName[]) {
      const n = await this.persistence.getRepo<any>(name).deleteByUser(userId);
      if (n) deleted[name] = n;
      total += n;
    }
    this.logger.warn(`Deleted ALL data for ${userId}: ${total} records`);
    return { ok: true, deleted, total };
  }
}
