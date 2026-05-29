import {
  FailoverReason,
  classifyGeminiError,
  jitteredBackoffMs,
} from '../src/llm/resilience';

describe('classifyGeminiError', () => {
  const cases: [unknown, FailoverReason][] = [
    [{ status: 429 }, FailoverReason.RATE_LIMIT],
    [{ message: 'rate limit exceeded' }, FailoverReason.RATE_LIMIT],
    [{ message: 'You exceeded your current quota' }, FailoverReason.BILLING],
    [{ status: 503 }, FailoverReason.OVERLOADED],
    [{ status: 500 }, FailoverReason.SERVER_ERROR],
    [{ name: 'AbortError' }, FailoverReason.TIMEOUT],
    [{ message: 'socket hang up' }, FailoverReason.TIMEOUT],
    [{ message: 'blocked by safety settings' }, FailoverReason.SAFETY_BLOCKED],
    [{ status: 401 }, FailoverReason.AUTH],
    [{ status: 404 }, FailoverReason.MODEL_NOT_FOUND],
    [{ message: 'context length exceeded' }, FailoverReason.CONTEXT_OVERFLOW],
    [{ message: 'something weird' }, FailoverReason.UNKNOWN],
  ];
  it.each(cases)('classifies %j', (err, expected) => {
    expect(classifyGeminiError(err)).toBe(expected);
  });
});

describe('jitteredBackoffMs', () => {
  it('stays within the expected band and respects the cap', () => {
    for (let i = 0; i < 200; i++) {
      const ms = jitteredBackoffMs(1, 500, 15000);
      expect(ms).toBeGreaterThanOrEqual(250);
      expect(ms).toBeLessThanOrEqual(500);
    }
    expect(jitteredBackoffMs(99, 500, 15000)).toBeLessThanOrEqual(15000);
  });
});
