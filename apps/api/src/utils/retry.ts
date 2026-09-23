export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Given the thrown error, return a Retry-After delay in ms if one applies. */
  retryAfterMs?: (err: unknown) => number | undefined;
  /** Return false to stop retrying immediately (non-retryable error). */
  shouldRetry?: (err: unknown) => boolean;
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Exponential backoff with jitter. Used to wrap every outbound call this app
 * makes to an external provider (LLM, Tavily, page fetches) — free-tier
 * providers rate-limit on tokens-per-minute as well as requests, and a
 * pipeline that dies on the first 429 is the most common way to lose points
 * on this assessment.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { retries = 3, baseDelayMs = 500, maxDelayMs = 15_000, retryAfterMs, shouldRetry, onRetry } =
    options;

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      const canRetry = shouldRetry ? shouldRetry(err) : true;
      if (!canRetry || attempt > retries) throw err;

      const explicit = retryAfterMs?.(err);
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = Math.random() * backoff * 0.25;
      const delay = explicit ?? backoff + jitter;

      onRetry?.(err, attempt, delay);
      await sleep(delay);
    }
  }
}
