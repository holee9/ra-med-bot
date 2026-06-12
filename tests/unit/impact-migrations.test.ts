// SPEC-REGULA-IMPACT-001 — static shape verification for impact tables and audit wiring.
// These tests run without a database: they parse source/migration files and assert
// structural contracts (column presence, audit action membership, schema exports).

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');

function readText(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function readMigration(name: string): string {
  return readText(`migrations/${name}`);
}

// ---------------------------------------------------------------------------
// Migration 0033 — regulatory_impact_assessments + impact_action_items tables
// ---------------------------------------------------------------------------
describe('migration 0033_impact_tables.sql', () => {
  const sql = readMigration('0033_impact_tables.sql');

  it('creates regulatory_impact_assessments table', () => {
    expect(sql).toMatch(/CREATE TABLE.*regulatory_impact_assessments/i);
  });

  it('creates impact_action_items table', () => {
    expect(sql).toMatch(/CREATE TABLE.*impact_action_items/i);
  });

  it('regulatory_impact_assessments has required columns', () => {
    for (const col of [
      'id',
      'regulatory_update_id',
      'project_id',
      'impact_level',
      'affected_sections',
      'analysis_summary',
      'confidence',
      'created_by',
      'created_at',
    ]) {
      expect(sql, `column ${col} missing from regulatory_impact_assessments`).toContain(col);
    }
  });

  it('impact_action_items has required columns', () => {
    for (const col of [
      'id',
      'assessment_id',
      'project_id',
      'priority',
      'description',
      'status',
      'created_at',
    ]) {
      expect(sql, `column ${col} missing from impact_action_items`).toContain(col);
    }
  });

  it('regulatory_impact_assessments has UNIQUE(regulatory_update_id, project_id)', () => {
    expect(sql).toMatch(/ria_update_project_key/i);
  });

  it('impact_level CHECK constraint covers expected values', () => {
    expect(sql).toContain('critical');
    expect(sql).toContain('high');
    expect(sql).toContain('medium');
    expect(sql).toContain('info');
  });
});

// ---------------------------------------------------------------------------
// Migration 0034 — audit action enum additions
// ---------------------------------------------------------------------------
describe('migration 0034_impact_audit_actions.sql', () => {
  const sql = readMigration('0034_impact_audit_actions.sql');

  const EXPECTED = [
    'impact.assessment_created',
    'impact.critical_detected',
    'impact.action_item_created',
  ];

  it.each(EXPECTED)('adds audit action: %s', (action) => {
    expect(sql).toContain(action);
  });

  it('uses ADD VALUE IF NOT EXISTS for idempotency', () => {
    expect(sql).toMatch(/ADD VALUE IF NOT EXISTS/i);
  });
});

// ---------------------------------------------------------------------------
// lib/db/schema.ts — Drizzle table exports
// ---------------------------------------------------------------------------
describe('lib/db/schema.ts impact table exports', () => {
  const src = readText('lib/db/schema.ts');

  it('exports regulatoryImpactAssessments', () => {
    expect(src).toContain('export const regulatoryImpactAssessments');
  });

  it('exports impactActionItems', () => {
    expect(src).toContain('export const impactActionItems');
  });

  it('auditActionEnum includes all three impact actions', () => {
    const enumSection = src.match(/export const auditActionEnum\s*=[\s\S]*?(?=\n\/\/|\nexport|$)/);
    expect(enumSection, 'auditActionEnum not found').toBeTruthy();
    const body = (enumSection as RegExpMatchArray)[0];
    expect(body).toContain("'impact.assessment_created'");
    expect(body).toContain("'impact.critical_detected'");
    expect(body).toContain("'impact.action_item_created'");
  });
});

// ---------------------------------------------------------------------------
// lib/audit.ts — AuditAction type sync
// ---------------------------------------------------------------------------
describe('lib/audit.ts impact AuditAction values', () => {
  const src = readText('lib/audit.ts');

  const IMPACT_ACTIONS = [
    'impact.assessment_created',
    'impact.critical_detected',
    'impact.action_item_created',
  ];

  it.each(IMPACT_ACTIONS)('AuditAction type includes: %s', (action) => {
    const escaped = action.replace(/\./g, '\\.');
    expect(src).toMatch(new RegExp(`'${escaped}'`));
  });
});

// ---------------------------------------------------------------------------
// lib/impact/ — module exports
// ---------------------------------------------------------------------------
describe('lib/impact module exports', () => {
  it('lib/impact/analyzer.ts exports analyzeImpact and listAssessmentsForOrg', () => {
    const src = readText('lib/impact/analyzer.ts');
    expect(src).toContain('export async function analyzeImpact');
    expect(src).toContain('export async function listAssessmentsForOrg');
  });

  it('lib/impact/types.ts exports ImpactLevel and ImpactAssessment', () => {
    const src = readText('lib/impact/types.ts');
    expect(src).toContain('ImpactLevel');
    expect(src).toContain('ImpactAssessment');
  });

  it('lib/impact/portfolio-scanner.ts exports scanPortfolio', () => {
    const src = readText('lib/impact/portfolio-scanner.ts');
    expect(src).toContain('export async function scanPortfolio');
  });

  it('lib/impact/audit-wiring.ts exports the three audit helpers', () => {
    const src = readText('lib/impact/audit-wiring.ts');
    expect(src).toContain('export async function auditAssessmentCreated');
    expect(src).toContain('export async function auditCriticalDetected');
    expect(src).toContain('export async function auditActionItemCreated');
  });
});

// ---------------------------------------------------------------------------
// Route handler files exist
// ---------------------------------------------------------------------------
describe('impact route handlers exist', () => {
  it('admin trigger route exists', () => {
    expect(() => readText('app/api/admin/radar/impact/route.ts')).not.toThrow();
  });

  it('ra impact list route exists', () => {
    expect(() => readText('app/api/ra/impact/route.ts')).not.toThrow();
  });

  it('ra impact detail route exists', () => {
    expect(() => readText('app/api/ra/impact/[assessmentId]/route.ts')).not.toThrow();
  });
});
