/**
 * @MX:ANCHOR [AUTO] runConsult — CONSULT RAG pipeline entry point (RA Power Chat)
 * @MX:REASON fan_in >= 3 (planned): /api/consult/sessions/:id/turns route,
 *          future CLI replay, and integration tests all call this function.
 *          Reuses TRIAGE runTriage for the core RAG pipeline (L-013 / L-014:
 *          TRIAGE 패턴 재사용, 회귀 리스크 최소) and adds CONSULT-specific
 *          citation coverage 80% enforcement (H-3, Charter [지양-2]).
 * @MX:SPEC SPEC-V3-CONSULT-001 (REQ-CONS-004, REQ-CONS-005, AC-CONS-03..05)
 */

import { runTriage } from '@/lib/domains/triage';
import type { RagPipelineInput } from '@/lib/domains/triage/types';

import type {
  ConsultCitation,
  ConsultError,
  ConsultInput,
  ConsultResult,
  ConsultSource,
} from './types';

/**
 * Run the CONSULT RAG pipeline.
 *
 * Flow: delegate to TRIAGE runTriage (15s timeout + AbortController +
 * classifyAndRoute → parallelRetrieveAndMerge → composePrompt → streamText →
 * enforceCitations → confidence), then apply CONSULT-specific citation
 * coverage 80% gate (H-3).
 *
 * Error mapping:
 * - TRIAGE returns `no_citations` / `timeout` / `runtime_error` → forward as-is.
 * - TRIAGE succeeds but uncited ratio > 0.2 (coverage < 80%) → `citation_coverage`.
 *
 * The caller (turn route) MUST persist the turn regardless (answer on success,
 * error string on failure) so the RA member sees feedback in the session.
 */
export async function runConsult(input: ConsultInput): Promise<ConsultResult> {
  const ragInput: RagPipelineInput = {
    question: input.question,
    orgId: input.orgId,
    actorId: input.actorId ?? null,
    signal: input.signal,
  };

  const triage = await runTriage(ragInput);

  if (triage.error) {
    return {
      answer: null,
      citations: [],
      sources: [],
      confidence: triage.autoConfidence,
      error: triage.error as ConsultError,
    };
  }

  const answer = triage.autoAnswer?.answer ?? '';
  const citations: ConsultCitation[] = triage.autoAnswer?.citations ?? [];

  // H-3: citation coverage 80% gate (Charter [지양-2], REQ-CONS-005, AC-CONS-04).
  // TRIAGE rejects only zero-citation answers; CONSULT additionally rejects
  // answers where uncited claims exceed 20% of sentences (regression from
  // legacy consult.ts 80% threshold — research.md:294-297).
  const totalSentences = countSentences(answer);
  const citedSup = countCitedSup(answer);
  if (totalSentences > 0) {
    const uncitedRatio = (totalSentences - citedSup) / totalSentences;
    if (uncitedRatio > 0.2) {
      return {
        answer: null,
        citations: [],
        sources: [],
        confidence: triage.autoConfidence,
        error: 'citation_coverage',
      };
    }
  }

  // Sources derived from citations (richer metadata is a follow-up).
  const sources: ConsultSource[] = citations.map((c) => ({ sourceId: c.source }));

  return {
    answer,
    citations,
    sources,
    confidence: triage.autoConfidence,
    error: null,
  };
}

// ── Citation/counting helpers (mirror TRIAGE run-triage.ts) ───────────────────
// Reimplemented locally for the coverage check. TRIAGE keeps its own copies;
// sharing would widen the TRIAGE API surface (regression risk).

function countSentences(html: string): number {
  // Drop <sup class="cite">…</sup> markers first — citation markers are not
  // prose sentences, so counting "1" / "2" inside them would inflate the
  // denominator and understate coverage (H-3 regression).
  const withoutSup = html.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '');
  const text = withoutSup.replace(/<[^>]+>/g, '');
  return text.split(/[.!?。？！]+/).filter((segment) => segment.trim().length > 0).length;
}

function countCitedSup(html: string): number {
  const matches = html.match(/<sup\b[^>]*\bclass\s*=\s*["'][^"']*\bcite\b[^"']*["'][^>]*>/gi);
  return matches ? matches.length : 0;
}
