#!/usr/bin/env tsx

import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * QA Gate 1 Checklist Generator
 *
 * Usage:
 *   pnpm qa:gate-1 <issue-number>
 *   pnpm qa:gate-1:comment <issue-number>
 */

interface Issue {
  number: number;
  title: string;
  body: string;
  labels: Array<string | { name: string }>;
}

interface GhLabel {
  name: string;
}

function writeLine(message = ''): void {
  process.stdout.write(`${message}\n`);
}

async function getIssue(issueNumber: number): Promise<Issue> {
  const command = `gh issue view ${issueNumber} --json title,body,labels`;

  try {
    const output = execSync(command, { encoding: 'utf-8' });
    const data = JSON.parse(output);

    // Handle labels (can be string array or object array with name property)
    const labels = Array.isArray(data.labels)
      ? data.labels.map((l: string | GhLabel) => (typeof l === 'string' ? l : l.name))
      : [];

    return {
      number: data.number,
      title: data.title,
      body: data.body,
      labels,
    };
  } catch (error) {
    console.error(`Error fetching issue #${issueNumber}:`, error);
    throw error;
  }
}

function findSPEC(issueNumber: number): string | null {
  try {
    const specFiles = execSync('find .moai/specs -name "spec.md" -type f', { encoding: 'utf-8' })
      .toString()
      .split('\n')
      .filter(Boolean);

    for (const specFile of specFiles) {
      const content = readFileSync(specFile, 'utf-8');
      if (content.includes(`Issue: #${issueNumber}`)) {
        return specFile;
      }
    }

    return null;
  } catch (error) {
    console.error('Error searching for SPEC:', error);
    return null;
  }
}

function extractSPECID(specPath: string | null): string {
  if (!specPath) return '{PENDING}';

  const match = specPath.match(/SPEC-([A-Z0-9-]+)/);
  return match ? `SPEC-${match[1]}` : '{PENDING}';
}

function getCurrentBranch(): string {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch {
    return '{PENDING}';
  }
}

function generateChecklist(issue: Issue, specPath: string | null): string {
  const specID = extractSPECID(specPath);
  const branch = getCurrentBranch();
  const today = new Date().toISOString().split('T')[0] ?? new Date().toISOString();

  let checklist = readFileSync('.moai/specs/_shared/qa-gate-1-checklist.md', 'utf-8');

  checklist = checklist
    .replace(/#{ISSUE_NUMBER}/g, String(issue.number))
    .replace(/{ISSUE_TITLE}/g, issue.title)
    .replace(/{SPEC_ID}/g, specID)
    .replace(/{BRANCH_NAME}/g, branch)
    .replace(/{CHECK_DATE}/g, today);

  return checklist;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || !args[0]) {
    console.error('Usage: tsx qa-gate-1-checklist.ts <issue-number>');
    process.exit(1);
  }

  const issueNumber = Number.parseInt(args[0], 10);

  if (Number.isNaN(issueNumber)) {
    console.error('Invalid issue number:', args[0]);
    process.exit(1);
  }

  writeLine(`Generating QA Gate 1 checkpoint for issue #${issueNumber}...`);

  const issue = await getIssue(issueNumber);
  writeLine(`✓ Issue found: "${issue.title}"`);

  const specPath = findSPEC(issueNumber);
  if (specPath) {
    writeLine(`SPEC found: ${specPath}`);
  } else {
    writeLine('No SPEC found (may be pre-SPEC implementation)');
  }

  const checklist = generateChecklist(issue, specPath);

  writeLine(`\n${'='.repeat(80)}`);
  writeLine('QA GATE 1 CHECKPOINT CHECKLIST');
  writeLine(`${'='.repeat(80)}\n`);

  writeLine(checklist);

  // Save to _generated directory
  const outputPath = `.moai/specs/_generated/qa-gate-1-issue-${issueNumber}.md`;
  mkdirSync('.moai/specs/_generated', { recursive: true });
  writeFileSync(outputPath, checklist);

  writeLine(`\nCheckpoint saved to: ${outputPath}`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
