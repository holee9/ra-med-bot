// @MX:ANCHOR [AUTO] InternalSopsRetriever — org-isolated internal SOPs retriever.
// @MX:REASON REQ-BREADTH-043 mandates SQL-level org isolation. JavaScript-side filtering
// is explicitly prohibited because it would load cross-org data into memory first.
// fan_in will reach 3+ when the RAG handler, project retriever, and audit module all
// reference this retriever in Phase 4.
// @MX:WARN [AUTO] org_id isolation is enforced in the SQL WHERE clause. Never remove or
// weaken this filter — doing so constitutes a data-isolation security regression.
// @MX:REASON SQL-level WHERE prevents cross-org data from ever reaching application memory.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-037, REQ-BREADTH-043)

import { openai } from '@ai-sdk/openai';
import { type EmbeddingModel, embed } from 'ai';
import { sql } from 'drizzle-orm';
import { db } from '../../db/client';
import type { IRetriever, RetrievalResult, RetrieverOptions } from './types';

interface SopsRow extends Record<string, unknown> {
  section_id: string;
  source_id: string;
  anchor: string;
  text: string;
  combined_score: number;
  org_label: string;
  title: string;
  year: number | null;
  type: string;
  url: string | null;
}

/**
 * Retriever for org-scoped internal SOPs.
 *
 * REQ-BREADTH-043: org_id isolation is enforced at SQL level — the WHERE clause
 * `source_sections.org_id = opts.orgId` runs inside Postgres. No cross-org row
 * ever enters application memory.
 */
export class InternalSopsRetriever implements IRetriever {
  readonly corpus = 'internal-sops';

  async retrieve(query: string, opts: RetrieverOptions = {}): Promise<RetrievalResult[]> {
    // REQ-BREADTH-043: orgId is mandatory — retrieving without it is a security violation.
    if (!opts.orgId) {
      throw new Error('orgId is required for InternalSopsRetriever (REQ-BREADTH-043)');
    }

    const limit = opts.limit ?? 10;
    const orgId = opts.orgId;

    // Embed the query — falls back to FTS-only when OpenAI key is unavailable.
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

    // SQL-level org isolation: WHERE ss.org_id = orgId.
    // This filter runs inside Postgres — cross-org rows are never loaded.
    let rows: unknown;
    if (embeddingLiteral !== null) {
      rows = await db.execute<SopsRow>(sql`
        WITH vec AS (
          SELECT
            ss.id AS section_id,
            1.0 - (ss.embedding <=> ${embeddingLiteral}::vector) AS vec_score
          FROM source_sections ss
          INNER JOIN sources s ON s.id = ss.source_id
          WHERE ss.embedding IS NOT NULL
            AND s.organization_id = ${orgId}
            AND s.type = 'Internal'
          ORDER BY ss.embedding <=> ${embeddingLiteral}::vector
          LIMIT ${limit * 4}
        ),
        fts AS (
          SELECT
            ss.id AS section_id,
            ts_rank(to_tsvector('english', ss.text), websearch_to_tsquery('english', ${query})) AS fts_score
          FROM source_sections ss
          INNER JOIN sources s ON s.id = ss.source_id
          WHERE to_tsvector('english', ss.text) @@ websearch_to_tsquery('english', ${query})
            AND s.organization_id = ${orgId}
            AND s.type = 'Internal'
          ORDER BY fts_score DESC
          LIMIT ${limit * 4}
        )
        SELECT
          ss.id           AS section_id,
          ss.source_id    AS source_id,
          ss.anchor       AS anchor,
          ss.text         AS text,
          (0.6 * COALESCE(vec.vec_score, 0) + 0.4 * COALESCE(fts.fts_score, 0)) AS combined_score,
          s.org_label     AS org_label,
          s.title         AS title,
          s.year          AS year,
          s.type::text    AS type,
          s.url           AS url
        FROM source_sections ss
        INNER JOIN sources s ON s.id = ss.source_id
        LEFT JOIN vec ON vec.section_id = ss.id
        LEFT JOIN fts ON fts.section_id = ss.id
        WHERE (vec.section_id IS NOT NULL OR fts.section_id IS NOT NULL)
        ORDER BY combined_score DESC
        LIMIT ${limit}
      `);
    } else {
      // FTS-only fallback when embedding is unavailable.
      rows = await db.execute<SopsRow>(sql`
        SELECT
          ss.id           AS section_id,
          ss.source_id    AS source_id,
          ss.anchor       AS anchor,
          ss.text         AS text,
          ts_rank(to_tsvector('english', ss.text), websearch_to_tsquery('english', ${query})) AS combined_score,
          s.org_label     AS org_label,
          s.title         AS title,
          s.year          AS year,
          s.type::text    AS type,
          s.url           AS url
        FROM source_sections ss
        INNER JOIN sources s ON s.id = ss.source_id
        WHERE to_tsvector('english', ss.text) @@ websearch_to_tsquery('english', ${query})
          AND s.organization_id = ${orgId}
          AND s.type = 'Internal'
        ORDER BY combined_score DESC
        LIMIT ${limit}
      `);
    }

    const list = rows as unknown as SopsRow[];
    return list.map((r) => ({
      id: r.section_id,
      content: r.text,
      score: r.combined_score,
      sourceId: r.source_id,
      metadata: {
        anchor: r.anchor,
        orgLabel: r.org_label,
        title: r.title,
        year: r.year,
        type: r.type,
        url: r.url,
      },
    }));
  }
}
