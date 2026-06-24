// @MX:NOTE [AUTO] change-workflow.ts — change_request lifecycle (REQ-MODELGOV-004/005).
// @MX:ANCHOR [AUTO] createChangeRequest + approveChange — the eval->approval->rollout pipeline.
// @MX:REASON REQ-MODELGOV-004/005/012/013/014 — the workflow enforces: eval must pass
//           before approval (REQ-005), approval requires ra-lead RBAC (REQ-014, enforced
//           at the route), approval activates the combination single-active (REQ-013),
//           and records approver/ts/eval-link in audit (REQ-012). fan_in >= 3 expected
//           (approve route, rollback, test fixtures).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-004/005/012/013/014)

import { type AuditDbHandle, writeAudit } from '@/lib/audit';
import { db } from '@/lib/db/client';
import { approvedCombination, changeRequest } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { auditApproved, auditChangeRequested, auditEvalResult } from './audit';
import { checkEvalThreshold } from './eval-gate';
import type { EvalGateResult } from './types';

/**
 * REQ-MODELGOV-004: create a change request + trigger (record) the eval run.
 *
 * The actual eval execution stays in CI (eval:ci). This function records the
 * eval result ref + status. When `evalResultJson` is supplied, the threshold is
 * checked immediately and eval_status set; otherwise it stays 'pending' until
 * the approve route supplies the eval result.
 */
export async function createChangeRequest(params: {
  orgId: string;
  promptId: string;
  modelPinId: string;
  evalRunId?: string;
  evalResultJson?: unknown;
  evalResultRef?: string;
  createdBy: string | null;
}): Promise<{ changeRequestId: string; evalStatus: 'pending' | 'passed' | 'failed' }> {
  let evalStatus: 'pending' | 'passed' | 'failed' = 'pending';
  let gate: EvalGateResult | null = null;

  if (params.evalResultJson !== undefined) {
    gate = checkEvalThreshold(params.evalResultJson, {
      evalRunId: params.evalRunId ?? null,
      evalResultRef: params.evalResultRef ?? null,
    });
    evalStatus = gate.passed ? 'passed' : 'failed';
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(changeRequest)
      .values({
        orgId: params.orgId,
        promptId: params.promptId,
        modelPinId: params.modelPinId,
        evalRunId: params.evalRunId ?? null,
        evalStatus,
        evalResultRef: params.evalResultRef ?? null,
        approvalStatus: 'pending_review',
        createdBy: params.createdBy,
      })
      .returning({ id: changeRequest.id, evalStatus: changeRequest.evalStatus });

    if (!row) throw new Error('change_request insert returned no rows');

    await auditChangeRequested({
      actorId: params.createdBy,
      orgId: params.orgId,
      resourceId: row.id,
      changeRequestId: row.id,
      promptId: params.promptId,
      modelPinId: params.modelPinId,
      tx,
    });

    if (gate) {
      await auditEvalResult({
        actorId: params.createdBy,
        orgId: params.orgId,
        resourceId: row.id,
        changeRequestId: row.id,
        passed: gate.passed,
        score: gate.score,
        threshold: gate.threshold,
        evalRunId: gate.evalRunId,
        tx,
      });
    }

    return { changeRequestId: row.id, evalStatus: row.evalStatus };
  });
}

/**
 * REQ-MODELGOV-005/012/013/014: approve a change request.
 *
 * Gates:
 *   1. eval_status MUST be 'passed' (REQ-005). Throws ChangeRequestBlockedError otherwise.
 *   2. approvalStatus MUST be 'pending_review' (idempotent re-approval blocked).
 *
 * On success:
 *   - supersedes the current active combination (sets active=false + superseded_by)
 *   - inserts + activates the new approved_combination
 *   - records approver_id + approved_at + eval_result_ref on the change_request
 *   - writes modelgov.approved audit (with approver + eval link) in the same tx (H2)
 *
 * RBAC (REQ-014) is enforced at the route via withPermission('modelgov.approve').
 */
export class ChangeRequestBlockedError extends Error {
  constructor(public reason: string) {
    super(`change request blocked: ${reason}`);
    this.name = 'ChangeRequestBlockedError';
  }
}

export async function approveChangeRequest(params: {
  changeRequestId: string;
  orgId: string;
  approverId: string;
  evalResultRef?: string;
}): Promise<{ combinationId: string }> {
  const [row] = await db
    .select({
      id: changeRequest.id,
      promptId: changeRequest.promptId,
      modelPinId: changeRequest.modelPinId,
      evalStatus: changeRequest.evalStatus,
      approvalStatus: changeRequest.approvalStatus,
      evalResultRef: changeRequest.evalResultRef,
    })
    .from(changeRequest)
    .where(and(eq(changeRequest.id, params.changeRequestId), eq(changeRequest.orgId, params.orgId)))
    .limit(1);

  if (!row) {
    throw new ChangeRequestBlockedError('change_request_not_found_or_org_mismatch');
  }

  // REQ-005: eval must have passed before approval.
  if (row.evalStatus !== 'passed') {
    // M3 fix (21 CFR Part 11 §11.10(e)): write the rejection audit in a
    // COMMITTING transaction BEFORE the throw. The prior code wrote the audit
    // inside the same tx that then threw — the throw rolled the tx back,
    // losing the denial record. Mirrors the capa #251 close-route denial fix.
    await db.transaction(async (tx) => {
      await writeAudit(
        {
          actor_id: params.approverId,
          action: 'modelgov.rejected',
          resource_type: 'change_request',
          resource_id: params.changeRequestId,
          meta_json: {
            org_id: params.orgId,
            approver_id: params.approverId,
            reason: `eval_status_${row.evalStatus}_not_passed`,
          },
        },
        tx,
      );
    });
    throw new ChangeRequestBlockedError(`eval_status_${row.evalStatus}_not_passed`);
  }

  if (row.approvalStatus !== 'pending_review') {
    throw new ChangeRequestBlockedError(`approval_status_${row.approvalStatus}_not_pending`);
  }

  const evalResultRef = params.evalResultRef ?? row.evalResultRef ?? null;

  return db.transaction(async (tx) => {
    // REQ-013: supersede the current active combination (if any).
    const [currentActive] = await tx
      .select({ id: approvedCombination.id })
      .from(approvedCombination)
      .where(and(eq(approvedCombination.orgId, params.orgId), eq(approvedCombination.active, true)))
      .limit(1);

    if (!row.promptId || !row.modelPinId) {
      throw new ChangeRequestBlockedError('change_request_missing_prompt_or_model_pin');
    }

    const [newCombo] = await tx
      .insert(approvedCombination)
      .values({
        orgId: params.orgId,
        promptId: row.promptId,
        modelPinId: row.modelPinId,
        active: true,
        changeRequestId: row.id,
      })
      .returning({ id: approvedCombination.id });

    if (!newCombo) throw new Error('approved_combination insert returned no rows');

    if (currentActive) {
      await tx
        .update(approvedCombination)
        .set({ active: false, supersededBy: newCombo.id })
        .where(eq(approvedCombination.id, currentActive.id));
    }

    // Record approver + timestamp + eval link on the change_request.
    await tx
      .update(changeRequest)
      .set({
        approvalStatus: 'approved',
        approverId: params.approverId,
        approvedAt: new Date(),
        evalResultRef,
      })
      .where(eq(changeRequest.id, params.changeRequestId));

    // REQ-012: audit the approval (approver + eval link) in the same tx.
    await auditApproved({
      actorId: params.approverId,
      orgId: params.orgId,
      resourceId: newCombo.id,
      changeRequestId: params.changeRequestId,
      approverId: params.approverId,
      combinationId: newCombo.id,
      evalResultRef,
      tx: tx as unknown as AuditDbHandle,
    });

    return { combinationId: newCombo.id };
  });
}

/**
 * Update eval_status on an existing change_request (used when the eval run
 * completes asynchronously). Re-records the audit row.
 */
export async function recordEvalResult(params: {
  changeRequestId: string;
  orgId: string;
  actorId: string | null;
  evalResultJson: unknown;
  evalRunId?: string;
  evalResultRef?: string;
}): Promise<EvalGateResult> {
  const gate = checkEvalThreshold(params.evalResultJson, {
    evalRunId: params.evalRunId ?? null,
    evalResultRef: params.evalResultRef ?? null,
  });

  return db.transaction(async (tx) => {
    await tx
      .update(changeRequest)
      .set({
        evalStatus: gate.passed ? 'passed' : 'failed',
        evalRunId: params.evalRunId ?? null,
        evalResultRef: params.evalResultRef ?? null,
      })
      .where(eq(changeRequest.id, params.changeRequestId));

    await auditEvalResult({
      actorId: params.actorId,
      orgId: params.orgId,
      resourceId: params.changeRequestId,
      changeRequestId: params.changeRequestId,
      passed: gate.passed,
      score: gate.score,
      threshold: gate.threshold,
      evalRunId: gate.evalRunId,
      tx: tx as unknown as AuditDbHandle,
    });

    return gate;
  });
}
