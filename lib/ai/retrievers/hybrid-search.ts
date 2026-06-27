// @MX:ANCHOR Hybrid retrieval — pgvector cosine + Postgres FTS, weighted 0.6/0.4.
// @MX:REASON This is the only retrieval path in Phase 2; every consult flows
// through it. fan_in is at least 2 (consult.ts + fda.ts wrapper) and grows in
// Phase 4 when corpus-specific retrievers are added.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-013, REQ-CHAT-014, REQ-CHAT-019)

import { openai } from '@ai-sdk/openai';
import { type EmbeddingModel, embed } from 'ai';
import { sql } from 'drizzle-orm';
import { db, withTenantScope } from '../../db/client';

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
  // REQ-INTEGRATION-001 — provenance for reproducible citations.
  // Optional: absent for external/legacy sources without Git provenance.
  sourceHost?: string | null;
  sourceOwner?: string | null;
  sourceRepo?: string | null;
  sourceRef?: string | null;
  sourcePath?: string | null;
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
  source_host: string | null;
  source_owner: string | null;
  source_repo: string | null;
  source_ref: string | null;
  source_path: string | null;
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
  orgId?: string,
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
  //
  // @MX:WARN [AUTO] App-level org isolation is mandatory here. RLS on
  // sources/source_sections is NOT enabled (these tables are absent from the
  // FORCE-RLS list in migrations/0084_force_rls.sql). The only isolation
  // boundary is the explicit `AND s.organization_id = ${orgId}` filter in every
  // WHERE clause. Never remove or weaken these filters — doing so is a
  // cross-org data-leak security regression (IDOR class).
  // @MX:REASON RLS is inert project-wide; the app-level filter is the sole defense.
  // @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-019 — org-scoped retrieval)
  //
  // When orgId is supplied we ALSO wrap in withTenantScope (defense-in-depth:
  // the GUC is set for any future RLS activation, and the app-level filter is
  // the live gate). When orgId is absent (project-wide corpus paths only), the
  // query proceeds without the org filter — callers must ensure orgId is
  // always threaded for any per-org retrieval.
  const orgFilter = orgId ? sql`AND s.organization_id = ${orgId}` : sql``;
  type ExecHandle = Pick<typeof db, 'execute'>;
  const runQueryOnHandle = async (client: ExecHandle): Promise<unknown> => {
    if (embeddingLiteral !== null) {
      // Hybrid: FULL OUTER JOIN so a section is included if it ranks in either branch.
      return client.execute<HybridRow>(sql`
        WITH vec AS (
          SELECT
            ss.id AS section_id,
            1.0 - (ss.embedding <=> ${embeddingLiteral}::vector) AS vec_score
          FROM source_sections ss
          INNER JOIN sources s ON s.id = ss.source_id
          WHERE ss.embedding IS NOT NULL
            ${typeFilter}
            ${orgFilter}
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
            ${orgFilter}
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
          s.url            AS url,
          s.source_host    AS source_host,
          s.source_owner   AS source_owner,
          s.source_repo    AS source_repo,
          s.source_ref     AS source_ref,
          s.source_path    AS source_path
        FROM source_sections ss
        INNER JOIN sources s ON s.id = ss.source_id
        LEFT JOIN vec ON vec.section_id = ss.id
        LEFT JOIN fts ON fts.section_id = ss.id
        WHERE (vec.vec_score IS NOT NULL OR fts.fts_score IS NOT NULL)
          ${orgFilter}
        LIMIT ${k * 4}
      `);
    }
    // FTS-only: skips vector CTE when OpenAI embedding is unavailable.
    return client.execute<HybridRow>(sql`
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
        s.url            AS url,
        s.source_host    AS source_host,
        s.source_owner   AS source_owner,
        s.source_repo    AS source_repo,
        s.source_ref     AS source_ref,
        s.source_path    AS source_path
      FROM source_sections ss
      INNER JOIN sources s ON s.id = ss.source_id
      WHERE to_tsvector('english', ss.text) @@ websearch_to_tsquery('english', ${ftsQuery})
        ${typeFilter}
        ${orgFilter}
      ORDER BY fts_score DESC
      LIMIT ${k * 4}
    `);
  };

  let rawRows: unknown;
  if (orgId) {
    rawRows = await withTenantScope(orgId, async (dbs) => runQueryOnHandle(dbs));
  } else {
    rawRows = await runQueryOnHandle(db);
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
      sourceHost: r.source_host ?? null,
      sourceOwner: r.source_owner ?? null,
      sourceRepo: r.source_repo ?? null,
      sourceRef: r.source_ref ?? null,
      sourcePath: r.source_path ?? null,
    };
  });

  chunks.sort((a, b) => b.combined_score - a.combined_score);

  // REQ-CORPUSLIC-008 — exclude expired/revoked-entitlement sources from search.
  // Primary call site for filterExpiredSources. orgId is threaded from all
  // per-corpus retrievers (fda/eu-mdr/mfds/nmpa/pmda) via RetrieverOptions and
  // from consult.ts → parallelRetrieveAndMerge. PMS-report builder passes orgId
  // directly. Defense-in-depth: a license-db hiccup never blocks retrieval —
  // the app-level `s.organization_id` filter in the SQL WHERE clause is the
  // primary org-isolation gate (RLS is inert on sources/source_sections; see
  // migrations/0084_force_rls.sql).
  //
  // REQ-SOURCE-GOV-005/009 — compose with the governance gate (filterGovernanceEligible)
  // via composeRetrievalGates: superseded + pending_review/rejected sources are
  // excluded too. A single composed call keeps the two gates in lock-step at
  // every retrieval site (hybrid-search / internal-sops / internal-docs).
  if (orgId && chunks.length > 0) {
    try {
      const { composeRetrievalGates } = await import('@/lib/source-governance/retrieval-gate');
      const sourceIds = Array.from(new Set(chunks.map((c) => c.sourceId)));
      const eligible = await composeRetrievalGates(sourceIds, { orgId });
      const filtered = chunks.filter((c) => eligible.has(c.sourceId));
      return filtered.slice(0, k);
    } catch {
      // License / governance metadata unavailable — return unfiltered. Org
      // isolation still holds: the SQL WHERE clause already gated rows by
      // s.organization_id at fetch time (not by RLS).
    }
  }

  return chunks.slice(0, k);
}
