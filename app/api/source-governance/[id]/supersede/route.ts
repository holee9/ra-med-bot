// @MX:NOTE [AUTO] POST /api/source-governance/[id]/supersede — mark a source superseded by another.
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48, REQ-SOURCE-GOV-005/006, AC-02)
// @MX:REASON Live call site for markSuperseded (was ZERO call sites — REQ-005/006
//   inert, superseded_by column always NULL). Without this route the retrieval-gate
//   supersession exclusion reads a column that is never written, so superseded
//   sources can never be excluded. RBAC sourcegov.manage + IDOR via getSourceInOrg
//   (null → 404, no cross-org existence leak). Audit source.superseded inside the
//   same transaction (21 CFR Part 11 atomicity — H2).

import { withPermission } from '@/lib/auth/with-permission';
import { markSuperseded } from '@/lib/source-governance/review-workflow';
import { supersedeRequestSchema } from '@/lib/source-governance/types';

async function resolveRouteId(ctx: {
  params?: Record<string, string | string[]> | Promise<Record<string, string | string[]>>;
}): Promise<string> {
  const params = ctx.params && 'then' in ctx.params ? await ctx.params : (ctx.params ?? {});
  const raw = (params as Record<string, string | string[]>).id;
  return Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
}

export const POST = withPermission('sourcegov.manage', async (req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }
  const sourceId = await resolveRouteId(ctx);
  if (!sourceId) {
    return Response.json({ error: 'source_id_required' }, { status: 400 });
  }

  const parsed = supersedeRequestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await markSuperseded({
    sourceId,
    supersededBy: parsed.data.supersededBy,
    orgId: organizationId,
    userId: session.user.id,
  });

  // IDOR: null → 404 (never reveal cross-org existence).
  if (!result) {
    return Response.json({ error: 'source_not_found' }, { status: 404 });
  }

  // M-1: self-cycle (sourceId === supersededBy) or successor not in org.
  if (!result.ok) {
    return Response.json(
      { error: 'invalid_supersede', reason: 'self_cycle_or_successor_not_in_org' },
      { status: 400 },
    );
  }

  return Response.json(result, { status: 200 });
});
