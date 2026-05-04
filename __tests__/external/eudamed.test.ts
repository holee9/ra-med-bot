/**
 * Tests for lib/external/eudamed.ts — REQ-EXT-007, REQ-EXT-008
 * Verifies Eudamed device lookup, network error handling, and param precedence.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/external/cache', () => ({
  withCache: (fn: (...args: unknown[]) => unknown, params: unknown) => fn(params),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const EUDAMED_RESPONSE = {
  data: [
    {
      basicUdiDi: 'BUDI123456',
      deviceName: 'Cardiac Monitor Pro',
      riskClass: 'IIb',
      intendedPurpose: 'Monitoring cardiac activity',
      certificateStatus: 'Valid',
      notifiedBody: 'TUV Rheinland',
      country: 'DE',
    },
  ],
};

describe('lookupDevice', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns typed EudamedDevice array on successful fetch', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(EUDAMED_RESPONSE), { status: 200 }),
    );

    const { lookupDevice } = await import('../../lib/external/eudamed');
    const results = await lookupDevice({ basicUdiDi: 'BUDI123456' });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      basicUdiDi: 'BUDI123456',
      deviceName: 'Cardiac Monitor Pro',
      riskClass: 'IIb',
      certificateStatus: 'Valid',
      notifiedBody: 'TUV Rheinland',
      country: 'DE',
    });
  });

  it('returns typed error result on network error without throwing', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'));

    vi.resetModules();
    vi.mock('../../lib/external/cache', () => ({
      withCache: (fn: (...args: unknown[]) => unknown, params: unknown) => fn(params),
    }));
    const { lookupDevice } = await import('../../lib/external/eudamed');

    // Must not throw
    await expect(lookupDevice({ basicUdiDi: 'ANY' })).resolves.toBeDefined();
    const result = await lookupDevice({ basicUdiDi: 'ANY' });
    // Should return empty array or typed error, not throw
    expect(Array.isArray(result)).toBe(true);
  });

  it('uses basicUdiDi endpoint when both basicUdiDi and deviceName provided', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(EUDAMED_RESPONSE), { status: 200 }),
    );

    vi.resetModules();
    vi.mock('../../lib/external/cache', () => ({
      withCache: (fn: (...args: unknown[]) => unknown, params: unknown) => fn(params),
    }));
    const { lookupDevice } = await import('../../lib/external/eudamed');
    await lookupDevice({ basicUdiDi: 'BUDI123456', deviceName: 'SomeDevice' });

    // Should use basicUdiDi in the URL (takes precedence)
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('BUDI123456');
  });

  it('searches by deviceName when only deviceName provided', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(EUDAMED_RESPONSE), { status: 200 }),
    );

    vi.resetModules();
    vi.mock('../../lib/external/cache', () => ({
      withCache: (fn: (...args: unknown[]) => unknown, params: unknown) => fn(params),
    }));
    const { lookupDevice } = await import('../../lib/external/eudamed');
    const results = await lookupDevice({ deviceName: 'Cardiac Monitor' });

    expect(results.length).toBeGreaterThanOrEqual(0);
    // URL should contain search term
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('Cardiac');
  });

  it('returns empty array when no search params provided', async () => {
    vi.resetModules();
    vi.mock('../../lib/external/cache', () => ({
      withCache: (fn: (...args: unknown[]) => unknown, params: unknown) => fn(params),
    }));
    const { lookupDevice } = await import('../../lib/external/eudamed');
    const results = await lookupDevice({});

    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty array on 404 response', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Not Found', { status: 404 }),
    );

    vi.resetModules();
    vi.mock('../../lib/external/cache', () => ({
      withCache: (fn: (...args: unknown[]) => unknown, params: unknown) => fn(params),
    }));
    const { lookupDevice } = await import('../../lib/external/eudamed');
    const results = await lookupDevice({ basicUdiDi: 'UNKNOWN' });

    expect(results).toEqual([]);
  });
});
