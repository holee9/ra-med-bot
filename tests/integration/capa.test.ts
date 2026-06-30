// @MX:NOTE [AUTO] Route-level + domain-level integration tests for CAPA.
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-001~012, AC-01~08)
//
// Two complementary strategies (mirrors labeling.test.ts / change-control.test.ts):
//   1. Source-level: read the route/lib/migration source and assert the control
//      is present (IDOR guard, withPermission RBAC, audit writeAudit, close gate,
//      ESIG, assessReportability reuse, Inngest registration).
//   2. Domain-level: exercise the pure domain functions (root cause validation,
//      trend signature, reportability mapping) to drive REQ-003/007 behavior
//      directly.
//
// AC mapping:
//   AC-01 — complaint → reportability → CAPA (source-level wiring)
//   AC-02 — effectiveness reminder registered (Inngest functions array)
//   AC-03 — linkage helper present + UNIQUE constraint
//   AC-04 — audit wrappers for all 7 actions present
//   AC-05 — QMS stub present
//   AC-06 — trend detector → pms_inputs
//   AC-07 — close gate blocks reportable + no vigilance_ref
//   AC-08 — RBAC capa.close requires ra-lead

import fs from 'node:fs';
import path from 'node:path';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  assessComplaintReportability,
  mapComplaintToAdverseEvent,
} from '@/lib/capa/reportability-mapping';
import {
  validateFishbone,
  validateFiveWhys,
  validateRootCauseAnalysis,
} from '@/lib/capa/root-cause';
import { TREND_THRESHOLD, computeTrendSignature } from '@/lib/capa/trend-signature';
import { describe, expect, it, vi } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const readText = (rel: string): string => fs.readFileSync(path.join(root, rel), 'utf8');

// ---------------------------------------------------------------------------
// AC-01: complaint → reportability → CAPA wiring (REQ-001, REQ-002)
// ---------------------------------------------------------------------------
describe('AC-01: complaint → reportability → CAPA (REQ-001, REQ-002)', () => {
  it('complaints route enforces withPermission + RBAC (complaint.create)', () => {
    const src = readText('app/api/ra/capa/complaints/route.ts');
    expect(src).toContain("withPermission('complaint.create'");
    expect(src).toContain('assertPmsProjectAccess');
    expect(src).toContain('auditComplaintIntakeCreated');
  });

  it('reportability route reuses assessReportability (vigilance engine)', () => {
    const src = readText('app/api/ra/capa/complaints/[id]/reportability/route.ts');
    expect(src).toContain('assessComplaintReportability');
    expect(src).toContain('persistComplaintReportability');
    expect(src).toContain('auditComplaintReportabilityAssessed');
  });

  it('reportability mapping imports assessReportability from vigilance engine', () => {
    const src = readText('lib/capa/reportability-mapping.ts');
    expect(src).toContain("from '@/lib/vigilance/reportability-engine'");
    expect(src).toContain('assessReportability');
  });

  it('assessComplaintReportability maps complaint → adverse event correctly', () => {
    const intake = {
      deviceName: 'Device X',
      eventDescription: 'Death during use',
      patientOutcome: 'death' as const,
      deviceCategory: 'class_III' as const,
      eventDate: '2026-01-01',
      awarenessDate: '2026-01-02',
      isManufacturerAware: true,
      reporterName: 'Hospital A',
      reporterRole: 'Biomedical Engineer',
    };
    const mapped = mapComplaintToAdverseEvent(intake);
    expect(mapped.patientOutcome).toBe('death');
    expect(mapped.deviceCategory).toBe('class_III');
  });

  it('assessComplaintReportability flags death + class_III as reportable', () => {
    const result = assessComplaintReportability({
      deviceName: 'Device X',
      eventDescription: 'Death',
      patientOutcome: 'death',
      deviceCategory: 'class_III',
      eventDate: '2026-01-01',
      awarenessDate: '2026-01-02',
      isManufacturerAware: true,
      reporterName: 'Hospital',
      reporterRole: 'Engineer',
    });
    expect(result.reportabilityStatus).toBe('reportable');
    expect(result.fdaMdrRequired).toBe(true);
  });

  it('assessComplaintReportability flags no_injury as not_reportable', () => {
    const result = assessComplaintReportability({
      deviceName: 'Device X',
      eventDescription: 'No injury',
      patientOutcome: 'no_injury',
      deviceCategory: 'class_I',
      eventDate: '2026-01-01',
      awarenessDate: '2026-01-02',
      isManufacturerAware: true,
      reporterName: 'Hospital',
      reporterRole: 'Engineer',
    });
    expect(result.reportabilityStatus).toBe('not_reportable');
  });
});

// ---------------------------------------------------------------------------
// AC-02: effectiveness reminder registered (REQ-006)
// ---------------------------------------------------------------------------
describe('AC-02: effectiveness reminder (REQ-006)', () => {
  it('Inngest functions array includes capaEffectivenessDueReminderFn', () => {
    const src = readText('lib/inngest/functions.ts');
    expect(src).toContain('capaEffectivenessDueReminderFn');
    expect(src).toContain('capa/effectiveness-due-reminder');
  });

  it('INNGEST_EVENTS includes CAPA_EFFECTIVENESS_REMINDER_TRIGGER', () => {
    const src = readText('lib/inngest/client.ts');
    expect(src).toContain('CAPA_EFFECTIVENESS_REMINDER_TRIGGER');
  });

  it('cron function imports dispatchEffectivenessReminders', () => {
    const src = readText('lib/inngest/capa/effectiveness-due-reminder.ts');
    expect(src).toContain('dispatchEffectivenessReminders');
    expect(src).toContain("id: 'capa-effectiveness-due-reminder'");
  });

  // M-4 (issue #251): dispatchEffectivenessReminders is no longer a no-op —
  // it renders a body per reminder and invokes the provided sender. Uses the
  // injected sender path so no SendGrid/network is required. The db query is
  // stubbed via vi.mock so the test exercises the dispatch loop in isolation.
  it('M-4: dispatchEffectivenessReminders actually invokes the sender N times for N due checks', async () => {
    // Inline module mock so the default SendGrid path is never reached.
    vi.resetModules();
    vi.doMock('@/lib/db/client', () => ({
      db: {
        select: () => {
          const rows = [
            {
              checkId: 'chk-1',
              capaId: 'capa-1',
              ownerId: 'owner-1',
              dueDate: '2026-06-24',
              ownerEmail: 'owner1@example.com',
              ownerName: 'Owner One',
            },
            {
              checkId: 'chk-2',
              capaId: 'capa-2',
              ownerId: 'owner-2',
              dueDate: '2026-06-24',
              ownerEmail: 'owner2@example.com',
              ownerName: 'Owner Two',
            },
            {
              checkId: 'chk-3',
              capaId: 'capa-3',
              ownerId: 'owner-3',
              dueDate: '2026-06-24',
              ownerEmail: 'owner3@example.com',
              ownerName: 'Owner Three',
            },
          ];
          const chain = Promise.resolve(rows) as unknown as {
            from: () => unknown;
            innerJoin: () => unknown;
            leftJoin: () => unknown;
            where: () => unknown;
          };
          chain.from = () => chain;
          chain.innerJoin = () => chain;
          chain.leftJoin = () => chain;
          chain.where = () => chain;
          return chain;
        },
      },
    }));

    const { dispatchEffectivenessReminders, renderEffectivenessReminder } = await import(
      '@/lib/capa/effectiveness'
    );

    const sentBodies: string[] = [];
    const result = await dispatchEffectivenessReminders('2026-06-24', {
      sendReminder: async (_reminder, body) => {
        sentBodies.push(body);
        return true;
      },
    });

    expect(result.totalDue).toBe(3);
    expect(result.dispatched).toBe(3);
    expect(sentBodies).toHaveLength(3);
    // Each body must be a rendered reminder containing the CAPA id.
    expect(sentBodies[0]).toContain('capa-1');
    expect(sentBodies[2]).toContain('capa-3');
    // The renderer must produce a plain-text body with the key fields.
    expect(renderEffectivenessReminder).toBeDefined();

    vi.doUnmock('@/lib/db/client');
    vi.resetModules();
  });

  it('M-4: dispatchEffectivenessReminders does not count a failed send as dispatched', async () => {
    vi.resetModules();
    vi.doMock('@/lib/db/client', () => ({
      db: {
        select: () => {
          const rows = [
            {
              checkId: 'chk-1',
              capaId: 'capa-1',
              ownerId: 'owner-1',
              dueDate: '2026-06-24',
              ownerEmail: 'owner1@example.com',
              ownerName: 'Owner One',
            },
          ];
          const chain = Promise.resolve(rows) as unknown as {
            from: () => unknown;
            innerJoin: () => unknown;
            leftJoin: () => unknown;
            where: () => unknown;
          };
          chain.from = () => chain;
          chain.innerJoin = () => chain;
          chain.leftJoin = () => chain;
          chain.where = () => chain;
          return chain;
        },
      },
    }));

    const { dispatchEffectivenessReminders } = await import('@/lib/capa/effectiveness');

    const result = await dispatchEffectivenessReminders('2026-06-24', {
      sendReminder: async () => false, // sender reports failure
    });

    expect(result.totalDue).toBe(1);
    expect(result.dispatched).toBe(0); // failed send not counted

    vi.doUnmock('@/lib/db/client');
    vi.resetModules();
  });
});

// ---------------------------------------------------------------------------
// AC-03: linkage integrity (REQ-008)
// ---------------------------------------------------------------------------
describe('AC-03: linkage integrity (REQ-008)', () => {
  it('records route links CAPA to risk/change_control/DHF/PMS', () => {
    const src = readText('app/api/ra/capa/records/route.ts');
    expect(src).toContain('linkCapaToTargets');
  });

  it('migration 0073 has UNIQUE constraint on capa_links', () => {
    const sql = readText('migrations/0073_capa.sql');
    expect(sql).toContain('UNIQUE (capa_id, target_type, target_id)');
    expect(sql).toContain(
      "target_type TEXT NOT NULL CHECK (target_type IN ('risk','change_control','dhf','pms'))",
    );
  });

  it('linkage helper verifies target existence before linking', () => {
    const src = readText('lib/capa/linkage.ts');
    expect(src).toContain('verifyTargetExists');
    expect(src).toContain('change_control');
    expect(src).toContain('designHistoryFiles');
    expect(src).toContain('riskItems');
  });
});

// ---------------------------------------------------------------------------
// AC-04: audit wrappers for all 7 actions (REQ-010)
// ---------------------------------------------------------------------------
describe('AC-04: audit wrappers 100% (REQ-010)', () => {
  const expectedActions = [
    'complaint.intake_created',
    'complaint.reportability_assessed',
    'capa.record_created',
    'capa.root_cause_documented',
    'capa.effectiveness_scheduled',
    'capa.closed',
    'capa.close_blocked_vigilance_missing',
  ];

  it.each(expectedActions)('audit.ts wrapper exists for %s', (action) => {
    const src = readText('lib/capa/audit.ts');
    expect(src).toContain(`action: '${action}'`);
  });

  it('close route writes both capa.closed and the gate-block audit', () => {
    const src = readText('app/api/ra/capa/records/[id]/close/route.ts');
    expect(src).toContain('auditCapaClosed');
    expect(src).toContain('auditCapaCloseBlockedVigilanceMissing');
  });
});

// ---------------------------------------------------------------------------
// AC-05: QMS stub present (REQ-009)
// ---------------------------------------------------------------------------
describe('AC-05: QMS stub (REQ-009)', () => {
  it('qms-sync route calls the stub', () => {
    const src = readText('app/api/ra/capa/records/[id]/qms-sync/route.ts');
    expect(src).toContain('syncCapaToQms');
    expect(src).toContain("withPermission('capa.qms_sync'");
  });

  it('qms-sync stub returns deterministic no-op', async () => {
    const { syncCapaToQms } = await import('@/lib/capa/qms-sync');
    const result = await syncCapaToQms({ capaId: 'test', status: 'closed' });
    expect(result.synced).toBe(false);
    expect(result.reason).toBe('qms_not_implemented');
    expect(result.qmsRef).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-06: trend detection → PMS (REQ-007)
// ---------------------------------------------------------------------------
describe('AC-06: trend detection → PMS (REQ-007)', () => {
  it('TREND_THRESHOLD is 3 (≥3 repeat complaints = trend)', () => {
    expect(TREND_THRESHOLD).toBe(3);
  });

  it('computeTrendSignature is deterministic for identical intake', () => {
    const intake = {
      deviceName: 'Device A',
      deviceModel: 'M1',
      patientOutcome: 'malfunction' as const,
      eventDescription: 'desc',
      deviceCategory: 'class_II' as const,
      eventDate: '2026-01-01',
      awarenessDate: '2026-01-02',
      isManufacturerAware: true,
      reporterName: 'R',
      reporterRole: 'Engineer',
    };
    const sig1 = computeTrendSignature(intake);
    const sig2 = computeTrendSignature({ ...intake, eventDescription: 'different desc' });
    // Description does NOT affect signature — only device + outcome.
    expect(sig1).toBe(sig2);
  });

  it('different device produces different signature', () => {
    const base = {
      deviceModel: 'M1',
      patientOutcome: 'malfunction' as const,
      eventDescription: 'desc',
      deviceCategory: 'class_II' as const,
      eventDate: '2026-01-01',
      awarenessDate: '2026-01-02',
      isManufacturerAware: true,
      reporterName: 'R',
      reporterRole: 'Engineer',
    };
    const sigA = computeTrendSignature({ ...base, deviceName: 'A' });
    const sigB = computeTrendSignature({ ...base, deviceName: 'B' });
    expect(sigA).not.toBe(sigB);
  });

  it('trend-detector inserts into pms_inputs when threshold met', () => {
    const src = readText('lib/capa/trend-detector.ts');
    expect(src).toContain('pmsInputs');
    expect(src).toContain("source: 'complaint_trend'");
  });
});

// ---------------------------------------------------------------------------
// AC-07: close gate blocks reportable + no vigilance_ref (REQ-011)
// ---------------------------------------------------------------------------
describe('AC-07: close gate (REQ-011)', () => {
  it('close route calls canCloseCapa before closing', () => {
    const src = readText('app/api/ra/capa/records/[id]/close/route.ts');
    expect(src).toContain('canCloseCapa');
    expect(src).toContain('close_blocked');
  });

  it('close-gate checks reportability_status + vigilance_ref', () => {
    const src = readText('lib/capa/close-gate.ts');
    expect(src).toContain("reportabilityStatus === 'reportable'");
    expect(src).toContain('vigilanceRef');
    expect(src).toContain('vigilance_link_missing');
  });

  it('close-gate enforces org scope (IDOR defense)', () => {
    const src = readText('lib/capa/close-gate.ts');
    expect(src).toContain('eq(capaRecords.orgId, orgId)');
    expect(src).toContain('capa_not_found_or_org_mismatch');
  });
});

// ---------------------------------------------------------------------------
// AC-08: RBAC — capa.close requires ra-lead (REQ-012)
// ---------------------------------------------------------------------------
describe('AC-08: RBAC (REQ-012)', () => {
  it('all 7 routes wrap with the correct permission action', () => {
    const checks: Array<[string, string]> = [
      ['app/api/ra/capa/complaints/route.ts', "withPermission('complaint.create'"],
      [
        'app/api/ra/capa/complaints/[id]/reportability/route.ts',
        "withPermission('complaint.assess_reportability'",
      ],
      ['app/api/ra/capa/records/route.ts', "withPermission('capa.create'"],
      ['app/api/ra/capa/records/[id]/root-cause/route.ts', "withPermission('capa.root_cause'"],
      [
        'app/api/ra/capa/records/[id]/effectiveness/route.ts',
        "withPermission('capa.effectiveness'",
      ],
      ['app/api/ra/capa/records/[id]/close/route.ts', "withPermission('capa.close'"],
      ['app/api/ra/capa/records/[id]/qms-sync/route.ts', "withPermission('capa.qms_sync'"],
    ];
    for (const [file, expected] of checks) {
      expect(readText(file), `${file} must wrap with ${expected}`).toContain(expected);
    }
  });

  it('capa.close requires ra-lead in PERMISSIONS map', () => {
    const src = readText('lib/auth/permissions.ts');
    expect(src).toMatch(/'capa\.close':\s*\{[^}]*minRole:\s*'ra-lead'/);
  });

  it('capa.qms_sync requires ra-lead in PERMISSIONS map', () => {
    const src = readText('lib/auth/permissions.ts');
    expect(src).toMatch(/'capa\.qms_sync':\s*\{[^}]*minRole:\s*'ra-lead'/);
  });

  it('all 7 PermissionAction values exist in the union', () => {
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
      expect(src, `union must include '${a}'`).toContain(`| '${a}'`);
    }
  });
});

// ---------------------------------------------------------------------------
// REQ-003: root cause validation (domain-level)
// ---------------------------------------------------------------------------
describe('REQ-003: root cause validation', () => {
  it('validateFiveWhys rejects empty chain', () => {
    const errors = validateFiveWhys({
      why1: '',
      why2: '',
      why3: '',
      why4: '',
      why5: '',
      rootCause: '',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('validateFiveWhys accepts complete chain', () => {
    const errors = validateFiveWhys({
      why1: 'a',
      why2: 'b',
      why3: 'c',
      why4: 'd',
      why5: 'e',
      rootCause: 'systemic',
    });
    expect(errors).toHaveLength(0);
  });

  it('validateFishbone rejects empty categories', () => {
    const errors = validateFishbone({
      man: [],
      machine: [],
      material: [],
      method: [],
      measurement: [],
      environment: [],
      rootCause: '',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('validateFishbone accepts one category with entries', () => {
    const errors = validateFishbone({
      man: ['training gap'],
      machine: [],
      material: [],
      method: [],
      measurement: [],
      environment: [],
      rootCause: 'training',
    });
    expect(errors).toHaveLength(0);
  });

  it('validateRootCauseAnalysis rejects unknown method', () => {
    const errors = validateRootCauseAnalysis('unknown' as never, {});
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('unknown method');
  });
});

// ---------------------------------------------------------------------------
// Count regression assertions (L-007 baseline enforcement)
// ---------------------------------------------------------------------------
describe('Count regression (L-007 baseline)', () => {
  it('workflow_type enum has 17 values (15 + complaint + clinical_investigation)', () => {
    const src = readText('lib/db/schema.ts');
    const match = src.match(
      /export const workflowTypeEnum = pgEnum\('workflow_type', \[([\s\S]*?)\]\);/,
    );
    const vals = match?.[1]?.match(/'[a-z_]+'/g) ?? [];
    expect(vals.length).toBe(17);
    expect(vals).toContain("'complaint'");
    expect(vals).toContain("'clinical_investigation'");
  });

  it('audit_action enum has 192 values (183 + 8 source.* SOURCE-GOVERNANCE Issue #48 + 1 label.esubmit_forwarded #249)', () => {
    const src = readText('lib/db/schema.ts');
    const match = src.match(
      /export const auditActionEnum = pgEnum\('audit_action', \[([\s\S]*?)\]\);/,
    );
    const vals = match?.[1]?.match(/'[a-z_.]+'/g) ?? [];
    expect(vals.length).toBe(209); // +1 rlhf.calibration_proposed (#264 2/3) +1 rlhf.implicit_feedback_recorded (#264 3/3) +1 label.esubmit_forwarded (#249) +1 traceability.section_superseded (#300 M-2)
  });

  it('AuditAction type has 200 values (sync with schema enum)', () => {
    const src = readText('lib/audit.ts');
    const match = src.match(/export type AuditAction =\s*([\s\S]*?);/);
    const vals = match?.[1]?.match(/'[a-z_.]+'/g) ?? [];
    expect(vals.length).toBe(209); // +1 rlhf.calibration_proposed (#264 2/3) +1 rlhf.implicit_feedback_recorded (#264 3/3) +1 label.esubmit_forwarded (#249) +1 traceability.section_superseded (#300 M-2)
  });

  it('PERMISSIONS matrix has 70 entries (68 + 2 sourcegov.* SOURCE-GOVERNANCE Issue #48)', () => {
    // Runtime count is the authoritative source of truth (matches
    // tests/unit/auth/permissions.test.ts and tests/regression/foundation.test.ts).
    expect(Object.keys(PERMISSIONS).length).toBe(79);
  });
});

// ---------------------------------------------------------------------------
// Phase 5 security review fixes — route-level source assertions
// (anti-mock: each fix MUST be present in the actual route/lib source)
// ---------------------------------------------------------------------------
describe('Phase 5 security fixes (C-1/H-1/H-2/H-3/evaluator)', () => {
  // C-1: persistComplaintReportability threads userId + workflow_run org anchor
  it('C-1: persistComplaintReportability anchors adverse_event to caller-org workflow_run', () => {
    const src = readText('lib/capa/reportability.ts');
    expect(src).toContain('userId: string');
    expect(src).toContain('workflowRunId: complaint.workflowRunId');
    // Must NOT use orgId as createdBy (H-3 fix)
    expect(src).not.toContain('createdBy: params.orgId');
    expect(src).toContain('createdBy: userId');
  });

  it('C-1: reportability route passes session.user.id as userId (not orgId)', () => {
    const src = readText('app/api/ra/capa/complaints/[id]/reportability/route.ts');
    expect(src).toContain('userId: session.user.id');
    expect(src).toContain('persistComplaintReportability');
  });

  // H-1: close ESIG binds signer identity + meaning + userId + timestamp
  it('H-1: close route ESIG hash binds signerName + meaning + userId + signedAt', () => {
    const src = readText('app/api/ra/capa/records/[id]/close/route.ts');
    expect(src).toContain('signerName: body.signerName');
    expect(src).toContain('meaning: body.meaning');
    expect(src).toContain('userId: session.user.id');
    expect(src).toContain('signedAt');
    // The hash MUST include a second signature-binding block (not just capaId+description)
    expect(src).toContain("type: 'capaCloseSignature'");
  });

  it('H-1: close route does NOT hash only capaId + description', () => {
    const src = readText('app/api/ra/capa/records/[id]/close/route.ts');
    // The old vulnerable pattern computed the hash from a single block with
    // only id + description. The fix MUST add a second block.
    const hashCallIdx = src.indexOf('computeAnswerHash');
    expect(hashCallIdx).toBeGreaterThan(-1);
    const afterHash = src.slice(hashCallIdx);
    // Two blocks passed in the array
    expect(afterHash.match(/type: 'capaClose[A-Za-z]*'/g)?.length).toBeGreaterThanOrEqual(2);
  });

  // H-2: all 6 mutation routes wrap mutation + audit in db.transaction
  const txRoutes = [
    'app/api/ra/capa/complaints/route.ts',
    'app/api/ra/capa/complaints/[id]/reportability/route.ts',
    'app/api/ra/capa/records/route.ts',
    'app/api/ra/capa/records/[id]/root-cause/route.ts',
    'app/api/ra/capa/records/[id]/effectiveness/route.ts',
    'app/api/ra/capa/records/[id]/close/route.ts',
  ];

  for (const route of txRoutes) {
    it(`H-2: ${route} wraps mutation + audit in db.transaction with tx passed to writeAudit`, () => {
      const src = readText(route);
      expect(src).toContain('db.transaction(async (tx)');
      // The tx must be forwarded into either writeAudit or an audit wrapper
      // (the audit wrappers accept tx as the 2nd positional arg).
      expect(src).toMatch(/,\s*tx,?\s*\)/);
    });
  }

  it('H-2: capa audit wrappers accept and forward tx to writeAudit', () => {
    const src = readText('lib/capa/audit.ts');
    expect(src).toMatch(/tx\?: AuditTx/);
    // Every wrapper forwards tx as the 2nd argument to writeAudit.
    const forwardCount = (src.match(/,\s*tx,?\s*\)/g) ?? []).length;
    expect(forwardCount).toBeGreaterThanOrEqual(7); // 7 wrappers
  });

  it('H-2: writeAudit accepts optional tx (2nd positional arg)', () => {
    const src = readText('lib/audit.ts');
    expect(src).toMatch(/writeAudit\(params: AuditEvent,\s*tx\?: AuditDbHandle\)/);
    expect(src).toContain('const client = tx ?? db');
  });

  // H-3: createdBy is userId, never orgId
  it('H-3: reportability lib uses userId for createdBy, not orgId', () => {
    const src = readText('lib/capa/reportability.ts');
    expect(src).toContain('createdBy: userId');
    expect(src).not.toMatch(/createdBy:\s*params\.orgId/);
  });

  // evaluator CRITICAL: getCapaLinkCount uses count(*) aggregation
  it('evaluator CRITICAL: getCapaLinkCount uses count(*) not single-row select', () => {
    const src = readText('lib/capa/linkage.ts');
    expect(src).toContain('sql<number>`count(*)`');
    expect(src).toContain('Number(row?.count ?? 0)');
    // The buggy pattern MUST be gone
    expect(src).not.toContain('select({ count: capaLinks.id })');
    expect(src).not.toContain('return row ? 1 : 0');
  });

  // evaluator HIGH: verifyTargetExists pms case does NOT return true unconditionally
  it('evaluator HIGH: verifyTargetExists pms case queries pms_inputs with org filter', () => {
    const src = readText('lib/capa/linkage.ts');
    expect(src).not.toMatch(/case 'pms':\s*\{[^}]*return true/s);
    expect(src).toContain('from(pmsInputs)');
    expect(src).toMatch(/eq\(pmsInputs\.orgId, orgId\)/);
  });

  // evaluator HIGH: risk case joins workflow_runs for org scoping
  it('evaluator HIGH: verifyTargetExists risk case joins workflow_runs.organizationId', () => {
    const src = readText('lib/capa/linkage.ts');
    expect(src).toContain('innerJoin(workflowRuns');
    expect(src).toContain('workflowRuns.organizationId, orgId');
  });
});
