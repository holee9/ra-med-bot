// @MX:NOTE [AUTO] GET /api/ra/authoring/sessions/[sessionId] — BFF proxy to hybrid-ra-saas.
// @MX:SPEC issue #171

import { HybridRaClientError, createHybridRaFetch } from '@/lib/api/hybrid-ra-client';
import { withPermission } from '@/lib/auth/with-permission';
import { NextRequest } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const hybridFetch = createHybridRaFetch();
    const res = await hybridFetch(`/api/v1/authoring/sessions/${sessionId}`, {
      method: 'GET',
    });
    const data = await res.json();
    return Response.json(data, { status: 200 });
  } catch (err) {
    if (err instanceof HybridRaClientError) {
      return Response.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
}
