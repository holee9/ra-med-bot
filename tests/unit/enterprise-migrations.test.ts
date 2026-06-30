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

// Strip block comments (/* */) and line comments (//) while preserving string
// literals, so `]` / `;` appearing inside comments or strings do not truncate
// extraction. Without this, non-greedy regexes stop at the first `]` / `;`
// inside a comment and undercount (the bug behind the previous 204/212 failure).
const stripComments = (src: string): string => {
  let out = '';
  let i = 0;
  let inStr: string | null = null;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (inStr) {
      out += c;
      if (c === '\\') {
        out += next ?? '';
        i += 2;
        continue;
      }
      if (c === inStr) inStr = null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
      out += c;
      i += 1;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
};

const extractAuditActionEnumValues = (src: string): string[] => {
  const cleaned = stripComments(src);
  const start = cleaned.indexOf("pgEnum('audit_action',");
  expect(start, 'auditActionEnum not found').toBeGreaterThan(-1);
  const arrStart = cleaned.indexOf('[', start);
  expect(arrStart, 'auditActionEnum array open not found').toBeGreaterThan(-1);
  // Track bracket depth and string state to find the matching closing `]`.
  let depth = 0;
  let inStr: string | null = null;
  let arrEnd = -1;
  for (let i = arrStart; i < cleaned.length; i += 1) {
    const c = cleaned[i];
    if (inStr) {
      if (c === '\\') {
        i += 1;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
      continue;
    }
    if (c === '[') depth += 1;
    else if (c === ']') {
      depth -= 1;
      if (depth === 0) {
        arrEnd = i;
        break;
      }
    }
  }
  expect(arrEnd, 'auditActionEnum array close not found').toBeGreaterThan(-1);
  const arrBody = cleaned.slice(arrStart, arrEnd + 1);
  return (arrBody.match(/'[^']+'/g) ?? []).map((value) => value.slice(1, -1));
};

const extractAuditActionTypeValues = (src: string): string[] => {
  const cleaned = stripComments(src);
  const match = cleaned.match(/export type AuditAction\s*=\s*/);
  expect(match, 'AuditAction type not found').toBeTruthy();
  const start = ((match as RegExpMatchArray).index ?? -1) + (match as RegExpMatchArray)[0].length;
  // Find the real terminating `;` at top level (strings tracked, comments already stripped).
  let inStr: string | null = null;
  let end = -1;
  for (let i = start; i < cleaned.length; i += 1) {
    const c = cleaned[i];
    if (inStr) {
      if (c === '\\') {
        i += 1;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
      continue;
    }
    if (c === ';') {
      end = i;
      break;
    }
  }
  expect(end, 'AuditAction type terminator not found').toBeGreaterThan(-1);
  const typeBody = cleaned.slice(start, end);
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
  // SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69) — 5 CI tables.
  ['clinical_investigations', 'clinicalInvestigations'],
  ['ci_protocols', 'ciProtocols'],
  ['ci_documents', 'ciDocuments'],
  ['ci_events', 'ciEvents'],
  ['ci_links', 'ciLinks'],
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
  // SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69) — 8 ci.* audit actions.
  'ci.assessed',
  'ci.pathway_determined',
  'ci.protocol_updated',
  'ci.irb_package_drafted',
  'ci.event_recorded',
  'ci.results_linked',
  'ci.closed',
  'ci.close_blocked_signoff_missing',
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
    // Lock-step = both declarations hold the same SET of audit actions. Declaration
    // order is NOT required to match (enum and type legitimately group migrations
    // differently with interspersed comments). Set-equality is the correct check.
    expect(new Set(values)).toEqual(new Set(typeValues));
    expect(values).toHaveLength(214); // +1 rlhf.calibration_proposed (#264 2/3) +1 rlhf.implicit_feedback_recorded (#264 3/3) +1 label.esubmit_forwarded (#249) +1 traceability.section_superseded (#300 M-2)
    expect(typeValues).toHaveLength(214);
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
    expect(values).toHaveLength(214); // +1 rlhf.calibration_proposed (#264 2/3) +1 rlhf.implicit_feedback_recorded (#264 3/3) +1 label.esubmit_forwarded (#249) +1 traceability.section_superseded (#300 M-2)
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

// ---------------------------------------------------------------------------
// Migration 0073: 1 workflow_type + 7 audit_action + 5 tables + RLS + indexes
// SPEC-REGULA-CAPA-001 (Issue #68)
// ---------------------------------------------------------------------------
const CAPA_AUDIT_ACTIONS = [
  'complaint.intake_created',
  'complaint.reportability_assessed',
  'capa.record_created',
  'capa.root_cause_documented',
  'capa.effectiveness_scheduled',
  'capa.closed',
  'capa.close_blocked_vigilance_missing',
] as const;

describe('Migration 0073: capa (SPEC-REGULA-CAPA-001)', () => {
  it('migration file 0073_capa.sql exists', () => {
    expect(fileExists('migrations/0073_capa.sql')).toBe(true);
  });

  it('adds complaint workflow_type (1 value)', () => {
    const sql = readText('migrations/0073_capa.sql');
    expect(sql).toContain("ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'complaint'");
  });

  it('adds 7 audit_action values', () => {
    const sql = readText('migrations/0073_capa.sql');
    for (const v of CAPA_AUDIT_ACTIONS) {
      expect(sql).toContain(`ALTER TYPE audit_action ADD VALUE IF NOT EXISTS '${v}'`);
    }
  });

  it('creates 5 tables with RLS', () => {
    const sql = readText('migrations/0073_capa.sql');
    const tables = [
      'complaints',
      'capa_records',
      'capa_root_causes',
      'capa_links',
      'capa_effectiveness_checks',
    ];
    for (const t of tables) {
      expect(sql).toContain(`CREATE TABLE ${t}`);
      expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    }
  });

  it('capa_links has UNIQUE constraint for link integrity (AC-03)', () => {
    const sql = readText('migrations/0073_capa.sql');
    expect(sql).toContain('UNIQUE (capa_id, target_type, target_id)');
  });

  it('capa_records has type CHECK for corrective/preventive split (REQ-004)', () => {
    const sql = readText('migrations/0073_capa.sql');
    expect(sql).toContain("CHECK (type IN ('corrective','preventive'))");
  });

  it('complaints has reportability_status + vigilance_ref (REQ-002/011)', () => {
    const sql = readText('migrations/0073_capa.sql');
    expect(sql).toContain('reportability_status');
    expect(sql).toContain('vigilance_ref');
    expect(sql).toContain(
      "CHECK (reportability_status IN ('pending','reportable','not_reportable'))",
    );
  });

  it('RLS policies use app.current_org_id pattern', () => {
    const sql = readText('migrations/0073_capa.sql');
    expect(sql).toContain("current_setting('app.current_org_id', true)::uuid");
    // 5 tables × 2 (USING + WITH CHECK) = 10 occurrences minimum
    const matches = sql.match(/current_setting\('app\.current_org_id'/g);
    expect(matches?.length).toBeGreaterThanOrEqual(10);
  });

  it('schema.ts defines 5 CAPA tables', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/export const complaints\s*=\s*pgTable/);
    expect(src).toMatch(/export const capaRecords\s*=\s*pgTable/);
    expect(src).toMatch(/export const capaRootCauses\s*=\s*pgTable/);
    expect(src).toMatch(/export const capaLinks\s*=\s*pgTable/);
    expect(src).toMatch(/export const capaEffectivenessChecks\s*=\s*pgTable/);
  });

  it('AuditAction type in audit.ts includes the 7 capa/complaint values', () => {
    const src = readText('lib/audit.ts');
    for (const v of CAPA_AUDIT_ACTIONS) {
      expect(src).toContain(`'${v}'`);
    }
  });

  it('permissions.ts adds 7 capa/complaint PermissionActions (REQ-012 RBAC)', () => {
    const src = readText('lib/auth/permissions.ts');
    const actions = [
      'complaint.create',
      'complaint.assess_reportability',
      'capa.create',
      'capa.root_cause',
      'capa.effectiveness',
      'capa.close',
      'capa.qms_sync',
    ];
    for (const a of actions) {
      expect(src).toContain(`'${a}'`);
    }
    // ra-lead only for close/qms_sync; ra-member+ for the rest
    expect(src).toMatch(/'capa\.close':\s*\{\s*minRole:\s*'ra-lead'/);
    expect(src).toMatch(/'capa\.qms_sync':\s*\{\s*minRole:\s*'ra-lead'/);
    expect(src).toMatch(/'complaint\.create':\s*\{\s*minRole:\s*'ra-member'/);
    expect(src).toMatch(/'capa\.create':\s*\{\s*minRole:\s*'ra-member'/);
  });
});

// ---------------------------------------------------------------------------
// Migration 0074: cer_persisted audit action (SPEC-REGULA-CER-001, Issue #255)
// Splits CER deliverable-persist provenance from run-initiation so cer_created
// unambiguously means "run initiated" and cer_persisted means "deliverable
// stored, atomic with workflow_runs insert" (21 CFR Part 11, REQ-CER-036).
// ---------------------------------------------------------------------------
describe('Migration 0074: cer_persisted audit action (Issue #255)', () => {
  it('migration file 0074_cer_persisted_audit_action.sql exists', () => {
    expect(fileExists('migrations/0074_cer_persisted_audit_action.sql')).toBe(true);
  });

  it('adds cer_persisted to audit_action enum', () => {
    const sql = readText('migrations/0074_cer_persisted_audit_action.sql');
    expect(sql).toMatch(/ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'cer_persisted'/);
  });

  it('has exactly 1 ALTER TYPE audit_action statement', () => {
    const sql = readText('migrations/0074_cer_persisted_audit_action.sql');
    const matches = sql.match(/ALTER TYPE audit_action ADD VALUE/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('auditActionEnum in schema.ts includes cer_persisted', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toContain("'cer_persisted'");
  });

  it('AuditAction type in audit.ts includes cer_persisted', () => {
    const src = readText('lib/audit.ts');
    expect(src).toContain("'cer_persisted'");
  });
});

// ---------------------------------------------------------------------------
// Migration 0075: traceability.matrix_viewed audit action (Issue #240)
// SPEC-REGULA-TRACEABILITY-001 — distinct read audit for the evidence matrix
// view (separate from dashboard.view) so 21 CFR Part 11 inspectors can
// unambiguously identify when a user viewed the per-project traceability matrix.
// ---------------------------------------------------------------------------
describe('Migration 0075: traceability.matrix_viewed audit action (Issue #240)', () => {
  it('migration file 0075_traceability_matrix_viewed_audit_action.sql exists', () => {
    expect(fileExists('migrations/0075_traceability_matrix_viewed_audit_action.sql')).toBe(true);
  });

  it('adds traceability.matrix_viewed to audit_action enum', () => {
    const sql = readText('migrations/0075_traceability_matrix_viewed_audit_action.sql');
    expect(sql).toMatch(
      /ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'traceability.matrix_viewed'/,
    );
  });

  it('has exactly 1 ALTER TYPE audit_action statement', () => {
    const sql = readText('migrations/0075_traceability_matrix_viewed_audit_action.sql');
    const matches = sql.match(/ALTER TYPE audit_action ADD VALUE/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('auditActionEnum in schema.ts includes traceability.matrix_viewed', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toContain("'traceability.matrix_viewed'");
  });

  it('AuditAction type in audit.ts includes traceability.matrix_viewed', () => {
    const src = readText('lib/audit.ts');
    expect(src).toContain("'traceability.matrix_viewed'");
  });
});

// Migration 0083: RLS WITH CHECK clauses project-wide (SPEC-REGULA-RLS-ENFORCE-001, Issue #239, Phase 1)
// Adds WITH CHECK to 20 policies that previously had USING only (INSERT/UPDATE not gated).
// RLS remains INERT (service-role bypass) until Phase 3 (FORCE ROW LEVEL SECURITY).
describe('Migration 0083: RLS WITH CHECK clauses project-wide (Issue #239)', () => {
  it('migration file 0083_rls_with_check_clauses.sql exists', () => {
    expect(fileExists('migrations/0083_rls_with_check_clauses.sql')).toBe(true);
  });

  it('issues exactly 20 ALTER POLICY statements with 20 WITH CHECK clauses', () => {
    const sql = readText('migrations/0083_rls_with_check_clauses.sql');
    const alterPolicy = sql.match(/ALTER POLICY/g) ?? [];
    expect(alterPolicy).toHaveLength(20);
    const withCheck = sql.match(/WITH CHECK \(/g) ?? [];
    expect(withCheck).toHaveLength(20);
  });

  it.each([
    ['organization_documents', '"tenant_isolation_documents"'],
    ['document_chunks', '"tenant_isolation_chunks"'],
    ['document_access_policies', '"tenant_isolation_access_policies"'],
    ['ingest_jobs', '"tenant_isolation_ingest_jobs"'],
    ['unanswered_queue', '"tenant_isolation_unanswered_queue"'],
    ['device_classifications', '"tenant_isolation_device_classifications"'],
    ['evidence_nodes', '"tenant_isolation_evidence_nodes"'],
    ['evidence_edges', '"tenant_isolation_evidence_edges"'],
    ['stale_flags', '"tenant_isolation_stale_flags"'],
    ['prompt_registry', 'prompt_registry_org_isolation'],
    ['model_pin', 'model_pin_org_isolation'],
    ['change_request', 'change_request_org_isolation'],
    ['approved_combination', 'approved_combination_org_isolation'],
    ['threat_model', '"tenant_isolation_threat_model"'],
    ['sbom', '"tenant_isolation_sbom"'],
    ['cve_impact', '"tenant_isolation_cve_impact"'],
    ['cyber_evidence_bundle', '"tenant_isolation_cyber_evidence_bundle"'],
    ['source_license', '"tenant_isolation_source_license"'],
    ['entitlement', '"tenant_isolation_entitlement"'],
    ['answer_feedback', 'answer_feedback_org_isolation'],
  ])('ALTER POLICY on %s (policy %s) includes WITH CHECK', (table, policy) => {
    const sql = readText('migrations/0083_rls_with_check_clauses.sql');
    expect(sql).toContain(`ALTER POLICY ${policy} ON ${table}`);
  });

  it('preserves answer_feedback EXISTS subquery in WITH CHECK (4-way org join)', () => {
    const sql = readText('migrations/0083_rls_with_check_clauses.sql');
    expect(sql).toMatch(/WITH CHECK \(\s*EXISTS/);
  });
});

// Migration 0084: FORCE ROW LEVEL SECURITY (SPEC-REGULA-RLS-ENFORCE-001, Issue #239, Phase 4)
// Forces RLS on the 20 org-scoped tables so even owners are subject to policies.
// Runtime enforcement still requires the app role switch (migration 0085) because
// superuser + BYPASSRLS roles bypass RLS regardless of FORCE.
describe('Migration 0084: FORCE ROW LEVEL SECURITY (Issue #239, Phase 4)', () => {
  it('migration file 0084_force_rls.sql exists', () => {
    expect(fileExists('migrations/0084_force_rls.sql')).toBe(true);
  });

  it('issues exactly 20 ALTER TABLE ... FORCE ROW LEVEL SECURITY statements', () => {
    const sql = readText('migrations/0084_force_rls.sql');
    const forceMatches = sql.match(/ALTER TABLE \w+ FORCE ROW LEVEL SECURITY/g) ?? [];
    expect(forceMatches).toHaveLength(20);
  });

  it('includes @MX:WARN noting FORCE alone does not enforce (app role switch required)', () => {
    const sql = readText('migrations/0084_force_rls.sql');
    expect(sql).toMatch(/@MX:WARN/);
    expect(sql).toMatch(/NOBYPASSRLS|regula_app/);
    expect(sql).toMatch(/superuser|BYPASSRLS/);
  });

  it.each([
    'organization_documents',
    'document_chunks',
    'document_access_policies',
    'ingest_jobs',
    'unanswered_queue',
    'device_classifications',
    'evidence_nodes',
    'evidence_edges',
    'stale_flags',
    'prompt_registry',
    'model_pin',
    'change_request',
    'approved_combination',
    'threat_model',
    'sbom',
    'cve_impact',
    'cyber_evidence_bundle',
    'source_license',
    'entitlement',
    'answer_feedback',
  ])('forces RLS on %s', (table) => {
    const sql = readText('migrations/0084_force_rls.sql');
    expect(sql).toContain(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
  });
});

// Migration 0085: non-superuser app role (SPEC-REGULA-RLS-ENFORCE-001, Issue #239, Phase 4)
// Creates regula_app (NOBYPASSRLS) — the role that makes FORCE RLS actually enforce.
describe('Migration 0085: non-superuser app role regula_app (Issue #239, Phase 4)', () => {
  it('migration file 0085_app_role.sql exists', () => {
    expect(fileExists('migrations/0085_app_role.sql')).toBe(true);
  });

  it('creates regula_app role via idempotent DO block (CREATE ROLE has no IF NOT EXISTS)', () => {
    const sql = readText('migrations/0085_app_role.sql');
    expect(sql).toMatch(/DO \$\$[\s\S]*pg_roles[\s\S]*regula_app[\s\S]*\$\$/);
    expect(sql).toMatch(/CREATE ROLE regula_app/);
  });

  it('sets NOBYPASSRLS and NOSUPERUSER (RLS applies to this role)', () => {
    const sql = readText('migrations/0085_app_role.sql');
    expect(sql).toMatch(/NOBYPASSRLS/);
    expect(sql).toMatch(/NOSUPERUSER/);
  });

  it('uses a placeholder password (never a real password in the repo)', () => {
    const sql = readText('migrations/0085_app_role.sql');
    expect(sql).toMatch(/CHANGE_ME_SET_VIA_ALTER_ROLE/);
    expect(sql).toMatch(/ALTER ROLE regula_app WITH PASSWORD/i);
  });

  it('includes @MX:WARN about placeholder password + ops ALTER ROLE requirement', () => {
    const sql = readText('migrations/0085_app_role.sql');
    expect(sql).toMatch(/@MX:WARN/);
    expect(sql).toMatch(/placeholder|CHANGE_ME/i);
  });

  it('grants schema + DML + sequence privileges on public', () => {
    const sql = readText('migrations/0085_app_role.sql');
    expect(sql).toMatch(/GRANT USAGE ON SCHEMA public TO regula_app/);
    expect(sql).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO regula_app/,
    );
    expect(sql).toMatch(/GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO regula_app/);
  });

  it('sets ALTER DEFAULT PRIVILEGES so future tables also grant regula_app', () => {
    const sql = readText('migrations/0085_app_role.sql');
    expect(sql).toMatch(/ALTER DEFAULT PRIVILEGES IN SCHEMA public[\s\S]*regula_app/);
  });
});

// Migration 0086: knowledge promotion — semantic search & team knowledge library
// (SPEC-REGULA-KNOWLEDGE-PROMO-001, Issue #50)
describe('Migration 0086: knowledge promotion promoted_answers (Issue #50)', () => {
  it('migration file 0086_knowledge_promo.sql exists', () => {
    expect(fileExists('migrations/0086_knowledge_promo.sql')).toBe(true);
  });

  it('creates promoted_answer_status enum with active/unpromoted values', () => {
    const sql = readText('migrations/0086_knowledge_promo.sql');
    expect(sql).toMatch(/CREATE TYPE promoted_answer_status AS ENUM \('active', 'unpromoted'\)/);
  });

  it('creates promoted_answers table with UNIQUE(source_message_id)', () => {
    const sql = readText('migrations/0086_knowledge_promo.sql');
    expect(sql).toMatch(/CREATE TABLE promoted_answers/);
    expect(sql).toMatch(/org_id\s+uuid NOT NULL REFERENCES organizations/);
    expect(sql).toMatch(/source_message_id\s+uuid NOT NULL REFERENCES messages/);
    expect(sql).toMatch(/promoted_by\s+text NOT NULL REFERENCES users/);
    expect(sql).toMatch(/embedding\s+vector\(1536\)/);
    expect(sql).toMatch(/UNIQUE\(source_message_id\)/);
  });

  it('enables RLS on promoted_answers with org isolation policy', () => {
    const sql = readText('migrations/0086_knowledge_promo.sql');
    expect(sql).toMatch(/ALTER TABLE promoted_answers ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/CREATE POLICY promoted_answers_org_isolation/);
    // Join path messages -> conversations -> projects -> org_members
    expect(sql).toMatch(/JOIN conversations c ON c.id = m.conversation_id/);
  });

  it('adds tags GIN index + org_active index + ivfflat embedding index', () => {
    const sql = readText('migrations/0086_knowledge_promo.sql');
    expect(sql).toMatch(/idx_promoted_answers_org_active/);
    expect(sql).toMatch(/idx_promoted_answers_tags ON promoted_answers USING GIN\(tags\)/);
    expect(sql).toMatch(/idx_promoted_answers_embedding/);
    expect(sql).toMatch(/USING ivfflat \(embedding vector_cosine_ops\)/);
  });

  it('adds messages.content_tsv GENERATED tsvector column + GIN index', () => {
    const sql = readText('migrations/0086_knowledge_promo.sql');
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS content_tsv tsvector/);
    expect(sql).toMatch(/GENERATED ALWAYS AS \(to_tsvector\('english', content_prose\)\) STORED/);
    expect(sql).toMatch(/idx_messages_content_tsv ON messages USING GIN\(content_tsv\)/);
  });

  it.each(['answer_promoted', 'answer_unpromoted'])(
    'adds audit action %s to audit_action enum',
    (action) => {
      const sql = readText('migrations/0086_knowledge_promo.sql');
      expect(sql).toMatch(
        new RegExp(`ALTER TYPE audit_action ADD VALUE IF NOT EXISTS '${action}'`),
      );
    },
  );

  it('has exactly 2 ALTER TYPE audit_action statements', () => {
    const sql = readText('migrations/0086_knowledge_promo.sql');
    const matches = sql.match(/ALTER TYPE audit_action ADD VALUE/g) ?? [];
    expect(matches).toHaveLength(2);
  });
});

// Migration 0087: project memory — persistent context & decision accumulation
// (SPEC-REGULA-PROJECT-MEMORY-001, Issue #51)
describe('Migration 0087: project_memory (Issue #51)', () => {
  it('migration file 0087_project_memory.sql exists', () => {
    expect(fileExists('migrations/0087_project_memory.sql')).toBe(true);
  });

  it('creates project_memory_type enum with 6 values', () => {
    const sql = readText('migrations/0087_project_memory.sql');
    expect(sql).toMatch(/CREATE TYPE project_memory_type AS ENUM/);
    expect(sql).toMatch(/device_classification/);
    expect(sql).toMatch(/target_markets/);
    expect(sql).toMatch(/submission_strategy/);
    expect(sql).toMatch(/predicate_device/);
    expect(sql).toMatch(/risk_class/);
    expect(sql).toMatch(/custom/);
  });

  it('creates project_memory_status enum with active/pending/invalidated', () => {
    const sql = readText('migrations/0087_project_memory.sql');
    expect(sql).toMatch(/CREATE TYPE project_memory_status AS ENUM/);
    expect(sql).toMatch(/'active'/);
    expect(sql).toMatch(/'pending'/);
    expect(sql).toMatch(/'invalidated'/);
  });

  it('creates project_memory table with required columns + FKs', () => {
    const sql = readText('migrations/0087_project_memory.sql');
    expect(sql).toMatch(/CREATE TABLE project_memory/);
    expect(sql).toMatch(/project_id\s+uuid NOT NULL REFERENCES projects/);
    expect(sql).toMatch(/source_conversation_id uuid REFERENCES conversations/);
    expect(sql).toMatch(/created_by\s+uuid NOT NULL REFERENCES users/);
    expect(sql).toMatch(/valid_from\s+timestamptz NOT NULL DEFAULT now\(\)/);
    expect(sql).toMatch(/valid_until\s+timestamptz/);
  });

  it('enables RLS on project_memory with org isolation via projects join', () => {
    const sql = readText('migrations/0087_project_memory.sql');
    expect(sql).toMatch(/ALTER TABLE project_memory ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/CREATE POLICY project_memory_org_isolation/);
    expect(sql).toMatch(/JOIN org_members om ON om.org_id = p.organization_id/);
  });

  it('adds lookup + project_status indexes', () => {
    const sql = readText('migrations/0087_project_memory.sql');
    expect(sql).toMatch(/idx_project_memory_lookup/);
    expect(sql).toMatch(/idx_project_memory_project_status/);
  });

  it('adds UNIQUE partial index for one-active-per-key (REQ-012)', () => {
    const sql = readText('migrations/0087_project_memory.sql');
    expect(sql).toMatch(/UNIQUE NULLS NOT DISTINCT/);
    expect(sql).toMatch(/project_id, key\).*WHERE status = 'active'/s);
  });

  it('adds exactly 3 ALTER TYPE audit_action statements (memory_*)', () => {
    const sql = readText('migrations/0087_project_memory.sql');
    const matches = sql.match(/ALTER TYPE audit_action ADD VALUE/g) ?? [];
    expect(matches).toHaveLength(3);
    expect(sql).toMatch(/'memory_created'/);
    expect(sql).toMatch(/'memory_updated'/);
    expect(sql).toMatch(/'memory_invalidated'/);
  });
});

// Migration 0076: clinical investigation planner (SPEC-REGULA-CLINICAL-INVESTIGATION-001, Issue #69)
describe('Migration 0076: clinical investigation planner (Issue #69)', () => {
  it('migration file 0076_clinical_investigation.sql exists', () => {
    expect(fileExists('migrations/0076_clinical_investigation.sql')).toBe(true);
  });

  it('adds clinical_investigation to workflow_type enum', () => {
    const sql = readText('migrations/0076_clinical_investigation.sql');
    expect(sql).toMatch(
      /ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'clinical_investigation'/,
    );
  });

  it.each([
    'ci.assessed',
    'ci.pathway_determined',
    'ci.protocol_updated',
    'ci.irb_package_drafted',
    'ci.event_recorded',
    'ci.results_linked',
    'ci.closed',
    'ci.close_blocked_signoff_missing',
  ])('adds audit action %s to audit_action enum', (action) => {
    const sql = readText('migrations/0076_clinical_investigation.sql');
    expect(sql).toMatch(new RegExp(`ALTER TYPE audit_action ADD VALUE IF NOT EXISTS '${action}'`));
  });

  it('has exactly 8 ALTER TYPE audit_action statements + 1 workflow_type', () => {
    const sql = readText('migrations/0076_clinical_investigation.sql');
    const auditMatches = sql.match(/ALTER TYPE audit_action ADD VALUE/g) ?? [];
    expect(auditMatches).toHaveLength(8);
    const wfMatches = sql.match(/ALTER TYPE workflow_type ADD VALUE/g) ?? [];
    expect(wfMatches).toHaveLength(1);
  });

  it('creates 4 new enums (ci_pathway, ci_doc_type, ci_event_type, ci_link_target_type)', () => {
    const sql = readText('migrations/0076_clinical_investigation.sql');
    expect(sql).toMatch(/CREATE TYPE ci_pathway AS ENUM/);
    expect(sql).toMatch(/CREATE TYPE ci_doc_type AS ENUM/);
    expect(sql).toMatch(/CREATE TYPE ci_event_type AS ENUM/);
    expect(sql).toMatch(/CREATE TYPE ci_link_target_type AS ENUM/);
  });

  it.each(['clinical_investigations', 'ci_protocols', 'ci_documents', 'ci_events', 'ci_links'])(
    'creates table %s with RLS org-isolation',
    (table) => {
      const sql = readText('migrations/0076_clinical_investigation.sql');
      expect(sql).toMatch(new RegExp(`CREATE TABLE ${table}`));
      expect(sql).toMatch(new RegExp(`ENABLE ROW LEVEL SECURITY.*${table}`, 's'));
    },
  );

  it('workflowTypeEnum in schema.ts includes clinical_investigation', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toContain("'clinical_investigation'");
  });

  it.each([
    'ci.assessed',
    'ci.pathway_determined',
    'ci.protocol_updated',
    'ci.irb_package_drafted',
    'ci.event_recorded',
    'ci.results_linked',
    'ci.closed',
    'ci.close_blocked_signoff_missing',
  ])('auditActionEnum in schema.ts includes %s', (action) => {
    const src = readText('lib/db/schema.ts');
    expect(src).toContain(`'${action}'`);
  });
});

describe('migrations/0077_model_governance.sql (SPEC-REGULA-MODEL-GOVERNANCE-001, Issue 71)', () => {
  it('migration file exists', () => {
    expect(fileExists('migrations/0077_model_governance.sql')).toBe(true);
  });

  it.each([
    'modelgov.prompt_registered',
    'modelgov.change_requested',
    'modelgov.eval_passed',
    'modelgov.eval_failed',
    'modelgov.approved',
    'modelgov.rejected',
    'modelgov.rolled_back',
    'modelgov.runtime_blocked',
  ])('adds audit action %s to audit_action enum', (action) => {
    const sql = readText('migrations/0077_model_governance.sql');
    expect(sql).toMatch(new RegExp(`ALTER TYPE audit_action ADD VALUE IF NOT EXISTS '${action}'`));
  });

  it('has exactly 8 ALTER TYPE audit_action statements + 0 workflow_type', () => {
    const sql = readText('migrations/0077_model_governance.sql');
    const auditMatches = sql.match(/ALTER TYPE audit_action ADD VALUE/g) ?? [];
    expect(auditMatches).toHaveLength(8);
    // REQ-MODELGOV does not persist to workflow_runs — no workflow_type extension.
    const wfMatches = sql.match(/ALTER TYPE workflow_type ADD VALUE/g) ?? [];
    expect(wfMatches).toHaveLength(0);
  });

  it('creates 3 new enums (modelgov_kind, eval_status, modelgov_approval_status)', () => {
    const sql = readText('migrations/0077_model_governance.sql');
    expect(sql).toMatch(/CREATE TYPE modelgov_kind AS ENUM/);
    expect(sql).toMatch(/CREATE TYPE eval_status AS ENUM/);
    expect(sql).toMatch(/CREATE TYPE modelgov_approval_status AS ENUM/);
  });

  it.each(['prompt_registry', 'model_pin', 'change_request', 'approved_combination'])(
    'creates table %s with RLS org-isolation',
    (table) => {
      const sql = readText('migrations/0077_model_governance.sql');
      expect(sql).toMatch(new RegExp(`CREATE TABLE ${table}`));
      expect(sql).toMatch(new RegExp(`ENABLE ROW LEVEL SECURITY.*${table}`, 's'));
    },
  );

  it('enforces single-active approved_combination via partial UNIQUE INDEX (REQ-MODELGOV-013)', () => {
    const sql = readText('migrations/0077_model_governance.sql');
    expect(sql).toMatch(/CREATE UNIQUE INDEX approved_combination_one_active_per_org/);
    expect(sql).toMatch(/WHERE active = true/);
  });

  it.each([
    'modelgov.prompt_registered',
    'modelgov.change_requested',
    'modelgov.eval_passed',
    'modelgov.eval_failed',
    'modelgov.approved',
    'modelgov.rejected',
    'modelgov.rolled_back',
    'modelgov.runtime_blocked',
  ])('auditActionEnum in schema.ts includes %s', (action) => {
    const src = readText('lib/db/schema.ts');
    expect(src).toContain(`'${action}'`);
  });

  it('schema.ts defines the 4 new tables + 3 new enums', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/export const modelgovKindEnum/);
    expect(src).toMatch(/export const evalStatusEnum/);
    expect(src).toMatch(/export const modelgovApprovalStatusEnum/);
    expect(src).toMatch(/export const promptRegistry = pgTable/);
    expect(src).toMatch(/export const modelPin = pgTable/);
    expect(src).toMatch(/export const changeRequest = pgTable/);
    expect(src).toMatch(/export const approvedCombination = pgTable/);
  });
});

// ---------------------------------------------------------------------------
// migrations/0078_cyberdevice.sql (SPEC-REGULA-CYBERDEVICE-001, Issue 67)
// ---------------------------------------------------------------------------
describe('migrations/0078_cyberdevice.sql (SPEC-REGULA-CYBERDEVICE-001, Issue 67)', () => {
  it('migration file exists', () => {
    expect(fileExists('migrations/0078_cyberdevice.sql')).toBe(true);
  });

  it.each([
    'cyber.threat_modeled',
    'cyber.sbom_imported',
    'cyber.sbom_validated',
    'cyber.sbom_diffed',
    'cyber.cve_analyzed',
    'cyber.update_plan_created',
    'cyber.evidence_bundled',
    'cyber.risk_linked',
    'cyber.access_denied',
  ])('adds ALTER TYPE audit_action ADD VALUE for: %s', (action) => {
    const sql = readText('migrations/0078_cyberdevice.sql');
    const escaped = action.replace(/\./g, '\\.');
    expect(sql).toMatch(
      new RegExp(`ALTER TYPE audit_action ADD VALUE\\s+IF NOT EXISTS\\s+'${escaped}'`),
    );
  });

  it('has exactly 9 ALTER TYPE audit_action statements', () => {
    const sql = readText('migrations/0078_cyberdevice.sql');
    const matches = sql.match(/ALTER TYPE audit_action ADD VALUE/g) ?? [];
    expect(matches).toHaveLength(9);
  });

  it('creates the 4 new tables with org_id + project_id scoping', () => {
    const sql = readText('migrations/0078_cyberdevice.sql');
    expect(sql).toMatch(/CREATE TABLE threat_model/);
    expect(sql).toMatch(/CREATE TABLE sbom/);
    expect(sql).toMatch(/CREATE TABLE cve_impact/);
    expect(sql).toMatch(/CREATE TABLE cyber_evidence_bundle/);
    expect(sql).toMatch(/REFERENCES organizations\(id\)/);
    expect(sql).toMatch(/REFERENCES projects\(id\)/);
  });

  it('enables RLS with org-isolation on all 4 tables', () => {
    const sql = readText('migrations/0078_cyberdevice.sql');
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/g);
    const policies = sql.match(/tenant_isolation_\w+/g) ?? [];
    expect(policies.length).toBeGreaterThanOrEqual(4);
    expect(sql).toMatch(/current_setting\('app.current_org_id'/);
  });

  it('creates the 2 new enums (sbom_format, cve_severity)', () => {
    const sql = readText('migrations/0078_cyberdevice.sql');
    expect(sql).toMatch(/CREATE TYPE sbom_format AS ENUM \('spdx', 'cyclonedx'\)/);
    expect(sql).toMatch(/CREATE TYPE cve_severity AS ENUM/);
  });

  it.each([
    'cyber.threat_modeled',
    'cyber.sbom_imported',
    'cyber.cve_analyzed',
    'cyber.access_denied',
  ])('auditActionEnum in schema.ts includes %s', (action) => {
    const src = readText('lib/db/schema.ts');
    expect(src).toContain(`'${action}'`);
  });

  it('schema.ts defines the 4 new tables + 2 new enums', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/export const sbomFormatEnum/);
    expect(src).toMatch(/export const cveSeverityEnum/);
    expect(src).toMatch(/export const threatModel = pgTable/);
    expect(src).toMatch(/export const sbom = pgTable/);
    expect(src).toMatch(/export const cveImpact = pgTable/);
    expect(src).toMatch(/export const cyberEvidenceBundle = pgTable/);
  });
});

// ---------------------------------------------------------------------------
// SPEC-REGULA-CORPUS-LICENSE-001 — Issue #72 (migration 0080_corpus_license)
// ---------------------------------------------------------------------------

describe('SPEC-REGULA-CORPUS-LICENSE-001 (Issue #72, migration 0080)', () => {
  it('has exactly 9 ALTER TYPE audit_action statements', () => {
    const sql = readText('migrations/0080_corpus_license.sql');
    const matches = sql.match(/ALTER TYPE audit_action ADD VALUE/g) ?? [];
    expect(matches).toHaveLength(9);
  });

  it('creates the 2 new tables with org_id scoping', () => {
    const sql = readText('migrations/0080_corpus_license.sql');
    expect(sql).toMatch(/CREATE TABLE source_license/);
    expect(sql).toMatch(/CREATE TABLE entitlement/);
    expect(sql).toMatch(/REFERENCES organizations\(id\)/);
    expect(sql).toMatch(/REFERENCES sources\(id\)/);
  });

  it('enables RLS with org-isolation on both tables', () => {
    const sql = readText('migrations/0080_corpus_license.sql');
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/g);
    const policies = sql.match(/tenant_isolation_\w+/g) ?? [];
    expect(policies.length).toBeGreaterThanOrEqual(2);
    expect(sql).toMatch(/current_setting\('app.current_org_id'/);
  });

  it('creates the 3 new enums (license_type, confidentiality_level, entitlement_status)', () => {
    const sql = readText('migrations/0080_corpus_license.sql');
    expect(sql).toMatch(
      /CREATE TYPE license_type AS ENUM \('standard_paid', 'journal', 'internal_sop', 'open'\)/,
    );
    expect(sql).toMatch(
      /CREATE TYPE confidentiality_level AS ENUM \('public', 'internal', 'trade_secret'\)/,
    );
    expect(sql).toMatch(
      /CREATE TYPE entitlement_status AS ENUM \('active', 'revoked', 'expired'\)/,
    );
  });

  it.each([
    'corpus.license_set',
    'corpus.ingestion_blocked',
    'corpus.full_text_blocked',
    'corpus.entitlement_granted',
    'corpus.entitlement_revoked',
    'corpus.export_blocked',
    'corpus.access_denied',
    'corpus.expiry_warned',
    'corpus.abstract_only_enforced',
  ])('auditActionEnum in schema.ts includes %s', (action) => {
    const src = readText('lib/db/schema.ts');
    expect(src).toContain(`'${action}'`);
  });

  it('schema.ts defines the 2 new tables + 3 new enums', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/export const licenseTypeEnum/);
    expect(src).toMatch(/export const confidentialityLevelEnum/);
    expect(src).toMatch(/export const entitlementStatusEnum/);
    expect(src).toMatch(/export const sourceLicense = pgTable/);
    expect(src).toMatch(/export const entitlement = pgTable/);
  });
});

// ---------------------------------------------------------------------------
// SPEC-REGULA-SOURCE-GOVERNANCE-001 — Issue #48 (migration 0081_source_governance)
// ---------------------------------------------------------------------------

describe('SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48, migration 0081)', () => {
  it('migration file 0081_source_governance.sql exists', () => {
    expect(fileExists('migrations/0081_source_governance.sql')).toBe(true);
  });

  it('has exactly 8 ALTER TYPE audit_action statements', () => {
    const sql = readText('migrations/0081_source_governance.sql');
    const matches = sql.match(/ALTER TYPE audit_action ADD VALUE/g) ?? [];
    expect(matches).toHaveLength(8);
  });

  it('creates the 2 new enums (source_authority_grade, source_approval_status)', () => {
    const sql = readText('migrations/0081_source_governance.sql');
    expect(sql).toMatch(/CREATE TYPE source_authority_grade AS ENUM/);
    expect(sql).toMatch(/CREATE TYPE source_approval_status AS ENUM/);
    for (const grade of [
      'regulator_official',
      'harmonized_standard',
      'internal_sop',
      'prior_submission',
      'public_database',
      'secondary_reference',
    ]) {
      expect(sql).toContain(`'${grade}'`);
    }
    for (const status of ['pending_review', 'approved', 'rejected']) {
      expect(sql).toContain(`'${status}'`);
    }
  });

  it('ALTERs the sources table with the 9 governance columns', () => {
    const sql = readText('migrations/0081_source_governance.sql');
    expect(sql).toMatch(/ALTER TABLE sources\s+ADD COLUMN IF NOT EXISTS authority_grade/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS jurisdiction/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS effective_date/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS sunset_date/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS superseded_by/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS owner_department/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS approval_status/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS review_cycle_days/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS last_reviewed_at/);
  });

  it('approval_status defaults to pending_review (REQ-SOURCE-GOV-009)', () => {
    const sql = readText('migrations/0081_source_governance.sql');
    expect(sql).toMatch(/approval_status source_approval_status NOT NULL DEFAULT 'pending_review'/);
  });

  it.each([
    'source.approved',
    'source.rejected',
    'source.review_due',
    'source.superseded',
    'source.stale_blocked',
    'source.low_authority_flagged',
    'source.governance_updated',
    'source.delta_sync_updated',
  ])('auditActionEnum in schema.ts includes %s', (action) => {
    const src = readText('lib/db/schema.ts');
    expect(src).toContain(`'${action}'`);
  });

  it('schema.ts defines the 2 new enums + sources governance columns', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/export const sourceAuthorityGradeEnum/);
    expect(src).toMatch(/export const sourceApprovalStatusEnum/);
    expect(src).toMatch(/authorityGrade: sourceAuthorityGradeEnum/);
    expect(src).toMatch(/approvalStatus: sourceApprovalStatusEnum/);
    expect(src).toMatch(/supersededBy: uuid\('superseded_by'\)/);
    expect(src).toMatch(/sunsetDate: date\('sunset_date'\)/);
    expect(src).toMatch(/effectiveDate: date\('effective_date'\)/);
    expect(src).toMatch(/ownerDepartment: text\('owner_department'\)/);
    expect(src).toMatch(/reviewCycleDays: integer\('review_cycle_days'\)/);
    expect(src).toMatch(/lastReviewedAt: timestamp\('last_reviewed_at'/);
  });

  it('AuditAction type includes the 8 source.* values (lock-step)', () => {
    const src = readText('lib/audit.ts');
    for (const action of [
      'source.approved',
      'source.rejected',
      'source.review_due',
      'source.superseded',
      'source.stale_blocked',
      'source.low_authority_flagged',
      'source.governance_updated',
      'source.delta_sync_updated',
    ]) {
      expect(src).toContain(`'${action}'`);
    }
  });
});

describe('Migration 0059: source provenance fields (Issue #154, REQ-INTEGRATION-001)', () => {
  it('migration file 0059_provenance_fields.sql exists', () => {
    expect(fileExists('migrations/0059_provenance_fields.sql')).toBe(true);
  });

  it('adds 9 provenance columns to sources table', () => {
    const sql = readText('migrations/0059_provenance_fields.sql');
    const addColumnCount = (sql.match(/ADD COLUMN/g) ?? []).length;
    expect(addColumnCount).toBeGreaterThanOrEqual(13);
    for (const col of [
      'source_host',
      'source_owner',
      'source_repo',
      'source_branch',
      'source_ref',
      'source_path',
      'content_hash',
      'ingestion_run_id',
      'ingested_at',
    ]) {
      expect(sql).toMatch(new RegExp(`ADD COLUMN\\s+${col}\\s+(TEXT|UUID|TIMESTAMPTZ)`));
    }
  });

  it('adds 4 provenance columns to source_sections table', () => {
    const sql = readText('migrations/0059_provenance_fields.sql');
    for (const col of ['chunk_hash', 'section_path', 'ingestion_run_id', 'ingested_at']) {
      expect(sql).toMatch(new RegExp(`ADD COLUMN\\s+${col}\\s+(TEXT|UUID|TIMESTAMPTZ)`));
    }
  });

  it('creates the 3 provenance indexes', () => {
    const sql = readText('migrations/0059_provenance_fields.sql');
    expect(sql).toMatch(/CREATE INDEX\s+idx_sources_host\s+ON sources\s*\(\s*source_host\s*\)/);
    expect(sql).toMatch(
      /CREATE INDEX\s+idx_sources_ingestion\s+ON sources\s*\(\s*ingestion_run_id\s*\)/,
    );
    expect(sql).toMatch(
      /CREATE INDEX\s+idx_source_sections_ingestion\s+ON source_sections\s*\(\s*ingestion_run_id\s*\)/,
    );
  });

  it('schema.ts defines matching provenance columns on sources + source_sections', () => {
    const src = readText('lib/db/schema.ts');
    for (const col of [
      'sourceHost',
      'sourceOwner',
      'sourceRepo',
      'sourceBranch',
      'sourceRef',
      'sourcePath',
      'contentHash',
      'ingestionRunId',
      'ingestedAt',
    ]) {
      expect(src).toContain(`${col}:`);
    }
    for (const col of ['chunkHash', 'sectionPath', 'ingestionRunId', 'ingestedAt']) {
      expect(src).toContain(`${col}:`);
    }
  });
});

// ---------------------------------------------------------------------------
// Migration 0091: owning-project issue routing (#157)
// ---------------------------------------------------------------------------
describe('Migration 0091: owning-project issue routing (Issue #157)', () => {
  it('migration file 0091_owning_issue.sql exists', () => {
    expect(fileExists('migrations/0091_owning_issue.sql')).toBe(true);
  });

  it('adds owning_issue_url + owning_issue_target columns to unanswered_queue (idempotent)', () => {
    const sql = readText('migrations/0091_owning_issue.sql');
    expect(sql).toMatch(
      /ALTER TABLE unanswered_queue\s+ADD COLUMN IF NOT EXISTS owning_issue_url text/,
    );
    expect(sql).toMatch(
      /ALTER TABLE unanswered_queue\s+ADD COLUMN IF NOT EXISTS owning_issue_target text/,
    );
  });

  it('adds owning_issue_created + owning_issue_creation_failed to audit_action (idempotent)', () => {
    const sql = readText('migrations/0091_owning_issue.sql');
    expect(sql).toMatch(/ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'owning_issue_created'/);
    expect(sql).toMatch(
      /ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'owning_issue_creation_failed'/,
    );
  });

  it('schema.ts defines matching columns on unansweredQueue', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toContain("owningIssueUrl: text('owning_issue_url')");
    expect(src).toContain("owningIssueTarget: text('owning_issue_target')");
  });

  it('schema.ts auditActionEnum + audit.ts AuditAction type include both new actions', () => {
    const schemaSrc = readText('lib/db/schema.ts');
    const enumValues = extractAuditActionEnumValues(schemaSrc);
    expect(enumValues).toContain('owning_issue_created');
    expect(enumValues).toContain('owning_issue_creation_failed');

    const auditSrc = readText('lib/audit.ts');
    const typeValues = extractAuditActionTypeValues(auditSrc);
    expect(typeValues).toContain('owning_issue_created');
    expect(typeValues).toContain('owning_issue_creation_failed');
  });
});

// ---------------------------------------------------------------------------
// Migration 0092: design_history_files + submission_packages text-vs-uuid FK fix (Issue #280)
// ---------------------------------------------------------------------------
describe('Migration 0092: DHF + eSubmit text-vs-uuid FK fix (Issue #280)', () => {
  it('migration file 0092_fixup_dhf_esubmit_text_uuid.sql exists', () => {
    expect(fileExists('migrations/0092_fixup_dhf_esubmit_text_uuid.sql')).toBe(true);
  });

  it('creates design_history_files with org_id uuid (not text)', () => {
    const sql = readText('migrations/0092_fixup_dhf_esubmit_text_uuid.sql');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS design_history_files/);
    expect(sql).toMatch(/org_id uuid NOT NULL REFERENCES organizations\(id\) ON DELETE CASCADE/);
  });

  it('creates design_history_files with created_by uuid (not text)', () => {
    const sql = readText('migrations/0092_fixup_dhf_esubmit_text_uuid.sql');
    expect(sql).toMatch(/created_by uuid NOT NULL REFERENCES users\(id\)/);
  });

  it('creates design_inputs table (dhf_id TEXT matches design_history_files.id TEXT)', () => {
    const sql = readText('migrations/0092_fixup_dhf_esubmit_text_uuid.sql');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS design_inputs/);
    expect(sql).toMatch(
      /dhf_id TEXT NOT NULL REFERENCES design_history_files\(id\) ON DELETE CASCADE/,
    );
  });

  it('creates design_verifications table', () => {
    const sql = readText('migrations/0092_fixup_dhf_esubmit_text_uuid.sql');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS design_verifications/);
    expect(sql).toMatch(
      /dhf_id TEXT NOT NULL REFERENCES design_history_files\(id\) ON DELETE CASCADE/,
    );
    expect(sql).toMatch(/design_input_id TEXT REFERENCES design_inputs\(id\)/);
  });

  it('creates design_reviews table', () => {
    const sql = readText('migrations/0092_fixup_dhf_esubmit_text_uuid.sql');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS design_reviews/);
    expect(sql).toMatch(
      /dhf_id TEXT NOT NULL REFERENCES design_history_files\(id\) ON DELETE CASCADE/,
    );
  });

  it('creates submission_packages with org_id uuid (not text)', () => {
    const sql = readText('migrations/0092_fixup_dhf_esubmit_text_uuid.sql');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS submission_packages/);
    expect(sql).toMatch(/org_id uuid NOT NULL REFERENCES organizations\(id\) ON DELETE CASCADE/);
  });

  it('creates submission_packages with created_by uuid (not text)', () => {
    const sql = readText('migrations/0092_fixup_dhf_esubmit_text_uuid.sql');
    expect(sql).toMatch(/created_by uuid NOT NULL REFERENCES users\(id\)/);
  });

  it('creates submission_interactions table (package_id TEXT matches submission_packages.id TEXT)', () => {
    const sql = readText('migrations/0092_fixup_dhf_esubmit_text_uuid.sql');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS submission_interactions/);
    expect(sql).toMatch(
      /package_id TEXT NOT NULL REFERENCES submission_packages\(id\) ON DELETE CASCADE/,
    );
  });

  it('creates all 6 required indexes with IF NOT EXISTS', () => {
    const sql = readText('migrations/0092_fixup_dhf_esubmit_text_uuid.sql');
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_dhf_org ON design_history_files\(org_id\)/);
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_design_inputs_dhf ON design_inputs\(dhf_id\)/,
    );
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_design_verifications_dhf ON design_verifications\(dhf_id\)/,
    );
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_design_reviews_dhf ON design_reviews\(dhf_id\)/,
    );
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_submission_packages_org ON submission_packages\(org_id\)/,
    );
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_submission_interactions_pkg ON submission_interactions\(package_id\)/,
    );
  });

  it('adds 4 DHF audit_action enum values with IF NOT EXISTS', () => {
    const sql = readText('migrations/0092_fixup_dhf_esubmit_text_uuid.sql');
    expect(sql).toMatch(/ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'dhf_created'/);
    expect(sql).toMatch(/ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'dhf_updated'/);
    expect(sql).toMatch(/ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'dhf_design_freeze'/);
    expect(sql).toMatch(/ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'dhf_review_approved'/);
  });

  it('schema.ts designHistoryFiles matches migration (org_id uuid, created_by uuid)', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toContain("orgId: uuid('org_id')");
    expect(src).toContain("createdBy: uuid('created_by')");
  });

  it('schema.ts submissionPackages matches migration (org_id uuid, created_by uuid)', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toContain("orgId: uuid('org_id')");
    expect(src).toContain("createdBy: uuid('created_by')");
  });

  it('schema.ts designInputs/designVerifications/designReviews match migration', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toContain("dhfId: text('dhf_id')");
    expect(src).toContain("designInputId: text('design_input_id')");
  });

  it('schema.ts submissionInteractions matches migration (package_id TEXT)', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toContain("packageId: text('package_id')");
  });
});

// ---------------------------------------------------------------------------
// Migration 0093: RLHF quality_tag enum +4 confidence-breakdown (Issue #264 sub-PR 1/3)
// ---------------------------------------------------------------------------
describe('Migration 0093: RLHF quality_tag +4 confidence-breakdown (Issue #264)', () => {
  it('migration file 0093_rlhf_quality_tags_plus4.sql exists', () => {
    expect(fileExists('migrations/0093_rlhf_quality_tags_plus4.sql')).toBe(true);
  });

  it('adds 4 quality_tag enum values with ALTER TYPE IF NOT EXISTS', () => {
    const sql = readText('migrations/0093_rlhf_quality_tags_plus4.sql');
    expect(sql).toMatch(/ALTER TYPE quality_tag ADD VALUE IF NOT EXISTS 'citation_coverage_low'/);
    expect(sql).toMatch(/ALTER TYPE quality_tag ADD VALUE IF NOT EXISTS 'source_recency_stale'/);
    expect(sql).toMatch(/ALTER TYPE quality_tag ADD VALUE IF NOT EXISTS 'source_authority_weak'/);
    expect(sql).toMatch(
      /ALTER TYPE quality_tag ADD VALUE IF NOT EXISTS 'source_agreement_conflict'/,
    );
  });

  it('schema.ts qualityTagEnum matches migration (12 values, #264 breakdown)', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toContain("'citation_coverage_low'");
    expect(src).toContain("'source_recency_stale'");
    expect(src).toContain("'source_authority_weak'");
    expect(src).toContain("'source_agreement_conflict'");
  });
});

// ---------------------------------------------------------------------------
// Migration 0094: messages embedding for REQ-002 semantic search (Issue #275)
// ---------------------------------------------------------------------------
describe('Migration 0094: messages embedding (Issue #275)', () => {
  it('migration file 0094_messages_embedding.sql exists', () => {
    expect(fileExists('migrations/0094_messages_embedding.sql')).toBe(true);
  });

  it('adds messages.embedding column with idempotent DO $$ block', () => {
    const sql = readText('migrations/0094_messages_embedding.sql');
    expect(sql).toMatch(/DO \$\$/);
    expect(sql).toMatch(/information_schema\.columns/);
    expect(sql).toMatch(/table_name = 'messages'/);
    expect(sql).toMatch(/column_name = 'embedding'/);
    expect(sql).toMatch(/ALTER TABLE messages ADD COLUMN embedding vector\(1536\)/);
  });

  it('creates ivfflat index with IF NOT EXISTS', () => {
    const sql = readText('migrations/0094_messages_embedding.sql');
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_messages_embedding/);
    expect(sql).toMatch(/USING ivfflat \(embedding vector_cosine_ops\)/);
    expect(sql).toMatch(/WITH \(lists = 10\)/);
  });

  it('schema.ts messages table has embedding column', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toContain('embedding: vector');
  });
});

// ---------------------------------------------------------------------------
// Migration 0095: RLHF confidence-calibration candidates (Issue #264 sub-PR 2/3)
// ---------------------------------------------------------------------------
describe('Migration 0095: RLHF calibration candidates (Issue #264 sub-PR 2/3)', () => {
  it('migration file 0095_rlhf_calibration_candidates.sql exists', () => {
    expect(fileExists('migrations/0095_rlhf_calibration_candidates.sql')).toBe(true);
  });

  it('creates calibration_candidate_status enum with 4 values', () => {
    const sql = readText('migrations/0095_rlhf_calibration_candidates.sql');
    expect(sql).toMatch(/CREATE TYPE calibration_candidate_status AS ENUM/);
    expect(sql).toMatch(/'pending'/);
    expect(sql).toMatch(/'reviewed'/);
    expect(sql).toMatch(/'dismissed'/);
    expect(sql).toMatch(/'applied_via_governance'/);
  });

  it('creates calibration_candidates table with org isolation + governance link', () => {
    const sql = readText('migrations/0095_rlhf_calibration_candidates.sql');
    expect(sql).toMatch(/CREATE TABLE calibration_candidates/);
    expect(sql).toMatch(/org_id\s+uuid NOT NULL REFERENCES organizations/);
    expect(sql).toMatch(/confidence_bucket\s+text NOT NULL/);
    expect(sql).toMatch(/observed_up_ratio\s+numeric\(4,3\)/);
    expect(sql).toMatch(/sample_size\s+integer NOT NULL DEFAULT 0/);
    // Charter [지양-2]: status defaults to pending (never auto-applied).
    expect(sql).toMatch(/status\s+calibration_candidate_status NOT NULL DEFAULT 'pending'/);
    // Charter [지양-4]: nullable governance link to #71.
    expect(sql).toMatch(/governance_change_request_id\s+uuid/);
    // RLS enabled (defense-in-depth; #239 debt acknowledged).
    expect(sql).toMatch(/ALTER TABLE calibration_candidates ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/CREATE POLICY calibration_candidates_org_isolation/);
  });

  it('adds rlhf.calibration_proposed audit action (ALTER TYPE IF NOT EXISTS)', () => {
    const sql = readText('migrations/0095_rlhf_calibration_candidates.sql');
    expect(sql).toMatch(
      /ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'rlhf\.calibration_proposed'/,
    );
  });

  it('schema.ts calibrationCandidateStatusEnum matches migration (4 values)', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/export const calibrationCandidateStatusEnum\s*=\s*pgEnum/);
    expect(src).toMatch(/calibration_candidate_status/);
    expect(src).toContain("'pending'");
    expect(src).toContain("'reviewed'");
    expect(src).toContain("'dismissed'");
    expect(src).toContain("'applied_via_governance'");
  });

  it('schema.ts calibrationCandidates table mirrors migration columns', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/export const calibrationCandidates\s*=\s*pgTable/);
    expect(src).toMatch(/'calibration_candidates'/);
    expect(src).toMatch(/confidenceBucket:\s*text\('confidence_bucket'\)/);
    expect(src).toMatch(/observedUpRatio:\s*numeric\('observed_up_ratio'/);
    expect(src).toMatch(/calibrationCandidateStatusEnum\('status'\)/);
    expect(src).toMatch(/governanceChangeRequestId:\s*uuid\('governance_change_request_id'\)/);
  });

  it('lib/audit.ts AuditAction union includes rlhf.calibration_proposed', () => {
    const src = readText('lib/audit.ts');
    expect(src).toMatch(/'rlhf\.calibration_proposed'/);
  });

  // ------------------------------------------------------------------
  // Issue #264 sub-PR 3/3 — implicit feedback (alternate answers)
  // ------------------------------------------------------------------

  it('migration file 0096_rlhf_implicit_feedback.sql exists', () => {
    expect(fileExists('migrations/0096_rlhf_implicit_feedback.sql')).toBe(true);
  });

  it('0096 creates answer_feedback_source enum (2 values)', () => {
    const sql = readText('migrations/0096_rlhf_implicit_feedback.sql');
    expect(sql).toMatch(/CREATE TYPE answer_feedback_source AS ENUM/);
    expect(sql).toMatch(/'explicit'/);
    expect(sql).toMatch(/'implicit_regenerate'/);
  });

  it('0096 adds feedback_source + variation_dimensions columns', () => {
    const sql = readText('migrations/0096_rlhf_implicit_feedback.sql');
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS feedback_source answer_feedback_source/);
    expect(sql).toMatch(/NOT NULL DEFAULT 'explicit'/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS variation_dimensions jsonb/);
  });

  it('0096 drops the 2-col unique and adds a 3-col unique (idempotent)', () => {
    const sql = readText('migrations/0096_rlhf_implicit_feedback.sql');
    // Drizzle/schema.ts name (never existed in real DB but kept for robustness).
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS answer_feedback_message_user_idx/);
    // CRITICAL: 0082 declared UNIQUE(message_id, user_id) INLINE, so Postgres
    // auto-named it `answer_feedback_message_id_user_id_key` (the `_key` suffix).
    // The original 0096 draft only dropped the Drizzle-name and missed this one,
    // so the 2-col unique survived in real DB and explicit+implicit inserts 500'd.
    // This assertion prevents that regression.
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS answer_feedback_message_id_user_id_key/);
    expect(sql).toMatch(
      /ADD CONSTRAINT answer_feedback_message_user_source_idx\s+UNIQUE \(message_id, user_id, feedback_source\)/,
    );
  });

  it('0096 adds rlhf.implicit_feedback_recorded audit action (ALTER TYPE IF NOT EXISTS)', () => {
    const sql = readText('migrations/0096_rlhf_implicit_feedback.sql');
    expect(sql).toMatch(
      /ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'rlhf\.implicit_feedback_recorded'/,
    );
  });

  it('schema.ts feedbackSourceEnum mirrors migration (2 values)', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(/export const feedbackSourceEnum\s*=\s*pgEnum\('answer_feedback_source'/);
    expect(src).toContain("'explicit'");
    expect(src).toContain("'implicit_regenerate'");
  });

  it('schema.ts answerFeedback table has feedbackSource + variationDimensions columns', () => {
    const src = readText('lib/db/schema.ts');
    expect(src).toMatch(
      /feedbackSource:\s*feedbackSourceEnum\('feedback_source'\)\.notNull\(\)\.default\('explicit'\)/,
    );
    expect(src).toMatch(/variationDimensions:\s*jsonb\('variation_dimensions'\)/);
    // 3-column unique replaces the old 2-column unique.
    expect(src).toMatch(
      /messageUserSourceUnique:\s*unique\('answer_feedback_message_user_source_idx'\)\.on\(/,
    );
    expect(src).not.toMatch(/messageUserUnique:\s*unique\('answer_feedback_message_user_idx'\)/);
  });

  it('lib/audit.ts AuditAction union includes rlhf.implicit_feedback_recorded', () => {
    const src = readText('lib/audit.ts');
    expect(src).toMatch(/'rlhf\.implicit_feedback_recorded'/);
  });
});
