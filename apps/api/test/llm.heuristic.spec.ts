import { LlmService } from '../src/llm/llm.service';

// In demo mode (no GEMINI_API_KEY) the service uses deterministic heuristics —
// exactly what the hermetic env forces. Persistence is unused on these paths.
function makeLlm(): LlmService {
  const config = { get: () => undefined } as any;
  const persistence = {} as any;
  return new LlmService(config, persistence);
}

describe('LlmService (demo heuristics)', () => {
  const llm = makeLlm();

  it('is not live without a key', () => {
    expect(llm.live).toBe(false);
  });

  it('classifies a time-critical KYC email as critical with a deadline', async () => {
    const r = await llm.classifyEmail({
      from: 'bank@x.com',
      subject: 'Action required: complete KYC within 3 days',
      body: 'Verify or your account will be suspended.',
    });
    expect(r.urgency).toBe('critical');
    expect(r.actionRequired).toBe(true);
    expect(r.deadline).toBeDefined();
  });

  it('classifies a sale email as promotional', async () => {
    const r = await llm.classifyEmail({
      from: 'deals@x.com',
      subject: 'Mega sale — 70% off, unsubscribe anytime',
      body: 'Biggest discount of the season.',
    });
    expect(r.urgency).toBe('promotional');
    expect(r.actionRequired).toBe(false);
  });

  it('produces a deterministic mock embedding', async () => {
    const a = await llm.embed('passport identity document');
    const b = await llm.embed('passport identity document');
    expect(a).toHaveLength(256);
    expect(a).toEqual(b);
  });
});
