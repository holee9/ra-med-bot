/**
 * @MX:ANCHOR [AUTO] runTriage — TRIAGE RAG pipeline entry point
 * @MX:REASON fan_in >= 3: /api/ask route, future /api/inbox auto-triage,
 *          and integration tests all call this function. The pipeline mirrors
 *          lib/ai/consult.ts Stages 1-7 (multi-corpus retrieve → chunk adapt →
 *          prompt compose → LLM stream → citation enforce → confidence →
 *          citation extract) but without SSE/conversation side effects so the
 *          /api/ask ticket hook stays transactional.
 * @MX:SPEC SPEC-V3-TRIAGE-001 (REQ-TRI-001..REQ-TRI-005)
 */

import { enforceCitations } from '@/lib/ai/citation-enforce';
import { calculateConfidence } from '@/lib/ai/confidence';
import { classifyIntent } from '@/lib/ai/intent';
import { getLlmModel } from '@/lib/ai/llm-provider';
import { parallelRetrieveAndMerge } from '@/lib/ai/merge';
import { composePrompt } from '@/lib/ai/prompt-templates';
import type { RetrievedChunk } from '@/lib/ai/retrievers/hybrid-search';
import type { RetrievalResult } from '@/lib/ai/retrievers/types';
import { classifyAndRoute } from '@/lib/ai/router';
import { getEnv } from '@/lib/env';
import { streamText } from 'ai';
import type { AutoAnswer, RagPipelineInput, TriageResult } from './types';

/**
 * @MX:WARN [AUTO] TRIAGE 15s timeout + citation validation branch (21 CFR Part 11).
 * @MX:REASON AbortController enforces TRIAGE_TIMEOUT_MS. On timeout the ticket
 *          stays in 'auto' state for manual review (REQ-TRI-005 fallback).
 *          Empty citations reject the answer (AC-06 / Charter [지양-2]).
 * @MX:SPEC SPEC-V3-TRIAGE-001 (REQ-TRI-002, REQ-TRI-005, AC-TRI-02, AC-TRI-04)
 */
const TRIAGE_LOCALE = 'ko' as const;
const TOP_K = 8;

/**
 * Run the TRIAGE RAG pipeline with a 15s timeout.
 *
 * Flow (mirrors consult.ts Stages 1-7 without SSE/conversation side effects):
 * 1. classifyAndRoute — multi-corpus routing (consult.ts:135 pattern)
 * 2. parallelRetrieveAndMerge — top-K retrieval + RLHF re-rank (consult.ts:146)
 * 3. RetrievalResult → RetrievedChunk adaptation (consult.ts:152-170)
 * 4. composePrompt — citation directive + chunk context (consult.ts:193)
 * 5. streamText — LLM prose with systemPrompt + chunkContext (consult.ts:300)
 * 6. enforceCitations — strip invalid sources, mark uncited claims
 * 7. calculateConfidence + citation extraction
 *
 * On empty retrieved chunks OR zero cited sources: returns `no_citations`
 * (AC-06 direct enforcement). On timeout: returns `timeout`. On any other
 * thrown error: returns `runtime_error`. The caller (/api/ask) MUST keep the
 * ticket in `auto` state for all error cases so manual review is still possible.
 */
export async function runTriage(input: RagPipelineInput): Promise<TriageResult> {
  const timeoutMs = getEnv().TRIAGE_TIMEOUT_MS;
  const controller = new AbortController();
  linkAbortSignals(input.signal, controller);

  // The timeout promise resolves with a `timeout` result when the internal
  // timer fires, AND aborts the controller so any in-flight streamText stops.
  // Promise.race against runPipeline bounds EVERY stage (retrieval, classify,
  // LLM) — not just streamText — so a hung retrieval cannot block the response.
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<TriageResult>((resolve) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      resolve({ autoAnswer: null, autoConfidence: null, error: 'timeout' });
    }, timeoutMs);
  });

  try {
    return await Promise.race([runPipeline(input, controller.signal), timeoutPromise]);
  } catch {
    // Pipeline threw before the timeout fired — caller-initiated abort or
    // retrieval/LLM runtime failure. Ticket stays in 'auto' for manual review.
    return { autoAnswer: null, autoConfidence: null, error: 'runtime_error' };
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

async function runPipeline(input: RagPipelineInput, signal: AbortSignal): Promise<TriageResult> {
  const { question, orgId, actorId } = input;

  const { corpora } = await classifyAndRoute(question, ['us']);
  const mergedResults = await parallelRetrieveAndMerge(question, corpora, {
    limit: 10,
    orgId,
    actorId: actorId ?? null,
  });

  // E-01: empty retrieval — no chunks to cite → AC-06 violation.
  if (mergedResults.length === 0) {
    return { autoAnswer: null, autoConfidence: null, error: 'no_citations' };
  }

  const topChunks = mergedResults.slice(0, TOP_K).map(adaptChunk);
  const intent = await classifyIntent(question, TRIAGE_LOCALE);
  const composed = composePrompt(question, intent, topChunks, TRIAGE_LOCALE);

  const fullProse = await streamProse(composed, question, signal);

  const availableSources = topChunks.map((_, index) => index + 1);
  const { cleaned } = enforceCitations(fullProse, availableSources);

  const autoConfidence = calculateConfidence({
    chunkScores: topChunks.map((chunk) => chunk.combined_score),
    citedCount: countCitedSup(cleaned),
    totalSentences: countSentences(cleaned),
  });

  const citedIndices = extractDataSourceIndices(cleaned);
  const citedChunks = topChunks
    .map((chunk, index) => ({ chunk, citeIndex: index + 1 }))
    .filter((entry) => citedIndices.has(entry.citeIndex));

  // AC-06 (REQ-TRI-002): citation-less answer MUST be rejected.
  if (citedChunks.length === 0) {
    return { autoAnswer: null, autoConfidence: null, error: 'no_citations' };
  }

  const autoAnswer: AutoAnswer = {
    answer: cleaned,
    citations: citedChunks.map((entry) => ({ source: entry.chunk.sourceId })),
  };

  return { autoAnswer, autoConfidence };
}

/**
 * Adapt RetrievalResult → RetrievedChunk (consult.ts:152-170 pattern).
 * `metadata` is Record<string, unknown>; fields are coerced with type guards.
 */
function adaptChunk(result: RetrievalResult): RetrievedChunk {
  const meta = result.metadata;
  const stringField = (key: string): string =>
    typeof meta[key] === 'string' ? (meta[key] as string) : '';
  const numberField = (key: string): number =>
    typeof meta[key] === 'number' ? (meta[key] as number) : 0;
  const optionalString = (key: string): string | null =>
    typeof meta[key] === 'string' ? (meta[key] as string) : null;

  return {
    sectionId: result.id,
    sourceId: result.sourceId,
    anchor: stringField('anchor'),
    text: result.content,
    offset: numberField('offset'),
    vec_score: result.score,
    fts_score: result.score,
    combined_score: result.score,
    orgLabel: stringField('orgLabel'),
    title: stringField('title'),
    year: typeof meta.year === 'number' ? (meta.year as number) : null,
    type: stringField('type'),
    url: optionalString('url'),
    sourceHost: optionalString('sourceHost'),
    sourceOwner: optionalString('sourceOwner'),
    sourceRepo: optionalString('sourceRepo'),
    sourceRef: optionalString('sourceRef'),
    sourcePath: optionalString('sourcePath'),
  };
}

async function streamProse(
  composed: { systemPrompt: string; chunkContext: string },
  question: string,
  signal: AbortSignal,
): Promise<string> {
  // LLM needs the chunk context to ground citations — systemPrompt alone would
  // leave the model without retrieved evidence (RAG would be inert).
  const system = composed.chunkContext
    ? `${composed.systemPrompt}\n\n${composed.chunkContext}`
    : composed.systemPrompt;

  const result = await streamText({
    model: getLlmModel(),
    system,
    prompt: question,
    maxTokens: 2048,
    abortSignal: signal,
  });

  let prose = '';
  for await (const part of result.fullStream) {
    if (part.type === 'text-delta' && part.textDelta) {
      prose += part.textDelta;
    }
  }
  return prose;
}

/** Merge an external AbortSignal into the internal timeout controller. */
function linkAbortSignals(external: AbortSignal | undefined, controller: AbortController): void {
  if (!external) return;
  if (external.aborted) {
    controller.abort();
    return;
  }
  external.addEventListener('abort', () => controller.abort(), { once: true });
}

// ── Citation/counting helpers (mirrors consult.ts private helpers) ────────────
// These are reimplemented locally because consult.ts does not export them.
// Keeping them private avoids widening the consult API surface (regression risk).

function countSentences(html: string): number {
  const text = html.replace(/<[^>]+>/g, '');
  return text.split(/[.!?。？！]+/).filter((segment) => segment.trim().length > 0).length;
}

function countCitedSup(html: string): number {
  const matches = html.match(/<sup\b[^>]*\bclass\s*=\s*["'][^"']*\bcite\b[^"']*["'][^>]*>/gi);
  return matches ? matches.length : 0;
}

function extractDataSourceIndices(html: string): Set<number> {
  const indices = new Set<number>();
  const regex = /data-source="(\d+)"/g;
  let match: RegExpExecArray | null = regex.exec(html);
  while (match !== null) {
    const value = match[1];
    if (value !== undefined) {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        indices.add(parsed);
      }
    }
    match = regex.exec(html);
  }
  return indices;
}
