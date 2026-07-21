// @MX:ANCHOR [AUTO] stale-propagation integration hooks — call sites for
// supersession events from delta-sync (#45) and impact (#41).
// @MX:REASON Centralizes the application-level hook so the supersession write
//           paths call ONE function. Idempotent + non-blocking-safe: failures
//           are logged via the audit row but never crash the parent sync.
//           This is the application-hook design decision from plan.md §4.1
//           (NOT a DB trigger — TDD-friendly and auditable).
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-009)

import { writeAudit } from '@/lib/kernel/audit';
import { db } from '@/lib/kernel/db/client';
import { findNodeByRef, upsertNode } from './graph';
import { propagateStaleFromNode } from './stale-propagation';
import type { StaleReason } from './stale-reason';

/**
 * Hook: a source_section was superseded by a newer ingestion.
 * Call from lib/radar/delta-sync after `source_sections.superseded_by` is set.
 *
 * Behavior:
 *   1. Resolve the evidence_node for (org, 'source_section', 'source_sections', refId).
 *      If no node exists yet (no deliverable has cited it), this is a no-op —
 *      there is nothing to propagate.
 *   2. Fan out stale_flags via propagateStaleFromNode.
 *   3. Emit a single traceability.stale_propagated audit row.
 *
 * Never throws — supersession must not crash the parent sync job.
 */
// @MX:NOTE [AUTO] AC-05 wired — call site: lib/radar/delta-sync/ingest.ts
//   `applyOutdateOperations` fires this hook after the supersession tx commits
//   (#238). The hook is lazy-imported so the delta-sync pure-function tests stay
//   decoupled from the traceability graph. Hook is non-blocking: failures are
//   captured as an audit row inside the hook, never crash the parent sync.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-009, AC-05)
export async function onSourceSectionSuperseded(opts: {
  orgId: string;
  refId: string;
  actorId: string | null;
}): Promise<{ propagated: boolean; affectedCount: number }> {
  try {
    const node = await findNodeByRef(db, {
      orgId: opts.orgId,
      nodeType: 'source_section',
      refTable: 'source_sections',
      refId: opts.refId,
    });
    if (!node) {
      return { propagated: false, affectedCount: 0 };
    }
    const result = await propagateStaleFromNode(db, {
      orgId: opts.orgId,
      sourceNodeId: node.id,
      reason: 'superseded_source' satisfies StaleReason,
    });
    await writeAudit({
      actor_id: opts.actorId,
      action: 'traceability.stale_propagated',
      resource_type: 'evidence_node',
      resource_id: node.id,
      meta_json: { reason: 'superseded_source', affectedCount: result.affectedNodeIds.length },
    });
    return { propagated: true, affectedCount: result.affectedNodeIds.length };
  } catch (err) {
    // Non-blocking: log and swallow. The parent sync must continue.
    await writeAudit({
      actor_id: opts.actorId,
      action: 'traceability.stale_propagated',
      resource_type: 'evidence_node',
      resource_id: opts.refId,
      meta_json: {
        reason: 'superseded_source',
        error: err instanceof Error ? err.message : 'unknown',
        propagationFailed: true,
      },
    });
    return { propagated: false, affectedCount: 0 };
  }
}

/**
 * Hook: a regulatory_update was superseded by a newer one (#41 impact path).
 * Ensures the corresponding evidence_node exists before propagating.
 */
export async function onRegulatoryUpdateSuperseded(opts: {
  orgId: string;
  refId: string;
  createdBy: string;
  actorId: string | null;
}): Promise<{ propagated: boolean; affectedCount: number }> {
  try {
    let node = await findNodeByRef(db, {
      orgId: opts.orgId,
      nodeType: 'regulatory_update',
      refTable: 'regulatory_updates',
      refId: opts.refId,
    });
    if (!node) {
      node = await upsertNode(db, {
        orgId: opts.orgId,
        nodeType: 'regulatory_update',
        refTable: 'regulatory_updates',
        refId: opts.refId,
        createdBy: opts.createdBy,
      });
    }
    const result = await propagateStaleFromNode(db, {
      orgId: opts.orgId,
      sourceNodeId: node.id,
      reason: 'superseded_regulation' satisfies StaleReason,
    });
    await writeAudit({
      actor_id: opts.actorId,
      action: 'traceability.stale_propagated',
      resource_type: 'evidence_node',
      resource_id: node.id,
      meta_json: { reason: 'superseded_regulation', affectedCount: result.affectedNodeIds.length },
    });
    return { propagated: true, affectedCount: result.affectedNodeIds.length };
  } catch (err) {
    await writeAudit({
      actor_id: opts.actorId,
      action: 'traceability.stale_propagated',
      resource_type: 'evidence_node',
      resource_id: opts.refId,
      meta_json: {
        reason: 'superseded_regulation',
        error: err instanceof Error ? err.message : 'unknown',
        propagationFailed: true,
      },
    });
    return { propagated: false, affectedCount: 0 };
  }
}
