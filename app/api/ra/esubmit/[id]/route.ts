// GET /api/ra/esubmit/[id] — fetch a single submission package with interactions.
// PATCH /api/ra/esubmit/[id] — update package fields (manifest, status, etc.).
// @MX:SPEC SPEC-REGULA-ESUBMIT-001

import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { submissionPackages, submissionInteractions } from '@/lib/db/schema';
import { writeAudit } from '@/lib/audit';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const PatchPackageSchema = z.object({
  device_name: z.string().min(1).max(255).optional(),
  submission_number: z.string().max(100).nullable().optional(),
  version: z.string().max(20).optional(),
  status: z
    .enum(['draft', 'validating', 'validated', 'submitted', 'rta', 'accepted', 'rejected'])
    .optional(),
  package_manifest: z.record(z.unknown()).optional(),
  submitted_at: z.string().datetime().nullable().optional(),
});

export const GET = withPermission('dashboard.view', async (_req, ctx, session) => {
  const orgId = session.user.organizationId;
  if (!orgId) {
    return Response.json({ error: 'Organization context required' }, { status: 400 });
  }

  const params = ctx.params ? await ctx.params : {};
  const id = (params as { id?: string }).id;
  if (!id) {
    return Response.json({ error: 'Missing package ID' }, { status: 400 });
  }

  const [pkg] = await db
    .select()
    .from(submissionPackages)
    .where(and(eq(submissionPackages.id, id), eq(submissionPackages.orgId, orgId)))
    .limit(1);

  if (!pkg) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const interactions = await db
    .select()
    .from(submissionInteractions)
    .where(eq(submissionInteractions.packageId, id));

  return Response.json({ package: pkg, interactions });
});

export const PATCH = withPermission('dashboard.view', async (req, ctx, session) => {
  const orgId = session.user.organizationId;
  if (!orgId) {
    return Response.json({ error: 'Organization context required' }, { status: 400 });
  }

  const params = ctx.params ? await ctx.params : {};
  const id = (params as { id?: string }).id;
  if (!id) {
    return Response.json({ error: 'Missing package ID' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PatchPackageSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Verify ownership
  const [existing] = await db
    .select({ id: submissionPackages.id })
    .from(submissionPackages)
    .where(and(eq(submissionPackages.id, id), eq(submissionPackages.orgId, orgId)))
    .limit(1);

  if (!existing) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };
  if (data.device_name !== undefined) updateValues.deviceName = data.device_name;
  if (data.submission_number !== undefined) updateValues.submissionNumber = data.submission_number;
  if (data.version !== undefined) updateValues.version = data.version;
  if (data.status !== undefined) updateValues.status = data.status;
  if (data.package_manifest !== undefined) updateValues.packageManifest = data.package_manifest;
  if (data.submitted_at !== undefined) {
    updateValues.submittedAt = data.submitted_at ? new Date(data.submitted_at) : null;
  }

  const [updated] = await db
    .update(submissionPackages)
    .set(updateValues)
    .where(eq(submissionPackages.id, id))
    .returning();

  // Audit submission event
  if (data.status === 'submitted') {
    await writeAudit({
      actor_id: session.user.id,
      action: 'submission_package_submitted',
      resource_type: 'submission_package',
      resource_id: id,
      meta_json: { status: 'submitted' },
    });
  }

  return Response.json({ package: updated });
});
