// @MX:NOTE BFF for hybrid audit health — proxies health() to hide internal endpoint.
// @MX:SPEC Issue #201
export const runtime = 'nodejs';

import { HybridRaClientError, createHybridRaClient } from '@/lib/api/hybrid-ra-client';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { recordIntegrationGap } from '@/lib/knowledge-gap/integration-gap';

export const GET = withPermission('audit.read', async (_req, _ctx, session) => {
  try {
    const data = await createHybridRaClient().health();
    return Response.json({ status: 'ok', health: data });
  } catch (err) {
    if (err instanceof HybridRaClientError && err.kind === 'unconfigured') {
      return Response.json({ status: 'unconfigured' });
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
