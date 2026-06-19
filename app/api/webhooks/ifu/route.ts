// @MX:ANCHOR [AUTO] POST /api/webhooks/ifu — IFU parsing completion webhook
// @MX:REASON Public API boundary for IFU parsing events. Requires timing-safe auth.
// @MX:SPEC Issue #188 (hybrid-ra-saas inbound webhook integration)

export const runtime = 'nodejs';

import { getEnv } from '@/lib/env';
import { timingSafeEqual } from '@/lib/webauth/timing-safe';
import { z } from 'zod';

// IFU webhook payload schema
const ifuWebhookSchema = z.object({
  tenant_id: z.string(),
  job_id: z.string(),
  doc_id: z.string(),
  doc_type: z.string(),
  confidence: z.number(),
  field_candidates: z.record(z.unknown()),
  required_missing: z.array(z.string()),
});

export const POST = async (req: Request) => {
  // Authentication: X-Regula-API-Key header (timing-safe compare)
  const authHeader = req.headers.get('x-regula-api-key');
  const env = getEnv();

  if (!authHeader || !env.REGULA_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const isValid = timingSafeEqual(authHeader, env.REGULA_API_KEY);
  if (!isValid) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ifuWebhookSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  return new Response(null, { status: 202 });
};
