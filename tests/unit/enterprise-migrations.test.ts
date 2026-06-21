// @MX:NOTE [AUTO] T-001 TDD RED phase — Phase 5 Enterprise migration shape tests.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-009, REQ-ENTERPRISE-016,
//   REQ-ENTERPRISE-027, REQ-ENTERPRISE-028)
//
// These tests verify file-level invariants for the 6 Phase 5 migrations WITHOUT
// executing SQL. Textual checks ensure schema.ts, audit.ts, and migration files
// stay in lock-step.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const readText = (rel: string): string => fs.readFileSync(path.join(root, rel), 'utf8');
const fileExists = (rel: string): boolean => fs.existsSync(path.join(root, rel));

const extractAuditActionEnumValues = (src: string): string[] => {
  const enumSection = src.match(/export const auditActionEnum\s*=[\s\S]*?(?=\n\/\/|\nexport|$)/);
  expect(enumSection, 'auditActionEnum not found').toBeTruthy();
  const valueMatches = (enumSection as RegExpMatchArray)[0].match(/'[^']+'/g) ?? [];
  return valueMatches.slice(1).map((value) => value.slice(1, -1));
};

const extractAuditActionTypeValues = (src: string): string[] => {
  const typeMatch = src.match(/export type AuditAction\s*=\s*([\s\S]*?);/);
  expect(typeMatch, 'AuditAction type not found').toBeTruthy();
  const typeBody = (typeMatch as RegExpMatchArray)[1] as string;
  return (typeBody.match(/'[^']+'/g) ?? []).map((value) => value.slice(1, -1));
};

// ---------------------------------------------------------------------------
// Migration 1: user_role pgEnum (REQ-ENTERPRISE-016)
// ---------------------------------------------------------------------------
describe('Migration 1: user_role pgEnum (REQ-ENTERPRISE-016)', () => {
  it('migration file 0004_user_role_enum.sql exists', () => {
    expect(fileExists('migrations/0004_user_role_enum.sql')).toBe(true);
  });

  it('creates user_role enum type with 4 values', () => {
    const sql = readText('migrations/0004_user_role_enum.sql');
    expect(sql).toMatch(/CREATE TYPE user_role AS ENUM/);
    expect(sql).toMatch(/'admin'/);
    expect(sql).toMatch(/'ra-lead'/);
    expect(sql).toMatch(/'ra-member'/);
    expect(sql).toMatch(/'viewer'/);
  });

  it('migrates existing member values to ra-member', () => {
    const sql = readText('migrations/0004_user_role_enum.sql');
    // Must UPDATE existing 'member' rows before altering column type
    expect(sql).toMatch(/UPDATE users/i);
    expect(sql).toMatch(/member.*ra-member|ra-member.*member/);
  });

  it('alters users.role column to use user_role type', () => {
    const sql = readText('migrations/0004_user_role_enum.sql');
    expect(sql).toMatch(/ALTER TABLE users/i);
    expect(sql).toMatch(/ALTER COLUMN role/i);
    expect(sql).toMatch(/user_role/);
  });

  it('sets NOT NULL and DEFAULT ra-member on users.role', () => {
    const sql = readText('migrations/0004_user_role_enum.sql');
    expect(sql).toMatch(/NOT NULL|SET NOT NULL/i);
    expect(sql).toMatch(/DEFAULT\s+'ra-member'/i);
  });
});

// ---------------------------------------------------------------------------
// Migration 2: audit_action enum extension +12 values (REQ-ENTERPRISE-028)
// ---------------------------------------------------------------------------
const ENTERPRISE_AUDIT_ACTIONS = [
  'auth.login',
  'auth.logout',
  'session.invalidate',
  'expert_review.create',
  'expert_review.assign',
  'expert_review.resolve',
  'rbac.permission_deny',
  'profile.theme_update',
  'profile.locale_update',
  'checklist.toggle',
  'consult.expert_review_auto_flag',
  'project.switch',
] as const;

const REQUIRED_RECOVERY_TABLES = [
  ['device_classifications', 'deviceClassifications'],
  ['regulatory_impact_assessments', 'regulatoryImpactAssessments'],
  ['impact_action_items', 'impactActionItems'],
  ['samd_assessments', 'samdAssessments'],
  ['design_history_files', 'designHistoryFiles'],
  ['submission_packages', 'submissionPackages'],
  ['pccp_versions', 'pccpVersions'],
  ['weekly_digests', 'weeklyDigests'],
  ['org_digest_preferences', 'orgDigestPreferences'],
  ['adverse_events', 'adverseEvents'],
  ['reportability_assessments', 'reportabilityAssessments'],
  ['vigilance_reports', 'vigilanceReports'],
] as const;

const REQUIRED_RECOVERY_AUDIT_ACTIONS = [
  'standards_searched',
  'standards_gap_analyzed',
  'standards_compliance_updated',
  'cer_created',
  'cer_stage_completed',
  'cer_expert_approved',
  'cer_exported',
  'cer_literature_search',
  'device_classified',
  'digest_generated',
  'digest_emailed',
  'samd_assessment_created',
  'samd_assessment_updated',
  'samd_review_approved',
  'dhf_created',
  'dhf_updated',
  'dhf_design_freeze',
  'dhf_review_approved',
  'submission_package_created',
  'submission_package_submitted',
  'submission_validation_completed',
] as const;

describe('Migration 2: audit_action enum +12 values (REQ-ENTERPRISE-028)', () => {
  it('migration file 0005_enterprise_audit_actions.sql exists', () => {
    expect(fileExists('migrations/0005_enterprise_audit_actions.sql')).toBe(true);
  });

  it.each(ENTERPRISE_AUDIT_ACTIONS)('adds ALTER TYPE audit_action ADD VALUE for: %s', (action) => {
    const sql = readText('migrations/0005_enterprise_audit_actions.sql');
    const escaped = action.replace(/\./g, '\\.');
    expect(sql, `missing ALTER TYPE for '${action}'`).toMatch(
      new RegExp(`ALTER TYPE audit_action ADD VALUE\\s+IF NOT EXISTS\\s+'${escaped}'`),
    );
  });

  it('has exactly 12 ALTER TYPE statements', () => {
    const sql = readText('migrations/0005_enterprise_audit_actions.sql');
    const matches = sql.match(/ALTER TYPE audit_action ADD VALUE/g) ?? [];
    expect(matches).toHaveLength(12);
  });

  it('does NOT add auth.mfa_fail as enum value (removed in v0.3.0 H-5)', () => {
    const sql = readText('migrations/0005_enterprise_audit_actions.sql');
    // Must not contain an ADD VALUE statement for auth.mfa_fail.
    // Comments mentioning it (e.g. "not included") are allowed.
    expect(sql).not.toMatch(/ADD VALUE\s+IF NOT EXISTS\s+'auth\.mfa_fail'/);
    expect(sql).not.toMatch(/ADD VALUE\s+'auth\.mfa_fail'/);
  });
});

// ---------------------------------------------------------------------------
// Migration 3: users.notification_pref column (REQ-ENTERPRISE-027)
// ---------------------------------------------------------------------------
describe('Migration 3: users.notification_pref column (REQ-ENTERPRISE-027)', () => {
  it('migration file 0006_notification_pref.sql exists', () => {
    expect(fileExists('migrations/0006_notification_pref.sql')).toBe(true);
  });

  it('adds notification_pref jsonb column to users table', () => {
    const sql = readText('migrations/0006_notification_pref.sql');
    expect(sql).toMatch(/ALTER TABLE users/i);
    expect(sql).toMatch(/ADD COLUMN.*notification_pref|notification_pref.*ADD COLUMN/i);
    expect(sql).toMatch(/jsonb/i);
  });

  it('notification_pref column has NOT NULL and DEFAULT empty object', () => {
    const sql = readText('migrations/0006_notification_pref.sql');
    expect(sql).toMatch(/NOT NULL/i);
    expect(sql).toMatch(/DEFAULT\s+'\{\}'/i);
  });
});

// ---------------------------------------------------------------------------
// Migration 4: expert_reviews composite index (Risk R9 mitigation)
// ---------------------------------------------------------------------------
describe('Migration 4: expert_reviews composite index', () => {
  it('migration file 0007_expert_reviews_index.sql exists', () => {
    expect(fileExists('migrations/0007_expert_reviews_index.sql')).toBe(true);
  });

  it('creates composite index on expert_reviews(status, assigned_to)', () => {
    const sql = readText('migrations/0007_expert_reviews_index.sql');
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS/i);
    expect(sql).toMatch(/idx_expert_reviews_status_assigned/);
    expect(sql).toMatch(/ON expert_reviews/i);
    expect(sql).toMatch(/status.*assigned_to|assigned_to.*status/i);
  });
});

// ---------------------------------------------------------------------------
// Migration 5: SYSTEM_USER_UUID seed (REQ-ENTERPRISE-009)
// ---------------------------------------------------------------------------
describe('Migration 5: SYSTEM_USER_UUID seed (REQ-ENTERPRISE-009)', () => {
  it('migration file 0008_system_user_seed.sql exists', () => {
    expect(fileExists('migrations/0008_system_user_seed.sql')).toBe(true);
  });

  it('upserts the fixed SYSTEM_USER_UUID', () => {
    const sql = readText('migrations/0008_system_user_seed.sql');
    expect(sql).toMatch(/00000000-0000-0000-0000-000000000001/);
    expect(sql).toMatch(/INSERT INTO users/i);
  });

  it('uses ON CONFLICT DO NOTHING for idempotency', () => {
    const sql = readText('migrations/0008_system_user_seed.sql');
    expect(sql).toMatch(/ON CONFLICT.*DO NOTHING/i);
  });

  it('sets system user role to admin and email to system@regula.internal', () => {
    const sql = readText('migrations/0008_system_user_seed.sql');
    expect(sql).toMatch(/admin/);
    expect(sql).toMatch(/system@regula\.internal/);
  });
});

// ---------------------------------------------------------------------------
// Migration 6: org_members and project_members tables (CF-2 fix)
// ---------------------------------------------------------------------------
describe('Migration 6: membership tables (CF-2 fix)', () => {
  it('migration file 0009_membership_tables.sql exists', () => {
    expect(fileExists('migrations/0009_membership_tables.sql')).toBe(true);
  });

  it('creates org_members table with user_id, org_id, created_at', () => {
    const sql = readText('migrations/0009_membership_tables.sql');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS org_members/i);
    expect(sql).toMatch(/user_id.*uuid|uuid.*user_id/i);
    expect(sql).toMatch(/org_id.*uuid|uuid.*org_id/i);
    expect(sql).toMatch(/created_at/i);
  });

  it('org_members has PRIMARY KEY on (user_id, org_id)', () => {
    const sql = readText('migrations/0009_membership_tables.sql');
    expect(sql).toMatch(/PRIMARY KEY\s*\(\s*user_id\s*,\s*org_id\s*\)/i);
  });

  it('creates project_members table with user_id, project_id, created_at', () => {
    const sql = readText('migrations/0009_membership_tables.sql');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS project_members/i);
    expect(sql).toMatch(/user_id.*uuid|uuid.*user_id/i);
    expect(sql).toMatch(/project_id.*uuid|uuid.*project_id/i);
    expect(sql).toMatch(/created_at/i);
  });

  it('project_members has PRIMARY KEY on (user_id, project_id)', () => {
    const sql = readText('migrations/0009_membership_tables.sql');
    expect(sql).toMatch(/PRIMARY KEY\s*\(\s*user_id\s*,\s*project_id\s*\)/i);
  });

  it('project_members references projects table', () => {
    const sql = readText('migrations/0009_membership_tables.sql');
    expect(sql).toMatch(/REFERENCES projects\(id\)/i);
  });

  it('org_members references users table', () => {
    const sql = readText('migrations/0009_membership_tables.sql');
    expect(sql).toMatch(/REFERENCES users\(id\)/i);
  });
});

// ---------------------------------------------------------------------------
// lib/db/schema.ts — Phase 5 additions
// ---------------------------------------------------------------------------
describe('lib/db/schema.ts Phase 5 additions', () => {
  it('exports userRoleEnum with 4 values', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/export const userRoleEnum\s*=/);
    expect(src).toMatch(/pgEnum\s*\(\s*'user_role'/);
  });

  it('users table uses userRoleEnum for role column', () => {
    const src = readText('lib/db/schema.ts');
    // Should reference the enum rather than text()
    expect(src).toMatch(/userRoleEnum\s*\(\s*'role'\s*\)/);
  });

  it('users table has notificationPref column', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/notificationPref\s*:|notification_pref/);
    expect(src).toMatch(/jsonb/);
  });

  it('exports orgMembers table', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/export const orgMembers\s*=/);
  });

  it('exports projectMembers table', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/export const projectMembers\s*=/);
  });

  it('auditActionEnum stays in lock-step with AuditAction through risk management', () => {
    const src = readText('lib/db/schema.ts');
    const auditSrc = readText('lib/audit.ts');
    const values = extractAuditActionEnumValues(src);
    const typeValues = extractAuditActionTypeValues(auditSrc);
    expect(values).toEqual(typeValues);
    expect(values).toHaveLength(106); // +2 signature.* (ESIG-001) +3 audit.* (AUDITOR-VIEW-001) +2 personal_bookmark.* (PERSONAL-LIB-001) +3 deadline.* (CALENDAR-001)
  });

  it.each(REQUIRED_RECOVERY_TABLES)(
    'exports required quality-recovery table %s as %s',
    (tableName, exportName) => {
      const src = readText('lib/db/schema.ts');
      expect(src).toMatch(new RegExp(`export const ${exportName}\\s*=\\s*pgTable`));
      expect(src).toContain(`'${tableName}'`);
    },
  );

  it('uses explicit SQL defaults for text array columns so drizzle-kit push emits valid SQL', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).not.toMatch(/\.array\(\)\s*\.notNull\(\)\s*\.default\(\[\]\)/);
    expect(src).toContain(".default(sql`'{}'::text[]`)");
    expect(src).toContain(".default(sql`ARRAY['']::text[]`)");
  });
});

// ---------------------------------------------------------------------------
// lib/audit.ts — Phase 5 AuditAction type additions
// ---------------------------------------------------------------------------
describe('lib/audit.ts Phase 5 AuditAction type additions', () => {
  it.each(ENTERPRISE_AUDIT_ACTIONS)('AuditAction type includes enterprise action: %s', (action) => {
    const src = readText('lib/audit.ts');
    const escaped = action.replace(/\./g, '\\.');
    expect(src).toMatch(new RegExp(`'${escaped}'`));
  });

  it('AuditAction type includes post-enterprise regulated workflow actions through risk management', () => {
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
        'export.markdown',
        'export.docx',
        'export.pdf',
        'export.email',
        'export.confluence',
      ]),
    );
    expect(values).toHaveLength(106); // +2 signature.* (ESIG-001) +3 audit.* (AUDITOR-VIEW-001) +2 personal_bookmark.* (PERSONAL-LIB-001) +3 deadline.* (CALENDAR-001)
  });

  it.each(REQUIRED_RECOVERY_AUDIT_ACTIONS)(
    'AuditAction type includes quality-recovery audit action: %s',
    (action) => {
      const values = extractAuditActionTypeValues(readText('lib/audit.ts'));
      expect(values).toContain(action);
    },
  );

  it.each(REQUIRED_RECOVERY_AUDIT_ACTIONS)(
    'auditActionEnum includes quality-recovery audit action: %s',
    (action) => {
      const values = extractAuditActionEnumValues(readText('lib/db/schema.ts'));
      expect(values).toContain(action);
    },
  );

  it('does NOT include auth.mfa_fail as a union value (removed in v0.3.0 H-5)', () => {
    const src = readText('lib/audit.ts');
    // Must not appear as a string literal in the type union.
    // Comments mentioning it are allowed.
    const typeMatch = src.match(/export type AuditAction\s*=\s*([\s\S]*?);/);
    expect(typeMatch, 'AuditAction type not found').toBeTruthy();
    const typeBody = (typeMatch as RegExpMatchArray)[1] as string;
    expect(typeBody).not.toMatch(/auth\.mfa_fail/);
  });
});
