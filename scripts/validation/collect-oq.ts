#!/usr/bin/env node

// @MX:ANCHOR [AUTO] collect-oq.ts — OQ (Operational Qualification) evidence aggregator.
// @MX:REASON SPEC-REGULA-VALIDATION-001 M2 (REQ-VAL-004, AC-3, Issue #49). Aggregates
//   CI run results via `gh run list` and records them as OQ evidence rows.
//   Thin glue — no new harness (Charter [지양-5]).
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M2, AC-3)
//
// Evidence mapping:
//   ci-run     — `gh run list --workflow=ci.yml` latest conclusion (databaseId + headSha)
//   rbac       — pnpm ci:rbac exit code (mapped to same ci_run_id when run in CI)
//   audit      — pnpm ci:audit exit code
//
// Usage:
//   node --experimental-strip-types scripts/validation/collect-oq.ts <release_id>
//
// Output: inserts OQ evidence rows (qualification_type='oq').
// When `gh` is unavailable (local dev), OQ evidence is recorded as 'skip' with
// the reason captured in metadata — CI is authoritative for OQ.

import { spawnSync } from 'node:child_process';
import type { EvidenceResult } from '../../lib/schemas/validation.ts';
import {
  checkGitTagExists,
  validateReleaseIdFormat,
} from '../../lib/validation/consumers/release.ts';
import { type EvidenceInput, insertEvidenceBundle } from '../../lib/validation/evidence-writer.ts';

interface OqArgs {
  releaseId: string;
}

function parseArgs(argv: string[]): OqArgs {
  const releaseId = argv[2];
  if (!releaseId) {
    process.stderr.write('Usage: collect-oq.ts <release_id>\n');
    process.exit(1);
  }
  return { releaseId };
}

/** Current HEAD commit SHA — recorded on every evidence row. */
function getHeadCommitSha(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' });
  if (result.status !== 0) {
    process.stderr.write('ERROR: failed to resolve HEAD commit SHA\n');
    process.exit(1);
  }
  return result.stdout.trim();
}

interface CiRunInfo {
  databaseId: number;
  headSha: string;
  conclusion: string;
  htmlUrl: string;
}

/**
 * Fetch the latest CI run info via `gh run list`.
 * Returns null when `gh` is unavailable or no CI run exists.
 */
function getLatestCiRun(): CiRunInfo | null {
  const result = spawnSync(
    'gh',
    ['run', 'list', '--workflow=ci.yml', '--limit=1', '--json=databaseId,headSha,conclusion,url'],
    { encoding: 'utf-8', stdio: 'pipe' },
  );
  if (result.status !== 0 || !result.stdout.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(result.stdout) as Array<{
      databaseId: number;
      headSha: string;
      conclusion: string;
      url: string;
    }>;
    if (!parsed[0]) return null;
    const run = parsed[0];
    return {
      databaseId: run.databaseId,
      headSha: run.headSha,
      conclusion: run.conclusion,
      htmlUrl: run.url,
    };
  } catch {
    return null;
  }
}

function mapConclusion(conclusion: string | null | undefined): EvidenceResult {
  if (conclusion === 'success') return 'pass';
  if (conclusion === 'failure' || conclusion === 'cancelled' || conclusion === 'timed_out') {
    return 'fail';
  }
  // null conclusion = run still in progress; neutered runs; missing rows.
  return 'skip';
}

function runCommandSilent(cmd: string, args: string[]): number {
  const result = spawnSync(cmd, args, { encoding: 'utf-8', stdio: 'pipe' });
  return result.status ?? 1;
}

/**
 * ci-run evidence — the CI Gates workflow conclusion.
 * AC-3: ci_run_id MUST equal the GitHub Actions databaseId.
 */
function collectCiRunEvidence(
  releaseId: string,
  commitSha: string,
  ciRun: CiRunInfo | null,
): EvidenceInput {
  if (!ciRun) {
    return {
      releaseId,
      qualificationType: 'oq',
      commitSha,
      ciRunId: null,
      testCommand: 'gh run list --workflow=ci.yml',
      artifactPath: null,
      result: 'skip',
      metadata: { reason: 'gh CLI unavailable or no CI run found' },
    };
  }
  return {
    releaseId,
    qualificationType: 'oq',
    commitSha,
    ciRunId: ciRun.databaseId,
    testCommand: 'gh run list --workflow=ci.yml',
    artifactPath: ciRun.htmlUrl,
    result: mapConclusion(ciRun.conclusion),
    metadata: {
      headSha: ciRun.headSha,
      conclusion: ciRun.conclusion,
      htmlUrl: ciRun.htmlUrl,
    },
  };
}

/**
 * rbac evidence — pnpm ci:rbac exit code.
 * Attached to the same ci_run_id when available (collected within CI).
 */
function collectRbacEvidence(
  releaseId: string,
  commitSha: string,
  ciRun: CiRunInfo | null,
): EvidenceInput {
  const exitCode = runCommandSilent('pnpm', ['ci:rbac']);
  return {
    releaseId,
    qualificationType: 'oq',
    commitSha,
    ciRunId: ciRun?.databaseId ?? null,
    testCommand: 'pnpm ci:rbac',
    artifactPath: 'scripts/qa/check-rbac.mjs',
    result: exitCode === 0 ? 'pass' : 'fail',
    metadata: { exitCode },
  };
}

/**
 * audit evidence — pnpm ci:audit exit code.
 * Attached to the same ci_run_id when available.
 */
function collectAuditEvidence(
  releaseId: string,
  commitSha: string,
  ciRun: CiRunInfo | null,
): EvidenceInput {
  const exitCode = runCommandSilent('pnpm', ['ci:audit']);
  return {
    releaseId,
    qualificationType: 'oq',
    commitSha,
    ciRunId: ciRun?.databaseId ?? null,
    testCommand: 'pnpm ci:audit',
    artifactPath: 'scripts/qa/audit-completeness.ts',
    result: exitCode === 0 ? 'pass' : 'fail',
    metadata: { exitCode },
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
  const ciRun = getLatestCiRun();

  const bundle: EvidenceInput[] = [
    collectCiRunEvidence(releaseId, commitSha, ciRun),
    collectRbacEvidence(releaseId, commitSha, ciRun),
    collectAuditEvidence(releaseId, commitSha, ciRun),
  ];

  const ids = await insertEvidenceBundle(bundle);

  const summary = {
    releaseId,
    qualificationType: 'oq',
    commitSha,
    ciRunId: ciRun?.databaseId ?? null,
    collectedAt: new Date().toISOString(),
    evidence: bundle.map((e, i) => ({
      id: ids[i],
      testCommand: e.testCommand,
      result: e.result,
      ciRunId: e.ciRunId,
      artifactPath: e.artifactPath,
    })),
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(
      `collect-oq failed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}

export {
  collectCiRunEvidence,
  collectRbacEvidence,
  collectAuditEvidence,
  mapConclusion,
  parseArgs,
};
