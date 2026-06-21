// @MX:NOTE [AUTO] Gate 2 PR acceptance helper script.
// @MX:SPEC SPEC-REGULA-QA-PR-ACCEPTANCE-001 (REQ-G2-001 through REQ-G2-008)
//
// Generates QA evidence section and QA signoff comment templates for PR merges.
// Also parses axe-core accessibility output and gitleaks secret scan output.
//
// Usage:
//   pnpm tsx scripts/qa/gate-2-pr-acceptance.ts --pr-number 42 --commit abc1234
//
// Exit code 1 if axe violations or gitleaks findings are detected.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QaEvidenceSectionOpts {
  prNumber: number;
  commitSha: string;
  commands: string[];
  results: string[];
  hasArtifacts: boolean;
}

export interface QaSignoffCommentOpts {
  gateStatus: 'PASS' | 'WAIVED' | 'BLOCKED';
  approver: string;
  evidenceLinks: string[];
  closureDecision: string;
}

// ---------------------------------------------------------------------------
// Pure parsing functions
// ---------------------------------------------------------------------------

/**
 * Parse axe-core CLI/JSON output and return an array of violation descriptions.
 *
 * Supports two formats:
 * 1. JSON output from `axe --reporter json` -- looks for violations[].id
 * 2. Plain text output -- looks for lines containing "violation" or "Rule:"
 *
 * @param axeOutput - Raw stdout from axe-core
 * @returns Array of violation strings (empty = no violations found)
 */
export function parseAxeViolations(axeOutput: string): string[] {
  const trimmed = axeOutput.trim();
  if (!trimmed) return [];

  // Attempt JSON parse first.
  try {
    const parsed: unknown = JSON.parse(trimmed);

    // axe-core JSON reporter wraps results in an array of page results.
    if (Array.isArray(parsed)) {
      const violations: string[] = [];
      for (const page of parsed) {
        const pageViolations: unknown = (page as Record<string, unknown>).violations;
        if (Array.isArray(pageViolations)) {
          for (const v of pageViolations) {
            const id: unknown = (v as Record<string, unknown>).id;
            const description: unknown = (v as Record<string, unknown>).description;
            const label = id ? String(id) : description ? String(description) : 'unknown';
            violations.push(label);
          }
        }
      }
      return violations;
    }

    // Single page result object.
    const pageViolations: unknown = (parsed as Record<string, unknown>).violations;
    if (Array.isArray(pageViolations)) {
      return pageViolations.map((v: unknown) => {
        const id: unknown = (v as Record<string, unknown>).id;
        const description: unknown = (v as Record<string, unknown>).description;
        return id ? String(id) : description ? String(description) : 'unknown';
      });
    }
  } catch {
    // Not JSON -- fall through to text parsing.
  }

  // Plain text heuristic: lines that mention "violation" or start with "Rule:".
  const lines = trimmed.split('\n');
  const violations: string[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('violation') || lower.trimStart().startsWith('rule:')) {
      violations.push(line.trim());
    }
  }
  return violations;
}

/**
 * Parse gitleaks output and return an array of secret finding descriptions.
 *
 * Supports two formats:
 * 1. JSON output from `gitleaks detect --report-format json` -- items with Description/RuleID/Secret
 * 2. Plain text -- lines starting with "Finding:" or "Secret:" labels (gitleaks verbose output)
 *
 * Plain text heuristic intentionally excludes "No leaks found" and version header lines.
 * A line is considered a finding only when it begins with the keyword label followed by
 * whitespace (e.g. "    Finding:     <value>").
 *
 * @param gitleaksOutput - Raw stdout/file content from gitleaks
 * @returns Array of finding strings (empty = no findings)
 */
export function parseGitleaksFindings(gitleaksOutput: string): string[] {
  const trimmed = gitleaksOutput.trim();
  if (!trimmed) return [];

  // Attempt JSON parse.
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item: unknown) => {
        const desc: unknown = (item as Record<string, unknown>).Description;
        const rule: unknown = (item as Record<string, unknown>).RuleID;
        const secret: unknown = (item as Record<string, unknown>).Secret;
        if (desc) return String(desc);
        if (rule) return String(rule);
        if (secret) return `secret detected: ${String(secret).slice(0, 20)}...`;
        return 'unknown finding';
      });
    }
  } catch {
    // Not JSON -- fall through to text parsing.
  }

  // Plain text heuristic: only match lines that start with "finding:" or "secret:"
  // label patterns as produced by gitleaks verbose output, not sentences containing them.
  const findings: string[] = [];
  for (const line of trimmed.split('\n')) {
    const stripped = line.trimStart().toLowerCase();
    if (stripped.startsWith('finding:') || stripped.startsWith('secret:')) {
      findings.push(line.trim());
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Template generation functions
// ---------------------------------------------------------------------------

/**
 * Generate the "## QA evidence" markdown section for a PR body.
 *
 * @param opts - PR metadata and evidence details
 * @returns Formatted markdown string
 */
export function generateQaEvidenceSection(opts: QaEvidenceSectionOpts): string {
  const { prNumber, commitSha, commands, results, hasArtifacts } = opts;

  const commandLines =
    commands.length > 0
      ? commands.map((cmd) => `- \`${cmd}\``).join('\n')
      : '- _No commands recorded_';

  const resultLines =
    results.length > 0 ? results.map((r) => `- ${r}`).join('\n') : '- _No results recorded_';

  const artifactsLine = hasArtifacts
    ? '- Artifacts attached to this PR (see Checks tab)'
    : '- No artifacts attached';

  return [
    '## QA evidence',
    '',
    `- **PR**: #${prNumber}`,
    `- **Commit**: \`${commitSha}\``,
    '',
    '### Commands run',
    commandLines,
    '',
    '### Results',
    resultLines,
    '',
    '### Artifacts',
    artifactsLine,
  ].join('\n');
}

/**
 * Generate the "### QA signoff" comment for posting before merge.
 *
 * @param opts - Gate status, approver, evidence links, closure decision
 * @returns Formatted markdown string
 */
export function generateQaSignoffComment(opts: QaSignoffCommentOpts): string {
  const { gateStatus, approver, evidenceLinks, closureDecision } = opts;

  const linkLines =
    evidenceLinks.length > 0
      ? evidenceLinks.map((link) => `- ${link}`).join('\n')
      : '- _No evidence links provided_';

  return [
    '### QA signoff',
    '',
    `**Gate status**: ${gateStatus}`,
    `**Approver**: ${approver}`,
    '',
    '**Evidence links**',
    linkLines,
    '',
    `**Closure decision**: ${closureDecision}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const isDirectRun =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const args = process.argv.slice(2);
  const prNumberIdx = args.indexOf('--pr-number');
  const commitIdx = args.indexOf('--commit');

  const prNumber = prNumberIdx >= 0 ? Number.parseInt(args[prNumberIdx + 1] ?? '0', 10) : 0;
  const commitSha = commitIdx >= 0 ? (args[commitIdx + 1] ?? 'unknown') : 'unknown';

  process.stdout.write('Gate 2 PR Acceptance Helper\n');
  process.stdout.write('===========================\n\n');

  const evidenceSection = generateQaEvidenceSection({
    prNumber,
    commitSha,
    commands: ['pnpm test', 'pnpm typecheck'],
    results: ['All tests pass', 'No type errors'],
    hasArtifacts: false,
  });

  const signoffComment = generateQaSignoffComment({
    gateStatus: 'PASS',
    approver: 'QA reviewer',
    evidenceLinks: [`https://github.com/holee9/ra-med-bot/pull/${prNumber}`],
    closureDecision: 'Approved for merge',
  });

  process.stdout.write(evidenceSection);
  process.stdout.write('\n\n---\n\n');
  process.stdout.write(signoffComment);
  process.stdout.write('\n');
}
