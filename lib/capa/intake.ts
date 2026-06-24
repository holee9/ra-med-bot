// @MX:NOTE [AUTO] Complaint intake persistence (REQ-001).
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-001)
//
// REQ-001: creates a structured complaint record. The intake payload is stored
// as JSONB so the reportability wrapper can map it to AdverseEventInput without
// a second read. The trend signature is computed up-front so trend detection
// is O(1) at insert time.

import { db } from '@/lib/db/client';
import { complaints } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { computeTrendSignature } from './trend-detector';
import type { ComplaintIntake } from './types';

/** Minimal transaction-handle type compatible with both the db singleton and a tx-scoped clone. */
type DbHandle = { insert: (typeof db)['insert'] };

/**
 * REQ-001: insert a structured complaint. Returns the created complaint id.
 *
 * The caller is responsible for:
 *   - assertPmsProjectAccess (IDOR guard on projectId)
 *   - audit complaint.intake_created
 *   - triggering reportability assessment (REQ-002)
 *
 * H-2 fix: accepts an optional `tx` so the insert + audit commit atomically.
 * Callers that wrap mutation + audit in `db.transaction` pass the `tx` here.
 *
 * @MX:WARN [AUTO] Callers MUST wrap this in a transaction if co-authored with
 * @MX:REASON the audit write (21 CFR Part 11 atomicity — the complaint and its
 *            creation audit must commit together).
 */
export async function createComplaint(
  params: {
    orgId: string;
    projectId: string;
    intake: ComplaintIntake;
    createdBy: string;
  },
  tx?: DbHandle,
): Promise<{ id: string; trendSignature: string }> {
  const trendSignature = computeTrendSignature(params.intake);
  const client = tx ?? db;

  const [row] = await client
    .insert(complaints)
    .values({
      orgId: params.orgId,
      projectId: params.projectId,
      intakeData: params.intake,
      reportabilityStatus: 'pending',
      trendSignature,
      createdBy: params.createdBy,
    })
    .returning({ id: complaints.id });

  const complaintId = row?.id;
  if (!complaintId) throw new Error('failed to insert complaint');
  return { id: complaintId, trendSignature };
}

/**
 * Fetch a complaint by id, scoped by org. Returns null when absent or
 * cross-org (callers surface 404).
 */
export async function getComplaint(
  complaintId: string,
  orgId: string,
): Promise<{
  id: string;
  intakeData: ComplaintIntake;
  reportabilityStatus: string;
  vigilanceRef: string | null;
} | null> {
  const [row] = await db
    .select({
      id: complaints.id,
      intakeData: complaints.intakeData,
      reportabilityStatus: complaints.reportabilityStatus,
      vigilanceRef: complaints.vigilanceRef,
    })
    .from(complaints)
    .where(and(eq(complaints.id, complaintId), eq(complaints.orgId, orgId)))
    .limit(1);

  if (!row) return null;
  return {
    id: row.id,
    intakeData: row.intakeData as ComplaintIntake,
    reportabilityStatus: row.reportabilityStatus,
    vigilanceRef: row.vigilanceRef ?? null,
  };
}
