// @MX:ANCHOR [AUTO] POST /api/traceability/edges — create/delete evidence edge.
// @MX:REASON IDOR-sensitive 21 CFR Part 11 record. Three-layer defense:
//   1) withPermission('traceability.manage') — ra-lead only.
//   2) createEdge/deleteEdgeByKey IDOR gate — verifies BOTH endpoints' org_id.
//   3) RLS at the DB layer.
//   A cross-org attempt returns 404 (not 403) to avoid leaking node existence.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-001, REQ-TRACEABILITY-003, REQ-TRACEABILITY-010)

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db, withTenantScope } from '@/lib/db/client';
import {
  EdgeIdorError,
  type EvidenceEdgeRelation,
  SelfReferenceError,
  type TraceabilityDb,
  createEdge,
  deleteEdgeByKey,
} from '@/lib/traceability/graph';
import { propagateStaleFromNode } from '@/lib/traceability/stale-propagation';
import type { StaleReason } from '@/lib/traceability/stale-reason';
import { z } from 'zod';

const RelationEnum = z.enum([
  'derived_from',
  'cites',
  'reviewed_by',
  'exported_in',
  'mitigates',
  'satisfies',
]);

const EdgeWriteSchema = z.object({
  fromNodeId: z.string().uuid(),
  toNodeId: z.string().uuid(),
  relation: RelationEnum,
  action: z.enum(['create', 'delete']),
  /** Optional — if the to-node is a superseded source, fan out stale flags. */
  staleReason: z.enum(['superseded_source', 'superseded_regulation']).optional(),
});

export const POST = withPermission('traceability.manage', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const parsed = EdgeWriteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  try {
    if (body.action === 'create') {
      // H2 fix (21 CFR Part 11): edge create + audit commit atomically. A
      // transient failure between the INSERT and the audit write rolls back
      // BOTH — the edge must never persist without its audit record.
      // #239 Phase 2: withTenantScope sets app.current_org_id GUC for RLS enforce.
      const res = await withTenantScope(organizationId, async (tx) => {
        const txDb = tx as unknown as TraceabilityDb;
        const result = await createEdge(txDb, {
          orgId: organizationId,
          fromNodeId: body.fromNodeId,
          toNodeId: body.toNodeId,
          relation: body.relation as EvidenceEdgeRelation,
          createdBy: session.user.id,
        });
        await writeAudit(
          {
            actor_id: session.user.id,
            action: 'traceability.edge_created',
            resource_type: 'evidence_edge',
            resource_id: result.edge?.id ?? `${body.fromNodeId}:${body.toNodeId}:${body.relation}`,
            meta_json: {
              fromNodeId: body.fromNodeId,
              toNodeId: body.toNodeId,
              relation: body.relation,
              idempotent: !result.created,
            },
          },
          tx,
        );
        return result;
      });

      // M2 fix: stale propagation runs AFTER the commit. If it throws, the
      // edge IS committed — never return 500. Catch, audit the failure, and
      // return success so the client can retry propagation idempotently.
      if (body.staleReason) {
        try {
          await propagateStaleFromNode(db, {
            orgId: organizationId,
            sourceNodeId: body.toNodeId,
            reason: body.staleReason as StaleReason,
            onPropagate: async (affected) => {
              await writeAudit({
                actor_id: session.user.id,
                action: 'traceability.stale_propagated',
                resource_type: 'evidence_node',
                resource_id: body.toNodeId,
                meta_json: { affectedCount: affected.length, reason: body.staleReason },
              });
            },
          });
        } catch (propagationErr) {
          // The edge is committed; log the propagation failure for retry.
          // Never 500 — propagation is idempotent (uq_stale_flags_node_reason).
          await writeAudit({
            actor_id: session.user.id,
            action: 'traceability.stale_propagated',
            resource_type: 'evidence_node',
            resource_id: body.toNodeId,
            meta_json: {
              reason: body.staleReason,
              error: propagationErr instanceof Error ? propagationErr.message : 'unknown',
              propagationFailed: true,
            },
          });
        }
      }
      return Response.json({ created: res.created }, { status: res.created ? 201 : 200 });
    }

    // action === 'delete' — H2: delete + audit in one transaction.
    // #239 Phase 2: withTenantScope sets app.current_org_id GUC for RLS enforce.
    const deleted = await withTenantScope(organizationId, async (tx) => {
      const txDb = tx as unknown as TraceabilityDb;
      const result = await deleteEdgeByKey(txDb, {
        orgId: organizationId,
        fromNodeId: body.fromNodeId,
        toNodeId: body.toNodeId,
        relation: body.relation as EvidenceEdgeRelation,
      });
      await writeAudit(
        {
          actor_id: session.user.id,
          action: 'traceability.edge_deleted',
          resource_type: 'evidence_edge',
          resource_id: `${body.fromNodeId}:${body.toNodeId}:${body.relation}`,
          meta_json: {
            fromNodeId: body.fromNodeId,
            toNodeId: body.toNodeId,
            relation: body.relation,
            existed: result,
          },
        },
        tx,
      );
      return result;
    });
    return Response.json({ deleted }, { status: deleted ? 200 : 404 });
  } catch (err) {
    // IDOR gate → 404 to avoid leaking cross-org node existence.
    if (err instanceof EdgeIdorError) {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }
    if (err instanceof SelfReferenceError) {
      return Response.json({ error: 'self_reference_forbidden' }, { status: 400 });
    }
    throw err; // withPermission's caller handles 500.
  }
});
