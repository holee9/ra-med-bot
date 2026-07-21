// @MX:NOTE [AUTO] GET /api/knowledge-promo/search — org-wide conversation + promoted search.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-001, REQ-002, REQ-003, AC-01)
// @MX:REASON searchOrgConversations (fulltext, all messages) and
//           searchPromotedSemantic (pgvector cosine, promoted_answers only).
//           Org scope enforced via withPermission('knowledgepromo.view') +
//           withTenantScope RLS GUC (#239). Cross-org rows never surface.

import { withPermission } from '@/lib/kernel/auth/with-permission';
import {
  type SearchMode,
  searchOrgConversations,
  searchPromotedSemantic,
} from '@/lib/knowledge-promo/semantic-search';

/**
 * GET /api/knowledge-promo/search?q=&mode=fulltext|semantic
 *
 * - mode=fulltext (default): org-scoped conversation fulltext (REQ-001).
 * - mode=semantic: org-scoped promoted_answers cosine (REQ-002, design #2).
 *
 * REQ-003 / AC-01: org isolation is enforced — no foreign-org row is returned.
 */
export const GET = withPermission('knowledgepromo.view', async (req, _ctx, session) => {
  const url = new URL(req.url);
  const query = url.searchParams.get('q') ?? '';
  const mode = (url.searchParams.get('mode') ?? 'fulltext') as SearchMode;
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(Number.parseInt(limitParam, 10) || 20, 1), 50) : 20;

  if (mode !== 'fulltext' && mode !== 'semantic') {
    return Response.json({ error: 'invalid_mode' }, { status: 400 });
  }

  const orgId = session.user.organizationId ?? '';
  if (!orgId) {
    return Response.json({ error: 'no_org_context' }, { status: 403 });
  }

  if (mode === 'semantic') {
    const promoted = await searchPromotedSemantic({ orgId, query, mode, limit });
    return Response.json({ mode: 'semantic', promoted, conversations: [] });
  }

  const conversations = await searchOrgConversations({ orgId, query, mode, limit });
  return Response.json({ mode: 'fulltext', conversations, promoted: [] });
});
