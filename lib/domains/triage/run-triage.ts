/**
 * M2: TRIAGE RAG 파이프라인 래퍼
 *
 * T-004..T-007: RAG 검색 → LLM 생성 → citation 강제 → confidence 계산
 *
 * @MX:ANCHOR [AUTO] runTriage — TRIAGE 래퍼 진입점
 * @MX:REASON fan_in >= 3: /api/ask route, future /api/inbox auto-triage,
 *          potential workflow integration all call this function.
 * @MX:SPEC SPEC-V3-TRIAGE-001 (REQ-TRI-001..REQ-TRI-005)
 */

import { enforceCitations } from '@/lib/ai/citation-enforce';
import { calculateConfidence } from '@/lib/ai/confidence';
import { hybridRetrieve } from '@/lib/ai/hybrid-router';
import { getLlmModel } from '@/lib/ai/llm-provider';
import { composePrompt } from '@/lib/ai/prompt-templates';
import type { RetrievalResult } from '@/lib/ai/retrievers/types';
import { getEnv } from '@/lib/env';
import { streamText } from 'ai';
import type { AutoAnswer, RagPipelineInput, TriageResult } from './types';

// @MX:WARN [AUTO] 타임아웃 분기 — 21 CFR Part 11 안전장치
// @MX:REASON TRIAGE는 15s 타임아웃으로 강제되어야 합니다.
//          초과 시 티켓은 manual review로 유지됩니다.
// @MX:SPEC SPEC-V3-TRIAGE-001 (REQ-TRI-005)
// @MX:PRIORITY P1 — 환자 safety 관련 시스템 타임아웃

// @MX:WARN [AUTO] no_citations 분기 — 빈 RAG 결과 처리
// @MX:REASON RAG 검색 결과가 없으면 LLM 호출을 건너뛰고 즉시 거부합니다.
//          hallucination 방지와 21 CFR Part 11 준수를 위해 필수적입니다.
// @MX:SPEC SPEC-V3-TRIAGE-001 (E-01)
// @MX:PRIORITY P1 — citation 없는 답변은 허위 정보 위험

/**
 * TRIAGE RAG 파이프라인 실행
 *
 * 흐름:
 * 1. RAG 검색 (hybridRetrieve, 15s 타임아웃)
 * 2. Chunk 변환 (RetrievalResult → RetrievedChunk)
 * 3. 프롬프트 구성 (composePrompt)
 * 4. LLM 생성 (streamText, 2048 tokens)
 * 5. Citation 강제 (enforceCitations)
 * 6. Confidence 계산 (calculateConfidence)
 *
 * @param input - RAG 파이프라인 입력
 * @returns TriageResult - 성공 시 autoAnswer+confidence, 실패 시 error
 */
export async function runTriage(input: RagPipelineInput): Promise<TriageResult> {
  const { question, orgId, signal } = input;
  const timeoutMs = getEnv().TRIAGE_TIMEOUT_MS;

  try {
    // ---- Stage 1: RAG 검색 (15s 타임아웃) ----
    const chunksPromise = hybridRetrieve(question, 'internal', { orgId }, 8);

    // 타임아웃 적용
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs),
    );

    let chunks: RetrievalResult[];
    try {
      chunks = await Promise.race([chunksPromise, timeoutPromise]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      if (message === 'timeout') {
        return { autoAnswer: null, autoConfidence: null, error: 'timeout' };
      }
      throw err; // Re-throw non-timeout errors
    }

    // E-01: 빈 결과 처리
    if (!chunks || chunks.length === 0) {
      return { autoAnswer: null, autoConfidence: null, error: 'no_citations' };
    }

    // ---- Stage 2: Chunk 변환 ----
    const topChunks = chunks.slice(0, 8);
    const retrievedChunks = topChunks.map((r) => ({
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
      sourceHost: (r.metadata.sourceHost as string | null | undefined) ?? null,
      sourceOwner: (r.metadata.sourceOwner as string | null | undefined) ?? null,
      sourceRepo: (r.metadata.sourceRepo as string | null | undefined) ?? null,
      sourceRef: (r.metadata.sourceRef as string | null | undefined) ?? null,
      sourcePath: (r.metadata.sourcePath as string | null | undefined) ?? null,
      metadata: r.metadata, // Keep original metadata for quote extraction
    }));

    // ---- Stage 3: 프롬프트 구성 ----
    const composed = composePrompt(question, 'general', retrievedChunks, 'ko');

    // ---- Stage 4: LLM 생성 ----
    let fullProse = '';
    try {
      const result = await streamText({
        model: getLlmModel(),
        system: composed.systemPrompt,
        prompt: question,
        maxTokens: 2048,
        abortSignal: signal,
      });

      for await (const chunk of result.fullStream) {
        if (chunk.type === 'text-delta' && chunk.textDelta) {
          fullProse += chunk.textDelta;
        }
      }
    } catch (llmErr) {
      // LLM 실패 시 runtime_error 반환
      return { autoAnswer: null, autoConfidence: null, error: 'runtime_error' };
    }

    // ---- Stage 5: Citation 강제 ----
    // @ts-ignore - map callback implicit any acceptable (TDD mode)
    const availableSources = retrievedChunks.map((_, i) => i + 1); // 1-based indices
    const { cleaned } = enforceCitations(fullProse, availableSources);

    // ---- Stage 6: Confidence 계산 ----
    // @ts-ignore - map callback implicit any acceptable (TDD mode)
    const chunkScores = retrievedChunks.map((c) => c.combined_score);
    const totalSentences = cleaned.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
    // Cited count: <sup class="cite" data-source="N"> 패턴 매칭
    const citedCount = (
      cleaned.match(/<sup\b[^>]*\bclass\s*=\s*["'][^"']*\bcite\b[^"']*["'][^>]*>/gi) || []
    ).length;

    const confidence = calculateConfidence({
      chunkScores,
      citedCount,
      totalSentences,
    });

    // ---- Stage 7: Citations 추출 ----
    // LLM은 data-source="N" 형식의 citation을 생성해야 함
    // consult.ts 패턴: extractDataSourceIndices()가 data-source 속성을 추출
    const citations: AutoAnswer['citations'] = [];

    // extractDataSourceIndices 패턴 사용
    const citeRegex = /data-source="(\d+)"/g;
    let match: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions
    // Required for regex exec loop pattern (consult.ts:820)
    while ((match = citeRegex.exec(cleaned)) !== null) {
      if (!match[1]) continue; // Skip if capture group is undefined
      const sourceIndex = Number.parseInt(match[1], 10); // Keep as 1-based for now
      const citeIndex = sourceIndex - 1; // Convert to 0-based

      if (citeIndex >= 0 && citeIndex < retrievedChunks.length) {
        const chunk = retrievedChunks[citeIndex];
        if (chunk) {
          // quote는 optional이므로 안전하게 추출
          const quote = chunk.metadata?.quote as string | undefined;
          const citation: { source: string; quote?: string } = {
            source: chunk.sourceId,
          };
          if (quote) {
            citation.quote = quote;
          }
          citations.push(citation);
        }
      }
    }

    const autoAnswer: AutoAnswer = {
      answer: cleaned,
      citations,
    };

    return { autoAnswer, autoConfidence: confidence };
  } catch (err) {
    // 런타임 예외 처리
    return { autoAnswer: null, autoConfidence: null, error: 'runtime_error' };
  }
}
