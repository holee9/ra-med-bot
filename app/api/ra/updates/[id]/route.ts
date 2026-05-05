// GET /api/ra/updates/[id] — regulatory update detail with on-demand impact analysis.
// @MX:SPEC SPEC-REGULA-RADAR-001

import { logger } from '@/lib/observability/logger';
import { eq } from 'drizzle-orm';
import { sharedAnthropicClient } from '../../../../../lib/ai/anthropic-client';
import { withPermission } from '../../../../../lib/auth/with-permission';
import { db } from '../../../../../lib/db/client';
import { regulatoryUpdates } from '../../../../../lib/db/schema';

export const GET = withPermission('dashboard.view', async (req, ctx) => {
  const params = ctx.params ? await ctx.params : {};
  const id = (params as { id?: string }).id;

  if (!id) {
    return Response.json({ error: 'Missing update ID' }, { status: 400 });
  }

  const [update] = await db
    .select()
    .from(regulatoryUpdates)
    .where(eq(regulatoryUpdates.id, id))
    .limit(1);

  if (!update) {
    return Response.json({ error: 'Update not found' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const requestAnalysis = searchParams.get('analyze') === 'true';

  let impactAnalysisText = update.impactAnalysisText;

  // On-demand Sonnet impact analysis if not cached and requested
  if (requestAnalysis && !impactAnalysisText) {
    try {
      const response = await sharedAnthropicClient.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Analyze the regulatory impact of this update for a medical device manufacturer:

Title: ${update.title}
Region: ${update.region}
Published: ${update.publishedAt?.toISOString() ?? 'unknown'}
Impact Type: ${update.impactTypeHint ?? 'unspecified'}

Provide a concise 3-5 sentence impact analysis covering: what changed, who is affected, and recommended next steps.`,
          },
        ],
      });

      const raw = response.content[0];
      if (raw && raw.type === 'text') {
        impactAnalysisText = raw.text;

        // Cache the analysis back to DB
        await db
          .update(regulatoryUpdates)
          .set({ impactAnalysisText })
          .where(eq(regulatoryUpdates.id, id));
      }
    } catch (err) {
      logger.error('[updates/[id]] Impact analysis failed:', err);
    }
  }

  return Response.json({ update: { ...update, impactAnalysisText } });
});
