// @MX:NOTE Intent classifier — fast Haiku call to route the rewriter.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-008)

import { anthropic } from '@ai-sdk/anthropic';
import { type LanguageModel, generateText } from 'ai';

// @MX:NOTE @ai-sdk/anthropic@3.0.74 ships LanguageModelV3 specification while
// ai@3.4.33 still types parameters as LanguageModelV1. The runtime contract is
// compatible — generateText/streamText both accept the v3 model — but the
// declaration mismatch requires an explicit cast at the boundary.
const MODEL = anthropic('claude-haiku-4-5') as unknown as LanguageModel;

export type Intent = 'regulation-lookup' | 'comparison' | 'general';

const INTENTS: readonly Intent[] = ['regulation-lookup', 'comparison', 'general'] as const;

const PROMPT_KO = (q: string) => `당신은 의료기기 규제(RA) 챗봇의 질의 분류기입니다.
다음 사용자 질문을 정확히 한 단어로 분류하세요:
- regulation-lookup: 특정 규정/조항/요건 조회 (예: 510(k), 21 CFR, ISO 13485)
- comparison: 두 규제 또는 시장의 비교 (예: FDA vs EU MDR)
- general: 그 외 일반 질문

질문: ${q}

답변 (단 한 단어):`;

const PROMPT_EN = (
  q: string,
) => `You are an intent classifier for a medical device regulatory affairs (RA) chatbot.
Classify the following user question with exactly one word:
- regulation-lookup: lookup a specific regulation/clause/requirement (e.g., 510(k), 21 CFR, ISO 13485)
- comparison: compare two regulations or markets (e.g., FDA vs EU MDR)
- general: any other general question

Question: ${q}

Answer (one word only):`;

/**
 * Classify the user's question into one of three intents using Claude Haiku.
 * Defaults to 'general' on any parsing ambiguity.
 */
export async function classifyIntent(question: string, locale: 'ko' | 'en'): Promise<Intent> {
  const prompt = locale === 'ko' ? PROMPT_KO(question) : PROMPT_EN(question);

  const { text } = await generateText({
    model: MODEL,
    prompt,
    maxTokens: 50,
  });

  const normalized = text.toLowerCase().trim();
  for (const candidate of INTENTS) {
    if (normalized.includes(candidate)) return candidate;
  }
  return 'general';
}
