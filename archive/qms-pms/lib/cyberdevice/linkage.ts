// @MX:NOTE [AUTO] Evidence-bundle referent validation (C-1 fix — Issue 67).
// @MX:SPEC SPEC-REGULA-CYBERDEVICE-001 (REQ-009/012/014)
//
// C-1 defect: cyber_evidence_bundle.linked_samd_id / linked_dhf_id /
// linked_submission_id were persisted raw from the request body with no
// existence or org-ownership check. A caller could link another org's SaMD /
// DHF / Submission or a dangling UUID. This mirrors the verifyLinkTargetExists
// pattern from lib/clinical-investigation/linkage.ts (H-4 fix).
//
// Each referent table is org-scoped:
//   - samd_assessments.org_id      (uuid, 0054)
//   - design_history_files.org_id  (uuid, 0055)
//   - submission_packages.org_id   (uuid, 0056)
//
// Native FK constraints are blocked by a type mismatch
// (cyber_evidence_bundle.linked_*_id is uuid; referent PKs are text), so this
// in-application validation is the authoritative guard. See
// migrations/0079_cyberdevice_linkage_hardening.sql for the full rationale.

import { db } from '@/lib/db/client';
import { designHistoryFiles, samdAssessments, submissionPackages } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export type LinkedReferentKind = 'samd' | 'dhf' | 'submission';

/**
 * C-1 fix: verify a linked_* referent exists AND belongs to `orgId` before the
 * cyber_evidence_bundle row is persisted. Returns true when the referent exists
 * in the caller's org, false otherwise (the route surfaces 404 — never 403 — so
 * UUID probing is not possible, consistent with the IDOR pattern).
 *
 * `referentId` is the raw string from the request body (the linked_*_id value).
 * The referent tables use text PKs; the cyber_evidence_bundle column is uuid,
 * so we accept the value as a string here and let Postgres cast at insert time.
 */
export async function verifyLinkedReferentExists(
  orgId: string,
  kind: LinkedReferentKind,
  referentId: string,
): Promise<boolean> {
  try {
    if (kind === 'samd') {
      const rows = await db
        .select({ id: samdAssessments.id })
        .from(samdAssessments)
        .where(and(eq(samdAssessments.id, referentId), eq(samdAssessments.orgId, orgId)))
        .limit(1);
      return rows.length > 0;
    }
    if (kind === 'dhf') {
      const rows = await db
        .select({ id: designHistoryFiles.id })
        .from(designHistoryFiles)
        .where(and(eq(designHistoryFiles.id, referentId), eq(designHistoryFiles.orgId, orgId)))
        .limit(1);
      return rows.length > 0;
    }
    if (kind === 'submission') {
      const rows = await db
        .select({ id: submissionPackages.id })
        .from(submissionPackages)
        .where(and(eq(submissionPackages.id, referentId), eq(submissionPackages.orgId, orgId)))
        .limit(1);
      return rows.length > 0;
    }
    return false;
  } catch {
    return false;
  }
}
