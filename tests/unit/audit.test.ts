// @MX:NOTE [AUTO] T-001 TDD RED phase — audit action extension tests.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-057)
//
// These tests verify the source-level shape of lib/audit.ts and the migration
// file without executing SQL. Textual checks ensure the TypeScript union type
// and the ALTER TYPE migration stay in lock-step.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const readText = (rel: string): string => fs.readFileSync(path.join(root, rel), 'utf8');

const extractAuditActionTypeValues = (src: string): string[] => {
  const typeMatch = src.match(/export type AuditAction\s*=\s*([\s\S]*?);/);
  expect(typeMatch, 'AuditAction type not found').toBeTruthy();
  const typeBody = (typeMatch as RegExpMatchArray)[1] as string;
  return (typeBody.match(/'[^']+'/g) ?? []).map((value) => value.slice(1, -1));
};

const BREADTH_ACTIONS = [
  'conversations.list',
  'conversation.view',
  'message.feedback',
  'template.list',
  'template.download',
  'updates.list',
  'dashboard.view',
  'projects.list',
  'project.create',
  'project.update',
] as const;

describe('lib/audit.ts (REQ-BREADTH-057) — extended AuditAction type', () => {
  it('exports writeAudit function', () => {
    const src = readText('lib/audit.ts');
    expect(src).toMatch(/export async function writeAudit\(/);
  });

  it('AuditAction type includes all 3 original Phase 1 values', () => {
    const src = readText('lib/audit.ts');
    expect(src).toMatch(/'llm\.call'/);
    expect(src).toMatch(/'source\.access'/);
    expect(src).toMatch(/'expert_review\.flag'/);
  });

  it.each(BREADTH_ACTIONS)('AuditAction type includes new BREADTH action: %s', (action) => {
    const src = readText('lib/audit.ts');
    // Escape dots for regex
    const escaped = action.replace(/\./g, '\\.');
    expect(src).toMatch(new RegExp(`'${escaped}'`));
  });

  it('AuditAction type includes current regulated workflow actions through risk management', () => {
    const src = readText('lib/audit.ts');
    const values = extractAuditActionTypeValues(src);
    expect(values).toEqual(
      expect.arrayContaining([
        'standards_searched',
        'device_classified',
        'digest_generated',
        'samd_assessment_created',
        'dhf_created',
        'submission_validation_completed',
        'risk.report_approved',
      ]),
    );
    expect(values).toHaveLength(91);
  });

  it.each([
    'cer_created',
    'cer_stage_completed',
    'cer_expert_approved',
    'cer_exported',
    'cer_literature_search',
  ])('AuditAction type includes CER action: %s (REQ-CER-036~040)', (action) => {
    const src = readText('lib/audit.ts');
    expect(src).toMatch(new RegExp(`'${action}'`));
  });

  it('AuditAction type includes Issue #7 remediation action: conversation.delete', () => {
    const src = readText('lib/audit.ts');
    expect(src).toMatch(/'conversation\.delete'/);
  });
});

describe('migrations/0003_breadth_audit_actions.sql (REQ-BREADTH-057)', () => {
  it('migration file exists', () => {
    const sqlPath = path.join(root, 'migrations', '0003_breadth_audit_actions.sql');
    expect(fs.existsSync(sqlPath), '0003_breadth_audit_actions.sql does not exist').toBe(true);
  });

  it('uses ALTER TYPE audit_action ADD VALUE for each new action', () => {
    const sql = readText('migrations/0003_breadth_audit_actions.sql');
    for (const action of BREADTH_ACTIONS) {
      expect(sql, `missing ALTER TYPE for '${action}'`).toMatch(
        new RegExp(`ALTER TYPE audit_action ADD VALUE\\s+'${action.replace(/\./g, '\\.')}'`),
      );
    }
  });

  it('has exactly 10 ALTER TYPE statements (one per new value)', () => {
    const sql = readText('migrations/0003_breadth_audit_actions.sql');
    const matches = sql.match(/ALTER TYPE audit_action ADD VALUE/g) ?? [];
    expect(matches).toHaveLength(10);
  });

  it('does NOT use a combined ALTER TYPE (PostgreSQL requires separate statements)', () => {
    const sql = readText('migrations/0003_breadth_audit_actions.sql');
    // Single-line combined ALTER is a common mistake; each must be separate
    const lines = sql.split('\n').filter((l) => l.includes('ALTER TYPE audit_action ADD VALUE'));
    expect(lines).toHaveLength(10);
  });
});
