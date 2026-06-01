import { PersistenceService } from '../src/persistence/persistence.service';
import { LlmService } from '../src/llm/llm.service';
import { MemoryService } from '../src/memory/memory.service';
import { PerceptionService } from '../src/perception/perception.service';
import { ContextService } from '../src/context/context.service';

// No GEMINI_API_KEY → LLM not live → deterministic heuristic perception path.
const config = { get: (k: string) => (k === 'DEMO_USER_ID' ? 'demo-user' : undefined) } as any;

async function setup() {
  const persistence = new PersistenceService(config);
  await persistence.onModuleInit();
  const llm = new LlmService(config, persistence);
  const memory = new MemoryService(persistence, llm);
  const perception = new PerceptionService(persistence, llm, memory);
  const context = new ContextService(persistence, memory);
  return { persistence, perception, context, memory };
}

describe('PerceptionService (phone awareness)', () => {
  it('turns a bill notification into a reminder and ignores an OTP', async () => {
    const { perception } = await setup();
    const r = await perception.ingestAndPerceive('demo-user', [
      {
        kind: 'notification',
        app: 'HDFC Bank',
        title: 'Credit Card',
        body: 'Your credit card payment of Rs 8,450 is due on 5 June.',
      },
      { kind: 'notification', app: 'Google', title: 'Security', body: 'Your OTP is 884213. Do not share.' },
    ]);

    expect(r.ingested).toBe(2);
    // The bill produced a reminder…
    expect(r.reminders.some((n) => /payment|due|bill/i.test(n.title + n.message))).toBe(true);
    // …and the OTP did not nag the user.
    expect(r.reminders.some((n) => /otp|884213/i.test(n.message))).toBe(false);
  });

  it('learns a durable fact from the signal and surfaces the reminder on Home', async () => {
    const { perception, context, memory } = await setup();
    await perception.ingestAndPerceive('demo-user', [
      {
        kind: 'notification',
        app: 'ICICI Bank',
        title: 'Bill',
        body: 'Electricity bill payment of Rs 1,200 is due tomorrow.',
      },
    ]);

    // Durable fact captured about where the user banks.
    const profile = await memory.getProfileText('demo-user');
    expect(profile).toMatch(/ICICI/i);

    // The reminder is merged into the Context Engine output (Home nudges).
    const nudges = await context.nudges('demo-user', 'Asia/Kolkata');
    expect(nudges.some((n) => n.kind === 'reminder')).toBe(true);
  });

  it('does not duplicate a reminder when the same signal is perceived twice', async () => {
    const { perception } = await setup();
    const signal = {
      kind: 'notification' as const,
      app: 'Vi',
      title: 'Recharge',
      body: 'Your plan expires today. Recharge to avoid disruption.',
    };
    await perception.ingestAndPerceive('demo-user', [signal]);
    const again = await perception.perceive('demo-user'); // nothing left unprocessed
    expect(again.processed).toBe(0);
    expect(again.reminders.length).toBe(0);
  });
});
