// @MX:NOTE [AUTO] rlhf-gate.ts — RLHF improvement proposal gate (REQ-MODELGOV-009).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-009, AC-05)
// @MX:REASON RLHF improvement proposals are stored as pending_review only and NEVER
//           applied to production without going through the full change_request ->
//           eval -> approval workflow. The actual RLHF data collection body is
//           deferred to a follow-up issue (see @MX:TODO below).

import { writeAudit } from '@/lib/audit';
import { db } from '@/lib/db/client';
import { changeRequest } from '@/lib/db/schema';

/**
 * REQ-MODELGOV-009: store an RLHF improvement proposal as a pending_review
 * change_request. Production application is blocked because:
 *   - eval_status stays 'pending' (no eval run)
 *   - approval_status stays 'pending_review'
 *   - approveChangeRequest() rejects unless eval_status='passed' (REQ-005)
 *
 * Returns the pending change_request id. The proposal text is stored ONLY in
 * the audit meta_json (PII-free: it's an improvement suggestion, not user data)
 * so a future eval/approval can reference it.
 *
 * @MX:TODO Full RLHF feedback ingestion pipeline is deferred to a follow-up
 *   issue. This function provides the storage + gate only.
 */
export async function submitRlhfProposal(params: {
  orgId: string;
  submittedBy: string | null;
  promptId?: string;
  proposalText: string;
}): Promise<{ changeRequestId: string }> {
  const [row] = await db
    .insert(changeRequest)
    .values({
      orgId: params.orgId,
      promptId: params.promptId ?? null,
      modelPinId: null,
      evalStatus: 'pending',
      approvalStatus: 'pending_review',
      createdBy: params.submittedBy,
    })
    .returning({ id: changeRequest.id });

  if (!row) throw new Error('change_request insert returned no rows');

  await writeAudit({
    actor_id: params.submittedBy,
    action: 'modelgov.change_requested',
    resource_type: 'change_request',
    resource_id: row.id,
    meta_json: {
      org_id: params.orgId,
      source: 'rlhf',
      prompt_id: params.promptId ?? null,
      proposal_text_hash: hashText(params.proposalText),
    },
  });

  return { changeRequestId: row.id };
}

function hashText(text: string): string {
  // Simple non-crypto hash to avoid storing raw proposal text in audit (PII hygiene).
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return `fnv32:${(h >>> 0).toString(16)}`;
}
