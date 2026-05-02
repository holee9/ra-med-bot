// @MX:ANCHOR Prompt composition — citation directive + chunk context + question.
// @MX:REASON The exact prompt text is the contract that produces 95%+ citation
// coverage. Any change MUST be reviewed by regula-compliance-qa. fan_in: consult.ts
// + tests.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-021, REQ-CHAT-022)

import type { Intent } from './intent';
import type { RetrievedChunk } from './retrievers/hybrid-search';

export interface ComposedPrompt {
  /** System prompt with verbatim citation directive (REQ-CHAT-021). */
  systemPrompt: string;
  /** Numbered chunk context block to be wrapped with cache_control downstream. */
  chunkContext: string;
  /** The (already-rewritten) user question. */
  userQuestion: string;
}

// REQ-CHAT-021 — VERBATIM. Do not paraphrase, shorten, or "improve" this text
// without a SPEC change request. The citation enforcement post-processor relies
// on the model having internalized this exact contract.
const CITATION_DIRECTIVE_KO = `모든 사실 주장(claim)에는 반드시 출처 번호를
<sup class="cite" data-source="N" data-offset="M">N</sup>
형식으로 inline 인용하세요. 출처 없이 주장을 생성하지 마세요.
사용자의 질문에 대한 답을 retrieved 출처에서 찾을 수 없으면
"해당 질문에 대한 공식 출처를 찾을 수 없습니다"라고만 답하세요.
상상으로 규정을 만들지 마세요.`;

const CITATION_DIRECTIVE_EN = `Every factual claim MUST include an inline citation in the form
<sup class="cite" data-source="N" data-offset="M">N</sup>.
Do NOT produce any claim without a citation. If you cannot answer from the
retrieved sources, reply only with "No official source was found for this question."
Do not invent regulations.`;

const ROLE_FRAMING_KO = `당신은 의료기기 규제 업무(Regulatory Affairs)를 지원하는 전문가 어시스턴트 Regula입니다.
답변은 명확하고, 근거에 충실하며, 한국어 RA 실무 용어를 사용합니다.
Respond in Korean. Use Source Serif KR style prose.`;

const ROLE_FRAMING_EN = `You are Regula, an expert assistant for medical-device regulatory affairs (RA).
Provide clear, evidence-grounded answers using standard RA terminology.
Respond in English.`;

/**
 * Compose the LLM prompt. The returned object lets the caller assemble the
 * actual `messages` array with anthropic cache_control on the chunk block.
 */
export function composePrompt(
  question: string,
  intent: Intent,
  chunks: RetrievedChunk[],
  locale: 'ko' | 'en',
): ComposedPrompt {
  const directive = locale === 'ko' ? CITATION_DIRECTIVE_KO : CITATION_DIRECTIVE_EN;
  const role = locale === 'ko' ? ROLE_FRAMING_KO : ROLE_FRAMING_EN;
  const intentHint = `(intent: ${intent})`;

  const systemPrompt = `${role}\n\n${directive}\n${intentHint}`;

  // REQ-CHAT-019 — hard limit of 8 chunks to prevent prompt truncation.
  const topChunks = chunks.slice(0, 8);

  // REQ-CHAT-022 — chunk injection format. cite_index = index + 1 (1-based).
  const chunkContext = topChunks
    .map((c, i) => {
      const n = i + 1;
      const yearStr = c.year !== null ? ` (${c.year})` : '';
      return `[Source ${n}: ${c.orgLabel} ${c.title}${yearStr} | section_id=${c.anchor}, offset=${c.offset}]\n${c.text}\n`;
    })
    .join('\n');

  return {
    systemPrompt,
    chunkContext,
    userQuestion: question,
  };
}
