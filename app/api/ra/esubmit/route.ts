// GET /api/ra/esubmit — list submission packages for the org.
// POST /api/ra/esubmit — create a new submission package.
// @MX:SPEC SPEC-REGULA-ESUBMIT-001

import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { submissionPackages } from '@/lib/db/schema';
import { writeAudit } from '@/lib/audit';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const CreatePackageSchema = z.object({
  submission_type: z.enum(['510k', 'de_novo', 'pma', 'cer', 'pccp', 'mfds_import', 'nmpa_ecdt']),
  jurisdiction: z.enum(['FDA', 'EU', 'MFDS', 'NMPA', 'PMDA']),
  device_name: z.string().min(1).max(255),
  submission_number: z.string().max(100).optional(),
  version: z.string().max(20).default('1.0'),
});

export const GET = withPermission('dashboard.view', async (_req, _ctx, session) => {
  const orgId = session.user.organizationId;
  if (!orgId) {
    return Response.json({ error: 'Organization context required' }, { status: 400 });
  }

  const records = await db
    .select()
    .from(submissionPackages)
    .where(eq(submissionPackages.orgId, orgId))
    .orderBy(desc(submissionPackages.createdAt))
    .limit(200);

  return Response.json({ packages: records });
});

export const POST = withPermission('dashboard.view', async (req, _ctx, session) => {
  const orgId = session.user.organizationId;
  if (!orgId) {
    return Response.json({ error: 'Organization context required' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = CreatePackageSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const [created] = await db
    .insert(submissionPackages)
    .values({
      orgId,
      submissionType: data.submission_type,
      jurisdiction: data.jurisdiction,
      deviceName: data.device_name,
      submissionNumber: data.submission_number ?? null,
      version: data.version,
      createdBy: session.user.id,
    })
    .returning();

  if (!created) {
    return Response.json({ error: 'Insert failed' }, { status: 500 });
  }

  await writeAudit({
    actor_id: session.user.id,
    action: 'submission_package_created',
    resource_type: 'submission_package',
    resource_id: created.id,
    meta_json: {
      submission_type: data.submission_type,
      jurisdiction: data.jurisdiction,
      device_name: data.device_name,
    },
  });

  return Response.json({ package: created }, { status: 201 });
});
