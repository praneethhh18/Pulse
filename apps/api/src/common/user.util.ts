import { PersistenceService } from '../persistence/persistence.service';

// Phase 0 has no auth yet — resolve the user from an optional header,
// defaulting to the demo user. Auth (Firebase) lands in Phase 1.
export function resolveUserId(
  persistence: PersistenceService,
  header?: string,
): string {
  return header && header.trim() ? header.trim() : persistence.demoUserId;
}

export function stripEmbedding<T extends { embedding?: unknown }>(doc: T): Omit<T, 'embedding'> {
  const { embedding, ...rest } = doc;
  return rest;
}
