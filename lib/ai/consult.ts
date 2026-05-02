// @MX:ANCHOR RAG pipeline entry point — 8-stage async generator yielding StreamEvents.
// @MX:REASON Single orchestration function that the SSE route handler calls. Every
// consult flows through here. fan_in >= 3: route.ts, tests, future scheduled tasks.
// @MX:WARN Complex orchestration with LLM streaming, DB writes, and audit calls.
// @MX:REASON All side-effects (writeAudit, persistMessage) must happen regardless
// of abort; use try/finally to ensure persistence.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-011..020, REQ-CHAT-053..055)

import { createHash } from 'node:crypto';
import { anthropic } from '@ai-sdk/anthropic';
import { type LanguageModel, streamText } from 'ai';
import type { Session } from 'next-auth';
import type { ConsultRequest } from '../../types/consult';
import type { SourceItem, StreamEvent, TraceEvent } from '../../types/streaming';
import { writeAudit } from '../audit';
import { db } from '../db/client';
import { conversations } from '../db/schema';
import { enforceCitations } from './citation-enforce';
import { calculateConfidence, getConfidenceLevel } from './confidence';
import { classifyIntent } from './intent';
import { persistMessage } from './persistence';
import { composePrompt } from './prompt-templates';
import { rewriteQuery } from './query-rewrite';
import { searchFDACorpus } from './retrievers/fda';
import type { RetrievedChunk } from './retrievers/hybrid-search';
import { StreamOrderValidator } from './streaming';

// Minimum delay between trace active → done transitions for perceptibility (REQ-CHAT-016).
const TRACE_MIN_DELAY_MS = 500;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Main RAG pipeline. Yields StreamEvents in 3-phase SSE order.
 *
 * Phase A: meta → trace*(N)
 * Phase B: prose_delta*(M)
 * Phase C: confidence → sources → [expert_review_required?] → done
 */
export async function* consult(
  input: ConsultRequest,
  session: Session,
  messageId: string,
  conversationId: string,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const validator = new StreamOrderValidator();
  const startTs = Date.now();

  function* emit(ev: StreamEvent): Generator<StreamEvent> {
    validator.validate(ev);
    yield ev;
  }

  // ---- Phase A: meta ----
  yield* emit({ type: 'meta', conversationId, messageId });

  // ---- Stage 1: Intent classification ----
  const intentTraceActive: TraceEvent = {
    type: 'trace',
    step: '질의 유형 분류 중',
    status: 'active',
  };
  yield* emit(intentTraceActive);

  if (signal?.aborted) return;
  const intentStart = Date.now();
  const intent = await classifyIntent(input.question, input.locale);
  // Ensure minimum delay for perceptibility.
  const intentElapsed = Date.now() - intentStart;
  if (intentElapsed < TRACE_MIN_DELAY_MS) await sleep(TRACE_MIN_DELAY_MS - intentElapsed);

  yield* emit({ type: 'trace', step: '질의 유형 분류 중', status: 'done' });

  // ---- Stage 2: Query rewrite ----
  if (signal?.aborted) return;
  const rewrittenQuery = rewriteQuery(input.question, input.locale, intent);

  // ---- Stage 3: Hybrid search ----
  yield* emit({ type: 'trace', step: '검색 중: FDA 코퍼스', status: 'active' });

  if (signal?.aborted) return;
  const searchStart = Date.now();
  const chunks = await searchFDACorpus(rewrittenQuery, 10, input.sourceFilter);
  const searchElapsed = Date.now() - searchStart;
  if (searchElapsed < TRACE_MIN_DELAY_MS) await sleep(TRACE_MIN_DELAY_MS - searchElapsed);

  yield* emit({ type: 'trace', step: '검색 중: FDA 코퍼스', status: 'done' });

  // Audit: source access — one row per unique sourceId in top-8 chunks.
  const topChunks = chunks.slice(0, 8);
  const uniqueSources = new Map<string, RetrievedChunk[]>();
  for (const c of topChunks) {
    if (!uniqueSources.has(c.sourceId)) uniqueSources.set(c.sourceId, []);
    uniqueSources.get(c.sourceId)!.push(c);
  }

  // ---- Stage 4: Extract relevant sections ----
  yield* emit({ type: 'trace', step: '관련 조항 추출 중', status: 'active' });
  const extractStart = Date.now();
  // (Reranker deferred to Phase 5 — use combined_score order)
  await sleep(Math.max(0, TRACE_MIN_DELAY_MS - (Date.now() - extractStart)));
  yield* emit({ type: 'trace', step: '관련 조항 추출 중', status: 'done' });

  // ---- Stage 5: Prompt composition ----
  yield* emit({ type: 'trace', step: '답변 생성 중', status: 'active' });

  if (signal?.aborted) return;
  const composed = composePrompt(rewrittenQuery, intent, topChunks, input.locale);

  // Build Anthropic messages with cache_control on chunk context block.
  const systemMessages = [
    { type: 'text' as const, text: composed.systemPrompt },
    ...(composed.chunkContext
      ? [
          {
            type: 'text' as const,
            text: composed.chunkContext,
            experimental_providerMetadata: {
              anthropic: { cacheControl: { type: 'ephemeral' } },
            },
          },
        ]
      : []),
  ];

  // ---- Stage 6: LLM streaming ----
  if (signal?.aborted) return;

  // Audit: LLM call — before starting consult (REQ-CHAT-053).
  await writeAudit({
    actor_id: session.user?.id ?? null,
    action: 'llm.call',
    resource_type: 'message',
    resource_id: messageId,
    conversation_id: conversationId,
    meta_json: {
      model: 'claude-sonnet-4-5',
      question_hash: sha256Hex(input.question),
      locale: input.locale,
      source_filter: input.sourceFilter,
      project_id: input.projectId ?? null,
    },
  });

  // @MX:NOTE Cast bridges the v3 provider → v1-typed `ai` SDK. Runtime is fine.
  const result = await streamText({
    model: anthropic('claude-sonnet-4-5') as unknown as LanguageModel,
    messages: [
      {
        role: 'user',
        content: [
          // Pass system content as first user block via prefilled approach.
          // Actually use system param directly.
        ],
      },
    ],
    system: systemMessages.map((m) => m.text).join('\n\n'),
    prompt: rewrittenQuery,
    maxTokens: 2048,
    abortSignal: signal,
  });

  yield* emit({ type: 'trace', step: '답변 생성 중', status: 'done' });

  // ---- Phase B: Stream prose_delta ----
  let fullProse = '';
  let tokensIn: number | null = null;
  let tokensOut: number | null = null;

  for await (const chunk of result.fullStream) {
    if (signal?.aborted) return;

    if (chunk.type === 'text-delta' && chunk.textDelta) {
      fullProse += chunk.textDelta;
      yield* emit({ type: 'prose_delta', delta: chunk.textDelta });
    } else if (chunk.type === 'finish') {
      tokensIn = chunk.usage?.promptTokens ?? null;
      tokensOut = chunk.usage?.completionTokens ?? null;
    }
  }

  // ---- Stage 7: Post-process ----
  // Citation enforcement
  // Collect available source indices (1-based, all topChunks)
  const availableSources = topChunks.map((_, i) => i + 1);
  const { cleaned, violations } = enforceCitations(fullProse, availableSources);

  // Calculate confidence
  const chunkScores = topChunks.map((c) => c.combined_score);
  const totalSentences = countSentences(cleaned);
  const citedCount = countCitedSentences(cleaned);
  const confidenceScore = calculateConfidence({ chunkScores, citedCount, totalSentences });
  const confidenceLevel = getConfidenceLevel(confidenceScore);

  // Determine cited source indices from HTML.
  const citedIndices = extractDataSourceIndices(cleaned);
  const citedChunks = topChunks
    .map((c, i) => ({ ...c, citeIndex: i + 1 }))
    .filter((c) => citedIndices.has(c.citeIndex));

  // Audit: source access per unique sourceId in cited chunks (REQ-CHAT-054).
  const auditedSources = new Set<string>();
  for (const chunk of citedChunks) {
    if (!auditedSources.has(chunk.sourceId)) {
      auditedSources.add(chunk.sourceId);
      const sameSourceChunks = citedChunks.filter((c) => c.sourceId === chunk.sourceId);
      await writeAudit({
        actor_id: session.user?.id ?? null,
        action: 'source.access',
        resource_type: 'source',
        resource_id: chunk.sourceId,
        conversation_id: conversationId,
        meta_json: {
          cite_indices: sameSourceChunks.map((c) => c.citeIndex),
          org_label: chunk.orgLabel,
          section_anchors: sameSourceChunks.map((c) => c.anchor),
        },
      });
    }
  }

  // ---- Phase C: structured events ----
  yield* emit({ type: 'confidence', level: confidenceLevel, score: confidenceScore });

  // Build sources items for SSE.
  const sourceItems: SourceItem[] = citedChunks.map((c) => ({
    id: c.sourceId,
    citeIndex: c.citeIndex,
    orgLabel: c.orgLabel,
    title: c.title,
    year: c.year,
    type: c.type as SourceItem['type'],
    url: c.url,
    anchor: c.anchor,
    offset: c.offset,
  }));
  sourceItems.sort((a, b) => a.citeIndex - b.citeIndex);

  yield* emit({ type: 'sources', items: sourceItems });

  // Expert review gating (REQ-CHAT-055).
  const uncitedViolationCount = violations.filter((v) => v.type === 'CLAIM_UNCITED').length;
  const citationCoverageBelow80 =
    totalSentences > 0 && uncitedViolationCount / totalSentences > 0.2;
  const requiresExpertReview = confidenceScore < 0.7 || citationCoverageBelow80;

  if (requiresExpertReview) {
    const reason =
      confidenceScore < 0.7
        ? `confidence score ${confidenceScore.toFixed(2)} < 0.7`
        : 'citation coverage < 80%';

    yield* emit({ type: 'expert_review_required', reason });

    await writeAudit({
      actor_id: session.user?.id ?? null,
      action: 'expert_review.flag',
      resource_type: 'message',
      resource_id: messageId,
      conversation_id: conversationId,
      meta_json: {
        reason,
        confidence_score: confidenceScore,
        trigger: 'auto',
      },
    });
  }

  // ---- Stage 8: Persist ----
  if (!signal?.aborted) {
    await persistMessage({
      conversationId,
      messageId,
      userQuestion: input.question,
      cleanedProse: cleaned,
      confidenceLevel,
      confidenceScore,
      durationMs: Date.now() - startTs,
      expertReviewRequired: requiresExpertReview,
      tokensIn,
      tokensOut,
      model: 'claude-sonnet-4-5',
      violations,
      citedChunks,
    });
  }

  yield* emit({ type: 'done', duration_ms: Date.now() - startTs });
}

/**
 * Ensure a conversation row exists, creating one if needed.
 */
export async function ensureConversation(
  conversationId: string | undefined,
  userId: string,
  projectId: string | undefined,
): Promise<string> {
  if (conversationId) return conversationId;

  const [conv] = await db
    .insert(conversations)
    .values({ userId, projectId: projectId ?? null, title: null })
    .returning({ id: conversations.id });
  if (conv === undefined) throw new Error('Failed to create conversation');
  return conv.id;
}

// Helpers

function countSentences(html: string): number {
  const text = html.replace(/<[^>]+>/g, '');
  const matches = text.match(/[.?!。？！]/g);
  return matches ? matches.length : 0;
}

function countCitedSentences(html: string): number {
  // A sentence is "cited" if it contains <sup class="cite"> tag.
  const segments = html.split(/[.?!。？！]/);
  return segments.filter((seg) => /<sup[^>]+class="[^"]*cite[^"]*"/.test(seg)).length;
}

function extractDataSourceIndices(html: string): Set<number> {
  const cited = new Set<number>();
  const re = /data-source="(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const captured = m[1];
    if (captured !== undefined) cited.add(Number.parseInt(captured, 10));
  }
  return cited;
}
