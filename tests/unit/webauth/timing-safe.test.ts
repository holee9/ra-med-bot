import * as crypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return {
    ...actual,
    timingSafeEqual: vi.fn(actual.timingSafeEqual),
  };
});

const { timingSafeEqual } = await import('@/lib/webauth/timing-safe');

describe('timingSafeEqual', () => {
  it('returns true for identical secrets', () => {
    expect(timingSafeEqual('secret-token', 'secret-token')).toBe(true);
  });

  it('returns false for different secrets', () => {
    expect(timingSafeEqual('secret-token', 'other-token')).toBe(false);
  });

  it('normalizes unequal-length secrets before timing-safe comparison', () => {
    vi.mocked(crypto.timingSafeEqual).mockClear();

    expect(timingSafeEqual('short', 'a-much-longer-secret')).toBe(false);

    expect(crypto.timingSafeEqual).toHaveBeenCalledTimes(1);
    const call = vi.mocked(crypto.timingSafeEqual).mock.calls[0];
    if (!call) {
      throw new Error('timingSafeEqual was not called');
    }
    const [left, right] = call;
    expect(left.byteLength).toBe(right.byteLength);
  });
});
