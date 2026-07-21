// @MX:NOTE [AUTO] Source governance audit wrappers (REQ-SOURCE-GOV-015).
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48)
//
// Thin wrappers over lib/audit.writeAudit for the 8 source.* audit actions.
// Routes and the review-workflow call these so every approval/reject/supersession
// event is recorded for 21 CFR Part 11 traceability. All wrappers pass-through
// the transaction handle when provided (Part 11 atomicity — lib/audit contract).

import { type AuditDbHandle, writeAudit } from '@/lib/kernel/audit';
import type { ApprovalStatus } from './types';

interface SourceAuditParams {
  userId: string;
  sourceId: string;
  conversationId?: string;
  tx?: AuditDbHandle;
}

interface AuditEventInput {
  actor_id: string;
  action: Parameters<typeof writeAudit>[0]['action'];
  resource_type: string;
  resource_id: string;
  conversation_id?: string | null;
  meta_json?: Record<string, unknown>;
}

/** Internal: writeAudit with optional tx, keeping AuditEvent + tx separate. */
function emit(event: AuditEventInput, tx?: AuditDbHandle): Promise<void> {
  return writeAudit(event, tx);
}

/** REQ-SOURCE-GOV-015 — approve/reject audit (mirrors label.approved). */
export function auditSourceApproval(
  params: SourceAuditParams & { decision: ApprovalStatus; notes?: string },
): Promise<void> {
  const action = params.decision === 'approved' ? 'source.approved' : 'source.rejected';
  return emit(
    {
      actor_id: params.userId,
      action,
      resource_type: 'source',
      resource_id: params.sourceId,
      conversation_id: params.conversationId,
      meta_json: { decision: params.decision, notes: params.notes ?? null },
    },
    params.tx,
  );
}

/** REQ-SOURCE-GOV-005 — supersession audit. */
export function auditSourceSuperseded(
  params: SourceAuditParams & { supersededBy: string },
): Promise<void> {
  return emit(
    {
      actor_id: params.userId,
      action: 'source.superseded',
      resource_type: 'source',
      resource_id: params.sourceId,
      conversation_id: params.conversationId,
      meta_json: { supersededBy: params.supersededBy },
    },
    params.tx,
  );
}

/** REQ-SOURCE-GOV-011/013 — periodic review-due notification audit. */
export function auditSourceReviewDue(
  params: SourceAuditParams & { reviewCycleDays: number | null; lastReviewedAt: string | null },
): Promise<void> {
  return emit(
    {
      actor_id: params.userId,
      action: 'source.review_due',
      resource_type: 'source',
      resource_id: params.sourceId,
      conversation_id: params.conversationId,
      meta_json: {
        reviewCycleDays: params.reviewCycleDays,
        lastReviewedAt: params.lastReviewedAt,
      },
    },
    params.tx,
  );
}

/** REQ-SOURCE-GOV-016 — #45 delta-sync refreshed governance state. */
export function auditSourceDeltaSyncUpdated(
  params: SourceAuditParams & { updatedFields: string[] },
): Promise<void> {
  return emit(
    {
      actor_id: params.userId,
      action: 'source.delta_sync_updated',
      resource_type: 'source',
      resource_id: params.sourceId,
      conversation_id: params.conversationId,
      meta_json: { updatedFields: params.updatedFields },
    },
    params.tx,
  );
}

/** REQ-SOURCE-GOV-016 — governance fields updated (authority/jurisdiction/dates). */
export function auditSourceGovernanceUpdated(
  params: SourceAuditParams & { fields: Record<string, unknown> },
): Promise<void> {
  return emit(
    {
      actor_id: params.userId,
      action: 'source.governance_updated',
      resource_type: 'source',
      resource_id: params.sourceId,
      conversation_id: params.conversationId,
      // PII-free: only governance field names + new values (no question/answer text).
      meta_json: { fields: params.fields },
    },
    params.tx,
  );
}

/** REQ-SOURCE-GOV-008 — low-authority-only retrieval flagged expert review. */
export function auditSourceLowAuthorityFlagged(
  params: SourceAuditParams & { reason: string; highestGrade: string | null },
): Promise<void> {
  return emit(
    {
      actor_id: params.userId,
      action: 'source.low_authority_flagged',
      resource_type: 'source',
      resource_id: params.sourceId,
      conversation_id: params.conversationId,
      meta_json: { reason: params.reason, highestGrade: params.highestGrade },
    },
    params.tx,
  );
}
