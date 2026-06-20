// @MX:NOTE [AUTO] Regression coverage for auditor DB enum migrations.
// @MX:SPEC SPEC-REGULA-AUDITOR-VIEW-001

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const readText = (rel: string): string => fs.readFileSync(path.join(root, rel), 'utf8');
const fileExists = (rel: string): boolean => fs.existsSync(path.join(root, rel));

const AUDITOR_AUDIT_ACTIONS = ['audit.access', 'audit.denied', 'audit.package.generated'] as const;

describe('SPEC-REGULA-AUDITOR-VIEW-001 — DB enum migrations', () => {
  it('ships migration 0062 for auditor role and audit actions', () => {
    expect(fileExists('migrations/0062_auditor_view_enums.sql')).toBe(true);
  });

  it('adds auditor to PostgreSQL user_role enum', () => {
    const sql = readText('migrations/0062_auditor_view_enums.sql');
    expect(sql).toMatch(/ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'auditor'/);
  });

  it.each(AUDITOR_AUDIT_ACTIONS)('adds %s to PostgreSQL audit_action enum', (action) => {
    const sql = readText('migrations/0062_auditor_view_enums.sql');
    const escaped = action.replace(/\./g, '\\.');
    expect(sql).toMatch(
      new RegExp(`ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS '${escaped}'`),
    );
  });

  it('schema userRoleEnum includes auditor so TypeScript and DB stay aligned', () => {
    const src = readText('lib/db/schema.ts');
    const enumMatch = src.match(
      /export const userRoleEnum\s*=\s*pgEnum\('user_role',\s*\[([\s\S]*?)\]\)/,
    );
    expect(enumMatch, 'userRoleEnum not found').toBeTruthy();
    expect(enumMatch?.[1]).toContain("'auditor'");
  });
});
