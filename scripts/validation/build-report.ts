#!/usr/bin/env node

// @MX:ANCHOR [AUTO] build-report.ts — Release Validation Report Markdown builder.
// @MX:REASON SPEC-REGULA-VALIDATION-001 M5 (REQ-VAL-010, AC-6, Issue #49). Aggregates
//   IQ/OQ/PQ evidence + change-control + checklist into a single Markdown report
//   cited by sign-off. fan_in >= 2: export API route + signoff route (auto-build).
//   Charter [지양-5] — thin glue: SELECTs + string concatenation, no new harness.
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M5, AC-6, REQ-VAL-010, REQ-VAL-014)
//
// Usage:
//   node --experimental-strip-types scripts/validation/build-report.ts <release_id>
//
// Output: writes docs/validation/release-report-<release_id>.md and prints its
// absolute path to stdout. Exit 0 on success, 1 on collector error.

import * as fs from 'node:fs';
import * as path from 'node:path';

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../lib/db/client.ts';
import { changeControl, validationEvidence } from '../../lib/db/schema.ts';
import {
  CHECKLIST_TITLES,
  type ChecklistId,
  buildChecklist,
} from '../../lib/validation/checklist.ts';
import {
  checkGitTagExists,
  snapshotSourceGovernance,
  snapshotTraceability,
  validateReleaseIdFormat,
} from '../../lib/validation/consumers/index.ts';
import { evaluateRerunGate } from '../../lib/validation/rerun-gate.ts';

interface BuildReportArgs {
  releaseId: string;
}

function parseArgs(argv: string[]): BuildReportArgs {
  const releaseId = argv[2];
  if (!releaseId) {
    process.stderr.write('Usage: build-report.ts <release_id>\n');
    process.exit(1);
  }
  return { releaseId };
}

interface EvidenceRow {
  qualificationType: string;
  testCommand: string;
  commitSha: string;
  ciRunId: number | null;
  artifactPath: string | null;
  result: string;
}

interface ChangeRow {
  changeAxis: string;
  impactLevel: string;
  rerunRequired: boolean;
  residualRisk: string;
  exceptionNote: string | null;
}

async function fetchEvidence(releaseId: string): Promise<EvidenceRow[]> {
  const rows = await db
    .select({
      qualificationType: validationEvidence.qualificationType,
      testCommand: validationEvidence.testCommand,
      commitSha: validationEvidence.commitSha,
      ciRunId: validationEvidence.ciRunId,
      artifactPath: validationEvidence.artifactPath,
      result: validationEvidence.result,
    })
    .from(validationEvidence)
    .where(eq(validationEvidence.releaseId, releaseId));
  return rows as EvidenceRow[];
}

async function fetchChanges(releaseId: string): Promise<ChangeRow[]> {
  const rows = await db
    .select({
      changeAxis: changeControl.changeAxis,
      impactLevel: changeControl.impactLevel,
      rerunRequired: changeControl.rerunRequired,
      residualRisk: changeControl.residualRisk,
      exceptionNote: changeControl.exceptionNote,
    })
    .from(changeControl)
    .where(eq(changeControl.releaseId, releaseId));
  return rows as ChangeRow[];
}

function escapePipe(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function renderEvidenceTable(rows: EvidenceRow[], qual: 'iq' | 'oq' | 'pq'): string {
  const filtered = rows.filter((r) => r.qualificationType === qual);
  if (filtered.length === 0) {
    return `| (no ${qual.toUpperCase()} evidence recorded) |  |  |  |  |  |`;
  }
  const header =
    '| test_command | commit_sha | ci_run_id | artifact_path | result |\n|---|---|---|---|---|';
  const body = filtered
    .map(
      (r) =>
        `| ${escapePipe(r.testCommand)} | ${escapePipe(r.commitSha).slice(0, 12)} | ${
          r.ciRunId == null ? '—' : String(r.ciRunId)
        } | ${r.artifactPath == null ? '—' : escapePipe(r.artifactPath)} | ${r.result} |`,
    )
    .join('\n');
  return `${header}\n${body}`;
}

function renderChangeTable(rows: ChangeRow[]): string {
  if (rows.length === 0) {
    return '| (no change-control entries — release has no tracked deltas) |  |  |  |  |';
  }
  const header =
    '| axis | impact | rerun_required | residual_risk | exception_note |\n|---|---|---|---|---|';
  const body = rows
    .map(
      (r) =>
        `| ${escapePipe(r.changeAxis)} | ${escapePipe(r.impactLevel)} | ${
          r.rerunRequired ? 'true' : 'false'
        } | ${escapePipe(r.residualRisk)} | ${
          r.exceptionNote == null ? '—' : escapePipe(r.exceptionNote)
        } |`,
    )
    .join('\n');
  return `${header}\n${body}`;
}

function renderChecklistSection(items: Array<{ id: string; title: string; met: boolean }>): string {
  const header = '| id | title | met |\n|---|---|---|';
  const body = items
    .map((i) => `| ${escapePipe(i.id)} | ${escapePipe(i.title)} | ${i.met ? 'true' : 'false'} |`)
    .join('\n');
  return `${header}\n${body}`;
}

function evidenceByType(rows: EvidenceRow[]) {
  return {
    iqPass: rows.some((r) => r.qualificationType === 'iq' && r.result === 'pass'),
    oqPass: rows.some((r) => r.qualificationType === 'oq' && r.result === 'pass'),
    pqPass: rows.some((r) => r.qualificationType === 'pq' && r.result === 'pass'),
  };
}

/**
 * Release Scope Status section (AC-6, REQ-VAL2-007). Renders IQ/OQ/PQ evidence
 * counts, the release_id, and git tag presence. #31-#34 referenced for static
 * completeness (now CLOSED — scope is real, not stubbed).
 */
function renderReleaseScopeSection(
  releaseId: string,
  evidence: EvidenceRow[],
  tagExists: boolean,
): string {
  const iq = evidence.filter((r) => r.qualificationType === 'iq').length;
  const oq = evidence.filter((r) => r.qualificationType === 'oq').length;
  const pq = evidence.filter((r) => r.qualificationType === 'pq').length;
  const tagLine = tagExists
    ? `git tag \`${releaseId}\` present locally.`
    : `git tag \`${releaseId}\` not found locally (pre-release candidate?).`;
  return `| metric | value |\n|---|---|\n| release_id | ${escapePipe(releaseId)} |\n| IQ evidence | ${iq} |\n| OQ evidence | ${oq} |\n| PQ evidence | ${pq} |\n| git tag | ${tagExists ? 'present' : 'absent'} |\n\n> ${tagLine}`;
}

/**
 * Traceability Status section (AC-4, REQ-VAL2-005). Renders buildMatrix summary
 * via consumer. EC-3: non-blocking on snapshot failure (records unavailable msg).
 */
async function renderTraceabilitySection(orgId: string): Promise<string> {
  if (!orgId) return '[traceability snapshot unavailable: REGULA_ORG_ID not set]';
  try {
    const summary = await snapshotTraceability({ orgId });
    return `| metric | value |\n|---|---|\n| totalRows | ${summary.totalRows} |\n| withGaps | ${summary.withGaps} |\n| stale | ${summary.stale} |`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Warning: traceability snapshot unavailable: ${msg}\n`);
    return `[traceability snapshot unavailable: ${escapePipe(msg)}]`;
  }
}

/**
 * Source Governance Status section (AC-5, REQ-VAL2-006). Renders dashboard
 * counts via consumer.
 */
async function renderSourceGovernanceSection(orgId: string): Promise<string> {
  if (!orgId) return '[source-governance snapshot unavailable: REGULA_ORG_ID not set]';
  try {
    const dashboard = await snapshotSourceGovernance({ orgId });
    const c = dashboard.counts;
    return `| metric | value |\n|---|---|\n| approved | ${c.approved} |\n| pendingReview | ${c.pendingReview} |\n| stale | ${c.stale} |\n| superseded | ${c.superseded} |`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Warning: source-governance snapshot unavailable: ${msg}\n`);
    return `[source-governance snapshot unavailable: ${escapePipe(msg)}]`;
  }
}

/**
 * Review Ops Status section (AC-7, REQ-VAL2-008). #36 Review-Ops not yet
 * implemented — explicit "not implemented" + #36 reference. No fabricated data.
 */
function renderReviewOpsSection(): string {
  return '> not implemented — SPEC-REGULA-REVIEW-OPS-001 (#36) is not yet complete. This section will report review-queue SLA and turnaround metrics once #36 lands. No review-ops numbers are fabricated here.';
}

/**
 * Assemble the 8-section Release Validation Report Markdown (AC-6).
 * Sections #6-#8 are stubs by design (R6 risk — #31-#34/#47/#48/#36 are not yet
 * complete; this report cites their pending state explicitly).
 */
export async function buildReleaseReportMarkdown(releaseId: string): Promise<string> {
  const orgId = process.env.REGULA_ORG_ID ?? '';
  const [evidence, changes, rerunGate, tagCheck, traceSection, sourceSection] = await Promise.all([
    fetchEvidence(releaseId),
    fetchChanges(releaseId),
    evaluateRerunGate(releaseId),
    Promise.resolve(checkGitTagExists(releaseId)),
    renderTraceabilitySection(orgId),
    renderSourceGovernanceSection(orgId),
  ]);

  const qual = evidenceByType(evidence);
  // The report file is being written in this run, so reportExported = true once
  // the file lands. For checklist evaluation we set true (we are the writer).
  const checklist = buildChecklist({
    hasIqPass: qual.iqPass,
    hasOqPass: qual.oqPass,
    hasPqPass: qual.pqPass,
    rerunGatePassed: rerunGate.passed,
    reportExported: true,
  });

  const generatedAt = new Date().toISOString();

  return `# Release Validation Report — ${releaseId}

> Generated by \`scripts/validation/build-report.ts\` at ${generatedAt}.
> Cited by \`docs/validation/intended-use.md\` and the sign-off API
> (\`POST /api/validation/signoff\`). This Markdown is the regulated artifact;
> PDF is intentionally out of scope (§8 Exclusions, REQ-VAL-011 post-v0.1).

## Intended Use

See \`docs/validation/intended-use.md\` for the authoritative statement. Summary:
Regula is a decision-support tool for RA professionals. Auto-generated drafts
require human review and approver sign-off before any external use. Direct
regulator submission and PHI processing are prohibited.

## IQ Evidence

${renderEvidenceTable(evidence, 'iq')}

## OQ Evidence

${renderEvidenceTable(evidence, 'oq')}

## PQ Evidence

${renderEvidenceTable(evidence, 'pq')}

## Change Control

${renderChangeTable(changes)}

${
  rerunGate.passed
    ? '> Rerun gate: **passed** — no high-impact change lacks rerun evidence.'
    : `> Rerun gate: **blocked** — ${rerunGate.failed.length} axis/axes missing rerun evidence: ${rerunGate.failed
        .map((f) => f.axis)
        .join(', ')}.`
}

## Release Scope Status (#31-#34)

${renderReleaseScopeSection(releaseId, evidence, tagCheck.exists)}

## Traceability Status (#47)

${traceSection}

## Source Governance Status (#48)

${sourceSection}

## Review Ops Status (#36)

${renderReviewOpsSection()}

## Sign-off Checklist

${renderChecklistSection(checklist)}

${
  checklist.every((i) => i.met)
    ? '> Checklist: **all met** — eligible for sign-off.'
    : `> Checklist: **${checklist.filter((i) => !i.met).length} unmet** — sign-off will be rejected with HTTP 409 (REQ-VAL-013).`
}
`;
}

/** Write the report to disk. Returns the absolute path. */
export function writeReportFile(releaseId: string, markdown: string): string {
  const dir = path.resolve(process.cwd(), 'docs', 'validation');
  fs.mkdirSync(dir, { recursive: true });
  const filename = `release-report-${releaseId}.md`;
  const fullPath = path.join(dir, filename);
  fs.writeFileSync(fullPath, markdown, 'utf-8');
  return fullPath;
}

async function main() {
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
  const markdown = await buildReleaseReportMarkdown(releaseId);
  const fullPath = writeReportFile(releaseId, markdown);
  process.stdout.write(`${fullPath}\n`);
}

// Run only when invoked directly, not when imported by tests.
const isDirectInvocation = process.argv[1]?.endsWith('build-report.ts');
if (isDirectInvocation) {
  main().catch((err) => {
    process.stderr.write(`build-report.ts: ${(err as Error).message ?? String(err)}\n`);
    process.exit(1);
  });
}
