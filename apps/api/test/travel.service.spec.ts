import { PersistenceService } from '../src/persistence/persistence.service';
import { LlmService } from '../src/llm/llm.service';
import { TravelService } from '../src/travel/travel.service';

const config = { get: (k: string) => (k === 'DEMO_USER_ID' ? 'demo-user' : undefined) } as any;

async function setup() {
  const persistence = new PersistenceService(config);
  await persistence.onModuleInit(); // seeds the Goa trip
  const llm = new LlmService(config, persistence);
  return { travel: new TravelService(persistence, llm) };
}

describe('TravelService', () => {
  it('lists the seeded trip with a packing list', async () => {
    const { travel } = await setup();
    const trips = await travel.list('demo-user');
    expect(trips.length).toBeGreaterThan(0);
    expect(trips[0].destination).toBe('Goa');
    expect(trips[0].packingList.length).toBeGreaterThan(0);
  });

  it('adds a trip with a generated packing list (demo template)', async () => {
    const { travel } = await setup();
    const trip = await travel.addTrip('demo-user', {
      destination: 'Manali',
      startsAt: new Date().toISOString(),
    });
    expect(trip.packingList.length).toBeGreaterThan(0);
    expect(trip.packingList.every((p) => p.packed === false)).toBe(true);
  });

  it('toggles a packing item', async () => {
    const { travel } = await setup();
    const trips = await travel.list('demo-user');
    const before = trips[0].packingList[2].packed;
    const updated = await travel.toggleItem('demo-user', trips[0]._id, 2);
    expect(updated!.packingList[2].packed).toBe(!before);
  });
});
