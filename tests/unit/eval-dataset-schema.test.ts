/**
 * SPEC-REGULA-LAUNCH-001 — REQ-LAUNCH-003 (TASK-002)
 *
 * Validates that all eval dataset YAML files exist with correct schema and entry counts.
 *
 * RED phase: fails until GREEN phase creates all dataset files.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const DATASETS_DIR = path.join(ROOT, 'tests', 'eval', 'datasets');

// ---------------------------------------------------------------------------
// Helper: parse a YAML dataset file into raw entries (no YAML parser needed —
// we count top-level "- " list items which is reliable for the flat format)
// ---------------------------------------------------------------------------
function countTopLevelEntries(filePath: string): number {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Each test case starts with "- description:" at the beginning of a line
  const matches = content.match(/^- description:/gm);
  return matches ? matches.length : 0;
}

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function fileContent(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

// ---------------------------------------------------------------------------
// REQ-LAUNCH-003: Dataset files exist
// ---------------------------------------------------------------------------
describe('REQ-LAUNCH-003: eval dataset files exist', () => {
  const expectedFiles = [
    'tests/eval/datasets/fda.yaml',
    'tests/eval/datasets/eu-mdr.yaml',
    'tests/eval/datasets/mfds.yaml',
    'tests/eval/datasets/nmpa.yaml',
    'tests/eval/datasets/pmda.yaml',
    'tests/eval/datasets/internal-sop.yaml',
    'tests/eval/datasets/REVIEWED.md',
  ];

  for (const filePath of expectedFiles) {
    it(`${filePath} exists`, () => {
      expect(fileExists(filePath), `${filePath} does not exist`).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// Entry count validation
// ---------------------------------------------------------------------------
describe('Dataset entry counts match specification', () => {
  it('fda.yaml has exactly 15 entries', () => {
    const count = countTopLevelEntries(path.join(DATASETS_DIR, 'fda.yaml'));
    expect(count).toBe(15);
  });

  it('eu-mdr.yaml has exactly 15 entries', () => {
    const count = countTopLevelEntries(path.join(DATASETS_DIR, 'eu-mdr.yaml'));
    expect(count).toBe(15);
  });

  it('mfds.yaml has exactly 10 entries', () => {
    const count = countTopLevelEntries(path.join(DATASETS_DIR, 'mfds.yaml'));
    expect(count).toBe(10);
  });

  it('nmpa.yaml has exactly 5 entries', () => {
    const count = countTopLevelEntries(path.join(DATASETS_DIR, 'nmpa.yaml'));
    expect(count).toBe(5);
  });

  it('pmda.yaml has exactly 5 entries', () => {
    const count = countTopLevelEntries(path.join(DATASETS_DIR, 'pmda.yaml'));
    expect(count).toBe(5);
  });

  it('internal-sop.yaml has exactly 5 entries', () => {
    const count = countTopLevelEntries(path.join(DATASETS_DIR, 'internal-sop.yaml'));
    expect(count).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Schema field validation — each entry must have required promptfoo fields
// ---------------------------------------------------------------------------
describe('Dataset YAML files have required schema fields', () => {
  const datasets = [
    'fda.yaml',
    'eu-mdr.yaml',
    'mfds.yaml',
    'nmpa.yaml',
    'pmda.yaml',
    'internal-sop.yaml',
  ];

  for (const dataset of datasets) {
    it(`${dataset} contains required fields (description, vars, assert)`, () => {
      const content = fileContent(`tests/eval/datasets/${dataset}`);
      expect(content).toMatch(/description:/);
      expect(content).toMatch(/vars:/);
      expect(content).toMatch(/assert:/);
    });

    it(`${dataset} vars block contains query field`, () => {
      const content = fileContent(`tests/eval/datasets/${dataset}`);
      expect(content).toMatch(/query:/);
    });

    it(`${dataset} vars block contains jurisdiction field`, () => {
      const content = fileContent(`tests/eval/datasets/${dataset}`);
      expect(content).toMatch(/jurisdiction:/);
    });

    it(`${dataset} assert block contains type: javascript`, () => {
      const content = fileContent(`tests/eval/datasets/${dataset}`);
      expect(content).toMatch(/type: javascript/);
    });
  }
});

// ---------------------------------------------------------------------------
// REVIEWED.md content validation
// ---------------------------------------------------------------------------
describe('REVIEWED.md has correct structure', () => {
  const reviewedPath = 'tests/eval/datasets/REVIEWED.md';

  it('REVIEWED.md contains Status: PENDING REVIEW', () => {
    const content = fileContent(reviewedPath);
    expect(content).toContain('PENDING REVIEW');
  });

  it('REVIEWED.md contains checkboxes for all 6 datasets', () => {
    const content = fileContent(reviewedPath);
    expect(content).toMatch(/- \[ \] fda\.yaml/);
    expect(content).toMatch(/- \[ \] eu-mdr\.yaml/);
    expect(content).toMatch(/- \[ \] mfds\.yaml/);
    expect(content).toMatch(/- \[ \] nmpa\.yaml/);
    expect(content).toMatch(/- \[ \] pmda\.yaml/);
    expect(content).toMatch(/- \[ \] internal-sop\.yaml/);
  });

  it('REVIEWED.md contains RA Lead sign-off section', () => {
    const content = fileContent(reviewedPath);
    expect(content).toContain('RA Lead');
  });
});
