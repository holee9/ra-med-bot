// @MX:NOTE [AUTO] Gate 5 operations readiness helper script.
// @MX:SPEC SPEC-REGULA-QA-OPERATIONS-001 (REQ-G5-001 through REQ-G5-008)
//
// Parses pre-deployment health check results, validates synthetic query
// pass counts, and generates the ops readiness report written to
// .moai/qa/ops/<wave>-ops-report.md after a successful RC deployment.
//
// All functions are pure (no I/O) and unit-testable in isolation.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HealthCheckResult {
  db: boolean;
  tunnel: boolean;
  audit: boolean;
  llm: boolean;
  passed: boolean;
}

export interface SyntheticQueryCounts {
  passed: number;
  failed: number;
  total: number;
}

export interface OpsReadinessReportOpts {
  wave: string;
  deployTimestamp: string;
  healthCheck: HealthCheckResult;
  syntheticQueryResults: SyntheticQueryCounts;
  latencyP95Ms: number;
  errorRate: number;
  costPerQuery: number;
  rollbackTested: boolean;
  auditRetentionVerified: boolean;
}

// ---------------------------------------------------------------------------
// parseHealthCheckResults
// ---------------------------------------------------------------------------

/**
 * Parse a health check output string into a HealthCheckResult.
 *
 * Supports the canonical format produced by the deployment health check
 * script, e.g.:
 *   "DB: OK, Tunnel: OK, Audit: OK, LLM: OK"
 *
 * Any component that is not "OK" (case-insensitive) is treated as failed.
 * `passed` is true only when all four components pass.
 */
// @MX:ANCHOR [AUTO] Public API boundary for health check parsing — callers: gate-5 CLI, ops report generator, unit tests.
// @MX:REASON fan_in >= 3
export function parseHealthCheckResults(output: string): HealthCheckResult {
  const parse = (key: string): boolean => {
    const match = new RegExp(`${key}:\\s*(\\w+)`, 'i').exec(output);
    return match?.[1]?.toUpperCase() === 'OK';
  };

  const db = parse('DB');
  const tunnel = parse('Tunnel');
  const audit = parse('Audit');
  const llm = parse('LLM');
  const passed = db && tunnel && audit && llm;

  return { db, tunnel, audit, llm, passed };
}

// ---------------------------------------------------------------------------
// checkSyntheticQueries
// ---------------------------------------------------------------------------

/**
 * Count pass/fail outcomes for the 5 canonical synthetic queries.
 *
 * @param results - Array of result strings. Each entry is either "PASS" or
 *   anything else (treated as "FAIL").
 * @returns SyntheticQueryCounts — total is always `results.length`.
 *   Gate 5 requires total === 5 AND passed === 5 for PASS status.
 */
export function checkSyntheticQueries(results: string[]): SyntheticQueryCounts {
  const passed = results.filter((r) => r.trim().toUpperCase() === 'PASS').length;
  const total = results.length;
  const failed = total - passed;
  return { passed, failed, total };
}

// ---------------------------------------------------------------------------
// generateOpsReadinessReport
// ---------------------------------------------------------------------------

const QUALITY_THRESHOLDS = {
  latencyP95MaxMs: 3000,
  errorRateMax: 0.01,
  costPerQueryMax: 0.05,
};

function statusIcon(ok: boolean): string {
  return ok ? 'PASS' : 'FAIL';
}

/**
 * Generate a Markdown ops readiness report for .moai/qa/ops/<wave>-ops-report.md.
 *
 * The report is self-contained: it records the wave, timestamp, health check
 * results, synthetic query outcomes, quality metrics baseline, and an overall
 * PASS/FAIL verdict.
 */
// @MX:ANCHOR [AUTO] Public API boundary for ops report generation — callers: gate-5 CLI, CI pipeline, unit tests.
// @MX:REASON fan_in >= 3
export function generateOpsReadinessReport(opts: OpsReadinessReportOpts): string {
  const {
    wave,
    deployTimestamp,
    healthCheck,
    syntheticQueryResults,
    latencyP95Ms,
    errorRate,
    costPerQuery,
    rollbackTested,
    auditRetentionVerified,
  } = opts;

  const syntheticAllPass = syntheticQueryResults.total === 5 && syntheticQueryResults.passed === 5;
  const latencyOk = latencyP95Ms <= QUALITY_THRESHOLDS.latencyP95MaxMs;
  const errorRateOk = errorRate <= QUALITY_THRESHOLDS.errorRateMax;
  const costOk = costPerQuery <= QUALITY_THRESHOLDS.costPerQueryMax;

  const metricsPass = latencyOk && errorRateOk && costOk;
  const overallPass =
    healthCheck.passed &&
    syntheticAllPass &&
    metricsPass &&
    rollbackTested &&
    auditRetentionVerified;

  const overallStatus = overallPass ? 'PASS' : 'FAIL';

  const lines: string[] = [
    '# Gate 5 — Operations Readiness Report',
    '',
    `**Wave:** ${wave}`,
    `**Deploy Timestamp:** ${deployTimestamp}`,
    `**Overall Status:** ${overallStatus}`,
    '',
    '---',
    '',
    '## Health Check',
    '',
    '| Component | Status |',
    '|-----------|--------|',
    `| DB        | ${statusIcon(healthCheck.db)} |`,
    `| Tunnel    | ${statusIcon(healthCheck.tunnel)} |`,
    `| Audit     | ${statusIcon(healthCheck.audit)} |`,
    `| LLM       | ${statusIcon(healthCheck.llm)} |`,
    `| **All**   | **${statusIcon(healthCheck.passed)}** |`,
    '',
    '---',
    '',
    '## Synthetic Queries (5 canonical)',
    '',
    '| Result | Count |',
    '|--------|-------|',
    `| Passed | ${syntheticQueryResults.passed} |`,
    `| Failed | ${syntheticQueryResults.failed} |`,
    `| Total  | ${syntheticQueryResults.total} |`,
    `| **Status** | **${statusIcon(syntheticAllPass)}** |`,
    '',
    '---',
    '',
    '## Quality Metrics Baseline',
    '',
    '| Metric | Value | Threshold | Status |',
    '|--------|-------|-----------|--------|',
    `| Latency P95 (ms) | ${latencyP95Ms} | ≤${QUALITY_THRESHOLDS.latencyP95MaxMs} | ${statusIcon(latencyOk)} |`,
    `| Error Rate | ${(errorRate * 100).toFixed(2)}% | ≤${(QUALITY_THRESHOLDS.errorRateMax * 100).toFixed(0)}% | ${statusIcon(errorRateOk)} |`,
    `| Cost per Query (USD) | $${costPerQuery.toFixed(4)} | ≤$${QUALITY_THRESHOLDS.costPerQueryMax.toFixed(2)} | ${statusIcon(costOk)} |`,
    '',
    '---',
    '',
    '## Operational Checks',
    '',
    '| Check | Status |',
    '|-------|--------|',
    `| Rollback procedure tested | ${statusIcon(rollbackTested)} |`,
    `| Audit retention verified  | ${statusIcon(auditRetentionVerified)} |`,
    '',
    '---',
    '',
    '## Verdict',
    '',
    `**${overallStatus}**`,
    '',
    overallPass
      ? `All Gate 5 criteria satisfied. System is operations-ready for wave ${wave}.`
      : 'One or more Gate 5 criteria failed. Resolve all FAIL items before proceeding.',
  ];

  return lines.join('\n');
}

import path from 'node:path';
// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
import { fileURLToPath } from 'node:url';

const isDirectRun =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  process.stdout.write('gate-5-ops-readiness: use this module programmatically or via CI.\n');
  process.stdout.write('See generateOpsReadinessReport() for the main report generator.\n');
}
