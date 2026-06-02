// @MX:NOTE [AUTO] PUT /api/ra/predicate/comparison/:id/approve — approve a single
//   comparison cell (per-dimension, per-predicate user approval).
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-016, REQ-PRE-029)
//
// REQ-PRE-016: comparison suggestions require explicit user approval. This route
// flips approved[predicate_index] = true for the given dimension and persists
// the updated comparison back into workflow_runs.resultJson.

// REQ-PRE-029: nodejs runtime required — department lookup uses the pg driver.
export const runtime = 'nodejs';

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { canManageComparisons } from '@/lib/auth/predicate-permissions';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { users, workflowRuns } from '@/lib/db/schema';
import type { PredicateComparison } from '@/lib/predicate/types';

const ApproveSchema = z.object({
  dimension: z.enum([
    'intended_use',
    'indications',
    'tech_characteristics',
    'materials',
    'performance',
  ]),
  predicate_index: z.number().int().nonnegative(),
});

/** Resolve the dynamic `[id]` segment from the route context (Next 15 async). */
async function resolveId(ctx: unknown): Promise<string> {
  const raw = (ctx as { params?: unknown }).params;
  const p = raw instanceof Promise ? await raw : raw;
  return (p as { id?: string })?.id ?? '';
}

/** Fetch the caller's department; null when unset or the user row is missing. */
async function getDepartment(userId: string): Promise<string | null> {
  const rows = await db
    .select({ department: users.department })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.department ?? null;
}

export const PUT = withPermission('workflow.execute', async (req, ctx, session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ApproveSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { dimension, predicate_index } = parsed.data;

  // Department RBAC (REQ-PRE-029): only RA/Dev may approve.
  const department = await getDepartment(session.user.id);
  if (!canManageComparisons(department)) {
    return Response.json({ error: 'permission_denied', reason: 'department' }, { status: 403 });
  }

  const id = await resolveId(ctx);
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  const [row] = await db
    .select({ id: workflowRuns.id, resultJson: workflowRuns.resultJson })
    .from(workflowRuns)
    .where(eq(workflowRuns.id, id))
    .limit(1);

  if (!row || !row.resultJson) {
    return Response.json({ error: 'Not Found' }, { status: 404 });
  }

  const comparison = row.resultJson as PredicateComparison & {
    selected_predicate_knumbers?: string[];
  };
  const cell = comparison.cells.find((c) => c.dimension === dimension);
  if (!cell) {
    return Response.json({ error: 'Dimension not found in comparison' }, { status: 400 });
  }

  // Approve the targeted predicate cell, extending the array if needed.
  cell.approved = cell.approved.slice();
  cell.approved[predicate_index] = true;

  await db
    .update(workflowRuns)
    .set({ resultJson: comparison, updatedAt: new Date() })
    .where(eq(workflowRuns.id, id))
    .returning();

  return Response.json({ comparison });
});
