// @MX:ANCHOR [AUTO] Knowledge Gap Classify Route — POST /api/knowledge-gap/classify.
// @MX:REASON Public API boundary for RA-lead classification of an unanswered gap
//          into one of 4 categories (REQ-KNOWLEDGE-GAP-008). Writes the
//          classification + status='classified' + audit row. RBAC gate is
//          ra-lead/admin via knowledgegap.classify — classification drives KB
//          augmentation, so it is a judgment call restricted to senior RA roles.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-008, REQ-009, AC-04, AC-07, AC-08, Issue #35)
//
// Flow:
//   1. Auth + RBAC (knowledgegap.classify = ra-lead only).
//   2. Zod-validate body (queueId, classification enum, optional note).
//   3. UPDATE unanswered_queue SET classification, status='classified' WHERE id.
//   4. Audit knowledge_gap_classified with meta {classification, note, queueId}.
//
// Failures propagate: invalid body → 400, row not found → 404, DB error → 500.

export const runtime = 'nodejs';

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { unansweredQueue } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

/**
 * REQ-KNOWLEDGE-GAP-008 classification categories (mirror gap_classification enum).
 * Each value maps to a distinct KB-augmentation workflow:
 *   - ra_project_gap           → internal RA project SOP corpus
 *   - md_process_gap           → manufacturing / registration process docs
 *   - external_regulation_needed → external regulator source ingestion
 *   - bug                      → product bug ticket (not a corpus gap)
 */
const ClassifyBodySchema = z.object({
  queueId: z.string().uuid(),
  classification: z.enum(['ra_project_gap', 'md_process_gap', 'external_regulation_needed', 'bug']),
  note: z.string().max(2000).optional(),
});

export const POST = withPermission('knowledgegap.classify', async (req, _ctx, session) => {
  const parsed = ClassifyBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid_body', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { queueId, classification, note } = parsed.data;

  // SECURITY (H1 fix): SELECT-then-UPDATE scoped by id+org. A row that does not
  // exist OR exists in another org both surface as 404 (not 403) so we never
  // leak the existence of a cross-org queueId. RLS also enforces this at the DB
  // layer; the explicit filter keeps the query plan cheap and unambiguous.
  const orgId = session.user.organizationId;
  const [existing] = await db
    .select({ id: unansweredQueue.id })
    .from(unansweredQueue)
    .where(
      orgId !== undefined
        ? and(eq(unansweredQueue.id, queueId), eq(unansweredQueue.orgId, orgId))
        : eq(unansweredQueue.id, queueId),
    );

  if (!existing) {
    return Response.json({ error: 'not_found', queueId }, { status: 404 });
  }

  await db
    .update(unansweredQueue)
    .set({ classification, status: 'classified' })
    .where(eq(unansweredQueue.id, queueId));

  await writeAudit({
    actor_id: session.user.id,
    action: 'knowledge_gap_classified',
    resource_type: 'unanswered_queue',
    resource_id: queueId,
    meta_json: {
      classification,
      note: note ?? null,
    },
  });

  return Response.json({ queueId, classification, status: 'classified' });
});
