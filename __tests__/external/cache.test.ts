/**
 * Tests for lib/external/cache.ts — REQ-EXT-009
 * Verifies 24-hour TTL caching and DISABLE_EXTERNAL_CACHE bypass.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock next/cache before importing the module under test.
const mockUnstableCache = vi.fn();
vi.mock('next/cache', () => ({
  unstable_cache: mockUnstableCache,
}));

describe('withCache', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: unstable_cache returns a wrapper that calls through.
    mockUnstableCache.mockImplementation((fn: (...args: unknown[]) => unknown) => fn);
  });

  afterEach(() => {
    process.env.DISABLE_EXTERNAL_CACHE = undefined;
  });

  it('calls unstable_cache with correct tags and revalidate when cache is enabled', async () => {
    const { withCache } = await import('../../lib/external/cache');

    const fn = vi.fn().mockResolvedValue({ result: 'data' });
    await withCache(fn, { q: 'test' }, 'myFn');

    expect(mockUnstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      expect.arrayContaining([expect.stringContaining('myFn')]),
      expect.objectContaining({ revalidate: 86400 }),
    );
  });

  it('calls the underlying function only once when called twice with same params (cache hit)', async () => {
    // Simulate cache by making unstable_cache return a cached version
    let cachedResult: unknown;
    let callCount = 0;
    mockUnstableCache.mockImplementation((fn: (...args: unknown[]) => unknown) => {
      return async (...args: unknown[]) => {
        if (cachedResult !== undefined) return cachedResult;
        callCount++;
        cachedResult = await fn(...args);
        return cachedResult;
      };
    });

    // Re-import to get fresh module with the mock
    vi.resetModules();
    vi.mock('next/cache', () => ({ unstable_cache: mockUnstableCache }));
    const { withCache } = await import('../../lib/external/cache');

    const fn = vi.fn().mockResolvedValue('value');
    await withCache(fn, { q: 'test' }, 'testFn');
    await withCache(fn, { q: 'test' }, 'testFn');

    // The underlying fn should only be called once due to caching
    expect(callCount).toBe(1);
  });

  it('bypasses cache and calls fn directly when DISABLE_EXTERNAL_CACHE=true', async () => {
    process.env.DISABLE_EXTERNAL_CACHE = 'true';

    vi.resetModules();
    vi.mock('next/cache', () => ({ unstable_cache: mockUnstableCache }));
    const { withCache } = await import('../../lib/external/cache');

    const fn = vi.fn().mockResolvedValue('value');
    await withCache(fn, { q: 'a' }, 'fnA');
    await withCache(fn, { q: 'a' }, 'fnA');

    // unstable_cache should NOT be called when cache is disabled
    expect(mockUnstableCache).not.toHaveBeenCalled();
    // fn called directly each time
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('returns the function result unchanged', async () => {
    vi.resetModules();
    vi.mock('next/cache', () => ({ unstable_cache: mockUnstableCache }));
    const { withCache } = await import('../../lib/external/cache');

    const expected = [{ id: 1, name: 'device' }];
    const fn = vi.fn().mockResolvedValue(expected);
    const result = await withCache(fn, {}, 'anyFn');

    expect(result).toEqual(expected);
  });
});
