// @MX:NOTE [AUTO] Sources GET API — returns source content with optional offset query param.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-044)

import { eq } from 'drizzle-orm';
import { withPermission } from '../../../../../lib/auth/with-permission';
import { db } from '../../../../../lib/db/client';
import { sourceSections, sources } from '../../../../../lib/db/schema';

export const GET = withPermission('conversation.view', async (_req, ctx) => {
  // Next.js 15 passes params as a Promise. Resolve it safely.
  const rawParams = (ctx as { params: Promise<{ id: string }> | { id: string } }).params;
  const params = rawParams instanceof Promise ? await rawParams : rawParams;
  const id = (params as { id: string })?.id ?? '';

  if (!id) {
    return new Response('Missing source id', { status: 400 });
  }

  const [source] = await db.select().from(sources).where(eq(sources.id, id)).limit(1);
  if (!source) {
    return new Response('Not Found', { status: 404 });
  }

  const sections = await db
    .select({
      id: sourceSections.id,
      anchor: sourceSections.anchor,
      heading: sourceSections.heading,
      text: sourceSections.text,
    })
    .from(sourceSections)
    .where(eq(sourceSections.sourceId, id))
    .orderBy(sourceSections.anchor);

  return Response.json({
    id: source.id,
    orgLabel: source.orgLabel,
    title: source.title,
    year: source.year,
    type: source.type,
    url: source.url,
    sections,
  });
});
