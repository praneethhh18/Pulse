import { randomUUID } from 'crypto';
import type { Collection as MongoNativeCollection } from 'mongodb';

// ─── Repository abstraction ──────────────────────────────────────────────
// One interface, two backends: MongoDB Atlas (live) or in-memory (demo).
// Feature code never knows which one it's talking to.

export interface QueryFilter {
  [key: string]: unknown;
}

export interface ScoredDoc<T> {
  doc: T;
  score: number;
}

export interface Repository<T extends { _id: string; userId: string }> {
  insert(doc: Omit<T, '_id' | 'createdAt' | 'updatedAt'> & Partial<T>): Promise<T>;
  findByUser(userId: string, filter?: QueryFilter): Promise<T[]>;
  findOne(filter: QueryFilter): Promise<T | null>;
  update(id: string, patch: Partial<T>): Promise<T | null>;
  /** Semantic search over an `embedding` field, scoped to a user. */
  vectorSearch(
    userId: string,
    queryEmbedding: number[],
    limit: number,
  ): Promise<ScoredDoc<T>[]>;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ─── In-memory backend (demo mode) ───────────────────────────────────────
export class MemoryRepository<T extends { _id: string; userId: string }>
  implements Repository<T>
{
  private store: T[];

  constructor(seed: T[] = []) {
    this.store = [...seed];
  }

  async insert(
    doc: Omit<T, '_id' | 'createdAt' | 'updatedAt'> & Partial<T>,
  ): Promise<T> {
    const full = {
      ...doc,
      _id: doc._id ?? randomUUID(),
      createdAt: (doc as Partial<T> & { createdAt?: string }).createdAt ?? nowIso(),
      updatedAt: nowIso(),
    } as unknown as T;
    this.store.push(full);
    return full;
  }

  async findByUser(userId: string, filter: QueryFilter = {}): Promise<T[]> {
    return this.store.filter(
      (d) => d.userId === userId && matchesFilter(d, filter),
    );
  }

  async findOne(filter: QueryFilter): Promise<T | null> {
    return this.store.find((d) => matchesFilter(d, filter)) ?? null;
  }

  async update(id: string, patch: Partial<T>): Promise<T | null> {
    const idx = this.store.findIndex((d) => d._id === id);
    if (idx === -1) return null;
    this.store[idx] = { ...this.store[idx], ...patch, updatedAt: nowIso() };
    return this.store[idx];
  }

  async vectorSearch(
    userId: string,
    queryEmbedding: number[],
    limit: number,
  ): Promise<ScoredDoc<T>[]> {
    return this.store
      .filter((d) => d.userId === userId)
      .map((doc) => ({
        doc,
        score: cosineSimilarity(
          queryEmbedding,
          (doc as unknown as { embedding?: number[] }).embedding ?? [],
        ),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

function matchesFilter(doc: Record<string, unknown>, filter: QueryFilter): boolean {
  return Object.entries(filter).every(([k, v]) => doc[k] === v);
}

// ─── MongoDB Atlas backend (live mode) ───────────────────────────────────
export class MongoRepository<T extends { _id: string; userId: string }>
  implements Repository<T>
{
  constructor(
    private readonly col: MongoNativeCollection,
    private readonly vectorIndexName = 'vector_index',
  ) {}

  async insert(
    doc: Omit<T, '_id' | 'createdAt' | 'updatedAt'> & Partial<T>,
  ): Promise<T> {
    const full = {
      ...doc,
      _id: doc._id ?? randomUUID(),
      createdAt:
        (doc as Partial<T> & { createdAt?: string }).createdAt ?? nowIso(),
      updatedAt: nowIso(),
    } as unknown as T;
    await this.col.insertOne(full as never);
    return full;
  }

  async findByUser(userId: string, filter: QueryFilter = {}): Promise<T[]> {
    return this.col
      .find({ userId, ...filter } as never)
      .sort({ createdAt: -1 })
      .toArray() as unknown as Promise<T[]>;
  }

  async findOne(filter: QueryFilter): Promise<T | null> {
    return this.col.findOne(filter as never) as unknown as Promise<T | null>;
  }

  async update(id: string, patch: Partial<T>): Promise<T | null> {
    await this.col.updateOne(
      { _id: id } as never,
      { $set: { ...patch, updatedAt: nowIso() } } as never,
    );
    return this.findOne({ _id: id });
  }

  async vectorSearch(
    userId: string,
    queryEmbedding: number[],
    limit: number,
  ): Promise<ScoredDoc<T>[]> {
    try {
      const results = (await this.col
        .aggregate([
          {
            $vectorSearch: {
              index: this.vectorIndexName,
              path: 'embedding',
              queryVector: queryEmbedding,
              numCandidates: 100,
              limit,
              filter: { userId },
            },
          },
          { $addFields: { __score: { $meta: 'vectorSearchScore' } } },
        ])
        .toArray()) as Array<T & { __score: number }>;
      return results.map((r) => ({ doc: r, score: r.__score }));
    } catch {
      // Atlas vector index not created yet → graceful in-app fallback.
      const all = (await this.col
        .find({ userId } as never)
        .toArray()) as unknown as T[];
      return all
        .map((doc) => ({
          doc,
          score: cosineSimilarity(
            queryEmbedding,
            (doc as unknown as { embedding?: number[] }).embedding ?? [],
          ),
        }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    }
  }
}
