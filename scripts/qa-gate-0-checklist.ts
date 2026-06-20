#!/usr/bin/env ts

/**
 * QA Gate 0 Checklist Generator
 *
 * Usage:
 *   pnpm tsx scripts/qa-gate-0-checklist.ts <issue-number>
 *
 * Description:
 *   Generates a QA Gate 0 checklist for a given issue.
 *   Fetches issue details from GitHub, loads SPEC if exists,
 *   and creates a populated checklist from the template.
 */

import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

interface Issue {
  number: number;
  title: string;
  body: string | null;
  labels: string[];
}

interface GhLabel {
  name?: unknown;
}

function print(message = '') {
  process.stdout.write(`${message}\n`);
}

function printError(message: string) {
  process.stderr.write(`${message}\n`);
}

/**
 * Fetch issue details from GitHub CLI
 */
async function getIssue(issueNumber: number): Promise<Issue> {
  try {
    const output = execSync(`gh issue view ${issueNumber} --json number,title,body,labels`, {
      encoding: 'utf-8',
    });
    const data = JSON.parse(output);
    return {
      number: data.number,
      title: data.title,
      body: data.body,
      labels: Array.isArray(data.labels)
        ? data.labels.map((label: string | GhLabel) =>
            typeof label === 'string' || typeof label.name === 'string'
              ? typeof label === 'string'
                ? label
                : label.name
              : '',
          )
        : [],
    };
  } catch (error) {
    throw new Error(`Failed to fetch issue #${issueNumber}: ${error}`);
  }
}

/**
 * Find SPEC document for an issue
 */
function findSPEC(issueNumber: number): string | null {
  try {
    const output = execSync(
      `find .moai/specs -name "spec.md" -type f -exec grep -l "Issue: #${issueNumber}" {} \\;`,
      { encoding: 'utf-8' },
    );
    const specs = output.trim().split('\n').filter(Boolean);
    return specs[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Generate checklist from template
 */
function generateChecklist(issue: Issue, specPath: string | null): string {
  const template = readFileSync(
    join(process.cwd(), '.moai/specs/_shared/qa-gate-0-checklist.md'),
    'utf-8',
  );

  const today = new Date().toISOString().slice(0, 10);
  const specId = specPath ? specPath.match(/SPEC-REGULA-[^/]+/)?.[0] || 'N/A' : 'N/A';

  let checklist = template
    .replace(/{ISSUE_NUMBER}/g, issue.number.toString())
    .replace(/{ISSUE_TITLE}/g, issue.title)
    .replace(/{SPEC_ID}/g, specId)
    .replace(/{SPEC_PATH}/g, specPath || 'N/A')
    .replace(/{CHECK_DATE}/g, today)
    .replace(/{BRANCH_NAME}/g, `fix/issue-${issue.number}`)
    .replace(/{REVIEWER_NAME}/g, '{PENDING}')
    .replace(/{REVIEWER_COMMENTS}/g, '{PENDING}');

  // Auto-check some items based on issue state
  if (issue.labels.includes('type/spec')) {
    checklist = checklist.replace(
      '- [ ] Issue body scope matches SPEC document',
      '- [x] Issue body scope matches SPEC document (SPEC issue type detected)',
    );
  }

  return checklist;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  const issueArg = args[0];

  if (!issueArg) {
    printError('Usage: pnpm tsx scripts/qa-gate-0-checklist.ts <issue-number>');
    process.exit(1);
  }

  const issueNumber = Number.parseInt(issueArg, 10);

  if (Number.isNaN(issueNumber)) {
    printError(`Invalid issue number: ${issueArg}`);
    process.exit(1);
  }

  try {
    print(`Generating QA Gate 0 checklist for issue #${issueNumber}...`);

    // Fetch issue details
    const issue = await getIssue(issueNumber);
    print(`Issue found: "${issue.title}"`);

    // Find SPEC document
    const specPath = findSPEC(issueNumber);
    if (specPath) {
      print(`SPEC found: ${specPath}`);
    } else {
      print('No SPEC document found (will proceed with issue only)');
    }

    // Generate checklist
    const checklist = generateChecklist(issue, specPath);

    // Write to stdout (can be redirected to file or copied)
    print(`\n${'='.repeat(80)}`);
    print('QA GATE 0 CHECKLIST');
    print(`${'='.repeat(80)}\n`);
    print(checklist);

    // Also write to file for reference
    const outputPath = join(
      process.cwd(),
      `.moai/specs/_generated/qa-gate-0-issue-${issueNumber}.md`,
    );
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, checklist, 'utf-8');
    print(`\nChecklist saved to: ${outputPath}`);
  } catch (error) {
    printError(`Error: ${error}`);
    process.exit(1);
  }
}

main();
