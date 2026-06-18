// @MX:NOTE [AUTO] GET|PATCH /api/ra/projects/:id — single project fetch and update.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-019)
// NOTE: GET uses 'project.manage' for project membership enforcement. Both GET and PATCH
// now properly resolve Next.js 15 Promise params for project-scoped RBAC validation.

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { writeAudit } from '../../../../../lib/audit';
import { withPermission } from '../../../../../lib/auth/with-permission';
import { db } from '../../../../../lib/db/client';
import { projects } from '../../../../../lib/db/schema';

async function resolveId(ctx: unknown): Promise<string> {
  const raw = (ctx as { params?: unknown }).params;
  const p = raw instanceof Promise ? await raw : raw;
  return (p as { id?: string })?.id ?? '';
}

export const GET = withPermission('project.manage', async (_req, ctx) => {
  const id = await resolveId(ctx);
  if (!id) return new Response('Missing id', { status: 400 });

  const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);

  if (!row) return new Response('Not Found', { status: 404 });

  return Response.json({ project: row });
});

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  deviceClass: z.string().optional(),
  color: z.string().optional(),
  status: z.string().optional(),
  submissionDate: z.string().optional(),
});

export const PATCH = withPermission('project.manage', async (req, ctx, session) => {
  const id = await resolveId(ctx);
  if (!id) return new Response('Missing id', { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = UpdateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!existing) return new Response('Not Found', { status: 404 });

  const [updated] = await db
    .update(projects)
    .set({
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.deviceClass !== undefined && { deviceClass: parsed.data.deviceClass }),
      ...(parsed.data.color !== undefined && { color: parsed.data.color }),
      ...(parsed.data.status !== undefined && { status: parsed.data.status }),
      ...(parsed.data.submissionDate !== undefined && {
        submissionDate: parsed.data.submissionDate,
      }),
    })
    .where(eq(projects.id, id))
    .returning();
  await writeAudit({
    action: 'project.update',
    actor_id: session.user.id,
    resource_type: 'project',
    resource_id: id,
    meta_json: { fields: Object.keys(parsed.data).sort() },
  });

  return Response.json({ project: updated });
});
