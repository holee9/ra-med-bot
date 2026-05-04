/**
 * Tests for lib/external/fda-maude.ts — REQ-EXT-004, REQ-EXT-005
 * Verifies adverse event search, retry, default limit, and graceful degradation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/external/cache', () => ({
  withCache: (fn: (...args: unknown[]) => unknown, params: unknown) => fn(params),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const MAUDE_RESPONSE = {
  results: [
    {
      report_number: 'MDR2021-001',
      date_received: '2021-03-10',
      device: [{ device_class: '2', brand_name: 'INFUSION PUMP', product_code: 'FPA' }],
      event_type: 'Injury',
      mdr_text: [
        { text: 'Patient injured during infusion' },
        { text: 'Device malfunction noted' },
        { text: 'Third text entry' },
      ],
    },
    {
      report_number: 'MDR2021-002',
      date_received: '2021-04-20',
      device: [{ device_class: '2', brand_name: 'INFUSION PUMP PRO', product_code: 'FPA' }],
      event_type: 'Malfunction',
      mdr_text: [{ text: 'Device stopped working' }],
    },
  ],
};

function buildMaudeResponse(count: number) {
  return {
    results: Array.from({ length: count }, (_, i) => ({
      report_number: `MDR2021-00${i + 1}`,
      date_received: '2021-03-10',
      device: [{ device_class: '2', brand_name: 'PUMP', product_code: 'FPA' }],
      event_type: 'Injury',
      mdr_text: [{ text: 'description' }],
    })),
  };
}

describe('searchAdverseEvents', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns typed MaudeEvent array on successful fetch', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(MAUDE_RESPONSE), { status: 200 }));

    const { searchAdverseEvents } = await import('../../lib/external/fda-maude');
    const results = await searchAdverseEvents({ productCode: 'FPA' });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toMatchObject({
      report_number: 'MDR2021-001',
      date_received: '2021-03-10',
      event_type: 'Injury',
      product_code: 'FPA',
    });
  });

  it('limits mdr_text to first 2 entries', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(MAUDE_RESPONSE), { status: 200 }));

    const { searchAdverseEvents } = await import('../../lib/external/fda-maude');
    const results = await searchAdverseEvents({ productCode: 'FPA' });

    // First result has 3 mdr_text entries, should be capped at 2
    expect(results[0]?.mdr_text.length).toBeLessThanOrEqual(2);
  });

  it('defaults to limit 5', async () => {
    const bigResponse = buildMaudeResponse(10);
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(bigResponse), { status: 200 }));

    vi.resetModules();
    vi.mock('../../lib/external/cache', () => ({
      withCache: (fn: (...args: unknown[]) => unknown, params: unknown) => fn(params),
    }));
    const { searchAdverseEvents } = await import('../../lib/external/fda-maude');
    const results = await searchAdverseEvents({ productCode: 'FPA' });

    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('retries on 429', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('Rate limit', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(MAUDE_RESPONSE), { status: 200 }));

    vi.resetModules();
    vi.mock('../../lib/external/cache', () => ({
      withCache: (fn: (...args: unknown[]) => unknown, params: unknown) => fn(params),
    }));
    const { searchAdverseEvents } = await import('../../lib/external/fda-maude');
    const results = await searchAdverseEvents({ productCode: 'FPA' });

    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns empty array for unknown product code (no results)', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ results: [] }), { status: 200 }));

    vi.resetModules();
    vi.mock('../../lib/external/cache', () => ({
      withCache: (fn: (...args: unknown[]) => unknown, params: unknown) => fn(params),
    }));
    const { searchAdverseEvents } = await import('../../lib/external/fda-maude');
    const results = await searchAdverseEvents({ productCode: 'UNKNOWN999' });

    expect(results).toEqual([]);
  });

  it('returns empty array on network error without throwing', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'));

    vi.resetModules();
    vi.mock('../../lib/external/cache', () => ({
      withCache: (fn: (...args: unknown[]) => unknown, params: unknown) => fn(params),
    }));
    const { searchAdverseEvents } = await import('../../lib/external/fda-maude');

    await expect(searchAdverseEvents({ productCode: 'FPA' })).resolves.toEqual([]);
  });
});
