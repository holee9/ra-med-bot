// @MX:NOTE BFF for hybrid audit health — proxies health() to hide internal endpoint.
// @MX:SPEC Issue #201
export const runtime = 'nodejs';

import { HybridRaClientError, createHybridRaClient } from '@/lib/api/hybrid-ra-client';

export async function GET() {
  try {
    const data = await createHybridRaClient().health();
    return Response.json({ status: 'ok', health: data });
  } catch (err) {
    if (err instanceof HybridRaClientError && err.kind === 'unconfigured') {
      return Response.json({ status: 'unconfigured' });
    }
    const e = err instanceof HybridRaClientError ? err : null;
    return Response.json(
      {
        status: 'error',
        message: e?.message ?? 'Unknown error',
        kind: e?.kind ?? 'server_error',
      },
      { status: 502 },
    );
  }
}
