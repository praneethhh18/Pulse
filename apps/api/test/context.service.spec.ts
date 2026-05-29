import { PersistenceService } from '../src/persistence/persistence.service';
import { ContextService } from '../src/context/context.service';

const config = { get: (k: string) => (k === 'DEMO_USER_ID' ? 'demo-user' : undefined) } as any;

// MemoryService is only used for the profile-prep nudge; a stub returning an
// empty profile keeps this test focused on the rule-based generators.
const memoryStub = { getProfileText: async () => '' } as any;

async function setup() {
  const persistence = new PersistenceService(config);
  await persistence.onModuleInit(); // seeds demo data in memory mode
  const context = new ContextService(persistence, memoryStub);
  return { context };
}

describe('ContextService — cross-domain nudges', () => {
  it('produces the seeded nudges incl. the flight/meeting conflict', async () => {
    const { context } = await setup();
    const nudges = await context.nudges('demo-user', 'Asia/Kolkata');
    expect(nudges.length).toBeGreaterThan(0);
    const kinds = nudges.map((n) => n.kind);
    expect(kinds).toContain('schedule-conflict');
    // every nudge carries its explainability + a stable key
    for (const n of nudges) {
      expect(n.reason).toBeTruthy();
      expect(n.key).toBeTruthy();
      expect(Array.isArray(n.sources)).toBe(true);
    }
  });

  it('hides a nudge after it is dismissed (ack)', async () => {
    const { context } = await setup();
    const before = await context.nudges('demo-user', 'Asia/Kolkata');
    const target = before[0];
    await context.ack('demo-user', target.key);
    const after = await context.nudges('demo-user', 'Asia/Kolkata');
    expect(after.find((n) => n.key === target.key)).toBeUndefined();
    expect(after.length).toBe(before.length - 1);
  });

  it('renders nudge times in the requested timezone', async () => {
    const { context } = await setup();
    const kol = await context.nudges('demo-user', 'Asia/Kolkata');
    const ny = await context.nudges('demo-user', 'America/New_York');
    const k = kol.find((n) => n.kind === 'schedule-conflict')!;
    const n = ny.find((x) => x.kind === 'schedule-conflict')!;
    expect(k.message).not.toBe(n.message); // same event, different local times
  });
});
