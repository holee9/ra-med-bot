// @MX:NOTE [AUTO] Knowledge Sources API — GET list, POST create.
// @MX:SPEC Issue #307 D-2 (Knowledge Sources API)

import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { knowledgeSources } from '@/lib/db/schema';
import { writeAudit } from '@/lib/audit';
import { parseGitUrl } from '@/lib/knowledge-sources/parse-git-url';
import { eq } from 'drizzle-orm';

// GET /api/ra/knowledge-sources — list knowledge sources (org-scoped)
export const GET = withPermission('knowledgesources.view', async (req) => {
  const session = (req as any).session;
  const orgId = session?.user?.organizationId;

  if (!orgId) {
    return Response.json({ error: 'organization_not_found' }, { status: 404 });
  }

  const sources = await db
    .select()
    .from(knowledgeSources)
    .where(eq(knowledgeSources.organizationId, orgId))
    .orderBy(knowledgeSources.createdAt);

  return Response.json({ sources });
});

// POST /api/ra/knowledge-sources — create knowledge source
export const POST = withPermission('knowledgesources.manage', async (req) => {
  const session = (req as any).session;
  const orgId = session?.user?.organizationId;
  const userId = session?.user?.id;

  if (!orgId || !userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { git_url, branch, auth_token } = body;

    // Validate git_url format
    const parsed = parseGitUrl(git_url);
    if (!parsed) {
      return Response.json({ error: 'invalid_git_url' }, { status: 400 });
    }

    // Create knowledge source
    const [source] = await db
      .insert(knowledgeSources)
      .values({
        organizationId: orgId,
        createdBy: userId,
        gitUrl: git_url,
        branch: branch || 'main',
        sourceHost: parsed.host,
        sourceOwner: parsed.owner,
        sourceRepo: parsed.repo,
        authTokenEncrypted: auth_token || null,
        syncStatus: 'pending',
      })
      .returning();

    if (!source) {
      return Response.json({ error: 'failed_to_create_source' }, { status: 500 });
    }

    // Write audit log
    await writeAudit({
      actor_id: userId,
      action: 'knowledge_source.created',
      resource_type: 'knowledgeSource',
      resource_id: source.id,
      meta_json: {
        git_url,
        branch: branch || 'main',
        host: parsed.host,
        owner: parsed.owner,
        repo: parsed.repo,
      },
    });

    return Response.json({ source }, { status: 201 });
  } catch (error) {
    console.error('Failed to create knowledge source:', error);
    return Response.json(
      { error: 'failed_to_create_source', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});
