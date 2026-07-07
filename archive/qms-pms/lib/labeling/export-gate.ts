// @MX:NOTE [AUTO] REQ-006 — export gate for unsupported claims.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-006, REQ-010, AC-03)

// @MX:LEGACY archived from lib
//
// Mirrors the PMS export-gating pattern (lib/pms/export-gate.ts). A labeling
// document may only be exported when ALL claims are supported (zero
// "unsupported" and zero pending expert_review_required). Denials are audited
// as 'label.export_blocked' (21 CFR Part 11).

import { db } from '@/lib/db/client';
import { labelingClaims, labelingDocuments, labelingSections } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import type { ExportGateResult } from './types';

/**
 * REQ-006: determine whether a labeling document may be exported.
 *
 * Blocking conditions:
 *   - Any claim with claim_type='unsupported' (REQ-003/004 + REQ-006).
 *   - Any claim with expert_review_required=true (REQ-004 pending review).
 *
 * Returns blocking claim IDs so the route can surface them to the operator.
 *
 * IDOR defense: org_id scope enforced at both the document and claims level.
 */
export async function canExportLabelingDocument(
  documentId: string,
  orgId: string,
): Promise<ExportGateResult> {
  // IDOR defense: document must belong to the caller's org.
  const doc = await db
    .select({ id: labelingDocuments.id })
    .from(labelingDocuments)
    .where(and(eq(labelingDocuments.id, documentId), eq(labelingDocuments.orgId, orgId)))
    .limit(1);

  if (doc.length === 0) {
    return {
      allowed: false,
      blockingClaims: [],
      reason: 'document_not_found_or_org_mismatch',
    };
  }

  // Fetch blocking claims: join sections → documents to scope by documentId,
  // and org_id on every table for defense-in-depth.
  const blocking = await db
    .select({
      id: labelingClaims.id,
      claimType: labelingClaims.claimType,
      expertReviewRequired: labelingClaims.expertReviewRequired,
    })
    .from(labelingClaims)
    .innerJoin(labelingSections, eq(labelingClaims.sectionId, labelingSections.id))
    .innerJoin(labelingDocuments, eq(labelingSections.documentId, labelingDocuments.id))
    .where(
      and(
        eq(labelingDocuments.id, documentId),
        eq(labelingDocuments.orgId, orgId),
        eq(labelingClaims.orgId, orgId),
      ),
    );

  const blockingClaims: string[] = [];
  for (const claim of blocking) {
    if (claim.claimType === 'unsupported' || claim.expertReviewRequired) {
      blockingClaims.push(claim.id);
    }
  }

  if (blockingClaims.length > 0) {
    return {
      allowed: false,
      blockingClaims,
      reason: 'unsupported_or_pending_review_claims_exist',
    };
  }

  return { allowed: true, blockingClaims: [] };
}
