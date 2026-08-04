// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/pccp/templates/metrics-library (SPEC-REGULA-PCCP-001).
// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-003)

import { describe, expect, it } from 'vitest';
import { PERFORMANCE_METRICS_LIBRARY, getMetricById } from '../metrics-library';

describe('metrics-library (SPEC-REGULA-PCCP-001)', () => {
  it('exposes a non-empty library of SPS performance metrics', () => {
    expect(PERFORMANCE_METRICS_LIBRARY.length).toBeGreaterThan(0);
    for (const m of PERFORMANCE_METRICS_LIBRARY) {
      expect(typeof m.id).toBe('string');
      expect(typeof m.name).toBe('string');
      expect(typeof m.unit).toBe('string');
    }
  });

  it('getMetricById returns the metric for a known id', () => {
    const first = PERFORMANCE_METRICS_LIBRARY[0];
    if (!first) throw new Error('library empty');
    expect(getMetricById(first.id)).toBe(first);
  });

  it('getMetricById returns undefined for an unknown id', () => {
    expect(getMetricById('does-not-exist')).toBeUndefined();
  });

  it('every metric id is unique', () => {
    const ids = PERFORMANCE_METRICS_LIBRARY.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
