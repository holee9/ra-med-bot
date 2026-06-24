// @MX:NOTE [AUTO] POST /api/cyberdevice/threat-model — generate threat model (REQ-001/002/008).
// @MX:SPEC SPEC-REGULA-CYBERDEVICE-001 (REQ-001, REQ-002, REQ-008, AC-06)

import { withPermission } from '@/lib/auth/with-permission';
import { auditThreatModeled } from '@/lib/cyberdevice/audit';
import { mapThreatsToGspr } from '@/lib/cyberdevice/gspr-mapping';
import { generateThreatModel } from '@/lib/cyberdevice/threat-model-generator';
import { architectureInputSchema } from '@/lib/cyberdevice/types';
import { db } from '@/lib/db/client';
import { threatModel } from '@/lib/db/schema';
import { assertPmsProjectAccess } from '@/lib/pms/project-ownership';
import { eq } from 'drizzle-orm';

export const POST = withPermission('cyberdevice.manage', async (req, _ctx, session) => {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const body = (await req.json()) as { projectId: string; architecture: unknown };
  if (!body?.projectId || typeof body.projectId !== 'string') {
    return Response.json({ error: 'projectId required' }, { status: 400 });
  }

  const archResult = architectureInputSchema.safeParse(body.architecture);
  if (!archResult.success) {
    return Response.json(
      { error: 'invalid_architecture', issues: archResult.error.issues },
      { status: 400 },
    );
  }

  // IDOR: project must belong to the caller's org.
  const denied = await assertPmsProjectAccess(body.projectId, organizationId);
  if (denied) return denied;

  const architecture = archResult.data;
  const { threats } = generateThreatModel(architecture);
  const gsprMapping = mapThreatsToGspr(threats);

  let threatModelId = '';
  try {
    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(threatModel)
        .values({
          orgId: organizationId,
          projectId: body.projectId,
          architectureInput: architecture,
          threats,
          gsprMapping,
          createdBy: session.user.id,
        })
        .returning({ id: threatModel.id });
      if (!created) throw new Error('threat_model_insert_failed');
      threatModelId = created.id;
      await auditThreatModeled(
        {
          userId: session.user.id,
          threatModelId,
          projectId: body.projectId,
          threatCount: threats.length,
        },
        tx,
      );
    });
  } catch (err) {
    console.error('[cyberdevice.threat-model] insert failed', err);
    return Response.json({ error: 'persist_failed' }, { status: 500 });
  }

  return Response.json(
    { threatModelId, threatCount: threats.length, threats, gsprMapping },
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

  const rows = await db.select().from(threatModel).where(eq(threatModel.projectId, projectId));
  return Response.json({ items: rows });
});
