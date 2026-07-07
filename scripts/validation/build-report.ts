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
 * Assemble the 8-section Release Validation Report Markdown (AC-6).
 * Sections #6-#8 are stubs by design (R6 risk — #31-#34/#47/#48/#36 are not yet
 * complete; this report cites their pending state explicitly).
 */
export async function buildReleaseReportMarkdown(releaseId: string): Promise<string> {
  const [evidence, changes, rerunGate] = await Promise.all([
    fetchEvidence(releaseId),
    fetchChanges(releaseId),
    evaluateRerunGate(releaseId),
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

> **Stub** — SPEC-REGULA-RELEASE-001 (#31-#34) not yet complete. This section
> will list the release scope (features, subsystems, in this release) once
> RELEASE-001 lands. Tracked as R6 risk in plan.md §4.

## Traceability Status (#47)

> **Stub** — SPEC-REGULA-TRACEABILITY-001 (#47) not yet complete. This section
> will summarize evidence-graph coverage for the release. Tracked as R6 risk.

## Source Governance Status (#48) · Review Ops Status (#36)

> **Stub** — SPEC-REGULA-SOURCE-GOVERNANCE-001 (#48) and
> SPEC-REGULA-REVIEW-OPS-001 (#36) not yet complete. These sections will report
> source-authority coverage and review SLA status once those SPECs land.

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
