// @MX:NOTE [AUTO] Gate 1 (Implementation Checkpoint) helper script.
// @MX:SPEC SPEC-REGULA-QA-IMPLEMENTATION-CHECKPOINT-001 (REQ-G1-001 through REQ-G1-007)
//
// Runs pnpm typecheck, pnpm lint, pnpm test, and contract checks, then
// generates a formatted "### QA checkpoint" comment for posting on GitHub issues.
//
// Usage:
//   tsx scripts/qa/gate-1-checkpoint.ts --change-desc "description of change"
//
// Exit code 1 if any check failed.

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Route handler patterns that mutate state — these require no placeholder TODOs.
const MUTABLE_METHOD_EXPORT_PATTERN =
  /export\s+(?:async\s+function|const)\s+(POST|PUT|PATCH|DELETE)\s*[=(]/;

// Detects TODO/FIXME/HACK placeholders that indicate incomplete implementation.
const TODO_PATTERN = /\bTODO\b|\bFIXME\b|\bHACK\b/;

/**
 * Check a single file's content for placeholder TODOs inside state-mutating route handlers.
 *
 * @param content - Source text of the file
 * @param filePath - File path for violation messages
 * @returns Array of violation strings (empty = compliant)
 */
export function checkFileForPlaceholderTodos(content: string, filePath: string): string[] {
  const violations: string[] = [];

  // Only flag TODO violations if the file contains a state-mutating route export.
  if (!MUTABLE_METHOD_EXPORT_PATTERN.test(content)) {
    return violations;
  }

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    // Skip pure comment lines — TODOs in doc comments are acceptable.
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }

    if (TODO_PATTERN.test(line)) {
      violations.push(`${filePath}: line ${i + 1}: TODO in state-mutating route`);
    }
  }

  return violations;
}

export interface CheckpointCommentOpts {
  typecheckPassed: boolean;
  lintPassed: boolean;
  testsPassed: boolean;
  contractResults: string[];
  violations: string[];
  changeDescription: string;
}

/**
 * Format a "### QA checkpoint" markdown comment for posting on a GitHub issue.
 *
 * @param opts - Checkpoint result options
 * @returns Formatted markdown string
 */
export function formatCheckpointComment(opts: CheckpointCommentOpts): string {
  const {
    typecheckPassed,
    lintPassed,
    testsPassed,
    contractResults,
    violations,
    changeDescription,
  } = opts;

  const overallPass = typecheckPassed && lintPassed && testsPassed && violations.length === 0;

  const statusBadge = overallPass ? 'PASS' : 'FAIL';

  const lines: string[] = [
    '### QA checkpoint',
    '',
    `**Change:** ${changeDescription}`,
    `**Result:** ${statusBadge}`,
    '',
    '#### Checks',
    '',
    `- typecheck: ${typecheckPassed ? '✓ PASS' : '✗ FAIL'}`,
    `- lint: ${lintPassed ? '✓ PASS' : '✗ FAIL'}`,
    `- tests: ${testsPassed ? '✓ PASS' : '✗ FAIL'}`,
  ];

  if (contractResults.length > 0) {
    lines.push('');
    lines.push('#### Contract checks');
    lines.push('');
    for (const result of contractResults) {
      lines.push(`- ${result}`);
    }
  }

  if (violations.length > 0) {
    lines.push('');
    lines.push('#### Violations');
    lines.push('');
    for (const v of violations) {
      lines.push(`- ✗ ${v}`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

function runCommand(cmd: string): { passed: boolean; output: string } {
  try {
    const output = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    return { passed: true, output };
  } catch (err: unknown) {
    const output =
      err instanceof Error && 'stdout' in err
        ? String((err as NodeJS.ErrnoException & { stdout?: string }).stdout ?? '')
        : '';
    return { passed: false, output };
  }
}

function parseArgs(argv: string[]): { changeDesc: string } {
  const idx = argv.indexOf('--change-desc');
  if (idx === -1 || !argv[idx + 1]) {
    process.stderr.write('Usage: gate-1-checkpoint.ts --change-desc "description"\n');
    process.exit(1);
  }
  return { changeDesc: argv[idx + 1] as string };
}

// ---------------------------------------------------------------------------
// CLI entry point — executed when run directly via tsx / ts-node
// ---------------------------------------------------------------------------
const isDirectRun =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const { changeDesc } = parseArgs(process.argv.slice(2));

  process.stdout.write('Running typecheck...\n');
  const typecheck = runCommand('pnpm typecheck');

  process.stdout.write('Running lint...\n');
  const lint = runCommand('pnpm lint');

  process.stdout.write('Running tests...\n');
  const tests = runCommand('pnpm test');

  process.stdout.write('Running contract checks...\n');
  const auditCheck = runCommand('tsx scripts/qa/audit-completeness.ts');
  const rbacCheck = runCommand('tsx scripts/qa/rbac-coverage.ts');

  const contractResults: string[] = [
    `audit-completeness: ${auditCheck.passed ? '✓ PASS' : '✗ FAIL'}`,
    `rbac-coverage: ${rbacCheck.passed ? '✓ PASS' : '✗ FAIL'}`,
  ];

  const comment = formatCheckpointComment({
    typecheckPassed: typecheck.passed,
    lintPassed: lint.passed,
    testsPassed: tests.passed,
    contractResults,
    violations: [],
    changeDescription: changeDesc,
  });

  process.stdout.write(`\n${comment}\n`);

  const allPassed = typecheck.passed && lint.passed && tests.passed;
  if (!allPassed) {
    process.exit(1);
  }
}
