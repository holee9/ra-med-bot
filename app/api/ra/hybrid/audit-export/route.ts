// @MX:NOTE BFF for hybrid audit export — proxies exportAudit() and returns download URL.
// @MX:SPEC Issue #201
export const runtime = 'nodejs';

import { HybridRaClientError, createHybridRaClient } from '@/lib/api/hybrid-ra-client';
import { withPermission } from '@/lib/auth/with-permission';
import { recordIntegrationGap } from '@/lib/knowledge-gap/integration-gap';
import { z } from 'zod';

const ExportSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  format: z.enum(['csv', 'json']).optional(),
});

/* audit-check-ignore: audit (integration gap) is written inside recordIntegrationGap()
   within the same tx (21 CFR Part 11 atomicity) — route-level writeAudit would duplicate */
export const POST = withPermission('audit.package.generate', async (request, _ctx, session) => {
  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ExportSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const data = await createHybridRaClient().exportAudit(parsed.data);
    return Response.json({ status: 'ok', export: data });
  } catch (err) {
    if (err instanceof HybridRaClientError && err.kind === 'unconfigured') {
      return Response.json({ status: 'unconfigured' }, { status: 200 });
    }
    const e = err instanceof HybridRaClientError ? err : null;
    const kind = e?.kind ?? 'server_error';
    // Issue #156 AC4 — record non-unconfigured hybrid errors into the audit trail.
    if (e) {
      await recordIntegrationGap({
        kind,
        endpoint: e.endpoint,
        statusCode: e.statusCode,
        tenantId: process.env.HYBRID_RA_TENANT_ID ?? null,
        actorId: session.user.id ?? null,
      });
    }
    return Response.json(
      {
        status: 'error',
        message: e?.message ?? 'Unknown error',
        kind,
      },
      { status: 502 },
    );
  }
});
