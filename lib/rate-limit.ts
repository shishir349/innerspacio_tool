import "server-only";

export interface RateLimitResult {
  allowed: boolean;
  /** Present only when `allowed` is false. */
  retryAfterSeconds?: number;
}

export interface RateLimitOptions {
  /** Max requests allowed within the window. */
  limit: number;
  windowSeconds: number;
}

/**
 * Provider-neutral rate-limiting interface. `consume` is called once per
 * attempt and atomically decides whether this call counts against the
 * limit and whether it's still allowed.
 */
export interface RateLimiter {
  consume(key: string, options: RateLimitOptions): Promise<RateLimitResult>;
}

/**
 * Sliding-window limiter backed by an in-process Map.
 *
 * IMPORTANT — this is NOT distributed. It tracks state per Node process:
 *   - Correct for a single `next start` process (e.g. this app run locally
 *     or on a single long-lived server).
 *   - WRONG in any horizontally-scaled or serverless deployment (multiple
 *     Next.js server instances, Vercel/AWS Lambda functions, etc.) — each
 *     instance has its own independent counter, so the *effective* limit
 *     becomes `limit × number of concurrently-warm instances`, and a
 *     counter resets to zero whenever a new instance is cold-started.
 *
 * For a real multi-instance production deployment, implement `RateLimiter`
 * against a shared store instead — e.g. Upstash Redis via `@upstash/ratelimit`,
 * Vercel KV, or a Postgres table with an atomic increment — and swap it in
 * via `getRateLimiter()` below. Do not ship this in-memory implementation to
 * a horizontally-scaled production deployment and assume the limit holds.
 */
class InMemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();

  async consume(key: string, { limit, windowSeconds }: RateLimitOptions): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const cutoff = now - windowMs;

    const existing = this.hits.get(key) ?? [];
    const recent = existing.filter((t) => t > cutoff);

    if (recent.length >= limit) {
      const oldestInWindow = recent[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));
      this.hits.set(key, recent);
      return { allowed: false, retryAfterSeconds };
    }

    recent.push(now);
    this.hits.set(key, recent);

    // Bound memory: occasionally drop keys with nothing recent.
    if (this.hits.size > 10_000) {
      for (const [k, timestamps] of this.hits) {
        if (timestamps.every((t) => t <= cutoff)) this.hits.delete(k);
      }
    }

    return { allowed: true };
  }
}

let singleton: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!singleton) singleton = new InMemoryRateLimiter();
  return singleton;
}

export class RateLimitedError extends Error {
  readonly code = "rate_limited" as const;
  constructor(public readonly retryAfterSeconds: number) {
    super(`Too many requests. Try again in ${retryAfterSeconds}s.`);
  }
}

/** Throws RateLimitedError when the limit is exceeded; otherwise resolves silently. */
export async function enforceRateLimit(key: string, options: RateLimitOptions): Promise<void> {
  const result = await getRateLimiter().consume(key, options);
  if (!result.allowed) {
    throw new RateLimitedError(result.retryAfterSeconds ?? options.windowSeconds);
  }
}
