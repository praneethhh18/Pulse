// Resilience primitives for LLM calls — ported from Hermes' error_classifier +
// retry_utils. Every recovery decision (retry vs switch model vs abort) hangs
// off the classified reason.

export enum FailoverReason {
  RATE_LIMIT = 'rate_limit', // 429 — back off then switch model
  BILLING = 'billing', // quota/billing — switch model immediately
  OVERLOADED = 'overloaded', // 503/529 — transient capacity
  SERVER_ERROR = 'server_error', // 5xx — retry
  TIMEOUT = 'timeout', // network/abort — retry
  SAFETY_BLOCKED = 'safety_blocked', // content policy — do NOT retry unchanged
  AUTH = 'auth', // bad/expired key — abort
  MODEL_NOT_FOUND = 'model_not_found', // bad model id — try next model
  CONTEXT_OVERFLOW = 'context_overflow', // prompt too big — abort here
  UNKNOWN = 'unknown',
}

export function classifyGeminiError(err: unknown): FailoverReason {
  const e = err as { status?: number; statusText?: string; message?: string; name?: string };
  const status = e?.status;
  const msg = `${e?.message ?? ''} ${e?.statusText ?? ''}`.toLowerCase();

  if (status === 429 || /rate.?limit|too many requests|resource exhausted/.test(msg))
    return FailoverReason.RATE_LIMIT;
  if (/quota|billing|exceeded your current quota|payment/.test(msg))
    return FailoverReason.BILLING;
  if (status === 503 || status === 529 || /overloaded|unavailable/.test(msg))
    return FailoverReason.OVERLOADED;
  if (status === 500 || status === 502 || /internal error|bad gateway/.test(msg))
    return FailoverReason.SERVER_ERROR;
  if (
    e?.name === 'AbortError' ||
    /timeout|timed out|etimedout|econnreset|socket hang up|fetch failed|network/.test(msg)
  )
    return FailoverReason.TIMEOUT;
  if (/safety|blocked|content policy|recitation|prohibited/.test(msg))
    return FailoverReason.SAFETY_BLOCKED;
  if (status === 401 || status === 403 || /api key|unauthenticated|permission denied|invalid authentication/.test(msg))
    return FailoverReason.AUTH;
  if (status === 404 || /not found|is not supported|unknown model/.test(msg))
    return FailoverReason.MODEL_NOT_FOUND;
  if (/context length|token limit|too long|exceeds the maximum/.test(msg))
    return FailoverReason.CONTEXT_OVERFLOW;
  return FailoverReason.UNKNOWN;
}

/** Recoverable within the same model by retrying. */
export const RETRYABLE = new Set([
  FailoverReason.TIMEOUT,
  FailoverReason.SERVER_ERROR,
  FailoverReason.OVERLOADED,
  FailoverReason.UNKNOWN,
]);

/** Recoverable by switching to a different model. */
export const SWITCH_MODEL = new Set([
  FailoverReason.RATE_LIMIT,
  FailoverReason.BILLING,
  FailoverReason.OVERLOADED,
  FailoverReason.MODEL_NOT_FOUND,
]);

// Decorrelated exponential backoff with jitter — avoids many workers
// synchronising their retries and amplifying an outage (Hermes retry_utils).
export function jitteredBackoffMs(attempt: number, base = 500, max = 15000): number {
  const exp = Math.min(base * 2 ** (attempt - 1), max);
  return Math.round(exp / 2 + Math.random() * (exp / 2));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
