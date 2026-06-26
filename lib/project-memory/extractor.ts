// @MX:NOTE [AUTO] AI decision extractor — detects RA decisions in conversation (AC-03).
// @MX:SPEC SPEC-REGULA-PROJECT-MEMORY-001 (REQ-004, REQ-005, REQ-013, AC-03)
// @MX:REASON Charter [지양-4] / REQ-005: the extractor NEVER auto-activates a
//   memory. It detects candidate decisions and writes status='pending' rows
//   for RA-lead review. Only approveSuggestedMemory() (explicit API) can
//   promote pending -> active. REQ-013: every extraction records
//   sourceConversationId for provenance. §7 #1: confidence < 0.7 is dropped to
//   avoid pending-queue spam.
//
// AC-03 dead-code prevention (L-008): detectDecisions MUST be called from
//   lib/ai/consult.ts after the assistant answer is persisted (fire-and-forget,
//   non-blocking). The wiring + pending-only invariant are verified by
//   tests/unit/project-memory/extractor.test.ts (two-layer: parseSuggestions
//   unit + persistSuggestionsAsPending pending-only assertion + consult wiring).

import { getLlmFastModel } from '@/lib/ai/llm-provider';
import { logger } from '@/lib/observability/logger';
import { type LanguageModel, generateText } from 'ai';
import { createMemory } from './manager';

/**
 * A single detected RA decision candidate. The extractor returns these;
 * the caller (consult.ts) persists each as a status='pending' project_memory row.
 */
export interface SuggestedMemory {
  memoryType:
    | 'device_classification'
    | 'target_markets'
    | 'submission_strategy'
    | 'predicate_device'
    | 'risk_class'
    | 'custom';
  key: string;
  value: string;
  /** §7 #1: confidence >= 0.7 required, else the suggestion is dropped. */
  confidence: number;
}

const CONFIDENCE_THRESHOLD = 0.7;

/**
 * Few-shot prompt (§7 design decision #1). Korean-first with RA terminology;
 * the model returns STRICT JSON. Lower confidence than threshold => empty list.
 */
const EXTRACTION_PROMPT = (conversationText: string) => `당신은 의료기기 규제(RA) 대화 분석기입니다.
다음 대화에서 명시적으로 결정된 RA 의사결정을 감지하라. 6가지 카테고리만 인식한다:
- device_classification: 디바이스 분류 (예: "Class II", "Class IIa", "Class III")
- target_markets: 목표 시장 (예: "FDA", "EU MDR", "MFDS", "NMPA", "PMDA")
- submission_strategy: 제출 전략 (예: "510(k)", "PMA", "De Novo", "CE 마킹")
- predicate_device: predicate device 결정 (예: 기기명, 모델)
- risk_class: 위험 등급 (예: "Class B", "Class IIa", "고위험")
- custom: 위 카테고리에 속하지 않는 중요한 프로젝트 의사결정

규칙:
1. 명시적 결정만 감지 (추측 금지).
2. confidence 0.7 미만은 제외.
3. JSON 배열로만 응답. 각 원소: {"memoryType","key","value","confidence"}.
4. 감지된 것이 없으면 빈 배열 [] 반환.

대화:
"""
${conversationText.slice(0, 4000)}
"""

JSON 배열:`;

interface RawSuggestion {
  memoryType?: string;
  key?: string;
  value?: string;
  confidence?: number;
}

const VALID_TYPES = new Set([
  'device_classification',
  'target_markets',
  'submission_strategy',
  'predicate_device',
  'risk_class',
  'custom',
]);

/**
 * REQ-004 / AC-03: detect RA decisions in a conversation. Returns suggestion
 * candidates; DOES NOT WRITE active rows (Charter [지양-4]). The caller
 * (consult.ts) writes each as status='pending' via createMemory.
 *
 * Non-fatal: LLM unavailable or malformed response => empty array (no
 * false-positive pending rows).
 */
export async function detectDecisions(conversationText: string): Promise<SuggestedMemory[]> {
  try {
    const { text } = await generateText({
      model: getLlmFastModel(),
      prompt: EXTRACTION_PROMPT(conversationText),
      maxTokens: 800,
    });

    const parsed = parseSuggestions(text);
    return parsed.filter((s) => s.confidence >= CONFIDENCE_THRESHOLD);
  } catch (err) {
    // LLM unavailable / misconfigured / network — log so AC-03 failures are
    // observable (a silent swallow hides extractor breakage behind an empty
    // pending queue). Never throw (caller is fire-and-forget in consult.ts).
    logger.error('[project-memory] detectDecisions failed (non-fatal):', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/** Parse + validate the LLM JSON response. Visible for testing. */
export function parseSuggestions(raw: string): SuggestedMemory[] {
  const jsonText = extractJsonArray(raw);
  if (!jsonText) return [];

  let arr: unknown;
  try {
    arr = JSON.parse(jsonText);
  } catch {
    return [];
  }

  if (!Array.isArray(arr)) return [];

  const out: SuggestedMemory[] = [];
  for (const item of arr) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as RawSuggestion;
    if (typeof r.memoryType !== 'string' || !VALID_TYPES.has(r.memoryType)) continue;
    if (typeof r.key !== 'string' || r.key.trim().length === 0) continue;
    if (typeof r.value !== 'string' || r.value.trim().length === 0) continue;
    const confidence = typeof r.confidence === 'number' ? r.confidence : 0;
    out.push({
      memoryType: r.memoryType as SuggestedMemory['memoryType'],
      key: r.key.slice(0, 200),
      value: r.value.slice(0, 1000),
      confidence,
    });
  }
  return out;
}

function extractJsonArray(raw: string): string | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf('[');
  const end = trimmed.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  return trimmed.slice(start, end + 1);
}

/**
 * REQ-013 / REQ-005: persist detected suggestions as status='pending' rows.
 * Called from consult.ts after the assistant answer is persisted. Each
 * suggestion records its sourceConversationId (provenance) and the system
 * actor. Non-fatal: a single persist failure does not abort the others.
 *
 * This helper lives here (not in manager.ts) because the "write pending" loop
 * is extractor-specific behavior. manager.createMemory handles the actual row.
 */
export async function persistSuggestionsAsPending(params: {
  suggestions: SuggestedMemory[];
  projectId: string;
  conversationId: string;
  orgId: string;
  /** System actor id for the pending row's created_by (REQ-013 provenance). */
  systemActorId: string;
}): Promise<{ written: number }> {
  const { suggestions, projectId, conversationId, orgId, systemActorId } = params;
  let written = 0;
  for (const s of suggestions) {
    try {
      await createMemory({
        projectId,
        memoryType: s.memoryType,
        key: s.key,
        value: s.value,
        sourceConversationId: conversationId,
        userId: systemActorId,
        orgId,
        status: 'pending', // Charter [지양-4] / REQ-005 — NEVER 'active' here.
      });
      written += 1;
    } catch {
      // Non-fatal: a single failure MUST NOT abort the consult stream.
    }
  }
  return { written };
}

// Re-export LanguageModel type for test mocking.
export type { LanguageModel };
