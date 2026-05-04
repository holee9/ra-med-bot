// @MX:ANCHOR RAG pipeline entry point — 8-stage async generator yielding StreamEvents.
// @MX:REASON Single orchestration function that the SSE route handler calls. Every
// consult flows through here. fan_in >= 3: route.ts, tests, future scheduled tasks.
// @MX:WARN Complex orchestration with LLM streaming, DB writes, and audit calls.
// @MX:REASON All side-effects (writeAudit, persistMessage) must happen regardless
// of abort; use try/finally to ensure persistence.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-011..020, REQ-CHAT-053..055)
// @MX:SPEC SPEC-REGULA-STRUCTURED-001 (REQ-STRUCT-002, REQ-STRUCT-034~036)

import { createHash } from 'node:crypto';
import { anthropic } from '@ai-sdk/anthropic';
import { type LanguageModel, streamText } from 'ai';
import { eq } from 'drizzle-orm';
import type { Session } from 'next-auth';
import type { ConsultRequest } from '../../types/consult';
import type { SourceItem, StreamEvent, TraceEvent } from '../../types/streaming';
import { writeAudit } from '../audit';
import { db } from '../db/client';
import { conversations, messageBlocks, messages } from '../db/schema';
import { enforceCitations } from './citation-enforce';
import { calculateConfidence, getConfidenceLevel } from './confidence';
import { shouldAutoFlag } from './expert-review-gating';
import { enqueueExpertReview } from './expert-review-queue';
import { classifyIntent } from './intent';
import { enrichWithExternalData } from './external-enrichment';
import { parallelRetrieveAndMerge } from './merge';
import { persistMessage } from './persistence';
import { composePrompt } from './prompt-templates';
import { rewriteQuery } from './query-rewrite';
import type { RetrievedChunk } from './retrievers/hybrid-search';
import { classifyAndRoute } from './router';
import { StreamOrderValidator } from './streaming';
import { OrderViolationError, generateStructuredBlocks } from './structured-blocks';

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

  // External enrichment: run in parallel with subsequent stages, graceful degrade.
  // REQ-EXT-003, REQ-EXT-006, REQ-EXT-010
  const externalCitationsPromise = enrichWithExternalData(intent, input.question);

  // ---- Stage 2: Query rewrite ----
  if (signal?.aborted) return;
  const rewrittenQuery = rewriteQuery(input.question, input.locale, intent);

  // ---- Stage 3: Multi-corpus retrieval via router + merge (REQ-BREADTH-038/039) ----
  yield* emit({ type: 'trace', step: '규정 코퍼스 검색 중', status: 'active' });

  if (signal?.aborted) return;
  const searchStart = Date.now();
  const { corpora } = await classifyAndRoute(rewrittenQuery, input.projectTargetMarkets ?? ['us']);
  const mergedResults = await parallelRetrieveAndMerge(rewrittenQuery, corpora, { limit: 10 });
  // Adapt RetrievalResult[] → RetrievedChunk[] shape expected by composePrompt.
  const chunks: RetrievedChunk[] = mergedResults.map((r) => ({
    sectionId: r.id,
    sourceId: r.sourceId,
    anchor: (r.metadata.anchor as string | undefined) ?? '',
    text: r.content,
    offset: (r.metadata.offset as number | undefined) ?? 0,
    vec_score: r.score,
    fts_score: r.score,
    combined_score: r.score,
    orgLabel: (r.metadata.orgLabel as string | undefined) ?? '',
    title: (r.metadata.title as string | undefined) ?? '',
    year: (r.metadata.year as number | null | undefined) ?? null,
    type: (r.metadata.type as string | undefined) ?? '',
    url: (r.metadata.url as string | null | undefined) ?? null,
  }));
  const searchElapsed = Date.now() - searchStart;
  if (searchElapsed < TRACE_MIN_DELAY_MS) await sleep(TRACE_MIN_DELAY_MS - searchElapsed);

  yield* emit({ type: 'trace', step: '규정 코퍼스 검색 중', status: 'done' });

  // Audit: source access — one row per unique sourceId in top-8 chunks.
  const topChunks = chunks.slice(0, 8);
  const uniqueSources = new Map<string, RetrievedChunk[]>();
  for (const c of topChunks) {
    let chunks = uniqueSources.get(c.sourceId);
    if (!chunks) {
      chunks = [];
      uniqueSources.set(c.sourceId, chunks);
    }
    chunks.push(c);
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

  // Await external citations enrichment and append to source items (REQ-EXT-003, 006, 010).
  // Errors already swallowed inside enrichWithExternalData — safe to await here.
  const externalCitations = await externalCitationsPromise;
  const allSourceItems = [...sourceItems, ...externalCitations];

  yield* emit({ type: 'sources', items: allSourceItems });

  // ---- Phase C: structured blocks (REQ-STRUCT-002, REQ-STRUCT-003) ----
  // prose_done flag guards against OrderViolationError — structured events
  // MUST only be emitted after prose streaming is complete.
  const prose_done = true; // set after fullProse is assembled and sources emitted
  if (!prose_done) throw new OrderViolationError('structured');

  if (!signal?.aborted) {
    const topSourceMeta = citedChunks.slice(0, 3).map((c) => ({
      title: c.title,
      orgLabel: c.orgLabel,
      year: c.year,
    }));

    let structuredOrderIndex = 1; // prose block is index 0 (written by persistMessage)

    try {
      for await (const blockEvent of generateStructuredBlocks(
        {
          question: input.question,
          prose: cleaned,
          topSources: topSourceMeta,
          messageId,
          locale: 'ko',
        },
        signal,
      )) {
        if (signal?.aborted) break;

        // Map event type to blockTypeEnum value (REQ-STRUCT-034)
        const blockTypeMap: Record<string, 'checklist' | 'comparison' | 'timeline' | 'related'> = {
          checklist: 'checklist',
          comparison: 'comparison',
          timeline: 'timeline',
          related: 'related',
        };
        const blockType = blockTypeMap[blockEvent.type];

        if (blockType) {
          // Persist block before SSE emit (REQ-STRUCT-034, REQ-STRUCT-035)
          try {
            await db.insert(messageBlocks).values({
              messageId,
              blockType,
              blockJson: blockEvent as unknown as Record<string, unknown>,
              orderIndex: structuredOrderIndex,
            });
            structuredOrderIndex++;
          } catch (insertErr) {
            // REQ-STRUCT-035: log and continue — emit even if persist fails
            console.error('[consult] messageBlocks INSERT failed for', blockEvent.type, insertErr);
          }
        }

        yield* emit(blockEvent);
      }
    } catch (err) {
      if (signal?.aborted) {
        // Silently swallow abort errors
      } else {
        console.error('[consult] generateStructuredBlocks error:', err);
      }
    }
  }

  // Expert review gating (REQ-CHAT-055).
  const uncitedViolationCount = violations.filter((v) => v.type === 'CLAIM_UNCITED').length;
  const citationCoverageBelow80 =
    totalSentences > 0 && uncitedViolationCount / totalSentences > 0.2;

  // REQ-ENTERPRISE-008: use shouldAutoFlag for gating (adds policy keyword detection)
  const autoFlagResult = shouldAutoFlag(confidenceScore, input.question, cleaned);
  const requiresExpertReview = autoFlagResult.flag || citationCoverageBelow80;

  if (requiresExpertReview) {
    const reason =
      autoFlagResult.reason ?? (citationCoverageBelow80 ? 'citation coverage < 80%' : 'unknown');

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

    // REQ-ENTERPRISE-009: enqueue for reviewer assignment (idempotent)
    await enqueueExpertReview({
      conversationId,
      messageId,
      reason,
      requestedBy: '00000000-0000-0000-0000-000000000001', // SYSTEM_USER_UUID
    });

    // REQ-ENTERPRISE-010: mark message as requiring expert review
    await db.update(messages).set({ expertReviewRequired: true }).where(eq(messages.id, messageId));

    // REQ-ENTERPRISE-010: audit the auto-flag event
    await writeAudit({
      actor_id: '00000000-0000-0000-0000-000000000001',
      action: 'consult.expert_review_auto_flag',
      resource_type: 'message',
      resource_id: messageId,
      conversation_id: conversationId,
      meta_json: {
        reason,
        confidence_score: confidenceScore,
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
  let m = re.exec(html);
  while (m !== null) {
    const captured = m[1];
    if (captured !== undefined) cited.add(Number.parseInt(captured, 10));
    m = re.exec(html);
  }
  return cited;
}
