// @MX:NOTE [AUTO] TDD RED phase — CER-001 schema and migration shape tests.
// @MX:SPEC SPEC-REGULA-CER-001 (REQ-CER-036~040, REQ-CER-012~013)
//
// Verifies source-level shape of migrations and schema without executing SQL.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const readText = (rel: string): string => fs.readFileSync(path.join(root, rel), 'utf8');

// ---------------------------------------------------------------------------
// Migration 0035 — workflow_type enum 'cer' addition
// ---------------------------------------------------------------------------
describe('0035_cer_workflow_type.sql', () => {
  it('migration file exists', () => {
    const filepath = path.join(root, 'migrations/0035_cer_workflow_type.sql');
    expect(fs.existsSync(filepath), '0035_cer_workflow_type.sql not found').toBe(true);
  });

  it('adds cer value to workflow_type enum', () => {
    const sql = readText('migrations/0035_cer_workflow_type.sql');
    expect(sql).toMatch(/ALTER TYPE.*workflow_type.*ADD VALUE.*'cer'/i);
  });
});

// ---------------------------------------------------------------------------
// Migration 0036 — cer_literature table
// ---------------------------------------------------------------------------
describe('0036_cer_literature.sql', () => {
  it('migration file exists', () => {
    const filepath = path.join(root, 'migrations/0036_cer_literature.sql');
    expect(fs.existsSync(filepath), '0036_cer_literature.sql not found').toBe(true);
  });

  it('creates cer_literature table', () => {
    const sql = readText('migrations/0036_cer_literature.sql');
    expect(sql).toMatch(/CREATE TABLE.*cer_literature/i);
  });

  it('includes required columns', () => {
    const sql = readText('migrations/0036_cer_literature.sql');
    expect(sql).toMatch(/pmid/i);
    expect(sql).toMatch(/title/i);
    expect(sql).toMatch(/abstract/i);
    expect(sql).toMatch(/vancouver_citation/i);
    expect(sql).toMatch(/sign50_level/i);
    expect(sql).toMatch(/grade_quality/i);
    expect(sql).toMatch(/included/i);
    expect(sql).toMatch(/cer_run_id/i);
  });
});

// ---------------------------------------------------------------------------
// Migration 0037 — cer_* audit actions
// ---------------------------------------------------------------------------
describe('0037_cer_audit_actions.sql', () => {
  it('migration file exists', () => {
    const filepath = path.join(root, 'migrations/0037_cer_audit_actions.sql');
    expect(fs.existsSync(filepath), '0037_cer_audit_actions.sql not found').toBe(true);
  });

  it.each([
    'cer_created',
    'cer_stage_completed',
    'cer_expert_approved',
    'cer_exported',
    'cer_literature_search',
  ])('adds %s to audit_action enum (REQ-CER-036~040)', (action) => {
    const sql = readText('migrations/0037_cer_audit_actions.sql');
    expect(sql).toMatch(new RegExp(`ADD VALUE.*'${action}'`, 'i'));
  });
});

// ---------------------------------------------------------------------------
// lib/kernel/db/schema.ts — workflowTypeEnum includes 'cer'
// ---------------------------------------------------------------------------
describe('lib/kernel/db/schema.ts workflowTypeEnum', () => {
  it("workflowTypeEnum includes 'cer' value (REQ-CER-012)", () => {
    const src = readText('lib/kernel/db/schema.ts');
    expect(src).toMatch(/'cer'/);
  });

  it('cerLiterature table is defined in schema', () => {
    const src = readText('lib/kernel/db/schema.ts');
    expect(src).toMatch(/cerLiterature/);
  });
});

// ---------------------------------------------------------------------------
// lib/kernel/audit.ts — CER audit actions in AuditAction type
// ---------------------------------------------------------------------------
describe('lib/kernel/audit.ts CER audit actions (REQ-CER-036~040)', () => {
  it.each([
    'cer_created',
    'cer_stage_completed',
    'cer_expert_approved',
    'cer_exported',
    'cer_literature_search',
  ])("AuditAction type includes '%s'", (action) => {
    const src = readText('lib/kernel/audit.ts');
    expect(src).toMatch(new RegExp(`'${action}'`));
  });
});
