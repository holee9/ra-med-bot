// @MX:ANCHOR [AUTO] PromotedAnswersRetriever — org-scoped promoted Q&A retrieval.
// @MX:REASON REQ-KNOWLEDGE-PROMO-009/010: promoted answers MUST participate in
//           RAG retrieval with a higher weight than internal documents. The
//           retriever applies a BOOST_FACTOR at score time so the boost flows
//           naturally into Cohere rerank + RLHF rerank (design decision #3).
//           fan_in >= 3: merge.ts, unit tests, integration tests.
// @MX:WARN [AUTO] org_id isolation is enforced in the SQL WHERE clause.
// @MX:REASON SQL-level WHERE prevents cross-org promoted answers from ever
//           reaching application memory.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-009, REQ-010, REQ-011, REQ-014, AC-04, AC-05, AC-08)

import { type EmbeddingModel, embed } from 'ai';
import { sql } from 'drizzle-orm';
// @MX:WARN [AUTO] db/client import MUST stay lazy (inside retrieve()).
// @MX:REASON Top-level value import triggers lib/env.ts parseEnv at module
//           load, breaking unit tests that import merge.ts registry without
//           DB env vars (see tests/unit/ai/merge.test.ts). `db` is type-only.
import type { db } from '../../kernel/db/client';
// SPEC-REGULA-KNOWLEDGE-PROMO-001 (L-4): reuse the canonical vector-literal
// builder instead of inlining `[${embedding.join(',')}]` so the format lives
// in one place (lib/knowledge-promo/embedding.ts toVectorLiteral).
import { toVectorLiteral } from '../../knowledge-promo/embedding';
import { getEmbeddingModel } from '../embedding-provider';
import type { IRetriever, RetrievalResult, RetrieverOptions } from './types';

/**
 * REQ-010 / AC-04: promoted answers are weighted higher than internal documents.
 * The boost is applied to the cosine similarity score at retrieval time so the
 * promoted answer outranks an equally-relevant internal chunk during rerank.
 * Value is conservative (1.6×) — tune via retriever tests if retrieval quality
 * signals demand it.
 */
export const PROMOTED_BOOST_FACTOR = 1.6;

interface PromotedRow extends Record<string, unknown> {
  promoted_id: string;
  source_message_id: string;
  title: string;
  tags: string[] | string;
  similarity: number;
}

/**
 * Retriever for org-scoped promoted answers (team knowledge library).
 *
 * REQ-009: included in the RAG pipeline via merge.ts registry.
 * REQ-010: score multiplied by PROMOTED_BOOST_FACTOR (> internal docs).
 * REQ-011 / AC-05: `metadata.sourceMessageId` gives citation provenance.
 * REQ-014 / AC-08: only `status='active'` rows are returned (unpromoted excluded).
 * REQ-003: org_id enforced at SQL level + withTenantScope GUC (#239).
 */
export class PromotedAnswersRetriever implements IRetriever {
  readonly corpus = 'org_promoted';

  async retrieve(query: string, opts: RetrieverOptions = {}): Promise<RetrievalResult[]> {
    // REQ-003: orgId is mandatory — retrieving without it is a security violation.
    if (!opts.orgId) {
      throw new Error('orgId is required for PromotedAnswersRetriever (REQ-KNOWLEDGE-PROMO-003)');
    }

    const limit = opts.limit ?? 10;
    const orgId = opts.orgId;

    let embedding: number[] | null = null;
    try {
      const { embedding: vec } = await embed({
        model: getEmbeddingModel() as unknown as EmbeddingModel<string>,
        value: query,
      });
      embedding = vec;
    } catch {
      // Embedding API unavailable — promoted semantic retrieval unavailable.
      return [];
    }
    const vectorLiteral = toVectorLiteral(embedding);
    if (!vectorLiteral) return [];

    type ExecHandle = Pick<typeof db, 'execute'>;
    const runQuery = async (client: ExecHandle): Promise<unknown> => {
      return client.execute<PromotedRow>(sql`
        SELECT
          pa.id                AS promoted_id,
          pa.source_message_id AS source_message_id,
          pa.title             AS title,
          pa.tags              AS tags,
          1.0 - (pa.embedding <=> ${vectorLiteral}::vector) AS similarity
        FROM promoted_answers pa
        WHERE pa.org_id = ${orgId}
          AND pa.status = 'active'
          AND pa.embedding IS NOT NULL
        ORDER BY pa.embedding <=> ${vectorLiteral}::vector
        LIMIT ${limit}
      `);
    };

    // Lazy import: avoids top-level lib/env.ts parseEnv at registry import time.
    const { withTenantScope } = await import('../../kernel/db/client');
    const rows = (await withTenantScope(orgId, (dbs) => runQuery(dbs))) as unknown as PromotedRow[];

    return rows.map((r) => {
      const baseScore = typeof r.similarity === 'number' ? r.similarity : Number(r.similarity);
      const boostedScore = baseScore * PROMOTED_BOOST_FACTOR;
      const tagArray = Array.isArray(r.tags) ? (r.tags as string[]) : [];
      // REQ-011 / AC-05: sourceMessageId carries citation provenance so a
      // promoted answer cited in the answer prose traces back to the original
      // conversation message (Charter [지양-2] citation 强制).
      return {
        id: r.promoted_id,
        content: r.title,
        score: boostedScore,
        sourceId: r.source_message_id,
        metadata: {
          sourceMessageId: r.source_message_id,
          promotedAnswerId: r.promoted_id,
          title: r.title,
          tags: tagArray,
          corpusType: 'org_promoted' as const,
          boosted: true,
          boostFactor: PROMOTED_BOOST_FACTOR,
        },
      };
    });
  }
}
