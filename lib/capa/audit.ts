// @MX:NOTE [AUTO] CAPA-specific audit helpers wrapping the central writeAudit().
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-010)
//
// 21 CFR Part 11: every regulated CAPA/complaint action is recorded through the
// central append-only audit pipeline. meta_json is PII-free — only IDs,
// booleans, and status labels are stored. Mirrors lib/vigilance/audit.ts.
//
// H2 fix (Part 11 atomicity): every wrapper accepts an optional `tx` handle so
// the audit insert rides the same transaction boundary as the mutation it
// records. Callers MUST wrap mutation + audit in `db.transaction(async (tx) => {
// ... })` and pass `tx` here so a mid-write failure rolls back both. Omitting
// `tx` uses the singleton `db` (autocommit) — the historical path — but the
// route-level integration tests assert the transaction wrapper is present.

import { writeAudit } from '../audit';

/** Minimal transaction-handle type compatible with both the db singleton and a tx-scoped clone. */
type AuditTx = Parameters<typeof writeAudit>[1];

/** REQ-001: a new structured complaint was created. */
export async function auditComplaintIntakeCreated(
  params: {
    userId: string;
    complaintId: string;
    projectId: string;
    deviceName: string;
  },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'complaint.intake_created',
      resource_type: 'complaint',
      resource_id: params.complaintId,
      meta_json: { projectId: params.projectId, deviceName: params.deviceName },
    },
    tx,
  );
}

/** REQ-002: reportability was assessed for a complaint. */
export async function auditComplaintReportabilityAssessed(
  params: {
    userId: string;
    complaintId: string;
    reportable: boolean;
    vigilanceLinked: boolean;
  },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'complaint.reportability_assessed',
      resource_type: 'complaint',
      resource_id: params.complaintId,
      meta_json: {
        reportable: params.reportable,
        vigilanceLinked: params.vigilanceLinked,
      },
    },
    tx,
  );
}

/** REQ-004/005: a new CAPA record was created. */
export async function auditCapaRecordCreated(
  params: {
    userId: string;
    capaId: string;
    complaintId: string;
    type: 'corrective' | 'preventive';
  },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'capa.record_created',
      resource_type: 'capaRecord',
      resource_id: params.capaId,
      meta_json: { complaintId: params.complaintId, type: params.type },
    },
    tx,
  );
}

/** REQ-003: root cause analysis was documented. */
export async function auditCapaRootCauseDocumented(
  params: {
    userId: string;
    capaId: string;
    method: '5whys' | 'fishbone';
  },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'capa.root_cause_documented',
      resource_type: 'capaRootCause',
      resource_id: params.capaId,
      meta_json: { method: params.method },
    },
    tx,
  );
}

/** REQ-006: an effectiveness check was scheduled. */
export async function auditCapaEffectivenessScheduled(
  params: { userId: string; capaId: string; dueDate: string },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'capa.effectiveness_scheduled',
      resource_type: 'capaEffectivenessCheck',
      resource_id: params.capaId,
      meta_json: { dueDate: params.dueDate },
    },
    tx,
  );
}

/** REQ-010: a CAPA was closed with ESIG. */
export async function auditCapaClosed(
  params: { userId: string; capaId: string; signatureHash: string },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'capa.closed',
      resource_type: 'capaRecord',
      resource_id: params.capaId,
      meta_json: { signatureHashPrefix: params.signatureHash.slice(0, 8) },
    },
    tx,
  );
}

/** REQ-011: CAPA close was blocked — reportable complaint lacks vigilance link. */
export async function auditCapaCloseBlockedVigilanceMissing(
  params: { userId: string; capaId: string; complaintId: string },
  tx?: AuditTx,
): Promise<void> {
  await writeAudit(
    {
      actor_id: params.userId,
      action: 'capa.close_blocked_vigilance_missing',
      resource_type: 'capaRecord',
      resource_id: params.capaId,
      meta_json: { complaintId: params.complaintId },
    },
    tx,
  );
}
