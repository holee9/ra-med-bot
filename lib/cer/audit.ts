// @MX:NOTE CER-specific audit helpers wrapping the central writeAudit().
// @MX:SPEC SPEC-REGULA-CER-001 (REQ-CER-036~040)
//
// 21 CFR Part 11: every regulated CER action is recorded through the central
// append-only audit pipeline. meta_json is PII-free by construction — only
// stage ids, export format, query length, and result counts are stored. The
// raw literature query text is NOT persisted (query length only).

import { writeAudit } from '../audit';

/**
 * REQ-CER-036: a new CER workflow run was created. Fires as an autocommit
 * BEFORE any external work (PubMed search) so the initiation is recorded even
 * if later steps fail.
 *
 * Two-row note (21 CFR Part 11 provenance): when the CER run supplies a
 * projectId, the route (`app/api/ra/workflows/cer/route.ts`) ALSO emits a
 * second `cer_created` row with `meta_json: { workflowRunId, projectId,
 * persisted: true }` INSIDE the persist transaction. This is intentional and
 * NOT a bug:
 *   - Row 1 (this function, autocommit)  = run was INITIATED (REQ-CER-036).
 *   - Row 2 (route, in-tx)               = deliverable was PERSISTED (AC-04),
 *                                          atomic with the workflow_runs insert.
 * A reviewer reading two `cer_created` rows for one run should treat row 1 as
 * "initiation" and the row carrying `persisted: true` as "deliverable stored".
 * If only row 1 is present (persist tx rolled back), the run was initiated but
 * no deliverable was stored — the PMS linkage query will return null.
 * Follow-up option: split into a distinct `cer_persisted` action for unambiguous
 * semantics (requires an audit_action enum migration).
 */
export async function auditCerCreated(actorId: string, cerRunId: string): Promise<void> {
  await writeAudit({
    actor_id: actorId,
    action: 'cer_created',
    resource_type: 'cer_run',
    resource_id: cerRunId,
  });
}

/** REQ-CER-037: a MEDDEV stage was completed. */
export async function auditCerStageCompleted(
  actorId: string,
  cerRunId: string,
  stageId: number,
): Promise<void> {
  await writeAudit({
    actor_id: actorId,
    action: 'cer_stage_completed',
    resource_type: 'cer_run',
    resource_id: cerRunId,
    meta_json: { stageId },
  });
}

/** REQ-CER-038: an RA expert approved the CER. */
export async function auditCerExpertApproved(actorId: string, cerRunId: string): Promise<void> {
  await writeAudit({
    actor_id: actorId,
    action: 'cer_expert_approved',
    resource_type: 'cer_run',
    resource_id: cerRunId,
  });
}

/** REQ-CER-039: the CER was exported to a downloadable format. */
export async function auditCerExported(
  actorId: string,
  cerRunId: string,
  format: 'docx' | 'pdf',
): Promise<void> {
  await writeAudit({
    actor_id: actorId,
    action: 'cer_exported',
    resource_type: 'cer_run',
    resource_id: cerRunId,
    meta_json: { format },
  });
}

/**
 * REQ-CER-040: a PubMed literature search was performed.
 * PII rule: the query string itself is NOT stored — only its length and the
 * number of results returned.
 */
export async function auditCerLiteratureSearch(
  actorId: string,
  cerRunId: string,
  query: string,
  resultCount: number,
): Promise<void> {
  await writeAudit({
    actor_id: actorId,
    action: 'cer_literature_search',
    resource_type: 'cer_run',
    resource_id: cerRunId,
    meta_json: { queryLength: query.length, resultCount },
  });
}
