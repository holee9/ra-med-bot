// @MX:NOTE [AUTO] T-003 (SPEC-REGULA-PREDICATE-001) RED phase — predicate
// schema + audit + migration shape tests. These do NOT execute SQL; they
// verify file-level invariants so a regression to the data model breaks CI
// before it can ship.
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-010, REQ-PRE-017, REQ-PRE-023)

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const readText = (rel: string): string => fs.readFileSync(path.join(root, rel), 'utf8');

const PREDICATE_AUDIT_ACTIONS = ['predicate_search', 'predicate_comparison_generated'] as const;

describe('workflow_type enum (REQ-PRE-010) — predicate_comparison value', () => {
  it('schema.ts workflowTypeEnum includes predicate_comparison', () => {
    const src = readText('lib/kernel/db/schema.ts');
    const match = src.match(/workflowTypeEnum\s*=\s*pgEnum\('workflow_type',\s*\[([\s\S]*?)\]\)/);
    expect(match, 'workflowTypeEnum not found').toBeTruthy();
    const body = (match as RegExpMatchArray)[1] as string;
    expect(body).toMatch(/'predicate_comparison'/);
  });

  it('schema.ts workflowTypeEnum still includes the 3 Phase 9 values', () => {
    const src = readText('lib/kernel/db/schema.ts');
    const match = src.match(/workflowTypeEnum\s*=\s*pgEnum\('workflow_type',\s*\[([\s\S]*?)\]\)/);
    const body = (match as RegExpMatchArray)[1] as string;
    expect(body).toMatch(/'submission_drafter'/);
    expect(body).toMatch(/'audit_response'/);
    expect(body).toMatch(/'indication_impact'/);
  });

  it('the WorkflowType union is assignable from predicate_comparison (compile-time)', async () => {
    const schema = (await import('@/lib/kernel/db/schema')) as Record<string, unknown>;
    const enumDef = schema.workflowTypeEnum as { enumValues: readonly string[] };
    expect(enumDef.enumValues).toContain('predicate_comparison');
  });
});

describe('audit_action lock-step (REQ-PRE-017) — predicate actions', () => {
  it.each(PREDICATE_AUDIT_ACTIONS)(
    'lib/kernel/audit.ts AuditAction union includes %s',
    (action) => {
      const src = readText('lib/kernel/audit.ts');
      const typeMatch = src.match(/export type AuditAction\s*=\s*([\s\S]*?);/);
      expect(typeMatch, 'AuditAction type not found').toBeTruthy();
      const typeBody = (typeMatch as RegExpMatchArray)[1] as string;
      expect(typeBody).toMatch(new RegExp(`'${action}'`));
    },
  );

  it.each(PREDICATE_AUDIT_ACTIONS)('schema.ts auditActionEnum array includes %s', (action) => {
    const src = readText('lib/kernel/db/schema.ts');
    const match = src.match(/auditActionEnum\s*=\s*pgEnum\('audit_action',\s*\[([\s\S]*?)\]\)/);
    expect(match, 'auditActionEnum not found').toBeTruthy();
    const body = (match as RegExpMatchArray)[1] as string;
    expect(body).toMatch(new RegExp(`'${action}'`));
  });

  it('audit lock-step: both predicate actions present in type AND enum (consistency)', () => {
    const auditSrc = readText('lib/kernel/audit.ts');
    const schemaSrc = readText('lib/kernel/db/schema.ts');
    for (const action of PREDICATE_AUDIT_ACTIONS) {
      const pattern = new RegExp(`'${action}'`);
      expect(auditSrc, `'${action}' missing from lib/kernel/audit.ts`).toMatch(pattern);
      expect(schemaSrc, `'${action}' missing from lib/kernel/db/schema.ts`).toMatch(pattern);
    }
  });
});

describe('migration 0029_predicate_workflow_type.sql (REQ-PRE-010)', () => {
  const rel = 'migrations/0029_predicate_workflow_type.sql';

  it('migration file exists', () => {
    expect(fs.existsSync(path.join(root, rel)), `${rel} does not exist`).toBe(true);
  });

  it('uses ALTER TYPE workflow_type ADD VALUE for predicate_comparison', () => {
    const sql = readText(rel);
    expect(sql).toMatch(
      /ALTER TYPE workflow_type ADD VALUE\s+IF NOT EXISTS\s+'predicate_comparison'/,
    );
  });

  it('is isolated: contains no audit_action and no index DDL (own transaction)', () => {
    const sql = readText(rel);
    // ALTER TYPE ... ADD VALUE must run in its own migration; the new enum value
    // cannot be used in the same transaction it was added (Postgres restriction).
    expect(sql).not.toMatch(/CREATE INDEX/);
    expect(sql).not.toMatch(/audit_action/);
  });
});

describe('migration 0030_predicate_index.sql (REQ-PRE-023)', () => {
  const rel = 'migrations/0030_predicate_index.sql';

  it('migration file exists', () => {
    expect(fs.existsSync(path.join(root, rel)), `${rel} does not exist`).toBe(true);
  });

  it('creates a CONCURRENTLY partial index on workflow_runs predicate rows', () => {
    const sql = readText(rel);
    expect(sql).toMatch(/CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_runs_user_predicate/);
    expect(sql).toMatch(/ON workflow_runs/);
    expect(sql).toMatch(/user_id/);
    expect(sql).toMatch(/workflow_type/);
    expect(sql).toMatch(/created_at DESC/);
    expect(sql).toMatch(/WHERE workflow_type = 'predicate_comparison'/);
  });

  it('does NOT add the enum value (separation of concerns from 0029)', () => {
    const sql = readText(rel);
    expect(sql).not.toMatch(/ALTER TYPE workflow_type ADD VALUE/);
  });
});

describe('migration 0031_predicate_audit_actions.sql (REQ-PRE-017)', () => {
  const rel = 'migrations/0031_predicate_audit_actions.sql';

  it('migration file exists', () => {
    expect(fs.existsSync(path.join(root, rel)), `${rel} does not exist`).toBe(true);
  });

  it('adds both predicate audit_action enum values via ALTER TYPE', () => {
    const sql = readText(rel);
    for (const action of PREDICATE_AUDIT_ACTIONS) {
      expect(sql, `missing ALTER TYPE for '${action}'`).toMatch(
        new RegExp(`ALTER TYPE audit_action ADD VALUE\\s+IF NOT EXISTS\\s+'${action}'`),
      );
    }
  });

  it('uses separate ALTER TYPE statements (Postgres requires one per value)', () => {
    const sql = readText(rel);
    const matches = sql.match(/ALTER TYPE audit_action ADD VALUE/g) ?? [];
    expect(matches).toHaveLength(2);
  });
});
