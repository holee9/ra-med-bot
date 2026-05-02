// @MX:NOTE Sources GET API — returns source content with optional offset query param.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-044)

import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { auth } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db/client';
import { sourceSections, sources } from '../../../../../lib/db/schema';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await params;
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
}
