// POST /api/ra/radar/search — natural language search with Haiku intent parse.
// @MX:SPEC SPEC-REGULA-RADAR-001

import { desc, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { sharedAnthropicClient } from '../../../../../lib/ai/anthropic-client';
import { writeAudit } from '../../../../../lib/audit';
import { withPermission } from '../../../../../lib/auth/with-permission';
import { db } from '../../../../../lib/db/client';
import { regulatoryUpdates } from '../../../../../lib/db/schema';

const SearchSchema = z.object({
  query: z.string().min(1).max(500),
});

interface ParsedIntent {
  keywords: string[];
  region?: string;
  impact_type?: string;
}

export const POST = withPermission('dashboard.view', async (req, _ctx, session) => {
  const body = (await req.json()) as unknown;
  const parsed = SearchSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: 'Invalid search query' }, { status: 422 });
  }

  const { query } = parsed.data;

  // Step 1: Haiku parses natural language intent
  let intent: ParsedIntent = { keywords: [query] };
  try {
    const intentResponse = await sharedAnthropicClient.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `Parse this regulatory search query and extract structured intent.
Query: "${query}"

Respond ONLY with JSON:
{"keywords": string[], "region": "US"|"EU"|"KR"|"JP"|"CN"|null, "impact_type": "guidance"|"recall"|"legislation"|"enforcement_action"|"informational"|null}`,
        },
      ],
    });

    const raw = intentResponse.content[0];
    if (raw && raw.type === 'text') {
      intent = JSON.parse(raw.text) as ParsedIntent;
    }
  } catch {
    // Fall back to keyword-only search
  }

  // Step 2: Query regulatory_updates with extracted keywords
  const conditions = intent.keywords.map((kw) =>
    or(
      ilike(regulatoryUpdates.title, `%${kw}%`),
      ilike(regulatoryUpdates.impactTypeHint, `%${kw}%`),
    ),
  );

  const rows = await db
    .select({
      id: regulatoryUpdates.id,
      title: regulatoryUpdates.title,
      region: regulatoryUpdates.region,
      publishedAt: regulatoryUpdates.publishedAt,
      impactScore: regulatoryUpdates.impactScore,
      impactTypeHint: regulatoryUpdates.impactTypeHint,
      sourceUrl: regulatoryUpdates.sourceUrl,
    })
    .from(regulatoryUpdates)
    .where(conditions.length > 0 ? or(...conditions.filter(Boolean)) : undefined)
    .orderBy(desc(regulatoryUpdates.publishedAt))
    .limit(20);

  await writeAudit({
    actor_id: session.user.id,
    action: 'radar.search',
    resource_type: 'regulatory_updates',
    resource_id: 'search',
    meta_json: { query, intent, result_count: rows.length },
  });

  return Response.json({ results: rows, intent });
});
