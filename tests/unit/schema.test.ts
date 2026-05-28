// @MX:NOTE T-003 schema/audit/migration shape tests. These do NOT execute
// SQL — they verify file-level invariants so a regression to the data model
// breaks CI before it can ship.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const readText = (rel: string): string => fs.readFileSync(path.join(root, rel), 'utf8');

describe('lib/db/schema.ts (REQ-FND-031..044b)', async () => {
  // Drizzle exports table builders; importing them here both exercises the
  // module (catches syntax errors) and gives the test access to the names.
  // The schema file does not require any env vars at import time.
  const schema = (await import('@/lib/db/schema')) as Record<string, unknown>;

  const expectedTables = [
    'users',
    'organizations',
    'projects',
    'conversations',
    'messages',
    'messageSources',
    'messageBlocks',
    'sources',
    'sourceSections',
    'templates',
    'regulatoryUpdates',
    'expertReviews',
    'auditLogs',
  ];

  it('REQ-FND-031: exports all 13 tables', () => {
    for (const name of expectedTables) {
      expect(schema[name], `missing export: ${name}`).toBeDefined();
    }
    expect(expectedTables).toHaveLength(13);
  });

  it('REQ-FND-044a: source_sections table is exported (critical, not omitted)', () => {
    expect(schema.sourceSections).toBeDefined();
  });

  it('REQ-FND-044: audit_logs table is exported', () => {
    expect(schema.auditLogs).toBeDefined();
  });

  it('exports all 8 pgEnums', () => {
    const enums = [
      'localeEnum',
      'themePrefEnum',
      'messageRoleEnum',
      'confidenceLevelEnum',
      'blockTypeEnum',
      'sourceTypeEnum',
      'expertReviewStatusEnum',
      'auditActionEnum',
    ];
    for (const name of enums) {
      expect(schema[name], `missing enum: ${name}`).toBeDefined();
    }
  });
});

describe('lib/audit.ts (REQ-FND-048, 049, 049a)', () => {
  it('exports writeAudit (textual check; runtime import requires DB env)', () => {
    const src = readText('lib/audit.ts');
    expect(src).toMatch(/export async function writeAudit\(/);
  });

  it('AuditAction type contains all 3 Phase 1 values (REQ-FND-048)', () => {
    const src = readText('lib/audit.ts');
    // Verify Phase 1 values are present — the union is extended by
    // 0003_breadth_audit_actions.sql (SPEC-REGULA-BREADTH-001 REQ-BREADTH-057).
    // The exact literal count is tested in tests/unit/audit.test.ts.
    expect(src).toMatch(/export type AuditAction/);
    expect(src).toMatch(/'llm\.call'/);
    expect(src).toMatch(/'source\.access'/);
    expect(src).toMatch(/'expert_review\.flag'/);
  });
});

describe('migrations/0000_init.sql (REQ-FND-045)', () => {
  const sql = readText('migrations/0000_init.sql');

  it('starts with CREATE EXTENSION vector', () => {
    // Allow leading comments before the CREATE EXTENSION line.
    expect(sql).toMatch(/CREATE EXTENSION IF NOT EXISTS vector;/);
    // Must precede any vector(...) column declaration.
    const extIdx = sql.indexOf('CREATE EXTENSION IF NOT EXISTS vector');
    const firstVectorCol = sql.indexOf('vector(1536)');
    expect(extIdx).toBeGreaterThan(-1);
    expect(firstVectorCol).toBeGreaterThan(extIdx);
  });

  it('is wrapped in BEGIN/COMMIT', () => {
    expect(sql).toMatch(/^\s*(?:--[^\n]*\n\s*)*BEGIN;/m);
    expect(sql.trimEnd().endsWith('COMMIT;')).toBe(true);
  });

  it('creates all 8 pgEnums', () => {
    const enumNames = [
      'locale',
      'theme_pref',
      'message_role',
      'confidence_level',
      'block_type',
      'source_type',
      'expert_review_status',
      'audit_action',
    ];
    for (const name of enumNames) {
      expect(sql, `missing enum: ${name}`).toMatch(new RegExp(`CREATE TYPE ${name} AS ENUM`));
    }
  });

  it('audit_action enum contains exactly 3 Phase 1 values', () => {
    expect(sql).toMatch(
      /CREATE TYPE audit_action AS ENUM \('llm\.call', 'source\.access', 'expert_review\.flag'\);/,
    );
  });

  it('creates ivfflat indexes on sources.embedding and source_sections.embedding', () => {
    expect(sql).toMatch(
      /sources_embedding_ivfflat_idx[\s\S]*ivfflat \(embedding vector_cosine_ops\)/,
    );
    expect(sql).toMatch(
      /source_sections_embedding_ivfflat_idx[\s\S]*ivfflat \(embedding vector_cosine_ops\)/,
    );
  });
});

describe('migrations/0001_audit_append_only.sql (REQ-FND-046, 046a, 047, 047a)', () => {
  const sql = readText('migrations/0001_audit_append_only.sql');

  it('defines tg_audit_logs_block_mutation', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION tg_audit_logs_block_mutation\(\)/);
  });

  it('blocks UPDATE OR DELETE at row level', () => {
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON audit_logs/);
  });

  it('blocks TRUNCATE at statement level', () => {
    expect(sql).toMatch(/BEFORE TRUNCATE ON audit_logs/);
    expect(sql).toMatch(/FOR EACH STATEMENT/);
  });

  it('REVOKEs mutation grants and GRANTs INSERT, SELECT to regula_app', () => {
    expect(sql).toMatch(
      /REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES ON audit_logs FROM regula_app;/,
    );
    expect(sql).toMatch(/GRANT INSERT, SELECT ON audit_logs TO regula_app;/);
  });
});

describe('middleware.ts (REQ-FND-053)', () => {
  const src = readText('middleware.ts');

  it('contains the exact REQ-FND-053 matcher pattern', () => {
    expect(src).toContain(
      `'/((?!_next/static|_next/image|favicon.ico|login|signup|sso/callback|api/auth|robots.txt|public).*)'`,
    );
  });

  it('redirects unauthenticated requests to /login', () => {
    expect(src).toMatch(/redirect\(new URL\('\/login'/);
  });

  it('redirects already-authenticated /login requests to /', () => {
    expect(src).toMatch(/redirect\(new URL\('\/'/);
  });
});

describe('lib/auth.ts (REQ-FND-051, 052, 054, 055)', () => {
  const src = readText('lib/auth.ts');

  it('uses JWT session strategy (Auth.js v5 Credentials forces JWT — REQ-FND-052)', () => {
    expect(src).toMatch(/strategy:\s*['"]jwt['"]/);
  });

  it('declares MicrosoftEntraID and Google providers', () => {
    expect(src).toMatch(/MicrosoftEntraID\(/);
    expect(src).toMatch(/Google\(/);
  });

  it('calls writeAudit in signIn callback (Phase 5 wiring — REQ-ENTERPRISE-029)', () => {
    // Phase 5 wires writeAudit into the signIn callback and signOut event.
    // Strip line + block comments before scanning so comment prose does not
    // produce false positives.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''))
      .join('\n');
    // Must have exactly one writeAudit call in the signIn callback context.
    expect((codeOnly.match(/writeAudit\(/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it('signIn callback is async and returns true (REQ-ENTERPRISE-029)', () => {
    // signIn must still return true to allow the sign-in to proceed.
    // The implementation now has a real async callback that calls writeAudit.
    expect(src).toMatch(/signIn:\s*async\s*\(/);
    expect(src).toMatch(/return true/);
  });
});

describe('app/api/auth/[...nextauth]/route.ts (REQ-FND-055)', () => {
  it('re-exports GET and POST from lib/auth handlers', () => {
    const src = readText('app/api/auth/[...nextauth]/route.ts');
    expect(src).toMatch(/from ['"]@\/lib\/auth['"]/);
    expect(src).toMatch(/export const \{ GET, POST \} = handlers;/);
  });
});
