// @MX:NOTE [AUTO] DELETE /api/ra/knowledge-sources/[id] — delete knowledge source.
// @MX:SPEC Issue #307 D-2 (Knowledge Sources API)

import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { knowledgeSources } from '@/lib/db/schema';
import { writeAudit } from '@/lib/audit';
import { assertKnowledgeSourceInOrg } from '@/lib/knowledge-sources/access';
import { eq } from 'drizzle-orm';

export const DELETE = withPermission('knowledgesources.manage', async (req, ctx, session) => {
  const orgId = session.user.organizationId;
  const userId = session.user.id;

  if (!orgId || !userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Resolve params for Next.js 15 Promise params
  const rawParams = ctx.params;
  const resolvedParams = rawParams && 'then' in rawParams ? await rawParams : rawParams;
  const id = resolvedParams?.id;

  if (!id) {
    return Response.json({ error: 'invalid_id' }, { status: 400 });
  }

  try {
    // IDOR guard: ensure source belongs to org
    await assertKnowledgeSourceInOrg(id, orgId);

    // Delete knowledge source
    await db.delete(knowledgeSources).where(eq(knowledgeSources.id, id));

    // Write audit log
    await writeAudit({
      actor_id: userId,
      action: 'knowledge_source.deleted',
      resource_type: 'knowledgeSource',
      resource_id: id,
      meta_json: {},
    });

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'knowledge_source_not_found') {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'org_mismatch') {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }
    console.error('Failed to delete knowledge source:', error);
    return Response.json(
      { error: 'failed_to_delete_source', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});
