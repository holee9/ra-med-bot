// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-024)
// PCCP version lifecycle: draft → submitted → cleared → superseded
// AC-9: only one active version per device — enforced at DB level (partial UNIQUE INDEX).

import type { AuditDbHandle } from '@/lib/kernel/audit';
import { db } from '@/lib/kernel/db/client';
import { pccpVersions } from '@/lib/kernel/db/schema';
import { and, eq } from 'drizzle-orm';
import type { PccpStatus } from './types';

const VALID_TRANSITIONS: Record<PccpStatus, PccpStatus[]> = {
  draft: ['submitted'],
  submitted: ['cleared', 'draft'],
  cleared: ['superseded'],
  superseded: [],
};

export function isValidTransition(from: PccpStatus, to: PccpStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Transitions a PCCP version to a new status.
 * Throws if the transition is not valid.
 */
export async function transitionPccpStatus(params: {
  pccpVersionId: string;
  toStatus: PccpStatus;
  actorId: string;
  // 21 CFR Part 11 §11.10(e) — Issue #378 PR-E: optional caller tx so the
  // status UPDATE rides the same transaction as the approval audits.
  tx?: AuditDbHandle;
}): Promise<void> {
  const q = params.tx ?? db;
  const [current] = await q
    .select({ status: pccpVersions.status })
    .from(pccpVersions)
    .where(eq(pccpVersions.id, params.pccpVersionId))
    .limit(1);

  if (!current) {
    throw new Error(`PCCP version ${params.pccpVersionId} not found`);
  }

  const fromStatus = current.status as PccpStatus;
  if (!isValidTransition(fromStatus, params.toStatus)) {
    throw new Error(`Invalid PCCP status transition: ${fromStatus} → ${params.toStatus}`);
  }

  await q
    .update(pccpVersions)
    .set({
      status: params.toStatus,
      active: params.toStatus !== 'superseded',
      updatedAt: new Date(),
    })
    .where(eq(pccpVersions.id, params.pccpVersionId));
}

/**
 * Returns the active PCCP version for a device, or null if none exists.
 */
export async function getActivePccpVersion(deviceId: string) {
  const [active] = await db
    .select()
    .from(pccpVersions)
    .where(and(eq(pccpVersions.deviceId, deviceId), eq(pccpVersions.active, true)))
    .limit(1);
  return active ?? null;
}
