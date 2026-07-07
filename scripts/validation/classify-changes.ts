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
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '../../lib/db/client.ts';
import { changeControl, changeRequest } from '../../lib/db/schema.ts';
import { CHANGE_AXES, type ChangeAxis, type ImpactLevel } from '../../lib/schemas/validation.ts';

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

/** Count commits touching a path pattern between previousRef and HEAD. */
function countPathDiffs(previousRef: string | undefined, pathSpec: string): number {
  if (!previousRef) return 0;
  const args = ['rev-list', '--count', `${previousRef}..HEAD`, '--', pathSpec];
  const result = spawnSync('git', args, { encoding: 'utf-8', stdio: 'pipe' });
  if (result.status !== 0) return 0;
  const count = Number.parseInt(result.stdout.trim(), 10);
  return Number.isFinite(count) ? count : 0;
}

/**
 * prompt/model axes — query model-governance changeRequest table.
 * High impact when an approved change exists in this release window.
 * research.md §1.3 boundary: change-workflow.ts owns the workflow itself.
 */
async function classifyModelGovernanceAxis(
  _releaseId: string,
  axis: 'prompt' | 'model',
): Promise<{ impactLevel: ImpactLevel; rerunRequired: boolean; residualRisk: string }> {
  // Count approved change_request rows that touch this axis.
  // prompt axis → promptId non-null; model axis → modelPinId non-null.
  const column = axis === 'prompt' ? changeRequest.promptId : changeRequest.modelPinId;
  const approved = await db
    .select({ id: changeRequest.id })
    .from(changeRequest)
    .where(and(eq(changeRequest.approvalStatus, 'approved'), isNotNull(column)));

  if (approved.length > 0) {
    return {
      impactLevel: 'high',
      rerunRequired: true,
      residualRisk: `${approved.length} approved ${axis} change(s) in change_request — OQ rerun mandatory`,
    };
  }
  // Pending review is medium (may resolve before sign-off).
  const pending = await db
    .select({ id: changeRequest.id })
    .from(changeRequest)
    .where(and(eq(changeRequest.approvalStatus, 'pending_review'), isNotNull(column)));
  if (pending.length > 0) {
    return {
      impactLevel: 'medium',
      rerunRequired: false,
      residualRisk: `${pending.length} pending ${axis} change(s) — monitor before sign-off`,
    };
  }
  return {
    impactLevel: 'low',
    rerunRequired: false,
    residualRisk: `No ${axis} change_request rows — no change detected`,
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

/** source_policy — lib/source-governance/ or lib/ai/policy-keywords.ts */
async function classifySourcePolicyAxis(
  _releaseId: string,
  previousRef: string | undefined,
): Promise<{ impactLevel: ImpactLevel; rerunRequired: boolean; residualRisk: string }> {
  return classifyGitDiffAxis('source_policy', previousRef, [
    'lib/source-governance/',
    'lib/ai/policy-keywords.ts',
  ]);
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
  const commitSha = getHeadCommitSha();

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
        classification = await classifyModelGovernanceAxis(releaseId, axis);
        break;
      case 'schema':
        classification = classifySchemaAxis(previousRef);
        break;
      case 'source_policy':
        classification = await classifySourcePolicyAxis(releaseId, previousRef);
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
};
