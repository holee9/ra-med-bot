// GET /api/ra/dhf — list DHF records for the org.
// POST /api/ra/dhf — create a new DHF.

// @MX:LEGACY archived from app
// @MX:SPEC SPEC-REGULA-DHF-001

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { designHistoryFiles } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

const CreateDHFSchema = z.object({
  device_name: z.string().min(1).max(255),
  device_model: z.string().max(255).optional(),
  intended_use: z.string().min(10),
  jurisdiction: z.enum(['FDA', 'EU', 'MFDS', 'NMPA', 'PMDA']).default('FDA'),
  regulatory_framework: z.enum(['QSR_QMSR', 'ISO_13485', 'EU_MDR']).default('QSR_QMSR'),
});

export const GET = withPermission('dashboard.view', async (_req, _ctx, session) => {
  const orgId = session.user.organizationId;
  if (!orgId) {
    return Response.json({ error: 'Organization context required' }, { status: 400 });
  }

  const records = await db
    .select()
    .from(designHistoryFiles)
    .where(eq(designHistoryFiles.orgId, orgId))
    .orderBy(desc(designHistoryFiles.createdAt))
    .limit(200);

  return Response.json({ dhfs: records });
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

  const parsed = CreateDHFSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const [created] = await db
    .insert(designHistoryFiles)
    .values({
      orgId,
      deviceName: data.device_name,
      deviceModel: data.device_model ?? null,
      intendedUse: data.intended_use,
      jurisdiction: data.jurisdiction,
      regulatoryFramework: data.regulatory_framework,
      createdBy: session.user.id,
    })
    .returning();

  if (!created) {
    return Response.json({ error: 'Insert failed' }, { status: 500 });
  }

  await writeAudit({
    actor_id: session.user.id,
    action: 'dhf_created',
    resource_type: 'design_history_file',
    resource_id: created.id,
    meta_json: { device_name: data.device_name, jurisdiction: data.jurisdiction },
  });

  return Response.json({ dhf: created }, { status: 201 });
});
