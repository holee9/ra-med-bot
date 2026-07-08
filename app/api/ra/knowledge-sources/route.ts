// @MX:NOTE [AUTO] Knowledge Sources API — GET list, POST create.
// @MX:SPEC Issue #307 D-2 (Knowledge Sources API)
// @MX:NOTE [AUTO] handler 3인자 (req, ctx, session) — capa 패턴 준수 (InnerHandler 시그니처).

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { knowledgeSources } from '@/lib/db/schema';
import { parseGitUrl } from '@/lib/knowledge-sources/parse-git-url';
import { eq } from 'drizzle-orm';

// GET /api/ra/knowledge-sources — list knowledge sources (org-scoped)
export const GET = withPermission('knowledgesources.view', async (_req, _ctx, session) => {
  const orgId = session.user.organizationId;

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
export const POST = withPermission('knowledgesources.manage', async (req, _ctx, session) => {
  const orgId = session.user.organizationId;
  const userId = session.user.id;

  if (!orgId || !userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { git_url, branch, auth_token } = body;

    // Validate git_url format (SSRF 1차 방어 — 상세 검증은 sync.ts cloneRepo)
    const parsed = parseGitUrl(git_url);
    if (!parsed) {
      return Response.json({ error: 'invalid_git_url' }, { status: 400 });
    }

    // 21 CFR Part 11 §11.10(e) — Issue #378: INSERT + audit ride the same
    // db.transaction so a failure between them rolls back both.
    const source = await db.transaction(async (tx) => {
      // Create knowledge source — syncStatus 'idle' (migration CHECK: idle/syncing/synced/failed)
      const [row] = await tx
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
          syncStatus: 'idle',
        })
        .returning();

      if (!row) return null;

      await writeAudit(
        {
          actor_id: userId,
          action: 'knowledge_source.created',
          resource_type: 'knowledgeSource',
          resource_id: row.id,
          meta_json: {
            git_url,
            branch: branch || 'main',
            host: parsed.host,
            owner: parsed.owner,
            repo: parsed.repo,
          },
        },
        tx,
      );

      return row;
    });

    if (!source) {
      return Response.json({ error: 'failed_to_create_source' }, { status: 500 });
    }

    return Response.json({ source }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error: 'failed_to_create_source',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
