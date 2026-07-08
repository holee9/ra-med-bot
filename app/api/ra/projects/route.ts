// @MX:NOTE [AUTO] GET|POST /api/ra/projects — list and create projects.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-019)

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { writeAudit } from '../../../../lib/audit';
import { withPermission } from '../../../../lib/auth/with-permission';
import { db } from '../../../../lib/db/client';
import { projects } from '../../../../lib/db/schema';

export const GET = withPermission('dashboard.view', async (_req, _ctx, session) => {
  const orgId = session.user.organizationId ?? '';

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      deviceClass: projects.deviceClass,
      status: projects.status,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(eq(projects.organizationId, orgId))
    .orderBy(projects.createdAt);

  return Response.json({ projects: rows });
});

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  deviceClass: z.string().optional(),
  targetMarkets: z.array(z.string()).optional(),
  color: z.string().optional(),
  submissionDate: z.string().optional(),
});

export const POST = withPermission('project.create', async (req, _ctx, session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const orgId = session.user.organizationId ?? '';
  if (!orgId) {
    return Response.json({ error: 'No organization context' }, { status: 400 });
  }

  // 21 CFR Part 11 §11.10(e) — Issue #378: INSERT + audit ride the same
  // db.transaction so a failure between them rolls back both.
  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(projects)
      .values({
        organizationId: orgId,
        name: parsed.data.name,
        deviceClass: parsed.data.deviceClass ?? null,
        targetMarkets: parsed.data.targetMarkets ?? [],
        color: parsed.data.color ?? null,
        submissionDate: parsed.data.submissionDate ?? null,
      })
      .returning();

    if (!row) return null;

    await writeAudit(
      {
        action: 'project.create',
        actor_id: session.user.id,
        resource_type: 'project',
        resource_id: row.id,
        meta_json: { organizationId: orgId },
      },
      tx,
    );

    return row;
  });

  return Response.json({ project: created }, { status: 201 });
});
