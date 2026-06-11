// @vitest-environment node
// Unit tests for the 3-tier cascade predicate search — SPEC-REGULA-PREDICATE-001
// (REQ-PRE-005 cascade tiers, REQ-PRE-006 Vectorize rerank,
//  REQ-PRE-007 pre-2004 coverage-gap notice).

import { describe, expect, it, vi } from 'vitest';
import { createCascadeSearch } from '../cascade-search';
import type { OpenFDADevice } from '../types';

/** Build an openFDA device record with overridable fields. */
function device(overrides: Partial<OpenFDADevice> = {}): OpenFDADevice {
  return {
    k_number: 'K000001',
    applicant_name: 'Acme',
    device_name: 'Infusion Pump',
    decision_date: '2023-01-01',
    decision: 'SESE',
    product_code: 'ABC',
    statement_or_summary: 'S',
    device_description: 'D',
    ...overrides,
  };
}

/** OpenFDAPage shape returned by the real client's search(). */
function page(results: OpenFDADevice[], total = results.length) {
  return { total, results };
}

/** A retriever stub matching the IRetriever interface (corpus + retrieve). */
function makeRetriever(results: Array<{ id: string; score: number }>) {
  return {
    corpus: 'fda',
    retrieve: vi.fn(async () =>
      results.map((r) => ({
        id: r.id,
        content: '',
        score: r.score,
        sourceId: r.id,
        metadata: {} as Record<string, unknown>,
      })),
    ),
  };
}

const env = {} as unknown as Parameters<ReturnType<typeof createCascadeSearch>['search']>[1];

describe('createCascadeSearch — tier cascade (REQ-PRE-005)', () => {
  it('runs tier 1 by device_name, then re-searches the top product_codes in tier 2', async () => {
    // Tier 1 returns devices with mixed product codes; AAA is the most frequent.
    const tier1 = [
      device({ k_number: 'K1', product_code: 'AAA' }),
      device({ k_number: 'K2', product_code: 'AAA' }),
      device({ k_number: 'K3', product_code: 'BBB' }),
    ];
    const tier2 = [
      device({ k_number: 'K4', product_code: 'AAA' }),
      device({ k_number: 'K5', product_code: 'AAA' }),
      device({ k_number: 'K6', product_code: 'AAA' }),
    ];

    const search = vi
      .fn()
      .mockResolvedValueOnce(page(tier1)) // tier 1: device_name
      .mockResolvedValue(page(tier2)); // tier 2: product_code re-search

    const client = { search, paginate: vi.fn() };
    const cascade = createCascadeSearch(client as never);

    const result = await cascade.search('Infusion Pump', env);

    // Tier 1 must query by device_name.
    expect(search.mock.calls[0][0]).toMatchObject({ device_name: 'Infusion Pump' });
    // Tier 2 must re-search by the most frequent product_code (AAA).
    const productSearches = search.mock.calls
      .slice(1)
      .map((c) => c[0]?.product_code)
      .filter(Boolean);
    expect(productSearches).toContain('AAA');
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it('falls back to a tier-3 panel search when no product_codes are found', async () => {
    // Tier 1 yields devices with no product_code, and too few candidates.
    const tier1 = [device({ k_number: 'K1', product_code: '' })];
    const tier3 = [
      device({ k_number: 'P1' }),
      device({ k_number: 'P2' }),
      device({ k_number: 'P3' }),
      device({ k_number: 'P4' }),
      device({ k_number: 'P5' }),
      device({ k_number: 'P6' }),
    ];

    const search = vi
      .fn()
      .mockResolvedValueOnce(page(tier1)) // tier 1
      .mockResolvedValue(page(tier3)); // tier 3 panel fallback

    const client = { search, paginate: vi.fn() };
    const cascade = createCascadeSearch(client as never);

    const result = await cascade.search('Rare Device', env);

    // A panel search must have been issued as the fallback.
    const panelSearches = search.mock.calls.filter((c) => c[0]?.panel);
    expect(panelSearches.length).toBeGreaterThan(0);
    expect(result.search_strategy).toBe('panel');
  });
});

describe('createCascadeSearch — Vectorize rerank (REQ-PRE-006)', () => {
  it('returns the top-5 candidates by Vectorize score', async () => {
    const found = Array.from({ length: 8 }, (_, i) =>
      device({ k_number: `K${i}`, product_code: 'AAA' }),
    );
    const search = vi.fn().mockResolvedValue(page(found));
    const client = { search, paginate: vi.fn() };

    // Rank K7 highest, K0 lowest, so rerank order differs from input order.
    const retriever = makeRetriever(found.map((d, i) => ({ id: d.k_number, score: (i + 1) / 8 })));

    const cascade = createCascadeSearch(client as never, retriever as never);
    const result = await cascade.search('Infusion Pump', env);

    expect(result.candidates).toHaveLength(5);
    // Highest score (K7) should rank first.
    expect(result.candidates[0]?.k_number).toBe('K7');
  });

  it('falls back to recency sort (decision_date desc) when Vectorize returns empty', async () => {
    const found = [
      device({ k_number: 'OLD', product_code: 'AAA', decision_date: '2010-01-01' }),
      device({ k_number: 'NEW', product_code: 'AAA', decision_date: '2022-12-31' }),
      device({ k_number: 'MID', product_code: 'AAA', decision_date: '2016-06-15' }),
    ];
    const search = vi.fn().mockResolvedValue(page(found));
    const client = { search, paginate: vi.fn() };

    const retriever = makeRetriever([]); // empty rerank → recency fallback

    const cascade = createCascadeSearch(client as never, retriever as never);
    const result = await cascade.search('Infusion Pump', env);

    expect(result.candidates[0]?.k_number).toBe('NEW');
    expect(result.candidates[result.candidates.length - 1]?.k_number).toBe('OLD');
  });

  it('falls back to recency sort when no Vectorize retriever is supplied', async () => {
    const found = [
      device({ k_number: 'OLD', product_code: 'AAA', decision_date: '2009-01-01' }),
      device({ k_number: 'NEW', product_code: 'AAA', decision_date: '2021-01-01' }),
    ];
    const search = vi.fn().mockResolvedValue(page(found));
    const client = { search, paginate: vi.fn() };

    const cascade = createCascadeSearch(client as never);
    const result = await cascade.search('Infusion Pump', env);

    expect(result.candidates[0]?.k_number).toBe('NEW');
  });
});

describe('createCascadeSearch — coverage-gap notice (REQ-PRE-007)', () => {
  it('flags has_coverage_gap when any result predates 2004-01-01', async () => {
    const found = [
      device({ k_number: 'K1', product_code: 'AAA', decision_date: '2001-05-01' }),
      device({ k_number: 'K2', product_code: 'AAA', decision_date: '2020-05-01' }),
      device({ k_number: 'K3', product_code: 'AAA', decision_date: '2019-05-01' }),
      device({ k_number: 'K4', product_code: 'AAA', decision_date: '2018-05-01' }),
      device({ k_number: 'K5', product_code: 'AAA', decision_date: '2017-05-01' }),
      device({ k_number: 'K6', product_code: 'AAA', decision_date: '2016-05-01' }),
      device({ k_number: 'K7', product_code: 'AAA', decision_date: '2015-05-01' }),
      device({ k_number: 'K8', product_code: 'AAA', decision_date: '2014-05-01' }),
      device({ k_number: 'K9', product_code: 'AAA', decision_date: '2013-05-01' }),
      device({ k_number: 'K10', product_code: 'AAA', decision_date: '2012-05-01' }),
      device({ k_number: 'K11', product_code: 'AAA', decision_date: '2011-05-01' }),
    ];
    const search = vi.fn().mockResolvedValue(page(found, found.length));
    const client = { search, paginate: vi.fn() };

    const cascade = createCascadeSearch(client as never);
    const result = await cascade.search('Infusion Pump', env);

    expect(result.has_coverage_gap).toBe(true);
  });

  it('flags has_coverage_gap when total results are below 10', async () => {
    const found = [
      device({ k_number: 'K1', product_code: 'AAA', decision_date: '2020-01-01' }),
      device({ k_number: 'K2', product_code: 'AAA', decision_date: '2019-01-01' }),
    ];
    const search = vi.fn().mockResolvedValue(page(found, found.length));
    const client = { search, paginate: vi.fn() };

    const cascade = createCascadeSearch(client as never);
    const result = await cascade.search('Infusion Pump', env);

    expect(result.has_coverage_gap).toBe(true);
  });

  it('does not flag a coverage gap for a large, modern result set', async () => {
    const found = Array.from({ length: 12 }, (_, i) =>
      device({ k_number: `K${i}`, product_code: 'AAA', decision_date: '2020-01-01' }),
    );
    const search = vi.fn().mockResolvedValue(page(found, 30));
    const client = { search, paginate: vi.fn() };

    const cascade = createCascadeSearch(client as never);
    const result = await cascade.search('Infusion Pump', env);

    expect(result.has_coverage_gap).toBe(false);
  });
});
