// @MX:NOTE BFF proxy for hybrid-ra-saas sync manifest — GET /api/ra/hybrid/sync-status
// @MX:SPEC Issue #199 (Hybrid RA IFU parse result & knowledge sync UX)
// Degrades gracefully: unconfigured env returns { status: 'unconfigured' } (not an error).

export const runtime = 'nodejs';

import { HybridRaClientError, createHybridRaClient } from '@/lib/api/hybrid-ra-client';
import { withPermission } from '@/lib/auth/with-permission';
import { recordIntegrationGap } from '@/lib/knowledge-gap/integration-gap';

export const GET = withPermission('dashboard.view', async (_req, _ctx, session) => {
  try {
    const data = await createHybridRaClient().syncManifest();
    return Response.json({ status: 'ok', sync: data });
  } catch (err) {
    if (err instanceof HybridRaClientError && err.kind === 'unconfigured') {
      return Response.json({ status: 'unconfigured' });
    }
    const e = err instanceof HybridRaClientError ? err : null;
    const kind = e?.kind ?? 'server_error';
    // Issue #156 AC4 — record non-unconfigured hybrid errors into the audit trail.
    // Best-effort; failures are swallowed inside the recorder.
    if (e) {
      await recordIntegrationGap({
        kind,
        endpoint: e.endpoint,
        statusCode: e.statusCode,
        tenantId: process.env.HYBRID_RA_TENANT_ID ?? null,
        actorId: session.user.id ?? null,
      });
    }
    return Response.json({
      status: 'error',
      message: e?.message ?? 'Unknown error',
      kind,
    });
  }
});
