// @MX:NOTE [AUTO] GET /api/cyberdevice/sbom/diff — diff two SBOM versions (REQ-004, AC-01).
// @MX:SPEC SPEC-REGULA-CYBERDEVICE-001 (REQ-004, AC-01)

import { withPermission } from '@/lib/auth/with-permission';
import { auditSbomDiffed } from '@/lib/cyberdevice/audit';
import { diffSbomVersions } from '@/lib/cyberdevice/sbom-diff';
import type { SbomComponent } from '@/lib/cyberdevice/types';
import { withTenantScope } from '@/lib/db/client';
import { sbom } from '@/lib/db/schema';
import { assertPmsProjectAccess } from '@/lib/pms/project-ownership';
import { and, eq } from 'drizzle-orm';

export const GET = withPermission('cyberdevice.view', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');
  const versionA = url.searchParams.get('versionA');
  const versionB = url.searchParams.get('versionB');
  if (!projectId || !versionA || !versionB) {
    return Response.json(
      { error: 'projectId, versionA, versionB query params required' },
      { status: 400 },
    );
  }

  const denied = await assertPmsProjectAccess(projectId, organizationId);
  if (denied) return denied;

  // #239 Phase 2: withTenantScope sets app.current_org_id GUC for RLS enforce.
  const rows = await withTenantScope(organizationId, async (dbs) =>
    dbs
      .select({ version: sbom.version, components: sbom.components })
      .from(sbom)
      .where(and(eq(sbom.projectId, projectId), eq(sbom.orgId, organizationId))),
  );
  const a = rows.find((r) => r.version === versionA);
  const b = rows.find((r) => r.version === versionB);
  if (!a || !b) {
    return Response.json({ error: 'sbom_version_not_found' }, { status: 404 });
  }

  const diff = diffSbomVersions(
    (a.components as SbomComponent[]) ?? [],
    (b.components as SbomComponent[]) ?? [],
  );

  // REQ-004 audit — read-only diff, but the action itself is regulated evidence.
  await auditSbomDiffed({
    userId: session.user.id,
    projectId,
    versionA,
    versionB,
    added: diff.added.length,
    removed: diff.removed.length,
    updated: diff.updated.length,
  });

  return Response.json(diff);
});
