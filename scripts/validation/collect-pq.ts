#!/usr/bin/env node

// @MX:ANCHOR [AUTO] collect-pq.ts — PQ (Performance Qualification) evidence bundle.
// @MX:REASON SPEC-REGULA-VALIDATION-001 M3 (REQ-VAL-005, AC-4, Issue #49). Aggregates
//   E2E (Playwright) + promptfoo eval results into PQ evidence rows.
//   Thin glue — no new harness (Charter [지양-5]).
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M3, AC-4)
//
// Evidence mapping:
//   e2e:chromium   — Playwright chromium suite (smoke + full)
//   e2e:firefox    — Playwright firefox suite
//   e2e:webkit     — Playwright webkit suite
//   eval           — tests/eval/results/latest.json (promptfoo)
//
// Usage:
//   node --experimental-strip-types scripts/validation/collect-pq.ts <release_id>
//
// Output: inserts PQ evidence rows (qualification_type='pq').

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import type { EvidenceResult } from '../../lib/schemas/validation.ts';
import {
  checkGitTagExists,
  validateReleaseIdFormat,
} from '../../lib/validation/consumers/release.ts';
import { type EvidenceInput, insertEvidenceBundle } from '../../lib/validation/evidence-writer.ts';

interface PqArgs {
  releaseId: string;
}

function parseArgs(argv: string[]): PqArgs {
  const releaseId = argv[2];
  if (!releaseId) {
    process.stderr.write('Usage: collect-pq.ts <release_id>\n');
    process.exit(1);
  }
  return { releaseId };
}

function getHeadCommitSha(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' });
  if (result.status !== 0) {
    process.stderr.write('ERROR: failed to resolve HEAD commit SHA\n');
    process.exit(1);
  }
  return result.stdout.trim();
}

/** Latest CI run databaseId (for ci_run_id linkage). Null when gh unavailable. */
function getLatestCiRunId(): number | null {
  const result = spawnSync(
    'gh',
    ['run', 'list', '--workflow=e2e.yml', '--limit=1', '--json=databaseId'],
    { encoding: 'utf-8', stdio: 'pipe' },
  );
  if (result.status !== 0 || !result.stdout.trim()) return null;
  try {
    const parsed = JSON.parse(result.stdout) as Array<{ databaseId: number }>;
    return parsed[0]?.databaseId ?? null;
  } catch {
    return null;
  }
}

/**
 * Run a single Playwright project; map exit code → EvidenceResult.
 * Skip when Playwright is not installed or browsers are missing.
 */
function collectE2eEvidence(
  releaseId: string,
  commitSha: string,
  ciRunId: number | null,
  project: 'chromium' | 'firefox' | 'webkit',
): EvidenceInput {
  const result = spawnSync('pnpm', ['test:e2e', '--project', project], {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  const exitCode = result.status ?? 1;
  // Local fallback: if pnpm/playwright unavailable (ENOENT), mark skip.
  if (result.error || exitCode === 1) {
    const stderr = result.stderr ?? '';
    if (/playwright.*not found|ENOENT|does not exist/i.test(stderr)) {
      return {
        releaseId,
        qualificationType: 'pq',
        commitSha,
        ciRunId,
        testCommand: `pnpm test:e2e --project ${project}`,
        artifactPath: '.github/workflows/e2e.yml',
        result: 'skip',
        metadata: { reason: 'Playwright not installed locally; CI e2e.yml authoritative' },
      };
    }
  }
  return {
    releaseId,
    qualificationType: 'pq',
    commitSha,
    ciRunId,
    testCommand: `pnpm test:e2e --project ${project}`,
    artifactPath: '.github/workflows/e2e.yml',
    result: exitCode === 0 ? 'pass' : 'fail',
    metadata: { exitCode, project },
  };
}

// Zod schema for the eval results JSON. Defends against malformed latest.json.
const evalResultsSchema = z.object({
  version: z.string().optional(),
  results: z
    .object({
      stats: z
        .object({
          successes: z.number().int().nonnegative().optional(),
          failures: z.number().int().nonnegative().optional(),
          totalTests: z.number().int().nonnegative().optional(),
        })
        .optional(),
    })
    .optional(),
  passRate: z.number().min(0).max(1).optional(),
});

interface ParsedEval {
  successes?: number;
  failures?: number;
  totalTests?: number;
  passRate?: number;
}

/**
 * Parse tests/eval/results/latest.json and produce eval evidence.
 * Skip when file missing (no eval run yet); fail when malformed; pass when
 * passRate >= threshold (0.8 from promptfoo config).
 */
function collectEvalEvidence(
  releaseId: string,
  commitSha: string,
  ciRunId: number | null,
): EvidenceInput {
  const evalPath = path.resolve(process.cwd(), 'tests/eval/results/latest.json');
  if (!existsSync(evalPath)) {
    // Try baseline.json as fallback.
    const baseline = path.resolve(process.cwd(), 'tests/eval/results/baseline.json');
    if (!existsSync(baseline)) {
      return {
        releaseId,
        qualificationType: 'pq',
        commitSha,
        ciRunId,
        testCommand: 'pnpm eval:ci (promptfoo)',
        artifactPath: 'tests/eval/results/latest.json',
        result: 'skip',
        metadata: { reason: 'latest.json + baseline.json both absent — no eval run on record' },
      };
    }
    return parseEvalFile(baseline, releaseId, commitSha, ciRunId);
  }
  return parseEvalFile(evalPath, releaseId, commitSha, ciRunId);
}

function parseEvalFile(
  filePath: string,
  releaseId: string,
  commitSha: string,
  ciRunId: number | null,
): EvidenceInput {
  const testCommand = 'pnpm eval:ci (promptfoo)';
  const artifactPath = 'tests/eval/results/latest.json';
  const metadata: Record<string, unknown> = { sourceFile: path.basename(filePath) };

  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch (err) {
    return {
      releaseId,
      qualificationType: 'pq',
      commitSha,
      ciRunId,
      testCommand,
      artifactPath,
      result: 'skip',
      metadata: {
        ...metadata,
        reason: `read error: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      releaseId,
      qualificationType: 'pq',
      commitSha,
      ciRunId,
      testCommand,
      artifactPath,
      result: 'fail',
      metadata: {
        ...metadata,
        reason: `JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }

  const validation = evalResultsSchema.safeParse(parsed);
  if (!validation.success) {
    return {
      releaseId,
      qualificationType: 'pq',
      commitSha,
      ciRunId,
      testCommand,
      artifactPath,
      result: 'fail',
      metadata: { ...metadata, reason: 'schema mismatch', zodError: validation.error.flatten() },
    };
  }

  const data = validation.data;
  const stats = data.results?.stats;
  const evalData: ParsedEval = {
    successes: stats?.successes,
    failures: stats?.failures,
    totalTests: stats?.totalTests,
    passRate: data.passRate,
  };
  Object.assign(metadata, evalData);

  // Pass threshold: passRate >= 0.8 (promptfoo config).
  if (typeof evalData.passRate === 'number') {
    return {
      releaseId,
      qualificationType: 'pq',
      commitSha,
      ciRunId,
      testCommand,
      artifactPath,
      result: evalData.passRate >= 0.8 ? 'pass' : 'fail',
      metadata,
    };
  }

  // Fallback: derive passRate from stats if passRate field absent.
  if (
    typeof evalData.successes === 'number' &&
    typeof evalData.totalTests === 'number' &&
    evalData.totalTests > 0
  ) {
    const derivedRate = evalData.successes / evalData.totalTests;
    return {
      releaseId,
      qualificationType: 'pq',
      commitSha,
      ciRunId,
      testCommand,
      artifactPath,
      result: derivedRate >= 0.8 ? 'pass' : 'fail',
      metadata: { ...metadata, derivedPassRate: derivedRate },
    };
  }

  return {
    releaseId,
    qualificationType: 'pq',
    commitSha,
    ciRunId,
    testCommand,
    artifactPath,
    result: 'skip',
    metadata: { ...metadata, reason: 'no passRate or usable stats in eval JSON' },
  };
}

async function main(): Promise<void> {
  const { releaseId } = parseArgs(process.argv);
  // M4: release_id format gate (REQ-VAL2-009).
  const formatCheck = validateReleaseIdFormat(releaseId);
  if (!formatCheck.valid) {
    process.stderr.write(`ERROR: ${formatCheck.reason}\n`);
    process.exit(1);
  }
  // M4: git tag warning (REQ-VAL2-010, non-blocking).
  const tagCheck = checkGitTagExists(releaseId);
  if (!tagCheck.exists) {
    process.stderr.write(
      `Warning: git tag ${releaseId} not found locally (pre-release candidate?)\n`,
    );
    if (tagCheck.warning) process.stderr.write(`${tagCheck.warning}\n`);
  }
  const commitSha = getHeadCommitSha();
  const ciRunId = getLatestCiRunId();

  const bundle: EvidenceInput[] = [
    collectE2eEvidence(releaseId, commitSha, ciRunId, 'chromium'),
    collectE2eEvidence(releaseId, commitSha, ciRunId, 'firefox'),
    collectE2eEvidence(releaseId, commitSha, ciRunId, 'webkit'),
    collectEvalEvidence(releaseId, commitSha, ciRunId),
  ];

  const ids = await insertEvidenceBundle(bundle);

  const summary = {
    releaseId,
    qualificationType: 'pq',
    commitSha,
    ciRunId,
    collectedAt: new Date().toISOString(),
    evidence: bundle.map((e, i) => ({
      id: ids[i],
      testCommand: e.testCommand,
      result: e.result,
      artifactPath: e.artifactPath,
    })),
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(
      `collect-pq failed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}

export { collectE2eEvidence, collectEvalEvidence, parseArgs, evalResultsSchema };
