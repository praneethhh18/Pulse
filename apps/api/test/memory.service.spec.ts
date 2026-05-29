import { PersistenceService } from '../src/persistence/persistence.service';
import { LlmService } from '../src/llm/llm.service';
import { MemoryService } from '../src/memory/memory.service';

const config = { get: (k: string) => (k === 'DEMO_USER_ID' ? 'u1' : undefined) } as any;

async function setup() {
  const persistence = new PersistenceService(config);
  await persistence.onModuleInit(); // memory mode (no MONGODB_URI)
  const llm = new LlmService(config, persistence);
  const memory = new MemoryService(persistence, llm);
  return { memory };
}

describe('MemoryService — grow-with-you learning loop (demo heuristics)', () => {
  it('extracts durable facts from a conversation into the profile', async () => {
    const { memory } = await setup();
    await memory.review('u1', [
      { role: 'user', text: 'remember I am vegetarian and my wife is Asha. I live in Bangalore.' },
      { role: 'pulse', text: 'Noted.' },
    ]);
    const profile = await memory.getProfileText('u1');
    expect(profile.toLowerCase()).toContain('asha');
    expect(profile.toLowerCase()).toContain('vegetarian');
    expect(profile.toLowerCase()).toContain('bangalore');
  });

  it('does not learn from a transient, fact-free turn', async () => {
    const { memory } = await setup();
    await memory.review('u1', [
      { role: 'user', text: 'what is the weather like?' },
      { role: 'pulse', text: 'I cannot check weather yet.' },
    ]);
    const profile = await memory.getProfileText('u1');
    expect(profile.trim()).toBe('');
  });
});
