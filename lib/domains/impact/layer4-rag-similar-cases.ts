// SPEC-V3-IMPACT-001 M6: Layer 4 RAG similar cases via pgvector.
// @MX:ANCHOR [AUTO] RAG similarity search for high-confidence impacts.
// @MX:REASON Called by API route when confidence >= 80%. fan_in >= 2.
// @MX:SPEC SPEC-V3-IMPACT-001 (AC-IMP-08, AC-IMP-14)

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { toVectorLiteral } from '@/lib/knowledge-promo/embedding';

export interface SimilarCaseInput {
  productId: string;
  changeType: string;
  embedding: number[];
}

export interface SimilarCase {
  id: string;
  title: string;
  content: string;
  similarity: number;
}

export interface SimilarCasesResult {
  cases: SimilarCase[];
  citations: string;
  timedOut: boolean;
  error?: string;
}

const TIMEOUT_MS = 10000; // 10 seconds
const MAX_RESULTS = 3;

/**
 * Finds similar cases using pgvector cosine similarity search.
 * Filters by source_repo='ra-llm-wiki' and change_type.
 * Returns max 3 results with citation format <sup class="cite">N</sup>.
 * Times out after 10s and returns empty results.
 */
export async function findSimilarCases(
  input: SimilarCaseInput,
): Promise<SimilarCasesResult> {
  const vectorLiteral = toVectorLiteral(input.embedding);
  if (!vectorLiteral) {
    return {
      cases: [],
      citations: '',
      timedOut: false,
      error: 'Failed to convert embedding to vector literal',
    };
  }

  try {
    // Implement timeout using Promise.race
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), TIMEOUT_MS),
    );

    const queryPromise = (async () => {
      const rows = await db.execute<SimilarCase>(
        sql`
          SELECT
            e.id,
            e.title,
            e.content,
            1.0 - (e.embedding <=> ${vectorLiteral}::vector) AS similarity
          FROM embeddings e
          WHERE e.source_repo = 'ra-llm-wiki'
            AND e.product_id = ${input.productId}
            AND e.change_type = ${input.changeType}
            AND e.embedding IS NOT NULL
          ORDER BY e.embedding <=> ${vectorLiteral}::vector
          LIMIT ${MAX_RESULTS}
        `,
      );

      return rows;
    })();

    const rows = await Promise.race([queryPromise, timeoutPromise]);

    const citations = rows
      .map((_, index) => `<sup class="cite">${index + 1}</sup>`)
      .join('');

    return {
      cases: rows,
      citations,
      timedOut: false,
    };
  } catch (error) {
    if ((error as Error).message === 'Query timeout') {
      return {
        cases: [],
        citations: '',
        timedOut: true,
      };
    }

    return {
      cases: [],
      citations: '',
      timedOut: false,
      error: (error as Error).message,
    };
  }
}
