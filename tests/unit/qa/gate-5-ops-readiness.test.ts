// @MX:NOTE [AUTO] Gate 5 operations readiness unit tests.
// @MX:SPEC SPEC-REGULA-QA-OPERATIONS-001 (REQ-G5-001 through REQ-G5-008)

import { describe, expect, it } from 'vitest';
import {
  checkSyntheticQueries,
  generateOpsReadinessReport,
  parseHealthCheckResults,
} from '../../../scripts/qa/gate-5-ops-readiness';

// ---------------------------------------------------------------------------
// parseHealthCheckResults
// ---------------------------------------------------------------------------

describe('parseHealthCheckResults', () => {
  it('parses all-OK output as fully passing', () => {
    const result = parseHealthCheckResults('DB: OK, Tunnel: OK, Audit: OK, LLM: OK');
    expect(result).toEqual({ db: true, tunnel: true, audit: true, llm: true, passed: true });
  });

  it('marks db false when DB is FAIL', () => {
    const result = parseHealthCheckResults('DB: FAIL, Tunnel: OK, Audit: OK, LLM: OK');
    expect(result.db).toBe(false);
    expect(result.passed).toBe(false);
  });

  it('marks tunnel false when Tunnel is DOWN', () => {
    const result = parseHealthCheckResults('DB: OK, Tunnel: DOWN, Audit: OK, LLM: OK');
    expect(result.tunnel).toBe(false);
    expect(result.passed).toBe(false);
  });

  it('marks audit false when Audit is ERROR', () => {
    const result = parseHealthCheckResults('DB: OK, Tunnel: OK, Audit: ERROR, LLM: OK');
    expect(result.audit).toBe(false);
    expect(result.passed).toBe(false);
  });

  it('marks llm false when LLM is UNAVAILABLE', () => {
    const result = parseHealthCheckResults('DB: OK, Tunnel: OK, Audit: OK, LLM: UNAVAILABLE');
    expect(result.llm).toBe(false);
    expect(result.passed).toBe(false);
  });

  it('returns all false for empty output', () => {
    const result = parseHealthCheckResults('');
    expect(result).toEqual({ db: false, tunnel: false, audit: false, llm: false, passed: false });
  });

  it('is case-insensitive for OK value', () => {
    const result = parseHealthCheckResults('DB: ok, Tunnel: Ok, Audit: oK, LLM: OK');
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkSyntheticQueries
// ---------------------------------------------------------------------------

describe('checkSyntheticQueries', () => {
  it('returns 5 passed 0 failed when all 5 pass', () => {
    const counts = checkSyntheticQueries(['PASS', 'PASS', 'PASS', 'PASS', 'PASS']);
    expect(counts).toEqual({ passed: 5, failed: 0, total: 5 });
  });

  it('returns correct counts when 1 query fails', () => {
    const counts = checkSyntheticQueries(['PASS', 'PASS', 'PASS', 'PASS', 'FAIL']);
    expect(counts).toEqual({ passed: 4, failed: 1, total: 5 });
  });

  it('counts non-PASS strings as failed', () => {
    const counts = checkSyntheticQueries(['PASS', 'ERROR', 'TIMEOUT', 'PASS', 'FAIL']);
    expect(counts).toEqual({ passed: 2, failed: 3, total: 5 });
  });

  it('returns all failed for 5 FAIL entries', () => {
    const counts = checkSyntheticQueries(['FAIL', 'FAIL', 'FAIL', 'FAIL', 'FAIL']);
    expect(counts).toEqual({ passed: 0, failed: 5, total: 5 });
  });

  it('is case-insensitive — "pass" counts as PASS', () => {
    const counts = checkSyntheticQueries(['pass', 'PASS', 'Pass', 'PASS', 'PASS']);
    expect(counts.passed).toBe(5);
  });

  it('trims whitespace from result strings', () => {
    const counts = checkSyntheticQueries([' PASS ', '  PASS  ', 'PASS', 'PASS', 'PASS']);
    expect(counts.passed).toBe(5);
  });

  it('handles empty array (edge case — gate fails regardless)', () => {
    const counts = checkSyntheticQueries([]);
    expect(counts).toEqual({ passed: 0, failed: 0, total: 0 });
  });
});

// ---------------------------------------------------------------------------
// generateOpsReadinessReport
// ---------------------------------------------------------------------------

const BASE_HEALTH_OK = { db: true, tunnel: true, audit: true, llm: true, passed: true };
const BASE_SYNTHETIC_OK = { passed: 5, failed: 0, total: 5 };

function makeOpts(overrides: Partial<Parameters<typeof generateOpsReadinessReport>[0]> = {}) {
  return {
    wave: 'wave-3',
    deployTimestamp: '2026-06-21T09:00:00Z',
    healthCheck: BASE_HEALTH_OK,
    syntheticQueryResults: BASE_SYNTHETIC_OK,
    latencyP95Ms: 1200,
    errorRate: 0.005,
    costPerQuery: 0.03,
    rollbackTested: true,
    auditRetentionVerified: true,
    ...overrides,
  };
}

describe('generateOpsReadinessReport', () => {
  it('contains the wave name', () => {
    const report = generateOpsReadinessReport(makeOpts({ wave: 'wave-3' }));
    expect(report).toContain('wave-3');
  });

  it('contains the deploy timestamp', () => {
    const report = generateOpsReadinessReport(
      makeOpts({ deployTimestamp: '2026-06-21T09:00:00Z' }),
    );
    expect(report).toContain('2026-06-21T09:00:00Z');
  });

  it('shows PASS verdict when all criteria are met', () => {
    const report = generateOpsReadinessReport(makeOpts());
    expect(report).toContain('Overall Status:** PASS');
    expect(report).toContain('## Verdict');
    expect(report).toContain('operations-ready');
  });

  it('shows FAIL verdict when health check fails', () => {
    const report = generateOpsReadinessReport(
      makeOpts({ healthCheck: { db: false, tunnel: true, audit: true, llm: true, passed: false } }),
    );
    expect(report).toContain('Overall Status:** FAIL');
  });

  it('shows FAIL verdict when synthetic queries are incomplete (4/5)', () => {
    const report = generateOpsReadinessReport(
      makeOpts({ syntheticQueryResults: { passed: 4, failed: 1, total: 5 } }),
    );
    expect(report).toContain('Overall Status:** FAIL');
  });

  it('shows FAIL verdict when latency exceeds threshold', () => {
    const report = generateOpsReadinessReport(makeOpts({ latencyP95Ms: 4000 }));
    expect(report).toContain('Overall Status:** FAIL');
    expect(report).toContain('FAIL');
  });

  it('shows FAIL verdict when rollback not tested', () => {
    const report = generateOpsReadinessReport(makeOpts({ rollbackTested: false }));
    expect(report).toContain('Overall Status:** FAIL');
  });

  it('shows FAIL verdict when audit retention not verified', () => {
    const report = generateOpsReadinessReport(makeOpts({ auditRetentionVerified: false }));
    expect(report).toContain('Overall Status:** FAIL');
  });

  it('includes health check table with all four components', () => {
    const report = generateOpsReadinessReport(makeOpts());
    expect(report).toContain('## Health Check');
    expect(report).toContain('DB');
    expect(report).toContain('Tunnel');
    expect(report).toContain('Audit');
    expect(report).toContain('LLM');
  });

  it('includes synthetic query counts in report', () => {
    const report = generateOpsReadinessReport(
      makeOpts({ syntheticQueryResults: { passed: 5, failed: 0, total: 5 } }),
    );
    expect(report).toContain('## Synthetic Queries');
    expect(report).toContain('| Passed | 5 |');
    expect(report).toContain('| Failed | 0 |');
    expect(report).toContain('| Total  | 5 |');
  });

  it('includes quality metrics baseline section', () => {
    const report = generateOpsReadinessReport(
      makeOpts({ latencyP95Ms: 1200, errorRate: 0.005, costPerQuery: 0.03 }),
    );
    expect(report).toContain('## Quality Metrics Baseline');
    expect(report).toContain('1200');
    expect(report).toContain('0.50%');
    expect(report).toContain('$0.0300');
  });

  it('reflects DB FAIL in health table', () => {
    const report = generateOpsReadinessReport(
      makeOpts({ healthCheck: { db: false, tunnel: true, audit: true, llm: true, passed: false } }),
    );
    expect(report).toMatch(/DB\s+\|\s+FAIL/);
  });
});
