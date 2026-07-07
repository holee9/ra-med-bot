// @MX:NOTE [AUTO] POST/GET /api/cyberdevice/sbom — import/list SBOM (REQ-003).
// @MX:SPEC SPEC-REGULA-CYBERDEVICE-001 (REQ-003, AC-01)

// @MX:LEGACY archived from app

import { withPermission } from '@/lib/auth/with-permission';
import { auditSbomImported, auditSbomValidated } from '@/lib/cyberdevice/audit';
import { SbomParseError, parseSbom } from '@/lib/cyberdevice/sbom-parser';
import { sbomImportInputSchema } from '@/lib/cyberdevice/types';
import { withTenantScope } from '@/lib/db/client';
import { sbom } from '@/lib/db/schema';
import { assertPmsProjectAccess } from '@/lib/pms/project-ownership';
import { and, desc, eq } from 'drizzle-orm';

export const POST = withPermission('cyberdevice.manage', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const parsed = sbomImportInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const denied = await assertPmsProjectAccess(body.projectId, organizationId);
  if (denied) return denied;

  let parsedSbom: ReturnType<typeof parseSbom>;
  try {
    parsedSbom = parseSbom(body.format, body.rawDocument);
  } catch (err) {
    if (err instanceof SbomParseError) {
      return Response.json({ error: 'sbom_parse_failed', code: err.code }, { status: 400 });
    }
    throw err;
  }

  let sbomId = '';
  try {
    // #239 Phase 2: withTenantScope sets app.current_org_id GUC for RLS enforce.
    await withTenantScope(organizationId, async (tx) => {
      const [created] = await tx
        .insert(sbom)
        .values({
          orgId: organizationId,
          projectId: body.projectId,
          format: body.format,
          version: body.version,
          components: parsedSbom.components,
          validated: true,
          contentHash: parsedSbom.contentHash,
          createdBy: session.user.id,
        })
        .returning({ id: sbom.id });
      if (!created) throw new Error('sbom_insert_failed');
      sbomId = created.id;
      await auditSbomImported(
        {
          userId: session.user.id,
          sbomId,
          projectId: body.projectId,
          format: body.format,
          version: body.version,
          componentCount: parsedSbom.components.length,
        },
        tx,
      );
      await auditSbomValidated(
        {
          userId: session.user.id,
          sbomId,
          projectId: body.projectId,
          validated: true,
          componentCount: parsedSbom.components.length,
        },
        tx,
      );
    });
  } catch (err) {
    console.error('[cyberdevice.sbom] insert failed', err);
    return Response.json({ error: 'persist_failed' }, { status: 500 });
  }

  return Response.json(
    {
      sbomId,
      format: body.format,
      version: body.version,
      componentCount: parsedSbom.components.length,
      contentHash: parsedSbom.contentHash,
    },
    { status: 201 },
  );
});

export const GET = withPermission('cyberdevice.view', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');
  if (!projectId) {
    return Response.json({ error: 'projectId query param required' }, { status: 400 });
  }
  const denied = await assertPmsProjectAccess(projectId, organizationId);
  if (denied) return denied;

  // #239 Phase 2: withTenantScope sets app.current_org_id GUC for RLS enforce.
  const rows = await withTenantScope(organizationId, async (dbs) =>
    dbs
      .select({
        id: sbom.id,
        format: sbom.format,
        version: sbom.version,
        componentCount: sbom.components,
        validated: sbom.validated,
        contentHash: sbom.contentHash,
        createdAt: sbom.createdAt,
      })
      .from(sbom)
      .where(and(eq(sbom.projectId, projectId), eq(sbom.orgId, organizationId)))
      .orderBy(desc(sbom.createdAt)),
  );
  // componentCount is jsonb; surface length without sending full payload in list view.
  const items = rows.map((r) => ({
    ...r,
    componentCount: Array.isArray(r.componentCount) ? r.componentCount.length : 0,
  }));
  return Response.json({ items });
});
