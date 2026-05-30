import { PersistenceService } from '../src/persistence/persistence.service';
import { HealthCompanionService } from '../src/health/health.service';

const config = { get: (k: string) => (k === 'DEMO_USER_ID' ? 'demo-user' : undefined) } as any;

async function setup() {
  const persistence = new PersistenceService(config);
  await persistence.onModuleInit(); // seeds demo health records in memory mode
  return new HealthCompanionService(persistence);
}

describe('HealthCompanionService', () => {
  it('summarises seeded vitals, meds and symptoms', async () => {
    const health = await setup();
    const s = await health.summary('demo-user');
    expect(s.vitals.length).toBeGreaterThan(0);
    const weight = s.vitals.find((v) => v.name === 'Weight');
    expect(weight).toBeDefined();
    expect(weight!.trend.length).toBeGreaterThanOrEqual(2); // two weight readings → a trend
    expect(s.medications.some((m) => m.name === 'Vitamin D')).toBe(true);
  });

  it('adds a new reading and surfaces it as the latest', async () => {
    const health = await setup();
    await health.add('demo-user', { kind: 'vital', name: 'Weight', value: '71', unit: 'kg' });
    const s = await health.summary('demo-user');
    expect(s.vitals.find((v) => v.name === 'Weight')!.latest).toBe('71');
  });
});
