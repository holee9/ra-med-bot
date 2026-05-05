// @MX:NOTE [AUTO] GET /api/ra/sources — aggregated corpus statistics for the knowledge base view.
// @MX:SPEC SPEC-REGULA-RELEASE-HARDENING-001 (TASK-002)

import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { sourceSections, sources } from '@/lib/db/schema';
import { count, countDistinct, eq, max } from 'drizzle-orm';

/**
 * Returns the list of source corpora (grouped by `sources.org_label`) along with
 * the number of distinct documents, total chunked sections, and the most recent
 * ingestion timestamp. The Knowledge page consumes this to render dynamic stats
 * instead of hard-coded labels.
 *
 * Shape: `{ corpora: Array<{ corpus, documentCount, sectionCount, lastUpdated }> }`
 *
 * `sources` is the canonical document registry (FDA / EU MDR / MFDS / ISO / Internal),
 * `source_sections` holds the chunked text used by the retriever. We left-join sections
 * onto sources so corpora without ingested chunks still appear with `sectionCount = 0`.
 */
export const GET = withPermission('dashboard.view', async () => {
  const rows = await db
    .select({
      orgLabel: sources.orgLabel,
      documentCount: countDistinct(sources.id),
      sectionCount: count(sourceSections.id),
      lastUpdated: max(sources.createdAt),
    })
    .from(sources)
    .leftJoin(sourceSections, eq(sources.id, sourceSections.sourceId))
    .groupBy(sources.orgLabel)
    .orderBy(sources.orgLabel);

  const corpora = rows.map((r) => ({
    corpus: r.orgLabel,
    documentCount: Number(r.documentCount ?? 0),
    sectionCount: Number(r.sectionCount ?? 0),
    lastUpdated: r.lastUpdated instanceof Date ? r.lastUpdated.toISOString() : r.lastUpdated,
  }));

  return Response.json({ corpora });
});
