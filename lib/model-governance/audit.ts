// @MX:NOTE [AUTO] audit.ts — modelgov audit wrappers (PII-free meta).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-007/012/014)
// @MX:REASON Thin wrappers around writeAudit that enforce the PII-free meta
//           convention (version ids, hashes, approver id — never prompt content).
//           Mirrors lib/clinical-investigation/audit.ts.

import { type AuditDbHandle, writeAudit } from '@/lib/kernel/audit';

interface ModelGovAuditParams {
  actorId: string | null;
  orgId: string;
  resourceId: string;
  tx?: AuditDbHandle;
}

/** REQ-MODELGOV-001 — immutable prompt/template version registered. */
export function auditPromptRegistered(
  p: ModelGovAuditParams & { promptId: string; kind: string; version: number; contentHash: string },
): Promise<void> {
  return writeAudit(
    {
      actor_id: p.actorId,
      action: 'modelgov.prompt_registered',
      resource_type: 'prompt_registry',
      resource_id: p.promptId,
      meta_json: { org_id: p.orgId, kind: p.kind, version: p.version, content_hash: p.contentHash },
    },
    p.tx,
  );
}

/** REQ-MODELGOV-004 — change request submitted + eval triggered. */
export function auditChangeRequested(
  p: ModelGovAuditParams & {
    changeRequestId: string;
    promptId: string | null;
    modelPinId: string | null;
  },
): Promise<void> {
  return writeAudit(
    {
      actor_id: p.actorId,
      action: 'modelgov.change_requested',
      resource_type: 'change_request',
      resource_id: p.changeRequestId,
      meta_json: { org_id: p.orgId, prompt_id: p.promptId, model_pin_id: p.modelPinId },
    },
    p.tx,
  );
}

/** REQ-MODELGOV-012 — combination approved (records approver + eval link). */
export function auditApproved(
  p: ModelGovAuditParams & {
    changeRequestId: string;
    approverId: string;
    combinationId: string;
    evalResultRef: string | null;
  },
): Promise<void> {
  return writeAudit(
    {
      actor_id: p.actorId,
      action: 'modelgov.approved',
      resource_type: 'approved_combination',
      resource_id: p.combinationId,
      meta_json: {
        org_id: p.orgId,
        change_request_id: p.changeRequestId,
        approver_id: p.approverId,
        eval_result_ref: p.evalResultRef,
      },
    },
    p.tx,
  );
}

/** REQ-MODELGOV-014 — combination rejected. */
export function auditRejected(
  p: ModelGovAuditParams & { changeRequestId: string; approverId: string; reason: string },
): Promise<void> {
  return writeAudit(
    {
      actor_id: p.actorId,
      action: 'modelgov.rejected',
      resource_type: 'change_request',
      resource_id: p.changeRequestId,
      meta_json: { org_id: p.orgId, approver_id: p.approverId, reason: p.reason },
    },
    p.tx,
  );
}

/** REQ-MODELGOV-006 — active combination reverted. */
export function auditRolledBack(
  p: ModelGovAuditParams & { fromCombinationId: string; toCombinationId: string },
): Promise<void> {
  return writeAudit(
    {
      actor_id: p.actorId,
      action: 'modelgov.rolled_back',
      resource_type: 'approved_combination',
      resource_id: p.toCombinationId,
      meta_json: {
        org_id: p.orgId,
        from_combination_id: p.fromCombinationId,
        to_combination_id: p.toCombinationId,
      },
    },
    p.tx,
  );
}

/** REQ-MODELGOV-008 — unapproved combination blocked at runtime. */
export function auditRuntimeBlocked(
  p: ModelGovAuditParams & { reason: string; promptId?: string; modelPinId?: string },
): Promise<void> {
  return writeAudit(
    {
      actor_id: p.actorId,
      action: 'modelgov.runtime_blocked',
      resource_type: 'approved_combination',
      resource_id: p.resourceId,
      meta_json: {
        org_id: p.orgId,
        reason: p.reason,
        prompt_id: p.promptId ?? null,
        model_pin_id: p.modelPinId ?? null,
      },
    },
    p.tx,
  );
}

/** REQ-MODELGOV-010/011 — eval result recorded (passed or failed). */
export function auditEvalResult(
  p: ModelGovAuditParams & {
    changeRequestId: string;
    passed: boolean;
    score: number;
    threshold: number;
    evalRunId: string | null;
  },
): Promise<void> {
  return writeAudit(
    {
      actor_id: p.actorId,
      action: p.passed ? 'modelgov.eval_passed' : 'modelgov.eval_failed',
      resource_type: 'change_request',
      resource_id: p.changeRequestId,
      meta_json: {
        org_id: p.orgId,
        passed: p.passed,
        score: p.score,
        threshold: p.threshold,
        eval_run_id: p.evalRunId,
      },
    },
    p.tx,
  );
}
