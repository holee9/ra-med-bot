// @MX:NOTE [AUTO] POST /api/ra/knowledge-sources/[id]/sync — trigger manual sync.
// @MX:SPEC Issue #307 D-2 (Knowledge Sources API)

import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { knowledgeSources } from '@/lib/db/schema';
import { assertKnowledgeSourceInOrg } from '@/lib/knowledge-sources/access';
import { syncKnowledgeSource } from '@/lib/knowledge-sources/sync';
import { eq } from 'drizzle-orm';

export const POST = withPermission('knowledgesources.manage', async (req, ctx, session) => {
  const orgId = session.user.organizationId;

  if (!orgId) {
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

    // Fetch source record
    const [source] = await db
      .select()
      .from(knowledgeSources)
      .where(eq(knowledgeSources.id, id))
      .limit(1);

    if (!source) {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }

    // Trigger sync (runs synchronously for now; can be made async via Inngest)
    await syncKnowledgeSource({
      id: source.id,
      gitUrl: source.gitUrl,
      branch: source.branch,
      auth_token: source.authTokenEncrypted,
      orgId: source.organizationId,
    });

    return Response.json({ success: true, message: 'Sync completed' });
  } catch (error) {
    if (error instanceof Error && error.message === 'knowledge_source_not_found') {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'org_mismatch') {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }
    console.error('Failed to sync knowledge source:', error);
    return Response.json(
      { error: 'sync_failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});
