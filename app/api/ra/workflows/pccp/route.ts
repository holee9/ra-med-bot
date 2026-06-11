// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-001, REQ-PCCP-021)
import { withPermission } from '@/lib/auth/with-permission';
import type { AuthSession } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { pccpVersions } from '@/lib/db/schema';
import { auditPccpCreated } from '@/lib/pccp/audit-wiring';
import { buildBaselineSnapshot } from '@/lib/pccp/baseline-snapshot';
import { getActivePccpVersion } from '@/lib/pccp/version-manager';
import { PccpInputSchema } from '@/lib/workflows/types';

async function postCreatePccp(request: Request, session: AuthSession): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid input', details: {} }, { status: 400 });
  }

  const result = PccpInputSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: 'Invalid input', details: result.error.format() },
      { status: 400 },
    );
  }

  const data = result.data;

  // AC-9: at most one active PCCP per device
  const existing = await getActivePccpVersion(data.device_id);
  if (existing) {
    return Response.json(
      {
        error: 'Conflict',
        details: `Device already has an active PCCP (id: ${existing.id}). Supersede it before creating a new version.`,
      },
      { status: 409 },
    );
  }

  const snapshot = buildBaselineSnapshot({
    deviceId: data.device_id,
    deviceName: data.device_name,
    manufacturer: data.manufacturer,
    indication: data.indication ?? null,
  });

  const [created] = await db
    .insert(pccpVersions)
    .values({
      deviceId: data.device_id,
      deviceName: data.device_name,
      manufacturer: data.manufacturer,
      indication: data.indication,
      version: data.version,
      createdBy: session.user.id,
      baselineSnapshotJsonb: snapshot,
    })
    .returning();

  await auditPccpCreated({
    actorId: session.user.id,
    pccpVersionId: created.id,
    deviceId: data.device_id,
    deviceName: data.device_name,
  });

  return Response.json(
    {
      id: created.id,
      deviceId: created.deviceId,
      deviceName: created.deviceName,
      version: created.version,
      status: created.status,
      createdAt: created.createdAt,
    },
    { status: 201 },
  );
}

export const POST = withPermission('consult.create', async (request, _ctx, session) =>
  postCreatePccp(request, session),
);
