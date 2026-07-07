#!/usr/bin/env node

// @MX:ANCHOR [AUTO] classify-changes.ts — 7-axis change-control impact assessment.
// @MX:REASON SPEC-REGULA-VALIDATION-001 M4 (REQ-VAL-007/008/009, AC-5, Issue #49).
//   Thin glue over existing assets — no new harness (Charter [지양-5]).
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M4, AC-5)
//
// 7 axes (research.md §1.3):
//   source_policy    — lib/source-governance/ (presence) or git diff heuristic
//   prompt           — model-governance changeRequest table (promptId set)
//   model            — model-governance changeRequest table (modelPinId set)
//   schema           — migrations/ diff (new migration since previous release)
//   retrieval        — lib/ai/retrievers/ git diff heuristic
//   export           — app/api/**/export/ git diff heuristic
//   review_workflow  — lib/ai/expert-review* git diff heuristic
//
// Fallback mode (R2 risk, #71 완료 전): when change-workflow integration is
// incomplete or previous-release ref is missing, we record low impact with
// residual_risk noting the heuristic basis. Conservative: over-classify high
// when ambiguous (plan.md §4 R3).
//
// Usage:
//   node --experimental-strip-types scripts/validation/classify-changes.ts <release_id> [previous_ref]

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { db } from '../../lib/db/client.ts';
import { changeControl } from '../../lib/db/schema.ts';
import { CHANGE_AXES, type ChangeAxis, type ImpactLevel } from '../../lib/schemas/validation.ts';
import {
  checkGitTagExists,
  fetchWindowScopedChangeRequests,
  snapshotSourceGovernance,
  validateReleaseIdFormat,
} from '../../lib/validation/consumers/index.ts';

interface ClassifyArgs {
  releaseId: string;
  previousRef?: string;
}

function parseArgs(argv: string[]): ClassifyArgs {
  const releaseId = argv[2];
  if (!releaseId) {
    process.stderr.write('Usage: classify-changes.ts <release_id> [previous_ref]\n');
    process.exit(1);
  }
  const previousRef = argv[3];
  return { releaseId, previousRef };
}

function getHeadCommitSha(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' });
  if (result.status !== 0) {
    process.stderr.write('ERROR: failed to resolve HEAD commit SHA\n');
    process.exit(1);
  }
  return result.stdout.trim();
}

/**
 * Safe int parser with bounds. PR #359 review: bare parseInt on git output is
 * unsafe — a corrupted git rev-list/diff output could yield gigantic numbers
 * that dominate classification thresholds. Cap at 100_000 (any real release
 * with > 100k commits on one path is certainly a git bug, not a signal).
 */
function safeParseIntBound(raw: string): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || n > 100_000) return 0;
  return n;
}

/** Count commits touching a path pattern between previousRef and HEAD. */
function countPathDiffs(previousRef: string | undefined, pathSpec: string): number {
  if (!previousRef) return 0;
  const args = ['rev-list', '--count', `${previousRef}..HEAD`, '--', pathSpec];
  const result = spawnSync('git', args, { encoding: 'utf-8', stdio: 'pipe' });
  if (result.status !== 0) return 0;
  return safeParseIntBound(result.stdout.trim());
}

/**
 * Resolve the release window [previousRef..HEAD] for window-scoped consumer queries.
 * EC-5: when previousRef is missing or absent in git history, fall back to UNIX
 * epoch (1970) so every existing change_request is conservatively in-window.
 * SPEC-REGULA-VALIDATION-002 M1 (REQ-VAL2-001).
 */
function resolveWindow(previousRef?: string): {
  windowStart: Date;
  windowEnd: Date;
  note: string;
} {
  const windowEnd = new Date();
  if (!previousRef) {
    return {
      windowStart: new Date(0),
      windowEnd,
      note: 'previous_ref not provided, fallback to epoch',
    };
  }
  const result = spawnSync('git', ['log', '-1', '--format=%cI', previousRef], {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  const iso = result.status === 0 ? result.stdout.trim() : '';
  if (!iso) {
    return {
      windowStart: new Date(0),
      windowEnd,
      note: `previous_ref ${previousRef} not found, fallback to epoch`,
    };
  }
  return {
    windowStart: new Date(iso),
    windowEnd,
    note: `window [${previousRef}..HEAD ${iso}]`,
  };
}

/**
 * Resolve the organization ID for window-scoped consumer queries.
 * Charter [지양-5]: single-org assumption (not a multi-tenant SaaS). The script
 * runs in a system/validation context where REGULA_ORG_ID is provided by env.
 * SPEC-REGULA-VALIDATION-002 M1/M2.
 */
function resolveOrgId(): string {
  const orgId = process.env.REGULA_ORG_ID;
  if (!orgId) {
    process.stderr.write(
      'ERROR: REGULA_ORG_ID env var required for window-scoped consumer queries\n',
    );
    process.exit(1);
  }
  return orgId;
}

/**
 * prompt/model axes — window-scoped model-governance change_request query via
 * consumer (AC-1, AC-2, AC-10). REQ-VAL2-001/002.
 *
 * High impact when an approved change exists in the release window
 * [previousRef..HEAD]. evalRunId/evalResultRef are recorded in residual_risk:
 * change_control.evidence_ref is uuid-typed (schema.ts:3486 — reserved for
 * validation_evidence.id loose ref per VALIDATION-001 design), while
 * model-governance evalRunId is a free-form string — storing it in evidence_ref
 * would require a column-type migration, which Charter [지양-5] 범위 통제 forbids.
 * residual_risk carries the traceability instead.
 */
async function classifyModelGovernanceAxis(
  _releaseId: string,
  axis: 'prompt' | 'model',
  options?: {
    orgId?: string;
    windowStart?: Date;
    windowEnd?: Date;
    windowNote?: string;
  },
): Promise<{ impactLevel: ImpactLevel; rerunRequired: boolean; residualRisk: string }> {
  const orgId = options?.orgId ?? '';
  const windowStart = options?.windowStart ?? new Date(0);
  const windowEnd = options?.windowEnd ?? new Date();
  const windowNote = options?.windowNote ?? 'window defaulted to epoch';

  // Consumer 경유 window-scoped query (AC-1, AC-10).
  const rows = await fetchWindowScopedChangeRequests({ orgId, windowStart, windowEnd });
  // prompt axis → promptId non-null; model axis → modelPinId non-null.
  const relevant = rows.filter((r) => (axis === 'prompt' ? r.promptId : r.modelPinId) !== null);
  const approved = relevant.filter((r) => r.approvalStatus === 'approved');
  const pending = relevant.filter((r) => r.approvalStatus === 'pending_review');

  if (approved.length > 0) {
    // evalRunId / evalResultRef → residual_risk (AC-2 traceability, schema 진실원).
    const evalRunIds = approved.map((r) => r.evalRunId).filter((v): v is string => v !== null);
    const evalResultRefs = approved
      .map((r) => r.evalResultRef)
      .filter((v): v is string => v !== null);
    const evalNote =
      evalRunIds.length > 0
        ? ` — evalRunId=${evalRunIds.join(',')}${
            evalResultRefs.length > 0 ? `, evalResultRef=${evalResultRefs.join(',')}` : ''
          }`
        : '';
    return {
      impactLevel: 'high',
      rerunRequired: true,
      residualRisk: `${approved.length} approved ${axis} change(s) in ${windowNote}${evalNote} — OQ rerun mandatory`,
    };
  }
  // Pending review is medium (may resolve before sign-off).
  if (pending.length > 0) {
    return {
      impactLevel: 'medium',
      rerunRequired: false,
      residualRisk: `${pending.length} pending ${axis} change(s) in ${windowNote} — monitor before sign-off`,
    };
  }
  return {
    impactLevel: 'low',
    rerunRequired: false,
    residualRisk: `No window-scoped ${axis} change_request rows in ${windowNote}`,
  };
}

/**
 * schema axis — new migration files since previousRef (or since last release).
 */
function classifySchemaAxis(previousRef: string | undefined): {
  impactLevel: ImpactLevel;
  rerunRequired: boolean;
  residualRisk: string;
} {
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  if (!existsSync(migrationsDir)) {
    return {
      impactLevel: 'low',
      rerunRequired: false,
      residualRisk: 'No migrations/ directory',
    };
  }
  const newMigrations = countPathDiffs(previousRef, 'migrations/');
  if (newMigrations > 0) {
    // Schema changes affect data persistence — high impact, IQ rerun needed.
    return {
      impactLevel: 'high',
      rerunRequired: true,
      residualRisk: `${newMigrations} migration commit(s) since previous release — IQ + OQ rerun mandatory`,
    };
  }
  return {
    impactLevel: 'low',
    rerunRequired: false,
    residualRisk: 'No migration changes since previous release',
  };
}

/**
 * Generic git-diff heuristic for the remaining 4 axes (source_policy, retrieval,
 * export, review_workflow). Path patterns mirror research.md §3 R2 fallback.
 */
function classifyGitDiffAxis(
  _axis: ChangeAxis,
  previousRef: string | undefined,
  pathSpecs: string[],
): { impactLevel: ImpactLevel; rerunRequired: boolean; residualRisk: string } {
  const totalCommits = pathSpecs.reduce((sum, spec) => sum + countPathDiffs(previousRef, spec), 0);
  if (totalCommits === 0) {
    return {
      impactLevel: 'low',
      rerunRequired: false,
      residualRisk: `No changes detected under [${pathSpecs.join(', ')}] since previous release`,
    };
  }
  // Heuristic thresholds (plan.md §4 R3 — conservative over-classification).
  // >= 3 commits → high; 1-2 → medium. Rerun required only for high.
  if (totalCommits >= 3) {
    return {
      impactLevel: 'high',
      rerunRequired: true,
      residualRisk: `${totalCommits} commit(s) under [${pathSpecs.join(', ')}] — rerun mandatory (heuristic threshold)`,
    };
  }
  return {
    impactLevel: 'medium',
    rerunRequired: false,
    residualRisk: `${totalCommits} commit(s) under [${pathSpecs.join(', ')}] — monitor`,
  };
}

/**
 * source_policy axis — git-diff heuristic + source-governance dashboard snapshot
 * via consumer (AC-3, AC-10). REQ-VAL2-004.
 *
 * Conservative over-classification (plan.md §4 R3): git-diff >= 3 commits OR
 * dashboard stale/superseded > 0 → high impact. residual_risk records both the
 * git-diff count and the dashboard counts (cumulative snapshot at {timestamp}).
 */
async function classifySourcePolicyAxis(
  _releaseId: string,
  previousRef: string | undefined,
  options?: { orgId?: string },
): Promise<{ impactLevel: ImpactLevel; rerunRequired: boolean; residualRisk: string }> {
  const orgId = options?.orgId ?? '';
  const pathSpecs = ['lib/source-governance/', 'lib/ai/policy-keywords.ts'];
  const gitDiff = pathSpecs.reduce((sum, spec) => sum + countPathDiffs(previousRef, spec), 0);

  // Consumer 경유 dashboard snapshot (AC-3, AC-10). Non-blocking on failure.
  let counts: {
    approved: number;
    pendingReview: number;
    stale: number;
    superseded: number;
  } | null = null;
  let snapshotNote = 'snapshot unavailable';
  try {
    if (orgId) {
      const dashboard = await snapshotSourceGovernance({ orgId });
      counts = dashboard.counts;
      snapshotNote = `snapshot at ${new Date().toISOString()}`;
    }
  } catch (err) {
    snapshotNote = `snapshot failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  const countsStr = counts
    ? `dashboard=approved:${counts.approved},pending:${counts.pendingReview},stale:${counts.stale},superseded:${counts.superseded}`
    : 'dashboard unavailable';
  const base = `git_diff=${gitDiff} commit(s) under ${pathSpecs.join(', ')}; ${countsStr}; ${snapshotNote}`;

  // Conservative: git-diff >= 3 OR stale/superseded > 0 → high (plan.md §4 R3).
  if (gitDiff >= 3 || (counts !== null && (counts.stale > 0 || counts.superseded > 0))) {
    return {
      impactLevel: 'high',
      rerunRequired: true,
      residualRisk: `${base} — source-policy risk detected, rerun mandatory`,
    };
  }
  if (gitDiff >= 1) {
    return {
      impactLevel: 'medium',
      rerunRequired: false,
      residualRisk: `${base} — monitor`,
    };
  }
  return {
    impactLevel: 'low',
    rerunRequired: false,
    residualRisk: base,
  };
}

/** retrieval — lib/ai/retrievers/ + lib/ai/rerank */
async function classifyRetrievalAxis(
  _releaseId: string,
  previousRef: string | undefined,
): Promise<{ impactLevel: ImpactLevel; rerunRequired: boolean; residualRisk: string }> {
  return classifyGitDiffAxis('retrieval', previousRef, [
    'lib/ai/retrievers/',
    'lib/ai/rerank/',
    'lib/ai/hybrid-search.ts',
  ]);
}

/** export — app/api export routes + lib/export */
async function classifyExportAxis(
  _releaseId: string,
  previousRef: string | undefined,
): Promise<{ impactLevel: ImpactLevel; rerunRequired: boolean; residualRisk: string }> {
  return classifyGitDiffAxis('export', previousRef, ['app/api/**/export/', 'lib/export/']);
}

/** review_workflow — expert-review gating + queue */
async function classifyReviewWorkflowAxis(
  _releaseId: string,
  previousRef: string | undefined,
): Promise<{ impactLevel: ImpactLevel; rerunRequired: boolean; residualRisk: string }> {
  return classifyGitDiffAxis('review_workflow', previousRef, [
    'lib/ai/expert-review',
    'lib/ai/policy-keywords.ts',
  ]);
}

/**
 * Insert or supersede change_control row for (release_id, change_axis).
 * Append-only semantics: prior rows remain; new INSERT captures current state.
 * research.md §6: "rows are superseded by new INSERTs".
 */
async function upsertChangeControlRow(params: {
  releaseId: string;
  axis: ChangeAxis;
  impactLevel: ImpactLevel;
  rerunRequired: boolean;
  residualRisk: string;
  assessorId: string;
  evidenceRef?: string | null;
}): Promise<string> {
  const [inserted] = await db
    .insert(changeControl)
    .values({
      releaseId: params.releaseId,
      changeAxis: params.axis,
      impactLevel: params.impactLevel,
      rerunRequired: params.rerunRequired,
      residualRisk: params.residualRisk,
      exceptionNote: null,
      evidenceRef: params.evidenceRef ?? null,
      assessorId: params.assessorId,
    })
    .returning({ id: changeControl.id });
  if (!inserted) {
    throw new Error(`change_control insert failed for axis ${params.axis}`);
  }
  return inserted.id;
}

async function main(): Promise<void> {
  const { releaseId, previousRef } = parseArgs(process.argv);
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
  // SPEC-REGULA-VALIDATION-002 M1/M2: org + window context for consumer queries.
  const orgId = resolveOrgId();
  const window = resolveWindow(previousRef);

  const results: Array<{
    axis: ChangeAxis;
    id: string;
    impactLevel: ImpactLevel;
    rerunRequired: boolean;
  }> = [];

  // 7 axes, each classified + inserted.
  for (const axis of CHANGE_AXES) {
    let classification: { impactLevel: ImpactLevel; rerunRequired: boolean; residualRisk: string };
    switch (axis) {
      case 'prompt':
      case 'model':
        classification = await classifyModelGovernanceAxis(releaseId, axis, {
          orgId,
          windowStart: window.windowStart,
          windowEnd: window.windowEnd,
          windowNote: window.note,
        });
        break;
      case 'schema':
        classification = classifySchemaAxis(previousRef);
        break;
      case 'source_policy':
        classification = await classifySourcePolicyAxis(releaseId, previousRef, { orgId });
        break;
      case 'retrieval':
        classification = await classifyRetrievalAxis(releaseId, previousRef);
        break;
      case 'export':
        classification = await classifyExportAxis(releaseId, previousRef);
        break;
      case 'review_workflow':
        classification = await classifyReviewWorkflowAxis(releaseId, previousRef);
        break;
      default:
        classification = {
          impactLevel: 'low',
          rerunRequired: false,
          residualRisk: `Axis ${axis} not yet classified`,
        };
    }
    const id = await upsertChangeControlRow({
      releaseId,
      axis,
      impactLevel: classification.impactLevel,
      rerunRequired: classification.rerunRequired,
      residualRisk: classification.residualRisk,
      assessorId: '00000000-0000-0000-0000-000000000001', // SYSTEM_USER_UUID
    });
    results.push({
      axis,
      id,
      impactLevel: classification.impactLevel,
      rerunRequired: classification.rerunRequired,
    });
  }

  const summary = {
    releaseId,
    commitSha,
    previousRef: previousRef ?? 'none (fallback mode)',
    collectedAt: new Date().toISOString(),
    axes: results,
    blockingAxes: results
      .filter((r) => r.impactLevel === 'high' && r.rerunRequired)
      .map((r) => r.axis),
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(
      `classify-changes failed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}

export {
  classifyModelGovernanceAxis,
  classifySchemaAxis,
  classifyGitDiffAxis,
  classifySourcePolicyAxis,
  classifyRetrievalAxis,
  classifyExportAxis,
  classifyReviewWorkflowAxis,
  parseArgs,
  safeParseIntBound,
};
