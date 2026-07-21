// @MX:NOTE [AUTO] PATCH /api/source-governance/[id] — set governance fields on a source.
// @MX:SPEC SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48, REQ-SOURCE-GOV-004/008)
// @MX:REASON Live call site for updateGovernanceFields + auditSourceGovernanceUpdated
//   (both were DEAD — authorityGrade had NO setter, so every source was null-grade
//   making assessLowAuthority/REQ-008 meaningless). RBAC sourcegov.manage + IDOR via
//   getSourceInOrg (null → 404). Audit source.governance_updated inside the same
//   transaction as the UPDATE (21 CFR Part 11 atomicity — H2).

import { withPermission } from '@/lib/kernel/auth/with-permission';
import { updateGovernanceFields } from '@/lib/source-governance/review-workflow';
import { updateGovernanceRequestSchema } from '@/lib/source-governance/types';

async function resolveRouteId(ctx: {
  params?: Record<string, string | string[]> | Promise<Record<string, string | string[]>>;
}): Promise<string> {
  const params = ctx.params && 'then' in ctx.params ? await ctx.params : (ctx.params ?? {});
  const raw = (params as Record<string, string | string[]>).id;
  return Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
}

/* audit-check-ignore: audit (source.governance_updated) is written inside
   updateGovernanceFields() within the same tx (21 CFR Part 11 atomicity) —
   route-level writeAudit would duplicate */
export const PATCH = withPermission('sourcegov.manage', async (req, ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }
  const sourceId = await resolveRouteId(ctx);
  if (!sourceId) {
    return Response.json({ error: 'source_id_required' }, { status: 400 });
  }

  const parsed = updateGovernanceRequestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await updateGovernanceFields({
    sourceId,
    orgId: organizationId,
    userId: session.user.id,
    fields: parsed.data,
  });

  // IDOR: null → 404 (never reveal cross-org existence).
  if (!result) {
    return Response.json({ error: 'source_not_found' }, { status: 404 });
  }

  return Response.json(result, { status: 200 });
});
