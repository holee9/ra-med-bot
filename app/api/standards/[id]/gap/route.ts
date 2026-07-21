// @MX:NOTE [AUTO] GET /api/standards/[id]/gap — gap analysis for a standard (Issue #62).
// @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-STANDARDS-013/014)
// @MX:REASON Identifies products linked to this standard and their compliance
//   state. Detailed revision-diff summarization is deferred to #62-F; today the
//   endpoint returns the product list + pendingReview subset (count + metadata).

import { withPermission } from '@/lib/kernel/auth/with-permission';
import { identifyAffectedProducts } from '@/lib/standards/impact-analyzer';

// GET /api/standards/[id]/gap — products affected + compliance state.
export const GET = withPermission('standards.read', async (_req, ctx, session) => {
  const params =
    typeof ctx.params === 'object' && ctx.params !== null
      ? await ctx.params
      : ({} as Record<string, string>);
  const standardId = params.id;
  if (!standardId) {
    return Response.json({ error: 'missing_standard_id' }, { status: 400 });
  }

  const orgId = session.user.organizationId ?? '';
  if (!orgId) return Response.json({ error: 'no_org_context' }, { status: 403 });

  const result = await identifyAffectedProducts(standardId, orgId);

  return Response.json({
    standardId: result.standardId,
    standardNumber: result.standardNumber,
    affectedCount: result.affected.length,
    pendingReviewCount: result.pendingReview.length,
    affected: result.affected,
    pendingReview: result.pendingReview,
    // @MX:TODO #62-F — LLM-summarized revision-diff gap report (REQ-014).
    summary: `${result.pendingReview.length} of ${result.affected.length} linked products need RA review.`,
  });
});
