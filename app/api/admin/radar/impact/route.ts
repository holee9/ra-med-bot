// POST /api/admin/radar/impact — trigger impact analysis for a regulatory update (admin only).
// @MX:SPEC SPEC-REGULA-IMPACT-001

import { z } from 'zod';
import { withPermission } from '../../../../../lib/auth/with-permission';
import { db } from '../../../../../lib/db/client';
import { analyzeImpact } from '../../../../../lib/domains/impact/analyzer';

const TriggerSchema = z.object({
  regulatory_update_id: z.string().uuid(),
});

export const POST = withPermission('dashboard.view', async (req, _ctx, session) => {
  if (session.user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const orgId = session.user.organizationId;
  if (!orgId) {
    return Response.json({ error: 'Organization context required' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = TriggerSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  let result: Awaited<ReturnType<typeof analyzeImpact>>;
  try {
    result = await analyzeImpact(
      {
        regulatory_update_id: parsed.data.regulatory_update_id,
        org_id: orgId,
        actor_id: session.user.id,
      },
      db,
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      return Response.json({ error: err.message }, { status: 404 });
    }
    return Response.json({ error: String(err) }, { status: 500 });
  }

  return Response.json(result);
});
