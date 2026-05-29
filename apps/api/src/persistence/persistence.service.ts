import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mongoose from 'mongoose';
import type { Collection as MongoNativeCollection } from 'mongodb';
import {
  MemoryRepository,
  MongoRepository,
  Repository,
} from './repository';
import { buildSeed } from './seed';
import type { CollectionName, UserDoc } from '../domain/types';

const ALL_COLLECTIONS: CollectionName[] = [
  'users',
  'documents',
  'email_intelligence',
  'calendar_events',
  'context_engine',
  'price_watches',
  'health_records',
  'financial_transactions',
  'event_briefings',
  'call_intelligence',
  'relationship_memory',
  'integrations',
  'user_profile',
  'provider_state',
];

@Injectable()
export class PersistenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Persistence');
  private connection?: mongoose.Connection;
  private readonly repos = new Map<CollectionName, Repository<any>>();
  mode: 'mongo' | 'memory' = 'memory';
  readonly demoUserId: string;

  constructor(private readonly config: ConfigService) {
    this.demoUserId = this.config.get<string>('DEMO_USER_ID') || 'demo-user';
  }

  async onModuleInit(): Promise<void> {
    const uri = this.config.get<string>('MONGODB_URI');
    if (uri) {
      try {
        const dbName = this.config.get<string>('MONGODB_DB') || 'pulse';
        this.connection = await mongoose
          .createConnection(uri, { dbName })
          .asPromise();
        this.mode = 'mongo';
        this.logger.log(`MongoDB Atlas connected (db: ${dbName})`);
        // Never auto-seed a real database with demo data. Only when explicitly
        // opted in (e.g. a throwaway demo cluster).
        if (this.config.get<string>('SEED_DEMO_DATA') === 'true') {
          this.logger.warn('SEED_DEMO_DATA=true → inserting demo data into MongoDB');
          await this.seedMongoIfEmpty();
        }
        return;
      } catch (e) {
        this.logger.error(`Mongo connect failed → falling back to memory: ${e}`);
      }
    }
    this.mode = 'memory';
    this.logger.warn(
      'Persistence in DEMO MODE (in-memory). Set MONGODB_URI in .env to go live.',
    );
    this.loadMemorySeed();
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection?.close();
  }

  listCollections(): CollectionName[] {
    return [...ALL_COLLECTIONS];
  }

  getRepo<T extends { _id: string; userId: string }>(
    name: CollectionName,
  ): Repository<T> {
    let r = this.repos.get(name);
    if (!r) {
      if (this.mode === 'mongo' && this.connection) {
        r = new MongoRepository<T>(
          this.connection.collection(name) as unknown as MongoNativeCollection,
        );
      } else {
        r = new MemoryRepository<T>([]);
      }
      this.repos.set(name, r);
    }
    return r as Repository<T>;
  }

  private loadMemorySeed(): void {
    const seed = buildSeed(this.demoUserId);
    this.repos.set('users', new MemoryRepository(seed.users));
    this.repos.set('documents', new MemoryRepository(seed.documents));
    this.repos.set(
      'email_intelligence',
      new MemoryRepository(seed.email_intelligence),
    );
    this.repos.set(
      'calendar_events',
      new MemoryRepository(seed.calendar_events),
    );
    for (const name of ALL_COLLECTIONS) {
      if (!this.repos.has(name)) this.repos.set(name, new MemoryRepository([]));
    }
  }

  private async seedMongoIfEmpty(): Promise<void> {
    const users = this.getRepo<UserDoc>('users');
    const existing = await users.findByUser(this.demoUserId);
    if (existing.length) return;
    const seed = buildSeed(this.demoUserId);
    for (const u of seed.users) await users.insert(u);
    for (const d of seed.documents) await this.getRepo('documents').insert(d);
    for (const e of seed.email_intelligence)
      await this.getRepo('email_intelligence').insert(e);
    for (const c of seed.calendar_events)
      await this.getRepo('calendar_events').insert(c);
    this.logger.log('Seeded demo data into MongoDB');
  }
}
