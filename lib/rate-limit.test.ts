import { describe, expect, it } from "vitest";
import { getRateLimiter, enforceRateLimit, RateLimitedError } from "./rate-limit";

describe("InMemoryRateLimiter", () => {
  it("allows requests up to the limit, then blocks", async () => {
    const limiter = getRateLimiter();
    const key = `test-key-${Math.random()}`;

    for (let i = 0; i < 3; i++) {
      const result = await limiter.consume(key, { limit: 3, windowSeconds: 60 });
      expect(result.allowed).toBe(true);
    }

    const blocked = await limiter.consume(key, { limit: 3, windowSeconds: 60 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", async () => {
    const limiter = getRateLimiter();
    const keyA = `test-key-a-${Math.random()}`;
    const keyB = `test-key-b-${Math.random()}`;

    await limiter.consume(keyA, { limit: 1, windowSeconds: 60 });
    const blockedA = await limiter.consume(keyA, { limit: 1, windowSeconds: 60 });
    const allowedB = await limiter.consume(keyB, { limit: 1, windowSeconds: 60 });

    expect(blockedA.allowed).toBe(false);
    expect(allowedB.allowed).toBe(true);
  });

  it("allows requests again once the window has fully elapsed", async () => {
    const limiter = getRateLimiter();
    const key = `test-key-window-${Math.random()}`;

    // A window so short it's already elapsed by the next call.
    const first = await limiter.consume(key, { limit: 1, windowSeconds: 0.01 });
    expect(first.allowed).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 20));

    const second = await limiter.consume(key, { limit: 1, windowSeconds: 0.01 });
    expect(second.allowed).toBe(true);
  });
});

describe("enforceRateLimit", () => {
  it("resolves silently when under the limit", async () => {
    await expect(
      enforceRateLimit(`enforce-ok-${Math.random()}`, { limit: 5, windowSeconds: 60 })
    ).resolves.toBeUndefined();
  });

  it("throws RateLimitedError when the limit is exceeded", async () => {
    const key = `enforce-blocked-${Math.random()}`;
    await enforceRateLimit(key, { limit: 1, windowSeconds: 60 });
    await expect(enforceRateLimit(key, { limit: 1, windowSeconds: 60 })).rejects.toThrow(
      RateLimitedError
    );
  });
});
