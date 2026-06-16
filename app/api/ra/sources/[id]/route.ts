// @MX:NOTE [AUTO] Sources GET API — returns source content with optional offset query param.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-044)

import { writeAudit } from '@/lib/audit';
import { eq } from 'drizzle-orm';
import { withPermission } from '../../../../../lib/auth/with-permission';
import { db } from '../../../../../lib/db/client';
import { sourceSections, sources } from '../../../../../lib/db/schema';

// E2E_TEST_MODE: deterministic mock sources for non-UUID test IDs.
// Prevents PostgreSQL UUID parse error when citation tests use 'test-src-N' IDs.
const E2E_MOCK_SOURCES: Record<
  string,
  {
    id: string;
    orgLabel: string;
    title: string;
    year: number;
    type: string;
    url: null;
    sections: { id: string; anchor: string; heading: string; text: string }[];
  }
> = {
  'test-src-1': {
    id: 'test-src-1',
    orgLabel: 'EU MDR',
    title: 'Regulation (EU) 2017/745',
    year: 2017,
    type: 'Regulation',
    url: null,
    sections: [
      {
        id: 'ts1-s1',
        anchor: 'Article 10',
        heading: 'General obligations of manufacturers',
        text: 'Manufacturers of devices shall establish, document, implement, maintain, keep up to date and continually improve a quality management system.',
      },
    ],
  },
  'test-src-2': {
    id: 'test-src-2',
    orgLabel: 'FDA 21 CFR',
    title: '21 CFR Part 820',
    year: 2022,
    type: 'Regulation',
    url: null,
    sections: [
      {
        id: 'ts2-s1',
        anchor: '820.30',
        heading: 'Design Controls',
        text: 'Each manufacturer of any class III or class II device shall establish and maintain procedures to control the design of the device.',
      },
    ],
  },
};

export const GET = withPermission('conversation.view', async (_req, ctx, session) => {
  // Next.js 15 passes params as a Promise. Resolve it safely.
  const rawParams = (ctx as { params: Promise<{ id: string }> | { id: string } }).params;
  const params = rawParams instanceof Promise ? await rawParams : rawParams;
  const id = (params as { id: string })?.id ?? '';

  if (!id) {
    return new Response('Missing source id', { status: 400 });
  }

  // E2E_TEST_MODE: return mock source for known test IDs to avoid UUID parse errors.
  if (process.env.E2E_TEST_MODE === 'true' && process.env.NODE_ENV !== 'production') {
    const mock = E2E_MOCK_SOURCES[id];
    if (mock) return Response.json(mock);
  }

  const [source] = await db.select().from(sources).where(eq(sources.id, id)).limit(1);
  if (!source) {
    return new Response('Not Found', { status: 404 });
  }

  if (source.organizationId && source.organizationId !== session.user.organizationId) {
    await writeAudit({
      action: 'rbac.permission_deny',
      actor_id: session.user.id,
      resource_type: 'source',
      resource_id: id,
      meta_json: {
        required: 'conversation.view',
        actualRole: session.user.role,
        reason: 'source_org_mismatch',
      },
    });
    return Response.json(
      { error: 'not_a_member', resource_type: 'source', resource_id: id },
      { status: 403 },
    );
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
