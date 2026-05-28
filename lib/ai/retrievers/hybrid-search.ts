// @MX:ANCHOR Hybrid retrieval — pgvector cosine + Postgres FTS, weighted 0.6/0.4.
// @MX:REASON This is the only retrieval path in Phase 2; every consult flows
// through it. fan_in is at least 2 (consult.ts + fda.ts wrapper) and grows in
// Phase 4 when corpus-specific retrievers are added.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-013, REQ-CHAT-014, REQ-CHAT-019)

import { openai } from '@ai-sdk/openai';
import { type EmbeddingModel, embed } from 'ai';
import { sql } from 'drizzle-orm';
import { db } from '../../db/client';

export interface RetrievedChunk {
  sectionId: string;
  sourceId: string;
  anchor: string;
  text: string;
  /** Character offset within the section text — used by DocViewer deep-link. */
  offset: number;
  vec_score: number;
  fts_score: number;
  /** combined_score = 0.6 * vec_score + 0.4 * fts_score */
  combined_score: number;
  // Source metadata, denormalized for prompt injection without an extra join.
  orgLabel: string;
  title: string;
  year: number | null;
  type: string;
  url: string | null;
}

interface HybridRow extends Record<string, unknown> {
  section_id: string;
  source_id: string;
  anchor: string;
  text: string;
  vec_score: number | null;
  fts_score: number | null;
  org_label: string;
  title: string;
  year: number | null;
  type: string;
  url: string | null;
}

/**
 * Hybrid search: union of pgvector similarity and FTS rank, combined by a
 * weighted sum. Returns top-k by combined_score descending.
 *
 * @param corpus  reserved for Phase 4 multi-corpus filtering; currently the
 *                'fda' value is identical to 'all'.
 * @param sourceFilter  applied as a SQL WHERE clause on sources.type.
 */
export async function hybridSearch(
  query: string,
  _corpus: 'fda' | 'all',
  k: number,
  sourceFilter: 'all' | 'regs' | 'internal',
): Promise<RetrievedChunk[]> {
  // 1. Attempt embedding — may fail when OPENAI_API_KEY is unavailable.
  // @MX:NOTE Cast bridges v3 provider → v1 SDK type. See lib/ai/intent.ts.
  let embeddingLiteral: string | null = null;
  try {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small') as unknown as EmbeddingModel<string>,
      value: query,
    });
    embeddingLiteral = `[${embedding.join(',')}]`;
  } catch {
    // OpenAI key unavailable — fall through to FTS-only retrieval.
  }

  // 2. Build OR-joined FTS query for better recall (prevents AND requiring all terms).
  const ftsQuery =
    query
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .join(' OR ') || query;

  // 3. Build the source-type WHERE fragment.
  let typeFilter = sql``;
  if (sourceFilter === 'regs') {
    typeFilter = sql`AND s.type IN ('Regulation', 'Guidance', 'Standard')`;
  } else if (sourceFilter === 'internal') {
    typeFilter = sql`AND s.type = 'Internal'`;
  }

  // 4. Query — hybrid (pgvector cosine + FTS) when embedding available, FTS-only otherwise.
  let rawRows: unknown;
  if (embeddingLiteral !== null) {
    // Hybrid: FULL OUTER JOIN so a section is included if it ranks in either branch.
    rawRows = await db.execute<HybridRow>(sql`
      WITH vec AS (
        SELECT
          ss.id AS section_id,
          1.0 - (ss.embedding <=> ${embeddingLiteral}::vector) AS vec_score
        FROM source_sections ss
        INNER JOIN sources s ON s.id = ss.source_id
        WHERE ss.embedding IS NOT NULL
          ${typeFilter}
        ORDER BY ss.embedding <=> ${embeddingLiteral}::vector
        LIMIT ${k * 4}
      ),
      fts AS (
        SELECT
          ss.id AS section_id,
          ts_rank(to_tsvector('english', ss.text), websearch_to_tsquery('english', ${ftsQuery})) AS fts_score
        FROM source_sections ss
        INNER JOIN sources s ON s.id = ss.source_id
        WHERE to_tsvector('english', ss.text) @@ websearch_to_tsquery('english', ${ftsQuery})
          ${typeFilter}
        ORDER BY fts_score DESC
        LIMIT ${k * 4}
      )
      SELECT
        ss.id            AS section_id,
        ss.source_id     AS source_id,
        ss.anchor        AS anchor,
        ss.text          AS text,
        vec.vec_score    AS vec_score,
        fts.fts_score    AS fts_score,
        s.org_label      AS org_label,
        s.title          AS title,
        s.year           AS year,
        s.type::text     AS type,
        s.url            AS url
      FROM source_sections ss
      INNER JOIN sources s ON s.id = ss.source_id
      LEFT JOIN vec ON vec.section_id = ss.id
      LEFT JOIN fts ON fts.section_id = ss.id
      WHERE (vec.vec_score IS NOT NULL OR fts.fts_score IS NOT NULL)
      LIMIT ${k * 4}
    `);
  } else {
    // FTS-only: skips vector CTE when OpenAI embedding is unavailable.
    rawRows = await db.execute<HybridRow>(sql`
      SELECT
        ss.id            AS section_id,
        ss.source_id     AS source_id,
        ss.anchor        AS anchor,
        ss.text          AS text,
        NULL::float      AS vec_score,
        ts_rank(to_tsvector('english', ss.text), websearch_to_tsquery('english', ${ftsQuery})) AS fts_score,
        s.org_label      AS org_label,
        s.title          AS title,
        s.year           AS year,
        s.type::text     AS type,
        s.url            AS url
      FROM source_sections ss
      INNER JOIN sources s ON s.id = ss.source_id
      WHERE to_tsvector('english', ss.text) @@ websearch_to_tsquery('english', ${ftsQuery})
        ${typeFilter}
      ORDER BY fts_score DESC
      LIMIT ${k * 4}
    `);
  }

  // 5. Combine and rank in app-land. We normalize fts_score to [0,1] by
  // dividing by the maximum to keep the weighted blend stable.
  const list = rawRows as unknown as HybridRow[];
  const maxFts = list.reduce((m, r) => Math.max(m, r.fts_score ?? 0), 0) || 1;

  const chunks: RetrievedChunk[] = list.map((r) => {
    const vec = r.vec_score ?? 0;
    const ftsNorm = (r.fts_score ?? 0) / maxFts;
    return {
      sectionId: r.section_id,
      sourceId: r.source_id,
      anchor: r.anchor,
      text: r.text,
      offset: 0,
      vec_score: vec,
      fts_score: ftsNorm,
      combined_score: 0.6 * vec + 0.4 * ftsNorm,
      orgLabel: r.org_label,
      title: r.title,
      year: r.year,
      type: r.type,
      url: r.url,
    };
  });

  chunks.sort((a, b) => b.combined_score - a.combined_score);
  return chunks.slice(0, k);
}
