// @MX:ANCHOR [AUTO] POST /api/webhooks/knowledge-sync — crawl completion webhook
// @MX:REASON Public API boundary for cloud-control-plane crawl events. Requires timing-safe auth.
// @MX:SPEC Issue #188 (hybrid-ra-saas inbound webhook integration)

export const runtime = 'nodejs';

import { getEnv } from '@/lib/env';
import { timingSafeEqual } from '@/lib/webauth/timing-safe';
import { z } from 'zod';

// Knowledge document schema
const knowledgeDocumentSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  hash: z.string(),
  source: z.string(),
  content: z.string(),
});

// Knowledge-sync webhook payload schema
const knowledgeSyncWebhookSchema = z.object({
  job_id: z.string(),
  documents: z.array(knowledgeDocumentSchema),
});

export const POST = async (req: Request) => {
  // Authentication: X-Crawl-Push-Secret header (timing-safe compare)
  const authHeader = req.headers.get('x-crawl-push-secret');
  const env = getEnv();

  if (!authHeader || !env.CRAWL_PUSH_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const isValid = timingSafeEqual(authHeader, env.CRAWL_PUSH_SECRET);
  if (!isValid) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = knowledgeSyncWebhookSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  return Response.json({ received: true }, { status: 200 });
};
