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
  ['corpus_sync_runs', 'corpusSyncRuns'],
  // SPEC-REGULA-CHANGE-CONTROL-001 (Issue #54) — 4 change-control tables.
  ['change_assessments', 'changeAssessments'],
  ['change_verdicts', 'changeVerdicts'],
  ['change_verdict_citations', 'changeVerdictCitations'],
  ['change_risk_links', 'changeRiskLinks'],
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
  // SPEC-REGULA-CHANGE-CONTROL-001 (Issue #54) — 5 change-control audit actions.
  'change.assessment_created',
  'change.verdict_produced',
  'change.verdict_citation_rejected',
  'change.assessment_reviewed',
  'change.report_exported',
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
    expect(values).toHaveLength(139); // +6 label.* (LABELING-001, Issue #66)
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
        // SPEC-REGULA-CHANGE-CONTROL-001 (Issue #54)
        'change.assessment_created',
        'change.verdict_produced',
        'change.verdict_citation_rejected',
        'change.assessment_reviewed',
        'change.report_exported',
        'change.export_blocked',
      ]),
    );
    expect(values).toHaveLength(139); // +6 label.* (LABELING-001, Issue #66)
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

// ---------------------------------------------------------------------------
// SPEC-REGULA-DELTA-SYNC-001 — corpus delta-sync (Issue #45, migration 0065)
// ---------------------------------------------------------------------------
describe('SPEC-REGULA-DELTA-SYNC-001 (Issue #45) — migration 0065', () => {
  const DELTA_SYNC_AUDIT_ACTIONS = [
    'corpus.sync_started',
    'corpus.sync_completed',
    'corpus.sync_failed',
  ] as const;

  it('migration file 0065_delta_sync.sql exists', () => {
    expect(fileExists('migrations/0065_delta_sync.sql')).toBe(true);
  });

  it('adds updated_at and superseded_by columns to source_sections', () => {
    const sql = readText('migrations/0065_delta_sync.sql');
    expect(sql).toMatch(/ALTER TABLE source_sections[\s\S]*updated_at/i);
    expect(sql).toMatch(/ALTER TABLE source_sections[\s\S]*superseded_by/i);
  });

  it('creates corpus_sync_runs table with required columns', () => {
    const sql = readText('migrations/0065_delta_sync.sql');
    expect(sql).toMatch(/CREATE TABLE[\s\S]*corpus_sync_runs/i);
    expect(sql).toMatch(/crawler_name/i);
    expect(sql).toMatch(/content_hash/i);
    expect(sql).toMatch(/status/i);
    expect(sql).toMatch(/chunks_added/i);
    expect(sql).toMatch(/chunks_outdated/i);
  });

  it('adds 3 corpus.* audit_action enum values', () => {
    const sql = readText('migrations/0065_delta_sync.sql');
    for (const action of DELTA_SYNC_AUDIT_ACTIONS) {
      expect(sql).toContain(action);
    }
  });

  it.each(DELTA_SYNC_AUDIT_ACTIONS)('AuditAction type includes delta-sync action: %s', (action) => {
    const src = readText('lib/audit.ts');
    const escaped = action.replace(/\./g, '\\.');
    expect(src).toMatch(new RegExp(`'${escaped}'`));
  });

  it.each(DELTA_SYNC_AUDIT_ACTIONS)('auditActionEnum includes delta-sync action: %s', (action) => {
    const src = readText('lib/db/schema.ts');
    expect(src).toContain(`'${action}'`);
  });

  it('schema.ts exports corpusSyncRuns table', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/export const corpusSyncRuns\s*=\s*pgTable/);
    expect(src).toContain("'corpus_sync_runs'");
  });

  it('schema.ts adds updated_at and superseded_by to sourceSections', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/updated_at:\s*timestamp/);
    expect(src).toMatch(/superseded_by:\s*uuid/);
  });
});

// ---------------------------------------------------------------------------
// SPEC-REGULA-KNOWLEDGE-GAP-001 — 미답변 자동 이슈화 (Issue #35, migration 0066)
// ---------------------------------------------------------------------------
describe('SPEC-REGULA-KNOWLEDGE-GAP-001 (Issue #35) — migration 0066', () => {
  const KNOWLEDGE_GAP_AUDIT_ACTIONS = [
    'knowledge_gap_created',
    'knowledge_gap_classified',
    'knowledge_gap_digest_sent',
    'knowledge_gap_resolved',
  ] as const;

  it('migration file 0066_knowledge_gap.sql exists', () => {
    expect(fileExists('migrations/0066_knowledge_gap.sql')).toBe(true);
  });

  it('creates 3 gap_* enum types with required values', () => {
    const sql = readText('migrations/0066_knowledge_gap.sql');
    // gap_reason
    expect(sql).toMatch(/CREATE TYPE gap_reason AS ENUM/);
    expect(sql).toMatch(/'low_confidence'/);
    expect(sql).toMatch(/'low_citation'/);
    expect(sql).toMatch(/'no_results'/);
    expect(sql).toMatch(/'policy_blocked'/);
    // gap_status
    expect(sql).toMatch(/CREATE TYPE gap_status AS ENUM/);
    expect(sql).toMatch(/'open'/);
    expect(sql).toMatch(/'classified'/);
    expect(sql).toMatch(/'resolved'/);
    // gap_classification
    expect(sql).toMatch(/CREATE TYPE gap_classification AS ENUM/);
    expect(sql).toMatch(/'ra_project_gap'/);
    expect(sql).toMatch(/'md_process_gap'/);
    expect(sql).toMatch(/'external_regulation_needed'/);
    expect(sql).toMatch(/'bug'/);
  });

  it('adds knowledge_gap_required boolean column to messages', () => {
    const sql = readText('migrations/0066_knowledge_gap.sql');
    expect(sql).toMatch(/ALTER TABLE messages[\s\S]*knowledge_gap_required/i);
    expect(sql).toMatch(/BOOLEAN NOT NULL DEFAULT FALSE/i);
  });

  it('creates unanswered_queue table with required columns', () => {
    const sql = readText('migrations/0066_knowledge_gap.sql');
    expect(sql).toMatch(/CREATE TABLE[\s\S]*unanswered_queue/i);
    expect(sql).toMatch(/org_id/i);
    expect(sql).toMatch(/conversation_id/i);
    expect(sql).toMatch(/message_id/i);
    expect(sql).toMatch(/redacted_question/i);
    expect(sql).toMatch(/redaction_hash/i);
    expect(sql).toMatch(/gap_reason/i);
    expect(sql).toMatch(/cluster_id/i);
    expect(sql).toMatch(/github_issue_number/i);
    expect(sql).toMatch(/classification/i);
    expect(sql).toMatch(/status/i);
  });

  it('enables RLS with org isolation policy on unanswered_queue', () => {
    const sql = readText('migrations/0066_knowledge_gap.sql');
    expect(sql).toMatch(/ALTER TABLE unanswered_queue ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/CREATE POLICY[\s\S]*unanswered_queue/i);
    expect(sql).toMatch(/current_setting\('app.current_org_id'/i);
  });

  it.each(KNOWLEDGE_GAP_AUDIT_ACTIONS)(
    'adds ALTER TYPE audit_action ADD VALUE for: %s',
    (action) => {
      const sql = readText('migrations/0066_knowledge_gap.sql');
      expect(sql, `missing ALTER TYPE for '${action}'`).toContain(action);
    },
  );

  it('has exactly 4 ALTER TYPE audit_action statements', () => {
    const sql = readText('migrations/0066_knowledge_gap.sql');
    const matches = sql.match(/ALTER TYPE audit_action ADD VALUE/g) ?? [];
    expect(matches).toHaveLength(4);
  });

  it.each(KNOWLEDGE_GAP_AUDIT_ACTIONS)(
    'AuditAction type includes knowledge-gap action: %s',
    (action) => {
      const src = readText('lib/audit.ts');
      expect(src).toContain(`'${action}'`);
    },
  );

  it.each(KNOWLEDGE_GAP_AUDIT_ACTIONS)(
    'auditActionEnum includes knowledge-gap action: %s',
    (action) => {
      const src = readText('lib/db/schema.ts');
      expect(src).toContain(`'${action}'`);
    },
  );

  it('schema.ts exports the 3 gap_* enums', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/export const gapReasonEnum\s*=\s*pgEnum/);
    expect(src).toMatch(/export const gapStatusEnum\s*=\s*pgEnum/);
    expect(src).toMatch(/export const gapClassificationEnum\s*=\s*pgEnum/);
  });

  it('schema.ts exports unansweredQueue table', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/export const unansweredQueue\s*=\s*pgTable/);
    expect(src).toContain("'unanswered_queue'");
  });

  it('schema.ts adds knowledgeGapRequired to messages table', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/knowledgeGapRequired:\s*boolean\('knowledge_gap_required'\)/);
  });
});

// ---------------------------------------------------------------------------
// SPEC-REGULA-CLASSIFY-001 (Issue #59) — MVP backend classification wizard
// (migration 0067). Augments the existing device_classifications table from
// 0050 with workflow_run_id FK, input/result JSONB, status, and RLS org
// isolation; adds the 'classify' workflow_type and 'classification_exported'
// audit_action.
// ---------------------------------------------------------------------------
describe('SPEC-REGULA-CLASSIFY-001 (Issue #59) — migration 0067', () => {
  it('migration file 0067_classify.sql exists', () => {
    expect(fileExists('migrations/0067_classify.sql')).toBe(true);
  });

  it("adds 'classify' to workflow_type", () => {
    const sql = readText('migrations/0067_classify.sql');
    expect(sql).toMatch(/ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'classify'/);
  });

  it("adds 'classification_exported' to audit_action", () => {
    const sql = readText('migrations/0067_classify.sql');
    expect(sql).toMatch(
      /ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'classification_exported'/,
    );
  });

  it('augments device_classifications with workflow_run_id, input, result, status', () => {
    const sql = readText('migrations/0067_classify.sql');
    expect(sql).toMatch(/ALTER TABLE device_classifications/i);
    expect(sql).toMatch(/workflow_run_id/i);
    expect(sql).toMatch(/input JSONB/i);
    expect(sql).toMatch(/result JSONB/i);
    expect(sql).toMatch(/status TEXT/i);
  });

  it('enables RLS with org isolation policy on device_classifications', () => {
    const sql = readText('migrations/0067_classify.sql');
    expect(sql).toMatch(/ALTER TABLE device_classifications ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/CREATE POLICY[\s\S]*device_classifications/i);
    expect(sql).toMatch(/current_setting\('app.current_org_id'/i);
  });

  it("workflowTypeEnum in schema.ts includes 'classify'", () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/export const workflowTypeEnum[\s\S]*'classify'/);
  });

  it("auditActionEnum in schema.ts includes 'classification_exported'", () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toContain("'classification_exported'");
  });

  it("AuditAction type in audit.ts includes 'classification_exported'", () => {
    const src = readText('lib/audit.ts');
    expect(src).toContain("'classification_exported'");
  });

  it('schema.ts deviceClassifications defines workflowRunId, input, result, status columns', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/workflowRunId:\s*uuid\('workflow_run_id'\)/);
    expect(src).toMatch(/input:\s*jsonb\('input'\)/);
    expect(src).toMatch(/result:\s*jsonb\('result'\)/);
    expect(src).toMatch(/status:\s*text\('status'\)/);
  });
});

// ---------------------------------------------------------------------------
// SPEC-REGULA-TRACEABILITY-001 (Issue #47) — local evidence graph layer
// (migration 0068). Adds evidence_nodes / evidence_edges / stale_flags tables,
// 3 new pgEnums (evidence_node_type, evidence_edge_relation, stale_reason),
// 4 traceability audit_action values, and RLS org isolation. STRICTLY separate
// from Issue #169's /api/ra/traceability/* BFF proxy — local graph namespace.
// ---------------------------------------------------------------------------
describe('SPEC-REGULA-TRACEABILITY-001 (Issue #47) — migration 0068', () => {
  it('migration file 0068_traceability.sql exists', () => {
    expect(fileExists('migrations/0068_traceability.sql')).toBe(true);
  });

  it('creates the 3 new pgEnums', () => {
    const sql = readText('migrations/0068_traceability.sql');
    expect(sql).toMatch(/CREATE TYPE evidence_node_type AS ENUM/);
    expect(sql).toMatch(/CREATE TYPE evidence_edge_relation AS ENUM/);
    expect(sql).toMatch(/CREATE TYPE stale_reason AS ENUM/);
  });

  it('evidence_node_type enum includes the 8 node kinds', () => {
    const sql = readText('migrations/0068_traceability.sql');
    for (const v of [
      'source_section',
      'message_source',
      'message',
      'workflow_run',
      'expert_review',
      'submission_package',
      'risk_item',
      'regulatory_update',
    ]) {
      expect(sql).toContain(`'${v}'`);
    }
  });

  it('evidence_edge_relation enum includes the 6 relations', () => {
    const sql = readText('migrations/0068_traceability.sql');
    for (const v of [
      'derived_from',
      'cites',
      'reviewed_by',
      'exported_in',
      'mitigates',
      'satisfies',
    ]) {
      expect(sql).toContain(`'${v}'`);
    }
  });

  it('adds the 4 traceability audit_action values', () => {
    const sql = readText('migrations/0068_traceability.sql');
    expect(sql).toMatch(
      /ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'traceability.edge_created'/,
    );
    expect(sql).toMatch(
      /ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'traceability.edge_deleted'/,
    );
    expect(sql).toMatch(
      /ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'traceability.packet_exported'/,
    );
    expect(sql).toMatch(
      /ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'traceability.stale_propagated'/,
    );
  });

  it('creates evidence_nodes with org_id, project_id, node metadata columns', () => {
    const sql = readText('migrations/0068_traceability.sql');
    expect(sql).toMatch(/CREATE TABLE evidence_nodes/);
    expect(sql).toMatch(/org_id\s+UUID NOT NULL REFERENCES organizations/);
    expect(sql).toMatch(/project_id\s+UUID REFERENCES projects/);
    expect(sql).toMatch(/authority\s+TEXT/);
    expect(sql).toMatch(/version\s+TEXT/);
    expect(sql).toMatch(/effective_date\s+TIMESTAMPTZ/);
    expect(sql).toMatch(/reviewer_id\s+UUID REFERENCES users/);
    expect(sql).toMatch(/artifact_hash\s+TEXT/);
  });

  it('creates evidence_edges with no-self CHECK and org_id', () => {
    const sql = readText('migrations/0068_traceability.sql');
    expect(sql).toMatch(/CREATE TABLE evidence_edges/);
    expect(sql).toMatch(/evidence_edges_no_self CHECK \(from_node_id <> to_node_id\)/);
    expect(sql).toMatch(/org_id\s+UUID NOT NULL REFERENCES organizations/);
  });

  it('creates stale_flags with propagated_from_node_id', () => {
    const sql = readText('migrations/0068_traceability.sql');
    expect(sql).toMatch(/CREATE TABLE stale_flags/);
    expect(sql).toMatch(/propagated_from_node_id\s+UUID REFERENCES evidence_nodes/);
    expect(sql).toMatch(/node_id\s+UUID NOT NULL REFERENCES evidence_nodes/);
  });

  it('creates the required indexes on all 3 tables', () => {
    const sql = readText('migrations/0068_traceability.sql');
    expect(sql).toMatch(/idx_evidence_nodes_ref/);
    expect(sql).toMatch(/idx_evidence_nodes_project/);
    expect(sql).toMatch(/idx_evidence_edges_from/);
    expect(sql).toMatch(/idx_evidence_edges_to/);
    expect(sql).toMatch(/idx_stale_flags_node/);
  });

  it('enables RLS with org isolation on all 3 tables', () => {
    const sql = readText('migrations/0068_traceability.sql');
    expect(sql).toMatch(/ALTER TABLE evidence_nodes ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/ALTER TABLE evidence_edges ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/ALTER TABLE stale_flags ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/current_setting\('app.current_org_id'/g);
    // Three org-isolation policies (one per table).
    const policies = sql.match(/CREATE POLICY "tenant_isolation_evidence/g) ?? [];
    expect(policies.length).toBeGreaterThanOrEqual(2);
    const stalePolicies = sql.match(/CREATE POLICY "tenant_isolation_stale_flags/g) ?? [];
    expect(stalePolicies.length).toBe(1);
  });

  it('schema.ts defines the 3 new pgEnums + 3 new tables (lock-step)', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/export const evidenceNodeTypeEnum\s*=\s*pgEnum/);
    expect(src).toMatch(/export const evidenceEdgeRelationEnum\s*=\s*pgEnum/);
    expect(src).toMatch(/export const staleReasonEnum\s*=\s*pgEnum/);
    expect(src).toMatch(/export const evidenceNodes\s*=\s*pgTable/);
    expect(src).toMatch(/export const evidenceEdges\s*=\s*pgTable/);
    expect(src).toMatch(/export const staleFlags\s*=\s*pgTable/);
  });

  it('auditActionEnum in schema.ts includes the 4 traceability values', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toContain("'traceability.edge_created'");
    expect(src).toContain("'traceability.edge_deleted'");
    expect(src).toContain("'traceability.packet_exported'");
    expect(src).toContain("'traceability.stale_propagated'");
  });

  it('AuditAction type in audit.ts includes the 4 traceability values', () => {
    const src = readText('lib/audit.ts');
    expect(src).toContain("'traceability.edge_created'");
    expect(src).toContain("'traceability.edge_deleted'");
    expect(src).toContain("'traceability.packet_exported'");
    expect(src).toContain("'traceability.stale_propagated'");
  });

  it('permissions.ts adds traceability.manage (ra-lead only)', () => {
    const src = readText('lib/auth/permissions.ts');
    expect(src).toMatch(/'traceability.manage'/);
    expect(src).toMatch(/'traceability.manage':\s*\{[^}]*minRole:\s*'ra-lead'/);
  });
});

// SPEC-REGULA-PMS-001 (Issue #53) — EU MDR Article 83-86 PMS/PMCF workflows.
// Adds 3 workflow_type values (pms_report, pmcf_plan, pmcf_evaluation), 7
// audit_action values, and 2 tables (pms_inputs, pms_documents) with org RLS.
describe('SPEC-REGULA-PMS-001 (Issue #53) — migration 0069', () => {
  const PMS_AUDIT_ACTIONS = [
    'pms.report_created',
    'pms.compliance_checked',
    'pms.report_exported',
    'pms.input_uploaded',
    'pmcf.plan_created',
    'pmcf.evaluation_drafted',
    'pms.cer_linked',
  ] as const;

  it('migration file 0069_pms.sql exists', () => {
    expect(fileExists('migrations/0069_pms.sql')).toBe(true);
  });

  it('adds the 3 PMS workflow_type values', () => {
    const sql = readText('migrations/0069_pms.sql');
    expect(sql).toMatch(/ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'pms_report'/);
    expect(sql).toMatch(/ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'pmcf_plan'/);
    expect(sql).toMatch(/ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'pmcf_evaluation'/);
  });

  it.each(PMS_AUDIT_ACTIONS)('adds ALTER TYPE audit_action ADD VALUE for: %s', (action) => {
    const sql = readText('migrations/0069_pms.sql');
    const escaped = action.replace(/\./g, '\\.');
    expect(sql).toMatch(
      new RegExp(`ALTER TYPE audit_action ADD VALUE\\s+IF NOT EXISTS\\s+'${escaped}'`),
    );
  });

  it('has exactly 7 ALTER TYPE audit_action statements', () => {
    const sql = readText('migrations/0069_pms.sql');
    const matches = sql.match(/ALTER TYPE audit_action ADD VALUE/g) ?? [];
    expect(matches.length).toBe(PMS_AUDIT_ACTIONS.length);
  });

  it('creates pms_inputs table with complaint/vigilance columns + org RLS', () => {
    const sql = readText('migrations/0069_pms.sql');
    expect(sql).toMatch(/CREATE TABLE pms_inputs/);
    expect(sql).toMatch(/org_id\s+UUID NOT NULL REFERENCES organizations/);
    expect(sql).toMatch(/project_id\s+UUID NOT NULL REFERENCES projects/);
    expect(sql).toMatch(/source\s+TEXT NOT NULL/);
    expect(sql).toMatch(/severity\s+TEXT/);
    expect(sql).toMatch(/susar_flag\s+BOOLEAN/);
    expect(sql).toMatch(/trend_category\s+TEXT/);
    expect(sql).toMatch(/uploaded_by\s+UUID REFERENCES users/);
  });

  it('creates pms_documents table with CER linkage + compliance/review status', () => {
    const sql = readText('migrations/0069_pms.sql');
    expect(sql).toMatch(/CREATE TABLE pms_documents/);
    expect(sql).toMatch(/org_id\s+UUID NOT NULL REFERENCES organizations/);
    expect(sql).toMatch(/project_id\s+UUID NOT NULL REFERENCES projects/);
    expect(sql).toMatch(/workflow_type\s+workflow_type NOT NULL/);
    expect(sql).toMatch(/cer_ref\s+UUID/);
    expect(sql).toMatch(/compliance_status\s+TEXT/);
    expect(sql).toMatch(/review_status\s+TEXT/);
    expect(sql).toMatch(/created_by\s+UUID NOT NULL REFERENCES users/);
  });

  it('enables RLS with org isolation on both PMS tables', () => {
    const sql = readText('migrations/0069_pms.sql');
    expect(sql).toMatch(/ALTER TABLE pms_inputs ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/ALTER TABLE pms_documents ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/current_setting\('app.current_org_id'/g);
    const inputPolicies = sql.match(/CREATE POLICY "tenant_isolation_pms_inputs/g) ?? [];
    expect(inputPolicies.length).toBe(1);
    const docPolicies = sql.match(/CREATE POLICY "tenant_isolation_pms_documents/g) ?? [];
    expect(docPolicies.length).toBe(1);
  });

  it('PMS RLS policies include WITH CHECK (INSERT/UPDATE guard)', () => {
    // RLS USING alone protects SELECT/DELETE; WITH CHECK protects INSERT/UPDATE.
    // Without WITH CHECK, a cross-org INSERT bypasses tenant isolation.
    const sql = readText('migrations/0069_pms.sql');
    const inputPolicyBlock = sql.match(/CREATE POLICY "tenant_isolation_pms_inputs"[\s\S]*?;/)?.[0];
    const docPolicyBlock = sql.match(
      /CREATE POLICY "tenant_isolation_pms_documents"[\s\S]*?;/,
    )?.[0];
    expect(inputPolicyBlock).toBeTruthy();
    expect(docPolicyBlock).toBeTruthy();
    expect(inputPolicyBlock).toMatch(/WITH CHECK/);
    expect(docPolicyBlock).toMatch(/WITH CHECK/);
  });

  it('creates indexes for PMS tables (project, org, unique)', () => {
    const sql = readText('migrations/0069_pms.sql');
    expect(sql).toMatch(/idx_pms_inputs_project/);
    expect(sql).toMatch(/idx_pms_documents_project/);
  });

  it('schema.ts workflowTypeEnum includes the 3 PMS values', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toContain("'pms_report'");
    expect(src).toContain("'pmcf_plan'");
    expect(src).toContain("'pmcf_evaluation'");
  });

  it('schema.ts auditActionEnum includes the 7 PMS values', () => {
    const src = readText('lib/db/schema.ts');
    for (const v of PMS_AUDIT_ACTIONS) {
      expect(src).toContain(`'${v}'`);
    }
  });

  it('schema.ts defines pmsInputs and pmsDocuments tables', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/export const pmsInputs\s*=\s*pgTable/);
    expect(src).toMatch(/export const pmsDocuments\s*=\s*pgTable/);
  });

  it('AuditAction type in audit.ts includes the 7 PMS values', () => {
    const src = readText('lib/audit.ts');
    for (const v of PMS_AUDIT_ACTIONS) {
      expect(src).toContain(`'${v}'`);
    }
  });
});

// ---------------------------------------------------------------------------
// SPEC-REGULA-CHANGE-CONTROL-001 (Issue #54) — Design Change RA Impact Assessor
// Migration 0071: 1 workflow_type + 5 audit_action + 4 tables + RLS + indexes
// ---------------------------------------------------------------------------
const CHANGE_CONTROL_AUDIT_ACTIONS = [
  'change.assessment_created',
  'change.verdict_produced',
  'change.verdict_citation_rejected',
  'change.assessment_reviewed',
  'change.report_exported',
  'change.export_blocked',
] as const;

describe('Migration 0071: change_control_assessment (SPEC-REGULA-CHANGE-CONTROL-001)', () => {
  it('migration file 0071_change_control.sql exists', () => {
    expect(fileExists('migrations/0071_change_control.sql')).toBe(true);
  });

  it('adds change_control_assessment to workflow_type enum (REQ-001)', () => {
    const sql = readText('migrations/0071_change_control.sql');
    expect(sql).toMatch(
      /ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'change_control_assessment'/,
    );
  });

  it.each(CHANGE_CONTROL_AUDIT_ACTIONS)(
    'adds ALTER TYPE audit_action ADD VALUE for: %s (REQ-012)',
    (action) => {
      const sql = readText('migrations/0071_change_control.sql');
      const escaped = action.replace(/\./g, '\\.');
      expect(sql).toMatch(
        new RegExp(`ALTER TYPE audit_action ADD VALUE IF NOT EXISTS '${escaped}'`),
      );
    },
  );

  it('has exactly 7 ALTER TYPE statements (1 workflow_type + 6 audit_action incl. export_blocked)', () => {
    const sql = readText('migrations/0071_change_control.sql');
    const wf = sql.match(/ALTER TYPE workflow_type ADD VALUE/g) ?? [];
    const audit = sql.match(/ALTER TYPE audit_action ADD VALUE/g) ?? [];
    expect(wf).toHaveLength(1);
    expect(audit).toHaveLength(6);
  });

  it('creates 4 change-control tables', () => {
    const sql = readText('migrations/0071_change_control.sql');
    expect(sql).toMatch(/CREATE TABLE change_assessments/);
    expect(sql).toMatch(/CREATE TABLE change_verdicts/);
    expect(sql).toMatch(/CREATE TABLE change_verdict_citations/);
    expect(sql).toMatch(/CREATE TABLE change_risk_links/);
  });

  it('enforces excerpt NOT NULL on change_verdict_citations (REQ-006 DB defense)', () => {
    const sql = readText('migrations/0071_change_control.sql');
    expect(sql).toMatch(/excerpt\s+TEXT\s+NOT\s+NULL/i);
    expect(sql).toMatch(/length\(btrim\(excerpt\)\)\s*>\s*0/);
  });

  it('enables RLS with org_id tenant isolation on all 4 tables', () => {
    const sql = readText('migrations/0071_change_control.sql');
    for (const table of [
      'change_assessments',
      'change_verdicts',
      'change_verdict_citations',
      'change_risk_links',
    ]) {
      expect(sql).toMatch(new RegExp(`ENABLE ROW LEVEL SECURITY[\\s\\S]*${table}`));
      expect(sql).toMatch(new RegExp(`tenant_isolation_${table}`));
    }
  });

  it('links change_risk_links.risk_item_id to risk_items.id (REQ-008 / #46)', () => {
    const sql = readText('migrations/0071_change_control.sql');
    expect(sql).toMatch(/risk_item_id\s+UUID\s+NOT\s+NULL\s+REFERENCES risk_items\(id\)/);
  });

  it('schema.ts workflowTypeEnum includes change_control_assessment', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toContain("'change_control_assessment'");
  });

  it('schema.ts auditActionEnum includes the 5 change.* values', () => {
    const src = readText('lib/db/schema.ts');
    for (const v of CHANGE_CONTROL_AUDIT_ACTIONS) {
      expect(src).toContain(`'${v}'`);
    }
  });

  it('schema.ts defines 4 change-control tables', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/export const changeAssessments\s*=\s*pgTable/);
    expect(src).toMatch(/export const changeVerdicts\s*=\s*pgTable/);
    expect(src).toMatch(/export const changeVerdictCitations\s*=\s*pgTable/);
    expect(src).toMatch(/export const changeRiskLinks\s*=\s*pgTable/);
  });

  it('AuditAction type in audit.ts includes the 5 change.* values', () => {
    const src = readText('lib/audit.ts');
    for (const v of CHANGE_CONTROL_AUDIT_ACTIONS) {
      expect(src).toContain(`'${v}'`);
    }
  });

  it('permissions.ts adds 3 change.* PermissionActions (REQ-012 RBAC)', () => {
    const src = readText('lib/auth/permissions.ts');
    expect(src).toMatch(/'change\.assess'/);
    expect(src).toMatch(/'change\.view'/);
    expect(src).toMatch(/'change\.export'/);
    // ra-lead only for assess/export; ra-member+ for view
    expect(src).toMatch(/'change\.assess':\s*\{\s*minRole:\s*'ra-lead'/);
    expect(src).toMatch(/'change\.export':\s*\{\s*minRole:\s*'ra-lead'/);
    expect(src).toMatch(/'change\.view':\s*\{\s*minRole:\s*'ra-member'/);
  });
});

// ---------------------------------------------------------------------------
// SPEC-REGULA-LABELING-001 (Issue #66) — Labeling & IFU Structured Authoring
// Migration 0072: 1 workflow_type + 6 audit_action + 5 tables + RLS + indexes
// ---------------------------------------------------------------------------
const LABELING_AUDIT_ACTIONS = [
  'label.document_created',
  'label.claim_validated',
  'label.claim_citation_rejected',
  'label.translation_diff_detected',
  'label.approved',
  'label.export_blocked',
] as const;

describe('Migration 0072: labeling (SPEC-REGULA-LABELING-001)', () => {
  it('migration file 0072_labeling.sql exists', () => {
    expect(fileExists('migrations/0072_labeling.sql')).toBe(true);
  });

  it('adds labeling to workflow_type enum (REQ-001)', () => {
    const sql = readText('migrations/0072_labeling.sql');
    expect(sql).toMatch(/ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'labeling'/);
  });

  it.each(LABELING_AUDIT_ACTIONS)(
    'adds ALTER TYPE audit_action ADD VALUE for: %s (REQ-010)',
    (action) => {
      const sql = readText('migrations/0072_labeling.sql');
      const escaped = action.replace(/\./g, '\\.');
      expect(sql).toMatch(
        new RegExp(`ALTER TYPE audit_action ADD VALUE IF NOT EXISTS '${escaped}'`),
      );
    },
  );

  it('has exactly 7 ALTER TYPE statements (1 workflow_type + 6 audit_action)', () => {
    const sql = readText('migrations/0072_labeling.sql');
    const wf = sql.match(/ALTER TYPE workflow_type ADD VALUE/g) ?? [];
    const audit = sql.match(/ALTER TYPE audit_action ADD VALUE/g) ?? [];
    expect(wf).toHaveLength(1);
    expect(audit).toHaveLength(6);
  });

  it('creates 5 labeling tables', () => {
    const sql = readText('migrations/0072_labeling.sql');
    expect(sql).toMatch(/CREATE TABLE labeling_documents/);
    expect(sql).toMatch(/CREATE TABLE labeling_sections/);
    expect(sql).toMatch(/CREATE TABLE labeling_claims/);
    expect(sql).toMatch(/CREATE TABLE labeling_claim_citations/);
    expect(sql).toMatch(/CREATE TABLE labeling_translations/);
  });

  it('enforces excerpt NOT NULL on labeling_claim_citations (REQ-003 DB defense)', () => {
    const sql = readText('migrations/0072_labeling.sql');
    expect(sql).toMatch(/excerpt\s+TEXT\s+NOT\s+NULL/i);
    expect(sql).toMatch(/length\(btrim\(excerpt\)\)\s*>\s*0/);
  });

  it('enables RLS with org_id tenant isolation on all 5 tables', () => {
    const sql = readText('migrations/0072_labeling.sql');
    for (const table of [
      'labeling_documents',
      'labeling_sections',
      'labeling_claims',
      'labeling_claim_citations',
      'labeling_translations',
    ]) {
      expect(sql).toMatch(new RegExp(`ENABLE ROW LEVEL SECURITY[\\s\\S]*${table}`));
      expect(sql).toMatch(new RegExp(`tenant_isolation_${table}`));
    }
  });

  it('schema.ts workflowTypeEnum includes labeling', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toContain("'labeling'");
  });

  it('schema.ts auditActionEnum includes the 6 label.* values', () => {
    const src = readText('lib/db/schema.ts');
    for (const v of LABELING_AUDIT_ACTIONS) {
      expect(src).toContain(`'${v}'`);
    }
  });

  it('schema.ts defines 5 labeling tables', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/export const labelingDocuments\s*=\s*pgTable/);
    expect(src).toMatch(/export const labelingSections\s*=\s*pgTable/);
    expect(src).toMatch(/export const labelingClaims\s*=\s*pgTable/);
    expect(src).toMatch(/export const labelingClaimCitations\s*=\s*pgTable/);
    expect(src).toMatch(/export const labelingTranslations\s*=\s*pgTable/);
  });

  it('AuditAction type in audit.ts includes the 6 label.* values', () => {
    const src = readText('lib/audit.ts');
    for (const v of LABELING_AUDIT_ACTIONS) {
      expect(src).toContain(`'${v}'`);
    }
  });

  it('permissions.ts adds 4 label.* PermissionActions (REQ-012 RBAC)', () => {
    const src = readText('lib/auth/permissions.ts');
    expect(src).toMatch(/'label\.create'/);
    expect(src).toMatch(/'label\.view'/);
    expect(src).toMatch(/'label\.approve'/);
    expect(src).toMatch(/'label\.export'/);
    // ra-lead only for approve/export; ra-member+ for create/view
    expect(src).toMatch(/'label\.approve':\s*\{\s*minRole:\s*'ra-lead'/);
    expect(src).toMatch(/'label\.export':\s*\{\s*minRole:\s*'ra-lead'/);
    expect(src).toMatch(/'label\.create':\s*\{\s*minRole:\s*'ra-member'/);
    expect(src).toMatch(/'label\.view':\s*\{\s*minRole:\s*'ra-member'/);
  });
});
