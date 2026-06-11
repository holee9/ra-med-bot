// @vitest-environment node
// Unit tests for predicate type definitions and Zod schemas — SPEC-REGULA-PREDICATE-001 (REQ-PRE-001).

import { describe, expect, it } from 'vitest';
import {
  type CascadeSearchResult,
  type ComparisonCell,
  type ComparisonDimension,
  OpenFDADeviceSchema,
  OpenFDASearchParamsSchema,
  type PredicateCandidate,
  type PredicateComparison,
  RateLimitConfigSchema,
} from '../types';

describe('OpenFDADeviceSchema', () => {
  const valid = {
    k_number: 'K123456',
    applicant_name: 'Acme Medical',
    device_name: 'Acme Catheter',
    decision_date: '2023-01-15',
    decision: 'SESE',
    product_code: 'ABC',
    statement_or_summary: 'Summary',
    device_description: 'A catheter device',
  };

  it('parses a valid openFDA device record', () => {
    const result = OpenFDADeviceSchema.parse(valid);
    expect(result.k_number).toBe('K123456');
    expect(result.device_name).toBe('Acme Catheter');
  });

  it('rejects a record missing the required k_number', () => {
    const { k_number, ...invalid } = valid;
    expect(() => OpenFDADeviceSchema.parse(invalid)).toThrow();
  });

  it('rejects a record where device_name is not a string', () => {
    expect(() => OpenFDADeviceSchema.parse({ ...valid, device_name: 42 })).toThrow();
  });
});

describe('OpenFDASearchParamsSchema', () => {
  it('parses params with only device_name set', () => {
    const result = OpenFDASearchParamsSchema.parse({ device_name: 'catheter' });
    expect(result.device_name).toBe('catheter');
  });

  it('parses empty params (all fields optional)', () => {
    const result = OpenFDASearchParamsSchema.parse({});
    expect(result).toEqual({});
  });

  it('rejects a negative limit', () => {
    expect(() => OpenFDASearchParamsSchema.parse({ limit: -1 })).toThrow();
  });
});

describe('RateLimitConfigSchema', () => {
  it('parses a config with requests_per_minute', () => {
    const result = RateLimitConfigSchema.parse({ requests_per_minute: 240 });
    expect(result.requests_per_minute).toBe(240);
  });

  it('parses a config with an optional api_key', () => {
    const result = RateLimitConfigSchema.parse({ requests_per_minute: 1000, api_key: 'abc' });
    expect(result.api_key).toBe('abc');
  });

  it('rejects a config without requests_per_minute', () => {
    expect(() => RateLimitConfigSchema.parse({})).toThrow();
  });
});

describe('TypeScript type contracts', () => {
  it('PredicateCandidate extends OpenFDADevice with optional rerank_score', () => {
    const candidate: PredicateCandidate = {
      k_number: 'K999999',
      applicant_name: 'Beta Corp',
      device_name: 'Beta Stent',
      decision_date: '2022-06-01',
      decision: 'SESE',
      product_code: 'XYZ',
      statement_or_summary: 'Summary',
      device_description: 'A stent',
      rerank_score: 0.92,
    };
    expect(candidate.rerank_score).toBe(0.92);
  });

  it('CascadeSearchResult carries strategy + cached flags', () => {
    const result: CascadeSearchResult = {
      candidates: [],
      total: 0,
      search_strategy: 'device_name',
      cached: false,
      has_coverage_gap: false,
    };
    expect(result.search_strategy).toBe('device_name');
    expect(result.cached).toBe(false);
  });

  it('ComparisonCell uses a valid ComparisonDimension', () => {
    const dim: ComparisonDimension = 'intended_use';
    const cell: ComparisonCell = {
      dimension: dim,
      subject_text: 'Used for X',
      predicate_texts: ['Used for X too'],
      approved: [true],
    };
    expect(cell.dimension).toBe('intended_use');
    expect(cell.approved).toEqual([true]);
  });

  it('PredicateComparison aggregates cells and predicates', () => {
    const comparison: PredicateComparison = {
      subject_device_name: 'Subject Device',
      selected_predicates: [],
      cells: [],
      created_at: new Date('2026-01-01'),
    };
    expect(comparison.subject_device_name).toBe('Subject Device');
    expect(comparison.created_at).toBeInstanceOf(Date);
  });
});
