// @MX:ANCHOR [AUTO] Expert Review [id] Route — GET (detail) + PATCH (state machine) + DELETE (405)
// @MX:REASON Public API boundary for individual expert review operations.
// State machine: pending → in_progress → resolved (no backwards transitions).
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-006..008)

import { writeAudit } from '@/lib/kernel/audit';
import type { AuditAction } from '@/lib/kernel/audit';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { db } from '@/lib/kernel/db/client';
import { expertReviews } from '@/lib/kernel/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// Valid state transitions: from → allowed next states
const TRANSITIONS: Record<string, string[]> = {
  pending: ['in_progress'],
  in_progress: ['resolved'],
  resolved: [],
};

const PatchSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'resolved']),
  assignedTo: z.string().optional(),
  resolution: z.string().optional(),
});

// Route context for [id] segments — Next.js 15 async params pattern.
type IdCtx = { params?: Promise<{ id: string }> | { id: string } };

async function resolveId(ctx: IdCtx): Promise<string> {
  if (!ctx.params) return '';
  const params = await (ctx.params as Promise<{ id: string }>);
  return params.id ?? '';
}

// GET /api/ra/expert-review/[id] — return single record or 404.
export const GET = withPermission('expertReview.view', async (_req, ctx, _session) => {
  const id = await resolveId(ctx as IdCtx);

  const rows = await db.select().from(expertReviews).where(eq(expertReviews.id, id));

  if (rows.length === 0) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  return Response.json(rows[0]);
});

// PATCH /api/ra/expert-review/[id] — update status via state machine.
// pending → in_progress: requires expertReview.assign permission
// in_progress → resolved: requires expertReview.resolve permission
export const PATCH = async (req: Request, ctx: IdCtx): Promise<Response> => {
  const id = await resolveId(ctx);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { status: targetStatus, assignedTo, resolution } = parsed.data;

  // Fetch current record
  const rows = await db.select().from(expertReviews).where(eq(expertReviews.id, id));

  if (rows.length === 0) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  const current = rows[0];
  if (!current) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  const currentStatus = current.status as string;

  // Validate state machine transition
  const allowed = TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(targetStatus)) {
    return Response.json({ error: 'invalid_transition' }, { status: 422 });
  }

  // Determine required permission: assign for in_progress, resolve for resolved
  const requiredAction =
    targetStatus === 'in_progress' ? 'expertReview.assign' : 'expertReview.resolve';
  const auditAction: AuditAction =
    targetStatus === 'in_progress' ? 'expert_review.assign' : 'expert_review.resolve';

  // Build update payload
  type UpdatePayload = {
    status: 'pending' | 'in_progress' | 'resolved';
    assignedTo?: string;
    notes?: string | null;
    resolvedAt?: Date | null;
  };

  const updateValues: UpdatePayload = { status: targetStatus };

  if (assignedTo !== undefined) {
    updateValues.assignedTo = assignedTo;
  }
  if (resolution !== undefined) {
    updateValues.notes = resolution;
  }
  if (targetStatus === 'resolved') {
    updateValues.resolvedAt = new Date();
  }

  // Guard with the appropriate permission
  const guarded = withPermission(requiredAction, async (_req2, _ctx2, session) => {
    // 21 CFR Part 11 §11.10(e) — Issue #378: UPDATE + audit ride the same
    // db.transaction so a failure between them rolls back both.
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(expertReviews)
        .set(updateValues)
        .where(eq(expertReviews.id, id))
        .returning();

      await writeAudit(
        {
          action: auditAction,
          actor_id: session.user.id,
          resource_type: 'expert_review',
          resource_id: id,
          meta_json: { from: currentStatus, to: targetStatus },
        },
        tx,
      );

      return row;
    });

    return Response.json(updated);
  });

  // Reconstruct ctx with plain params for withPermission (it only uses params for project scope)
  return guarded(req, {});
};

// DELETE /api/ra/expert-review/[id] — always 405.
export const DELETE = async (_req: Request, _ctx: unknown): Promise<Response> => {
  return Response.json(
    { error: 'method_not_allowed' },
    {
      status: 405,
      headers: { Allow: 'GET, PATCH' },
    },
  );
};
