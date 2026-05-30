import { PersistenceService } from '../src/persistence/persistence.service';
import { FinanceService } from '../src/finance/finance.service';

const config = { get: (k: string) => (k === 'DEMO_USER_ID' ? 'demo-user' : undefined) } as any;

async function setup() {
  const persistence = new PersistenceService(config);
  await persistence.onModuleInit(); // seeds demo transactions in memory mode
  return new FinanceService(persistence);
}

describe('FinanceService', () => {
  it('summarises spend by category and flags subscriptions', async () => {
    const finance = await setup();
    const s = await finance.summary('demo-user');
    expect(s.categories.length).toBeGreaterThan(0);
    expect(s.total).toBeGreaterThan(0);
    // Food delivery is seeded ~43% up over the prior 30 days
    const food = s.categories.find((c) => c.name === 'Food delivery');
    expect(food).toBeDefined();
    expect(food!.deltaPct).toBeGreaterThanOrEqual(25);
    // Netflix is a recurring subscription
    expect(s.subscriptions.some((x) => x.merchant === 'Netflix')).toBe(true);
  });

  it('excludes income (credits) from category spend', async () => {
    const finance = await setup();
    const s = await finance.summary('demo-user');
    expect(s.categories.find((c) => c.name === 'Income')).toBeUndefined();
  });
});
