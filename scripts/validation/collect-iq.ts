#!/usr/bin/env node

// @MX:ANCHOR [AUTO] collect-iq.ts — IQ (Installation Qualification) evidence bundle generator.
// @MX:REASON SPEC-REGULA-VALIDATION-001 M1 (REQ-VAL-003, Issue #49). Aggregates 5 IQ
//   evidence rows (env/deps/migrations/config/secret) by REUSING existing CI/quality
//   gates. Thin glue layer — no new harness (Charter [지양-5]).
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M1, AC-2)
//
// Evidence sources (research.md §1.1):
//   env        — lib/env.ts parseEnv() via scripts/validate-runtime-env.ts
//   deps       — pnpm-lock.yaml sha256 + pnpm install --frozen-lockfile
//   migrations — pnpm ci:migrations exit code (latest migration number captured)
//   config     — biome typecheck/lint/format gate results (from local run)
//   secret     — .gitleaks.toml presence + git head free of gitleaks findings
//
// Usage:
//   node --experimental-strip-types scripts/validation/collect-iq.ts <release_id>
//
// Output: inserts 5 validation_evidence rows (qualification_type='iq').
// Exit 0 on success (regardless of individual pass/fail — evidence records the
// state, it does not gate). Exit 1 on collector error (could not assemble bundle).

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { parseEnv } from '../../lib/env.ts';
import type { EvidenceResult } from '../../lib/schemas/validation.ts';
import {
  checkGitTagExists,
  validateReleaseIdFormat,
} from '../../lib/validation/consumers/release.ts';
import { type EvidenceInput, insertEvidenceBundle } from '../../lib/validation/evidence-writer.ts';

interface IqArgs {
  releaseId: string;
}

function parseArgs(argv: string[]): IqArgs {
  const releaseId = argv[2];
  if (!releaseId) {
    process.stderr.write('Usage: collect-iq.ts <release_id>\n');
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

/** Latest migration number (e.g. 0112) — metadata for migrations evidence. */
function getLatestMigrationNumber(): number {
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  if (!existsSync(migrationsDir)) return 0;
  const files = readdirSync(migrationsDir).filter((f) => /^\d{4}_.*\.sql$/.test(f));
  if (files.length === 0) return 0;
  const numbers = files.map((f) => Number.parseInt(f.slice(0, 4), 10));
  return Math.max(...numbers);
}

/** sha256 of pnpm-lock.yaml — dependency reproducibility fingerprint. */
function getLockfileChecksum(): string | null {
  const lockPath = path.resolve(process.cwd(), 'pnpm-lock.yaml');
  if (!existsSync(lockPath)) return null;
  const content = readFileSync(lockPath);
  return createHash('sha256').update(content).digest('hex');
}

/** Run a command silently; returns exit code. Used by config + secret evidence. */
function runCommandSilent(cmd: string, args: string[]): number {
  const result = spawnSync(cmd, args, { encoding: 'utf-8', stdio: 'pipe' });
  return result.status ?? 1;
}

/**
 * env evidence — parseEnv() result.
 * Pass = lib/env.ts validates all required keys present; Fail = missing/invalid.
 */
function collectEnvEvidence(releaseId: string, commitSha: string): EvidenceInput {
  let result: EvidenceResult = 'fail';
  let metadata: Record<string, unknown> = {};
  try {
    parseEnv(process.env);
    result = 'pass';
    metadata = { validator: 'lib/env.ts parseEnv' };
  } catch (err) {
    result = 'fail';
    metadata = {
      validator: 'lib/env.ts parseEnv',
      error: err instanceof Error ? err.message : String(err),
    };
  }
  return {
    releaseId,
    qualificationType: 'iq',
    commitSha,
    testCommand: 'parseEnv(process.env) — lib/env.ts Zod validation',
    artifactPath: 'lib/env.ts',
    result,
    metadata,
  };
}

/**
 * deps evidence — pnpm-lock.yaml checksum + frozen install dry-run.
 * Pass = lockfile exists and `pnpm install --frozen-lockfile --frozen` succeeds.
 * Skip = no lockfile (dev environment without pnpm).
 */
function collectDepsEvidence(releaseId: string, commitSha: string): EvidenceInput {
  const lockfileChecksum = getLockfileChecksum();
  if (!lockfileChecksum) {
    return {
      releaseId,
      qualificationType: 'iq',
      commitSha,
      testCommand: 'pnpm install --frozen-lockfile',
      artifactPath: 'pnpm-lock.yaml',
      result: 'skip',
      metadata: { reason: 'pnpm-lock.yaml not found' },
    };
  }
  // Verify lockfile is in sync with package.json — `pnpm install --frozen-lockfile`
  // exits non-zero if they drift.
  const installExit = runCommandSilent('pnpm', [
    'install',
    '--frozen-lockfile',
    '--reporter=silent',
  ]);
  return {
    releaseId,
    qualificationType: 'iq',
    commitSha,
    testCommand: 'pnpm install --frozen-lockfile',
    artifactPath: 'pnpm-lock.yaml',
    result: installExit === 0 ? 'pass' : 'fail',
    metadata: {
      lockfileSha256: lockfileChecksum,
      installExitCode: installExit,
    },
  };
}

/**
 * migrations evidence — `pnpm ci:migrations` exit code.
 * Pass = no gaps/duplicates; Fail = sequence broken; Skip = no migrations dir.
 */
function collectMigrationsEvidence(releaseId: string, commitSha: string): EvidenceInput {
  const latest = getLatestMigrationNumber();
  if (latest === 0) {
    return {
      releaseId,
      qualificationType: 'iq',
      commitSha,
      testCommand: 'pnpm ci:migrations',
      artifactPath: 'scripts/ci/check-migrations.ts',
      result: 'skip',
      metadata: { reason: 'migrations/ directory empty or missing' },
    };
  }
  const exitCode = runCommandSilent('pnpm', ['ci:migrations']);
  return {
    releaseId,
    qualificationType: 'iq',
    commitSha,
    testCommand: 'pnpm ci:migrations',
    artifactPath: 'scripts/ci/check-migrations.ts',
    result: exitCode === 0 ? 'pass' : 'fail',
    metadata: {
      latestMigrationNumber: latest,
      checkExitCode: exitCode,
    },
  };
}

/**
 * config evidence — typecheck + lint + format gates.
 * Aggregates 3 sub-checks: result=pass only if all 3 pass.
 * Per-sub-check metadata recorded so the report can show which gate failed.
 */
function collectConfigEvidence(releaseId: string, commitSha: string): EvidenceInput {
  const typecheckExit = runCommandSilent('pnpm', ['ci:typecheck']);
  const lintExit = runCommandSilent('pnpm', ['ci:lint']);
  const formatExit = runCommandSilent('pnpm', ['ci:format']);
  const allPass = typecheckExit === 0 && lintExit === 0 && formatExit === 0;
  return {
    releaseId,
    qualificationType: 'iq',
    commitSha,
    testCommand: 'pnpm ci:typecheck && pnpm ci:lint && pnpm ci:format',
    artifactPath: '.github/workflows/ci.yml (CI Gates job)',
    result: allPass ? 'pass' : 'fail',
    metadata: {
      typecheckExitCode: typecheckExit,
      lintExitCode: lintExit,
      formatExitCode: formatExit,
    },
  };
}

/**
 * secret evidence — gitleaks config presence + clean HEAD.
 * Pass = .gitleaks.toml exists and gitleaks scan (if available) reports no leaks.
 * Skip = gitleaks binary not installed (CI-only tool). The security.yml workflow
 *        remains the authoritative source for secret scanning in CI.
 */
function collectSecretEvidence(releaseId: string, commitSha: string): EvidenceInput {
  const gitleaksConfigExists = existsSync(path.resolve(process.cwd(), '.gitleaks.toml'));
  if (!gitleaksConfigExists) {
    return {
      releaseId,
      qualificationType: 'iq',
      commitSha,
      testCommand: 'gitleaks detect --config .gitleaks.toml',
      artifactPath: '.github/workflows/security.yml (secret-scan job)',
      result: 'fail',
      metadata: { reason: '.gitleaks.toml config missing' },
    };
  }
  // Try local gitleaks; fall back to skip if binary not on PATH.
  const gitleaksResult = spawnSync(
    'gitleaks',
    ['detect', '--no-banner', '--config', '.gitleaks.toml'],
    {
      encoding: 'utf-8',
      stdio: 'pipe',
    },
  );
  if (gitleaksResult.error || gitleaksResult.status === null) {
    return {
      releaseId,
      qualificationType: 'iq',
      commitSha,
      testCommand: 'gitleaks detect --config .gitleaks.toml',
      artifactPath: '.github/workflows/security.yml (secret-scan job)',
      result: 'skip',
      metadata: {
        reason: 'gitleaks binary not available locally; CI security.yml is authoritative',
        configExists: true,
      },
    };
  }
  // gitleaks exit 0 = no leaks; 1 = leaks found; other = error.
  return {
    releaseId,
    qualificationType: 'iq',
    commitSha,
    testCommand: 'gitleaks detect --config .gitleaks.toml',
    artifactPath: '.github/workflows/security.yml (secret-scan job)',
    result: gitleaksResult.status === 0 ? 'pass' : 'fail',
    metadata: {
      configExists: true,
      gitleaksExitCode: gitleaksResult.status,
    },
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

  const bundle: EvidenceInput[] = [
    collectEnvEvidence(releaseId, commitSha),
    collectDepsEvidence(releaseId, commitSha),
    collectMigrationsEvidence(releaseId, commitSha),
    collectConfigEvidence(releaseId, commitSha),
    collectSecretEvidence(releaseId, commitSha),
  ];

  const ids = await insertEvidenceBundle(bundle);

  // JSON summary to stdout — consumed by API route and CI dashboards.
  const summary = {
    releaseId,
    qualificationType: 'iq',
    commitSha,
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

// Run only when invoked directly, not when imported (tests import the collectors).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(
      `collect-iq failed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}

// Export individual collectors for unit testing.
export {
  collectEnvEvidence,
  collectDepsEvidence,
  collectMigrationsEvidence,
  collectConfigEvidence,
  collectSecretEvidence,
  parseArgs,
};
