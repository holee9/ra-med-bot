#!/usr/bin/env tsx
// @MX:NOTE [AUTO] model-gov-eval-gate.ts — promptfoo release gate (REQ-MODELGOV-010/011, AC-04).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-010/011)
// @MX:REASON CI gate script. Runs AFTER `pnpm eval:ci` (which writes
//           tests/eval/results/latest.json). Reads the result, enforces the
//           threshold, and exits non-zero on miss so the release gate fails.
//           Mirrors checkEvalThreshold() in lib/model-governance/eval-gate.ts
//           but as a standalone CLI so CI can invoke it without a test runner.
//
// Usage: tsx scripts/qa/model-gov-eval-gate.ts [result-json-path] [threshold]

import fs from 'node:fs';
import { DEFAULT_EVAL_THRESHOLD, checkEvalThreshold } from '../../lib/model-governance/eval-gate';

const resultPath = process.argv[2] ?? 'tests/eval/results/latest.json';
const thresholdArg = process.argv[3];
const threshold = thresholdArg ? Number.parseFloat(thresholdArg) : DEFAULT_EVAL_THRESHOLD;

function main(): void {
  if (!fs.existsSync(resultPath)) {
    // REQ-011: missing result file → fail closed. CI runs eval:ci before this
    // gate; a missing file means the eval never ran (e.g., skipped on missing
    // secret). Treat as a gate failure so a silent skip cannot ship unvalidated.
    console.error(`[model-gov-eval-gate] FAIL: result file not found: ${resultPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(resultPath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(`[model-gov-eval-gate] FAIL: invalid JSON in ${resultPath}`);
    process.exit(1);
  }

  const result = checkEvalThreshold(parsed, { threshold });
  const pct = `${(result.score * 100).toFixed(1)}%`;
  const thresholdPct = `${(result.threshold * 100).toFixed(1)}%`;

  if (result.passed) {
    // biome-ignore lint/suspicious/noConsole: CI QA gate script — PASS message on stdout is intentional for release gate diagnostics (mirrors scripts/health-check.ts pattern).
    console.log(`[model-gov-eval-gate] PASS: score ${pct} >= threshold ${thresholdPct}`);
    process.exit(0);
  }

  console.error(
    `[model-gov-eval-gate] FAIL: score ${pct} < threshold ${thresholdPct} (${result.reason})`,
  );
  process.exit(1);
}

main();
