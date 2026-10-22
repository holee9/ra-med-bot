// @MX:ANCHOR [AUTO] NasDocsRetriever — NAS 실무문서 Qdrant 검색 (hermes-ra nas_ra_docs).
// @MX:REASON 3세션 협의(2026-10-21)의 핵심 연결: "질의에 답 못함"의 원인이던 지식
//           단절(Regula=git 2저장소만 검색)을 해소 — NAS 실무문서 340만+ 청크가
//           상담 파이프라인의 검색 대상에 합류. llm-wiki 부활의 '살아있는 소비자' 역할.
// @MX:SPEC ECOSYSTEM 헌장 원칙 5 (지식 토대 공유) — Regula는 자체 RAG를 늘리지 않고
//           공유 Qdrant 인덱스를 조회만 한다.
//
// Vector note: nas_ra_docs is embedded at qwen3 NATIVE 4096 dims by hermes-ra;
// queries use getNativeEmbeddingModel (no MRL 1536 truncation).
//
// Security (규약 v1.0): NAS 유래 = [내부]. Chunks surface only inside the
// authenticated app via citations; nothing from here enters any git remote.
// Governance: all results carry the seeded NAS proxy source row (approved /
// internal_sop / licensed), so the authority + license gates pass naturally.

import { embed } from 'ai';
import { getNativeEmbeddingModel } from '../embedding-provider';
import type { IRetriever, RetrievalResult, RetrieverOptions } from './types';

const QDRANT_URL = process.env.QDRANT_URL ?? 'http://localhost:6333';
const COLLECTION = 'nas_ra_docs';
const NAS_ORG_LABEL = 'NAS 실무문서';
const MIN_SCORE = 0.25; // cosine similarity floor — below this the chunk is noise

/** Memoized proxy source row id (seeded once, see scripts/ docs). */
let cachedSourceId: string | null | undefined;

async function resolveSourceId(): Promise<string | null> {
  if (cachedSourceId !== undefined) return cachedSourceId;
  try {
    // Dynamic import keeps this module side-effect-free at load time — the
    // db module runs env validation, which unit tests of OTHER consumers
    // (merge.test) must not trigger.
    const { db } = await import('@/lib/kernel/db/client');
    const { sources } = await import('@/lib/kernel/db/schema');
    const { eq } = await import('drizzle-orm');
    const [row] = await db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.orgLabel, NAS_ORG_LABEL))
      .limit(1);
    cachedSourceId = row?.id ?? null;
  } catch {
    cachedSourceId = null;
  }
  return cachedSourceId;
}

interface QdrantHit {
  id: number | string;
  score: number;
  payload?: {
    file_path?: string;
    filename?: string;
    folder_category?: string;
    chunk_index?: number;
    text?: string;
  };
}

export class NasDocsRetriever implements IRetriever {
  readonly corpus = 'nas-docs';

  async retrieve(query: string, opts: RetrieverOptions = {}): Promise<RetrievalResult[]> {
    // orgId mandatory — same security posture as InternalSopsRetriever
    // (REQ-BREADTH-043 pattern): no unscoped retrieval.
    if (!opts.orgId) return [];
    const sourceId = await resolveSourceId();
    if (!sourceId) return []; // proxy row not seeded — corpus inactive

    let vector: number[];
    try {
      const { embedding } = await embed({
        model: getNativeEmbeddingModel() as never,
        value: query,
      });
      vector = embedding;
    } catch {
      return []; // embedding unavailable → graceful degrade to other corpora
    }

    try {
      const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vector, limit: opts.limit ?? 10, with_payload: true }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      const body = (await res.json()) as { result?: QdrantHit[] };
      return (body.result ?? [])
        .filter((h) => h.score >= MIN_SCORE && h.payload?.text)
        .map((h) => ({
          id: `nas-${String(h.id)}`,
          content: h.payload?.text ?? '',
          score: h.score,
          sourceId,
          metadata: {
            anchor: `${h.payload?.filename ?? 'doc'} #${h.payload?.chunk_index ?? 0}`,
            orgLabel: NAS_ORG_LABEL,
            title: h.payload?.filename ?? 'NAS 문서',
            year: null,
            type: 'Internal',
            url: null,
            sourcePath: h.payload?.file_path ?? null,
            folderCategory: h.payload?.folder_category ?? null,
          },
        }));
    } catch {
      return []; // Qdrant unreachable → other corpora still answer
    }
  }
}
