import { PersistenceService } from '../src/persistence/persistence.service';
import { LlmService } from '../src/llm/llm.service';
import { LearningService } from '../src/learning/learning.service';

const config = { get: (k: string) => (k === 'DEMO_USER_ID' ? 'demo-user' : undefined) } as any;

async function setup() {
  const persistence = new PersistenceService(config);
  await persistence.onModuleInit(); // seeds a Spanish goal with due cards
  const llm = new LlmService(config, persistence);
  return new LearningService(persistence, llm);
}

describe('LearningService — spaced repetition', () => {
  it('seeds a goal with due cards', async () => {
    const learning = await setup();
    const goals = await learning.listGoals('demo-user');
    expect(goals.length).toBeGreaterThan(0);
    expect(goals[0].due).toBeGreaterThan(0);
  });

  it('"good" pushes the next review into the future; "again" keeps it soon', async () => {
    const learning = await setup();
    const due = await learning.dueCards('demo-user');
    const card = due[0];

    const good = await learning.review('demo-user', card._id, 'good');
    expect(new Date(good!.dueAt).getTime()).toBeGreaterThan(Date.now() + 12 * 60 * 60 * 1000);
    expect(good!.reps).toBe(1);

    const again = await learning.review('demo-user', due[1]._id, 'again');
    expect(new Date(again!.dueAt).getTime()).toBeLessThan(Date.now() + 60 * 60 * 1000);
    expect(again!.lapses).toBe(1);
  });
});
