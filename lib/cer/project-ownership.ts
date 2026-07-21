// @MX:ANCHOR [AUTO] assertPmsProjectAccess — tenant guard for PMS mutations.
// @MX:REASON PMS routes accept projectId in JSON bodies, so withPermission()
//           cannot enforce project ownership from route params. Every PMS
//           mutation must prove projects.organization_id before writing.
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-010)

import { db } from '@/lib/kernel/db/client';
import { projects } from '@/lib/kernel/db/schema';
import { and, eq } from 'drizzle-orm';

type ProjectAccessDb = {
  select: (fields?: unknown) => {
    from: (table: unknown) => {
      where: (condition: unknown) => {
        limit: (n: number) => Promise<Array<{ id?: string }>>;
      };
    };
  };
};

export async function pmsProjectBelongsToOrg(
  projectId: string,
  organizationId: string,
  dbClient: ProjectAccessDb = db as unknown as ProjectAccessDb,
): Promise<boolean> {
  try {
    const rows = await dbClient
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function assertPmsProjectAccess(
  projectId: string,
  organizationId: string,
): Promise<Response | null> {
  const allowed = await pmsProjectBelongsToOrg(projectId, organizationId);
  if (allowed) return null;
  return Response.json({ error: 'Project not found' }, { status: 404 });
}
