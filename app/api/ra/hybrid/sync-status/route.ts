// @MX:NOTE BFF proxy for hybrid-ra-saas sync manifest — GET /api/ra/hybrid/sync-status
// @MX:SPEC Issue #199 (Hybrid RA IFU parse result & knowledge sync UX)
// Degrades gracefully: unconfigured env returns { status: 'unconfigured' } (not an error).

export const runtime = 'nodejs';

import { HybridRaClientError, createHybridRaClient } from '@/lib/api/hybrid-ra-client';
import { withPermission } from '@/lib/auth/with-permission';

export const GET = withPermission('dashboard.view', async () => {
  try {
    const data = await createHybridRaClient().syncManifest();
    return Response.json({ status: 'ok', sync: data });
  } catch (err) {
    if (err instanceof HybridRaClientError && err.kind === 'unconfigured') {
      return Response.json({ status: 'unconfigured' });
    }
    const e = err instanceof HybridRaClientError ? err : null;
    return Response.json({
      status: 'error',
      message: e?.message ?? 'Unknown error',
      kind: e?.kind ?? 'server_error',
    });
  }
});
