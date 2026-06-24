// @MX:NOTE [AUTO] access.ts — IDOR / org-scoping guards for model-governance routes.
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71)
// @MX:REASON Every route under app/api/model-governance/ MUST verify the requested
//           resource belongs to the caller's org before any mutation. Mirrors
//           assertInvestigationAccess. Returns null on miss so the route surfaces 404
//           (never 403) — UUID probing is not possible.

import { db } from '@/lib/db/client';
import { changeRequest, modelPin, promptRegistry } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

/**
 * Verify `promptId` belongs to `organizationId`. Returns true on success.
 */
export async function assertPromptAccess(
  promptId: string,
  organizationId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: promptRegistry.id })
    .from(promptRegistry)
    .where(and(eq(promptRegistry.id, promptId), eq(promptRegistry.orgId, organizationId)))
    .limit(1);
  return Boolean(row);
}

/**
 * Verify `modelPinId` belongs to `organizationId`. Returns true on success.
 */
export async function assertModelPinAccess(
  modelPinId: string,
  organizationId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: modelPin.id })
    .from(modelPin)
    .where(and(eq(modelPin.id, modelPinId), eq(modelPin.orgId, organizationId)))
    .limit(1);
  return Boolean(row);
}

/**
 * Verify `changeRequestId` belongs to `organizationId`. Returns the row on success
 * or null when missing/cross-org (caller surfaces 404).
 */
export async function assertChangeRequestAccess(
  changeRequestId: string,
  organizationId: string,
): Promise<{
  id: string;
  promptId: string | null;
  modelPinId: string | null;
  evalStatus: 'pending' | 'passed' | 'failed';
  approvalStatus: 'pending_review' | 'approved' | 'rejected';
} | null> {
  const [row] = await db
    .select({
      id: changeRequest.id,
      promptId: changeRequest.promptId,
      modelPinId: changeRequest.modelPinId,
      evalStatus: changeRequest.evalStatus,
      approvalStatus: changeRequest.approvalStatus,
    })
    .from(changeRequest)
    .where(and(eq(changeRequest.id, changeRequestId), eq(changeRequest.orgId, organizationId)))
    .limit(1);

  return row ?? null;
}
