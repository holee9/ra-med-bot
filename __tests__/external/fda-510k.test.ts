/**
 * Tests for lib/external/fda-510k.ts — REQ-EXT-001, REQ-EXT-002
 * Verifies 510(k) lookup, retry on 429/5xx, and graceful empty handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock cache to call through directly (no caching in unit tests)
vi.mock('../../lib/external/cache', () => ({
  withCache: (fn: (...args: unknown[]) => unknown, params: unknown) => fn(params),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const FDA_510K_RESPONSE = {
  results: [
    {
      k_number: 'K213456',
      device_name: 'INFUSION PUMP',
      applicant: 'ACME MEDICAL',
      decision_date: '2021-06-15',
      decision_description: 'SUBSTANTIALLY EQUIVALENT',
      product_code: 'FPA',
      device_class: '2',
      submission_type: '510(k)',
    },
  ],
};

describe('lookup510k', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns typed Fda510kResult array on successful fetch', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(FDA_510K_RESPONSE), { status: 200 }),
    );

    const { lookup510k } = await import('../../lib/external/fda-510k');
    const results = await lookup510k({ productCode: 'FPA' });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      k_number: 'K213456',
      device_name: 'INFUSION PUMP',
      applicant: 'ACME MEDICAL',
      decision_date: '2021-06-15',
      decision_description: 'SUBSTANTIALLY EQUIVALENT',
      product_code: 'FPA',
      device_class: '2',
      submission_type: '510(k)',
    });
  });

  it('retries on 429 response (fetch called multiple times)', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('Too Many Requests', { status: 429 }))
      .mockResolvedValueOnce(new Response('Too Many Requests', { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(FDA_510K_RESPONSE), { status: 200 }),
      );

    vi.resetModules();
    vi.mock('../../lib/external/cache', () => ({
      withCache: (fn: (...args: unknown[]) => unknown, params: unknown) => fn(params),
    }));
    const { lookup510k } = await import('../../lib/external/fda-510k');
    const results = await lookup510k({ productCode: 'FPA' });

    // Should have retried and eventually succeeded
    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(results).toHaveLength(1);
  });

  it('retries on 5xx response', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(FDA_510K_RESPONSE), { status: 200 }),
      );

    vi.resetModules();
    vi.mock('../../lib/external/cache', () => ({
      withCache: (fn: (...args: unknown[]) => unknown, params: unknown) => fn(params),
    }));
    const { lookup510k } = await import('../../lib/external/fda-510k');
    const results = await lookup510k({ productCode: 'FPA' });

    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(results).toHaveLength(1);
  });

  it('returns empty array when no params provided', async () => {
    vi.resetModules();
    vi.mock('../../lib/external/cache', () => ({
      withCache: (fn: (...args: unknown[]) => unknown, params: unknown) => fn(params),
    }));
    const { lookup510k } = await import('../../lib/external/fda-510k');
    const results = await lookup510k({});

    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty array on API error without throwing', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    vi.resetModules();
    vi.mock('../../lib/external/cache', () => ({
      withCache: (fn: (...args: unknown[]) => unknown, params: unknown) => fn(params),
    }));
    const { lookup510k } = await import('../../lib/external/fda-510k');

    await expect(lookup510k({ deviceName: 'pump' })).resolves.toEqual([]);
  });

  it('returns empty array when API returns no results', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );

    vi.resetModules();
    vi.mock('../../lib/external/cache', () => ({
      withCache: (fn: (...args: unknown[]) => unknown, params: unknown) => fn(params),
    }));
    const { lookup510k } = await import('../../lib/external/fda-510k');
    const results = await lookup510k({ productCode: 'ZZZ' });

    expect(results).toEqual([]);
  });
});
