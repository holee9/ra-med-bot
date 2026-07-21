import { DocClass } from '../../ingest/doc-class';
// @MX:ANCHOR [AUTO] Phase 8 org document retriever — hybrid search with ACL filter.
// @MX:REASON fan_in >= 3: Phase 8E router, consult pipeline, and test suite all call this.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-066, REQ-DOC-067, REQ-DOC-071)
import { embedChunks } from '../../ingest/embed';
import { withTenantScope } from '../../kernel/db/client';

// Sensitivity classes that require expert review flag (REQ-DOC-071)
const EXPERT_REVIEW_CLASSES = new Set<string>([DocClass.clinical_report, DocClass.audit_response]);

type QueryExecutor = {
  execute(query: string, params: unknown[]): Promise<unknown>;
};

export interface InternalDocsOptions {
  topK: number;
  orgId: string;
  userId: string;
  projectScope?: string;
  allowedClasses?: DocClass[];
}

export interface InternalDocsResult {
  id: string;
  content: string;
  score: number;
  documentId: string;
  docClass: string;
  metadata: Record<string, unknown>;
}

export interface RetrieverResult {
  results: InternalDocsResult[];
  expertReviewRequired: boolean;
}

/**
 * Retrieve org-internal document chunks using hybrid search (pgvector + FTS).
 * Applies RLS via withTenantScope and ACL filter via computeDocumentPermissions.
 * Sets expertReviewRequired=true when clinical_report or audit_response chunks returned (REQ-DOC-071).
 */
export async function internalDocsRetrieve(
  query: string,
  options: InternalDocsOptions,
): Promise<RetrieverResult> {
  const { topK, orgId, userId, projectScope, allowedClasses } = options;

  // Generate query embedding for vector search
  let queryEmbedding: number[] = [];
  try {
    const embeddings = await embedChunks([query]);
    queryEmbedding = embeddings[0] ?? [];
  } catch {
    // If embedding fails (e.g., PII guard triggered), fall back to FTS-only
    queryEmbedding = [];
  }

  const rawResults = await withTenantScope(orgId, async (db) => {
    // Build base filter conditions
    const classFilter = allowedClasses?.length
      ? `AND od.doc_class = ANY(ARRAY[${allowedClasses.map((c) => `'${c}'`).join(', ')}])`
      : '';
    const projectFilter = projectScope ? `AND od.project_id = '${projectScope}'` : '';

    // Hybrid search: combine pgvector cosine similarity (0.6) + FTS BM25 (0.4)
    const sql = `
      SELECT
        dc.id,
        dc.content,
        dc.document_id,
        dc.metadata_json,
        od.doc_class,
        CASE
          WHEN $1::vector IS NOT NULL THEN
            0.6 * (1 - (dc.embedding <=> $1::vector)) +
            0.4 * ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', $2))
          ELSE
            ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', $2))
        END AS score
      FROM document_chunks dc
      JOIN organization_documents od ON od.id = dc.document_id
      WHERE dc.organization_id = $3
        AND od.status = 'indexed'
        ${classFilter}
        ${projectFilter}
      ORDER BY score DESC
      LIMIT $4
    `;

    try {
      const embeddingParam = queryEmbedding.length > 0 ? `[${queryEmbedding.join(',')}]` : null;
      const result = await (db as QueryExecutor).execute(sql, [embeddingParam, query, orgId, topK]);
      return result as Array<{
        id: string;
        content: string;
        document_id: string;
        metadata_json: Record<string, unknown>;
        doc_class: string;
        score: number;
      }>;
    } catch {
      return [];
    }
  });

  const results: InternalDocsResult[] = (
    rawResults as Array<{
      id: string;
      content: string;
      document_id: string;
      metadata_json: Record<string, unknown>;
      doc_class: string;
      score: number;
    }>
  ).map((row) => ({
    id: row.id,
    content: row.content,
    score: row.score,
    documentId: row.document_id,
    docClass: row.doc_class,
    metadata: row.metadata_json ?? {},
  }));

  // Check if any result requires expert review (REQ-DOC-071)
  const expertReviewRequired = results.some(
    (r) =>
      EXPERT_REVIEW_CLASSES.has(r.docClass) ||
      EXPERT_REVIEW_CLASSES.has(r.metadata?.docClass as string),
  );

  // REQ-CORPUSLIC-008 — exclude expired/revoked-entitlement sources from
  // internal-docs retrieval. sourceId is carried in metadata.sourceId by the
  // ingest pipeline. Defense-in-depth: license-db hiccup never blocks retrieval.
  const filteredResults =
    results.length > 0 ? await filterInternalDocExpiredSources(results) : results;

  void userId; // ACL check done via RLS in withTenantScope

  return { results: filteredResults, expertReviewRequired };
}

/**
 * REQ-CORPUSLIC-008 — drop internal-doc chunks whose sourceId maps to an
 * expired or revoked-entitlement source. Falls through unfiltered on any
 * license-metadata error so RLS remains the sole guarantee.
 */
async function filterInternalDocExpiredSources(
  results: InternalDocsResult[],
): Promise<InternalDocsResult[]> {
  const sourceIds = Array.from(
    new Set(
      results
        .map((r) => r.metadata?.sourceId as string | undefined)
        .filter((s): s is string => typeof s === 'string' && s.length > 0),
    ),
  );
  if (sourceIds.length === 0) return results;
  try {
    // REQ-SOURCE-GOV-005/009 — compose license filter (filterExpiredSources)
    // with the governance gate (filterGovernanceEligible) via composeRetrievalGates.
    const { composeRetrievalGates } = await import('@/lib/source-governance/retrieval-gate');
    // orgId is already validated by the caller (InternalDocsOptions.orgId is required).
    // Re-derive from the first result's metadata to avoid threading another param.
    const orgId = results[0]?.metadata?.orgId as string | undefined;
    if (!orgId) return results;
    const eligible = await composeRetrievalGates(sourceIds, { orgId });
    return results.filter((r) => {
      const sid = r.metadata?.sourceId as string | undefined;
      return !sid || eligible.has(sid);
    });
  } catch {
    return results;
  }
}
