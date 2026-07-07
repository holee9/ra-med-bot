// @MX:NOTE [AUTO] SPEC-REGULA-VALIDATION-001 M0 — schema/migration/Zod shape tests.
// These tests do NOT execute SQL. They verify file-level invariants so that a
// regression to the validation evidence data model breaks CI before it ships.
// Migration-level CHECK constraints are validated by the integration test that
// runs `pnpm db:migrate` against a real Postgres instance (L-010).

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const readText = (rel: string): string => fs.readFileSync(path.join(root, rel), 'utf8');

describe('SPEC-REGULA-VALIDATION-001 M0 — schema.ts exports', async () => {
  const schema = (await import('@/lib/db/schema')) as Record<string, unknown>;

  it('REQ-VAL-003/004/005: exports validationEvidence table', () => {
    expect(schema.validationEvidence).toBeDefined();
  });

  it('REQ-VAL-007/008/009: exports changeControl table', () => {
    expect(schema.changeControl).toBeDefined();
  });

  it('REQ-VAL-010/012/013: exports validationSignoff table', () => {
    expect(schema.validationSignoff).toBeDefined();
  });
});

describe('SPEC-REGULA-VALIDATION-001 M0 — migration 0112 shape', () => {
  const up = readText('migrations/0112_validation_evidence.sql');
  const down = readText('migrations/0112_validation_evidence_rollback.sql');

  it('creates all 3 tables', () => {
    expect(up).toMatch(/CREATE TABLE IF NOT EXISTS validation_evidence/);
    expect(up).toMatch(/CREATE TABLE IF NOT EXISTS change_control/);
    expect(up).toMatch(/CREATE TABLE IF NOT EXISTS validation_signoff/);
  });

  it('REQ-VAL-003: qualification_type CHECK covers iq/oq/pq only', () => {
    // Match the CHECK clause precisely — guards against accidental widening.
    expect(up).toMatch(
      /qualification_type TEXT NOT NULL CHECK \(qualification_type IN \('iq', 'oq', 'pq'\)\)/,
    );
  });

  it('REQ-VAL-006: result CHECK covers pass/fail/skip only', () => {
    expect(up).toMatch(/result TEXT NOT NULL CHECK \(result IN \('pass', 'fail', 'skip'\)\)/);
  });

  it('REQ-VAL-007: change_axis CHECK covers all 7 axes', () => {
    expect(up).toMatch(/change_axis TEXT NOT NULL CHECK \(change_axis IN/);
    for (const axis of [
      'source_policy',
      'prompt',
      'model',
      'schema',
      'retrieval',
      'export',
      'review_workflow',
    ]) {
      expect(up, `axis ${axis} missing`).toContain(`'${axis}'`);
    }
  });

  it('REQ-VAL-008: impact_level CHECK covers low/medium/high only', () => {
    expect(up).toMatch(
      /impact_level TEXT NOT NULL CHECK \(impact_level IN \('low', 'medium', 'high'\)\)/,
    );
  });

  it('REQ-VAL-013: validation_signoff.release_id is UNIQUE (one sign-off per release)', () => {
    expect(up).toMatch(/release_id TEXT NOT NULL UNIQUE/);
  });

  it('release_id indexes present (M1-M4 access pattern)', () => {
    expect(up).toMatch(/CREATE INDEX IF NOT EXISTS idx_validation_evidence_release/);
    expect(up).toMatch(/CREATE INDEX IF NOT EXISTS idx_change_control_release/);
  });

  it('rollback drops all 3 tables in FK-safe order', () => {
    expect(down).toMatch(/DROP TABLE IF EXISTS validation_signoff/);
    expect(down).toMatch(/DROP TABLE IF EXISTS change_control/);
    expect(down).toMatch(/DROP TABLE IF EXISTS validation_evidence/);
    // signoff first (references users), evidence last (referenced by change_control loose ref)
    const signoffPos = down.indexOf('DROP TABLE IF EXISTS validation_signoff');
    const controlPos = down.indexOf('DROP TABLE IF EXISTS change_control');
    const evidencePos = down.indexOf('DROP TABLE IF EXISTS validation_evidence');
    expect(signoffPos).toBeLessThan(controlPos);
    expect(controlPos).toBeLessThan(evidencePos);
  });
});

describe('SPEC-REGULA-VALIDATION-001 M0 — Zod enum rejection', async () => {
  const schemas = await import('@/lib/schemas/validation');

  it('qualificationTypeSchema accepts iq/oq/pq and rejects anything else', () => {
    for (const v of ['iq', 'oq', 'pq'] as const) {
      expect(schemas.qualificationTypeSchema.safeParse(v).success).toBe(true);
    }
    expect(schemas.qualificationTypeSchema.safeParse('sq').success).toBe(false);
    expect(schemas.qualificationTypeSchema.safeParse('').success).toBe(false);
    expect(schemas.qualificationTypeSchema.safeParse(null).success).toBe(false);
  });

  it('evidenceResultSchema accepts pass/fail/skip and rejects anything else', () => {
    for (const v of ['pass', 'fail', 'skip'] as const) {
      expect(schemas.evidenceResultSchema.safeParse(v).success).toBe(true);
    }
    expect(schemas.evidenceResultSchema.safeParse('error').success).toBe(false);
    expect(schemas.evidenceResultSchema.safeParse('passed').success).toBe(false);
  });

  it('changeAxisSchema accepts all 7 axes and rejects unknown', () => {
    for (const v of [
      'source_policy',
      'prompt',
      'model',
      'schema',
      'retrieval',
      'export',
      'review_workflow',
    ] as const) {
      expect(schemas.changeAxisSchema.safeParse(v).success).toBe(true);
    }
    expect(schemas.changeAxisSchema.safeParse('llm').success).toBe(false);
    expect(schemas.changeAxisSchema.safeParse('prompts').success).toBe(false);
  });

  it('impactLevelSchema accepts low/medium/high and rejects unknown', () => {
    for (const v of ['low', 'medium', 'high'] as const) {
      expect(schemas.impactLevelSchema.safeParse(v).success).toBe(true);
    }
    expect(schemas.impactLevelSchema.safeParse('critical').success).toBe(false);
  });

  it('REQ-VAL-006: validationEvidenceInsertSchema enforces required fields', () => {
    const valid = {
      releaseId: '2026.07-rc1',
      qualificationType: 'iq' as const,
      commitSha: 'abc1234',
      testCommand: 'pnpm ci:test',
      result: 'pass' as const,
    };
    expect(schemas.validationEvidenceInsertSchema.safeParse(valid).success).toBe(true);

    // missing commitSha — should fail
    const { commitSha: _omit, ...missingSha } = valid;
    expect(schemas.validationEvidenceInsertSchema.safeParse(missingSha).success).toBe(false);

    // invalid qualification_type — should fail
    expect(
      schemas.validationEvidenceInsertSchema.safeParse({ ...valid, qualificationType: 'sq' })
        .success,
    ).toBe(false);
  });

  it('REQ-VAL-009: changeControlInsertSchema requires non-empty residual_risk', () => {
    const valid = {
      releaseId: '2026.07-rc1',
      changeAxis: 'model' as const,
      impactLevel: 'high' as const,
      rerunRequired: true,
      residualRisk: 'No residual risk — full PQ rerun completed.',
    };
    expect(schemas.changeControlInsertSchema.safeParse(valid).success).toBe(true);

    // empty residual_risk — should fail (REQ-VAL-009 mandatory justification)
    expect(
      schemas.changeControlInsertSchema.safeParse({ ...valid, residualRisk: '' }).success,
    ).toBe(false);
  });

  it('REQ-VAL-013: validationSignoffInsertSchema enforces checklist_state shape', () => {
    const valid = {
      releaseId: '2026.07-rc1',
      checklistState: {
        items: [
          { id: 'iq-pass', title: 'IQ bundle attached', met: true },
          { id: 'oq-pass', title: 'OQ bundle attached', met: true },
          { id: 'pq-pass', title: 'PQ bundle attached', met: true },
        ],
      },
      approverId: '00000000-0000-4000-8000-000000000000',
      reportArtifactPath: 'reports/2026.07-rc1.md',
    };
    expect(schemas.validationSignoffInsertSchema.safeParse(valid).success).toBe(true);

    // empty items — should still parse (sign-off may legitimately have 0 items pending)
    expect(
      schemas.validationSignoffInsertSchema.safeParse({ ...valid, checklistState: { items: [] } })
        .success,
    ).toBe(true);

    // invalid approverId — should fail
    expect(
      schemas.validationSignoffInsertSchema.safeParse({ ...valid, approverId: 'not-a-uuid' })
        .success,
    ).toBe(false);
  });
});

describe('SPEC-REGULA-VALIDATION-001 M0 — Drizzle type inference sanity', async () => {
  const { validationEvidence, changeControl, validationSignoff } = await import('@/lib/db/schema');

  it('validationEvidence is a Drizzle table with expected column keys', () => {
    expect(validationEvidence).toBeDefined();
    // Drizzle tables expose column keys directly.
    expect(validationEvidence.releaseId).toBeDefined();
    expect(validationEvidence.qualificationType).toBeDefined();
    expect(validationEvidence.commitSha).toBeDefined();
    expect(validationEvidence.ciRunId).toBeDefined();
    expect(validationEvidence.testCommand).toBeDefined();
    expect(validationEvidence.artifactPath).toBeDefined();
    expect(validationEvidence.result).toBeDefined();
    expect(validationEvidence.evidenceMetadata).toBeDefined();
    expect(validationEvidence.collectedAt).toBeDefined();
  });

  it('changeControl is a Drizzle table with expected column keys', () => {
    expect(changeControl).toBeDefined();
    expect(changeControl.releaseId).toBeDefined();
    expect(changeControl.changeAxis).toBeDefined();
    expect(changeControl.impactLevel).toBeDefined();
    expect(changeControl.rerunRequired).toBeDefined();
    expect(changeControl.residualRisk).toBeDefined();
    expect(changeControl.exceptionNote).toBeDefined();
    expect(changeControl.evidenceRef).toBeDefined();
    expect(changeControl.assessorId).toBeDefined();
    expect(changeControl.assessedAt).toBeDefined();
  });

  it('validationSignoff is a Drizzle table with expected column keys', () => {
    expect(validationSignoff).toBeDefined();
    expect(validationSignoff.releaseId).toBeDefined();
    expect(validationSignoff.checklistState).toBeDefined();
    expect(validationSignoff.approverId).toBeDefined();
    expect(validationSignoff.signedAt).toBeDefined();
    expect(validationSignoff.reportArtifactPath).toBeDefined();
    expect(validationSignoff.auditLogRef).toBeDefined();
  });
});
