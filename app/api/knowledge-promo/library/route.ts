// @MX:NOTE [AUTO] GET /api/knowledge-promo/library — team knowledge library listing.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-008, REQ-012, REQ-015, AC-06)
// @MX:REASON Returns status='active' promoted answers for the caller's org.
//           Optional tag filter via `?tag=foo&tag=bar` (AND semantics). Org
//           scope enforced via withPermission('knowledgepromo.view') +
//           withTenantScope RLS GUC (#239).

import { withPermission } from '@/lib/kernel/auth/with-permission';
import { listLibrary } from '@/lib/knowledge-promo/library';

export const GET = withPermission('knowledgepromo.view', async (req, _ctx, session) => {
  const url = new URL(req.url);
  const tags = url.searchParams.getAll('tag');
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(Number.parseInt(limitParam, 10) || 50, 1), 200) : 50;

  const orgId = session.user.organizationId ?? '';
  if (!orgId) {
    return Response.json({ error: 'no_org_context' }, { status: 403 });
  }

  const entries = await listLibrary({ orgId, tags: tags.length > 0 ? tags : undefined, limit });
  return Response.json({ entries });
});
