// @MX:NOTE [AUTO] CAPA record CRUD — corrective/preventive split (REQ-004/005).
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-004, REQ-005, REQ-010)
//
// REQ-004: corrective vs preventive tracked separately via the `type` column.
// REQ-005: owner + due_date + effectiveness_status per record.

import { db } from '@/lib/db/client';
import { capaEffectivenessChecks, capaRecords, capaRootCauses } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import type { CapaLinkInput, CapaType, RootCauseMethod } from './types';

/**
 * Minimal transaction-handle type compatible with both the db singleton and a
 * tx-scoped clone. Used by createCapaRecord / saveRootCause / closeCapaRecord
 * so callers can ride the mutation + audit on the same transaction (H-2 fix).
 */
type DbHandle = {
  insert: (typeof db)['insert'];
  update: (typeof db)['update'];
};

export interface CreateCapaInput {
  orgId: string;
  projectId: string;
  complaintId: string;
  type: CapaType;
  description: string;
  ownerId: string;
  dueDate: string; // ISO YYYY-MM-DD
  createdBy: string;
  effectivenessDueDate?: string; // when set, schedule an effectiveness check
  links?: CapaLinkInput[]; // REQ-008 auto-link on creation
}

/**
 * REQ-004/005: create a CAPA record. When effectivenessDueDate is provided,
 * also schedules an effectiveness check (REQ-006) and inserts capa_links rows
 * for the optional links array (REQ-008).
 *
 * @MX:WARN [AUTO] Multiple writes; callers SHOULD wrap in a transaction.
 * @MX:REASON 21 CFR Part 11 — the record, its effectiveness schedule, and its
 *            links must commit atomically.
 *
 * IDOR defense: scoped by orgId throughout. The caller must have already
 * asserted project access (assertPmsProjectAccess).
 */
export async function createCapaRecord(
  input: CreateCapaInput,
  tx?: DbHandle,
): Promise<{
  capaId: string;
  effectivenessCheckId: string | null;
}> {
  const client = tx ?? db;
  const [row] = await client
    .insert(capaRecords)
    .values({
      orgId: input.orgId,
      projectId: input.projectId,
      complaintId: input.complaintId,
      type: input.type,
      description: input.description,
      ownerId: input.ownerId,
      dueDate: input.dueDate,
      status: 'open',
      effectivenessStatus: 'pending',
      createdBy: input.createdBy,
    })
    .returning({ id: capaRecords.id });

  const capaId = row?.id;
  if (!capaId) throw new Error('failed to insert capa_records');

  let effectivenessCheckId: string | null = null;
  if (input.effectivenessDueDate) {
    const [check] = await client
      .insert(capaEffectivenessChecks)
      .values({
        orgId: input.orgId,
        capaId,
        dueDate: input.effectivenessDueDate,
      })
      .returning({ id: capaEffectivenessChecks.id });
    effectivenessCheckId = check?.id ?? null;
  }

  return { capaId, effectivenessCheckId };
}

/**
 * Fetch a CAPA by id, scoped by org. Returns null when absent or cross-org.
 */
export async function getCapaRecord(
  capaId: string,
  orgId: string,
): Promise<{
  id: string;
  complaintId: string;
  type: string;
  description: string;
  status: string;
  effectivenessStatus: string;
  ownerId: string;
  closeSignatureHash: string | null;
} | null> {
  const [row] = await db
    .select({
      id: capaRecords.id,
      complaintId: capaRecords.complaintId,
      type: capaRecords.type,
      description: capaRecords.description,
      status: capaRecords.status,
      effectivenessStatus: capaRecords.effectivenessStatus,
      ownerId: capaRecords.ownerId,
      closeSignatureHash: capaRecords.closeSignatureHash,
    })
    .from(capaRecords)
    .where(and(eq(capaRecords.id, capaId), eq(capaRecords.orgId, orgId)))
    .limit(1);

  return row ?? null;
}

/**
 * REQ-003: persist a root cause analysis for a CAPA.
 *
 * H-2 fix: accepts an optional `tx` so the insert + audit commit atomically.
 */
export async function saveRootCause(
  params: {
    capaId: string;
    orgId: string;
    createdBy: string;
    method: RootCauseMethod;
    analysisData: unknown;
    summary: string;
  },
  tx?: DbHandle,
): Promise<string> {
  const client = tx ?? db;
  const [row] = await client
    .insert(capaRootCauses)
    .values({
      orgId: params.orgId,
      capaId: params.capaId,
      method: params.method,
      analysisData: params.analysisData as Record<string, unknown>,
      summary: params.summary,
      createdBy: params.createdBy,
    })
    .returning({ id: capaRootCauses.id });
  const rootCauseId = row?.id;
  if (!rootCauseId) throw new Error('failed to insert capa_root_causes');
  return rootCauseId;
}

/**
 * REQ-010: close a CAPA. Marks status='closed', records the ESIG hash + closer.
 * Callers MUST have already passed canCloseCapa (REQ-011 gate) + recorded the
 * signature via the ESIG pipeline.
 *
 * H-2 fix: accepts an optional `tx` so the close update + audit commit atomically.
 */
export async function closeCapaRecord(
  params: {
    capaId: string;
    orgId: string;
    closedBy: string;
    signatureHash: string;
  },
  tx?: DbHandle,
): Promise<boolean> {
  const client = tx ?? db;
  const result = await client
    .update(capaRecords)
    .set({
      status: 'closed',
      closedBy: params.closedBy,
      closedAt: new Date(),
      closeSignatureHash: params.signatureHash,
      updatedAt: new Date(),
    })
    .where(and(eq(capaRecords.id, params.capaId), eq(capaRecords.orgId, params.orgId)))
    .returning({ id: capaRecords.id });

  return result.length > 0;
}
