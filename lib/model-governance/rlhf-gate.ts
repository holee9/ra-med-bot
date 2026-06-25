// @MX:NOTE [AUTO] rlhf-gate.ts — RLHF improvement proposal gate (REQ-MODELGOV-009).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-009, AC-05)
// @MX:REASON RLHF improvement proposals are stored as pending_review only and NEVER
//           applied to production without going through the full change_request ->
//           eval -> approval workflow. The actual RLHF data collection body is
//           deferred to a follow-up issue (see @MX:TODO below).

import { createHash } from 'node:crypto';
import { type AuditDbHandle, writeAudit } from '@/lib/audit';
import { db, withTenantScope } from '@/lib/db/client';
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
  return withTenantScope(params.orgId, async (dbs) => {
    const [row] = await dbs
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

    // M3 fix: writeAudit inside the same tenant scope so the audit row + GUC
    // commit atomically (21 CFR Part 11 — the record MUST survive). The
    // withTenantScope callback already runs inside db.transaction, so the
    // audit commits with the insert.
    await writeAudit(
      {
        actor_id: params.submittedBy,
        action: 'modelgov.change_requested',
        resource_type: 'change_request',
        resource_id: row.id,
        meta_json: {
          org_id: params.orgId,
          source: 'rlhf',
          prompt_id: params.promptId ?? null,
          proposal_text_hash: hashProposalText(params.proposalText),
        },
      },
      dbs as unknown as AuditDbHandle,
    );

    return { changeRequestId: row.id };
  });
}

/**
 * M2 fix: SHA-256 replaces the prior 32-bit FNV-like hash. The old hash was
 * brute-forceable and collision-prone (2^32 space). SHA-256 is the same
 * algorithm used for prompt_registry.content_hash. Proposal text is PII-free
 * (an improvement suggestion, not user data) so a strong hash is appropriate.
 */
function hashProposalText(text: string): string {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}
