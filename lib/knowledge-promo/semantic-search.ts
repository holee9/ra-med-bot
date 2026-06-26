// @MX:NOTE [AUTO] Org-wide conversation search (fulltext) + promoted-answer search (semantic).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-001, REQ-002, REQ-003, AC-01)
// @MX:REASON Two search modes scoped to the caller's org via withTenantScope
//           (RLS GUC — #239). fulltext covers ALL messages via content_tsv;
//           semantic is limited to promoted_answers.embedding (design decision
//           #2 — general-conversation semantic backfill is a follow-up).
// @MX:WARN [AUTO] org_id isolation is enforced in the SQL WHERE clause.
// @MX:REASON SQL-level WHERE prevents cross-org rows from ever reaching app memory.

import { openai } from '@ai-sdk/openai';
import { type EmbeddingModel, embed } from 'ai';
import { sql } from 'drizzle-orm';
import { type db, withTenantScope } from '../db/client';
import { toVectorLiteral } from './embedding';

export type SearchMode = 'fulltext' | 'semantic';

export interface SearchParams {
  orgId: string;
  query: string;
  mode: SearchMode;
  limit?: number;
}

export interface MessageSearchRow extends Record<string, unknown> {
  messageId: string;
  conversationId: string;
  contentProse: string;
  score: number;
}

export interface PromotedSearchRow extends Record<string, unknown> {
  promotedId: string;
  sourceMessageId: string;
  title: string;
  tags: string[];
  score: number;
}

/**
 * REQ-001 / AC-01: fulltext search over org-scoped conversation messages via
 * the content_tsv GENERATED column (migration 0086 §3). Cross-org rows are
 * never returned — the join messages -> conversations -> projects is scoped to
 * the caller org in SQL, and withTenantScope sets the RLS GUC.
 */
export async function searchOrgConversations(params: SearchParams): Promise<MessageSearchRow[]> {
  const { orgId, query, limit = 20 } = params;
  if (!query.trim()) return [];

  type ExecHandle = Pick<typeof db, 'execute'>;
  const runQuery = async (client: ExecHandle): Promise<unknown> => {
    return client.execute<MessageSearchRow>(sql`
      SELECT
        m.id              AS message_id,
        m.conversation_id AS conversation_id,
        m.content_prose   AS content_prose,
        ts_rank(m.content_tsv, websearch_to_tsquery('english', ${query})) AS score
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      JOIN projects p ON p.id = c.project_id
      WHERE p.organization_id = ${orgId}
        AND m.content_tsv @@ websearch_to_tsquery('english', ${query})
        AND m.role = 'assistant'
      ORDER BY score DESC
      LIMIT ${limit}
    `);
  };

  const rows = (await withTenantScope(orgId, (dbs) =>
    runQuery(dbs),
  )) as unknown as MessageSearchRow[];
  return rows.map((r) => ({
    messageId: r.messageId ?? ((r as Record<string, unknown>).message_id as string),
    conversationId: r.conversationId ?? ((r as Record<string, unknown>).conversation_id as string),
    contentProse: r.contentProse ?? ((r as Record<string, unknown>).content_prose as string),
    score: r.score,
  }));
}

/**
 * REQ-002 / AC-01: semantic search over org-scoped promoted answers via
 * pgvector cosine (`<=>`) on promoted_answers.embedding. Only status='active'
 * rows are returned (REQ-008/014). Design decision #2: general-conversation
 * semantic is a follow-up — this covers the promoted library only.
 *
 * Falls back to a no-op (empty result) when OpenAI is unavailable so the API
 * never 500s on a missing key.
 */
export async function searchPromotedSemantic(params: SearchParams): Promise<PromotedSearchRow[]> {
  const { orgId, query, limit = 20 } = params;
  if (!query.trim()) return [];

  let embedding: number[] | null = null;
  try {
    const { embedding: vec } = await embed({
      model: openai.embedding('text-embedding-3-small') as unknown as EmbeddingModel<string>,
      value: query,
    });
    embedding = vec;
  } catch {
    return []; // OpenAI unavailable — semantic search unavailable.
  }
  const vectorLiteral = toVectorLiteral(embedding);
  if (!vectorLiteral) return [];

  type ExecHandle = Pick<typeof db, 'execute'>;
  const runQuery = async (client: ExecHandle): Promise<unknown> => {
    return client.execute<PromotedSearchRow>(sql`
      SELECT
        pa.id                AS promoted_id,
        pa.source_message_id AS source_message_id,
        pa.title             AS title,
        pa.tags              AS tags,
        1.0 - (pa.embedding <=> ${vectorLiteral}::vector) AS score
      FROM promoted_answers pa
      WHERE pa.org_id = ${orgId}
        AND pa.status = 'active'
        AND pa.embedding IS NOT NULL
      ORDER BY pa.embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `);
  };

  const rows = (await withTenantScope(orgId, (dbs) =>
    runQuery(dbs),
  )) as unknown as PromotedSearchRow[];
  return rows.map((r) => ({
    promotedId: r.promotedId ?? ((r as Record<string, unknown>).promoted_id as string),
    sourceMessageId:
      r.sourceMessageId ?? ((r as Record<string, unknown>).source_message_id as string),
    title: r.title,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    score: r.score,
  }));
}
