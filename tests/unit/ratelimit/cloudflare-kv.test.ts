// Tests for lib/ratelimit/cloudflare-kv.ts
// RED: sliding-window rate limiter backed by Workers KV

import { describe, expect, it, vi, beforeEach } from 'vitest';

function makeKVMock() {
  const store = new Map<string, string>();
  return {
    put: vi.fn(async (key: string, value: string, _opts?: unknown) => {
      store.set(key, value);
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    delete: vi.fn(async (key: string) => { store.delete(key); }),
    _store: store,
  } as unknown as KVNamespace;
}

describe('createKVRateLimiter', () => {
  let kv: KVNamespace;

  beforeEach(() => {
    kv = makeKVMock();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('should export createKVRateLimiter factory', async () => {
    const mod = await import('../../../lib/ratelimit/cloudflare-kv');
    expect(typeof mod.createKVRateLimiter).toBe('function');
  });

  it('should allow requests within limit', async () => {
    const { createKVRateLimiter } = await import('../../../lib/ratelimit/cloudflare-kv');
    const limiter = createKVRateLimiter(kv, { limit: 5, windowSeconds: 60 });

    const result = await limiter.limit('consult', 'user-1');
    expect(result.success).toBe(true);
    expect(result.remaining).toBeLessThanOrEqual(4);
  });

  it('should block when limit is exceeded', async () => {
    const { createKVRateLimiter } = await import('../../../lib/ratelimit/cloudflare-kv');
    const limiter = createKVRateLimiter(kv, { limit: 2, windowSeconds: 60 });

    await limiter.limit('consult', 'user-2');
    await limiter.limit('consult', 'user-2');
    const result = await limiter.limit('consult', 'user-2');

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should use key pattern ratelimit:<endpoint>:<userId>:<window>', async () => {
    const { createKVRateLimiter } = await import('../../../lib/ratelimit/cloudflare-kv');
    const limiter = createKVRateLimiter(kv, { limit: 10, windowSeconds: 60 });

    await limiter.limit('consult', 'user-3');

    const calledKeys = vi.mocked(kv.put).mock.calls.map((c) => c[0]);
    expect(calledKeys.some((k) => k.startsWith('ratelimit:consult:user-3:'))).toBe(true);
  });

  it('should reset count after window expires', async () => {
    const { createKVRateLimiter } = await import('../../../lib/ratelimit/cloudflare-kv');
    const limiter = createKVRateLimiter(kv, { limit: 1, windowSeconds: 60 });

    await limiter.limit('consult', 'user-4');
    const blocked = await limiter.limit('consult', 'user-4');
    expect(blocked.success).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(61 * 1000);
    // KV mock: clear store to simulate TTL expiry
    (kv as ReturnType<typeof makeKVMock>)._store.clear();

    const afterExpiry = await limiter.limit('consult', 'user-4');
    expect(afterExpiry.success).toBe(true);
  });
});
