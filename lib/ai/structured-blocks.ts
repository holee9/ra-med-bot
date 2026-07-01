// @MX:ANCHOR [AUTO] generateStructuredBlocks — Phase 3 follow-up LLM pipeline.
// @MX:REASON Entry point called by /api/ra/consult after prose completion.
// fan_in >= 3: route handler, tests, future scheduled tasks.
// @MX:WARN Complex async generator with multiple LLM calls and Zod parsing.
// @MX:REASON Each block type requires classifier + generator call pair.
// Abort signal must propagate to prevent orphaned Haiku calls.
// @MX:SPEC SPEC-REGULA-STRUCTURED-001 (REQ-STRUCT-001~010)

import { generateText } from 'ai';
import type { LanguageModel } from 'ai';
import { logger } from '../../lib/observability/logger';
import type {
  ChecklistEvent,
  ComparisonEvent,
  RelatedEvent,
  TimelineEvent,
} from '../../types/streaming';
import { getLlmFastModel } from './llm-provider';
import {
  buildChecklistClassifier,
  buildChecklistGenerator,
  buildComparisonClassifier,
  buildComparisonGenerator,
  buildRelatedGenerator,
  buildTimelineClassifier,
  buildTimelineGenerator,
} from './structured-prompts';
import {
  ChecklistBlockSchema,
  ComparisonBlockSchema,
  RelatedBlockSchema,
  TimelineBlockSchema,
} from './structured-schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SourceMeta {
  title: string;
  orgLabel: string;
  year: number | null;
}

export interface StructuredInput {
  question: string;
  prose: string;
  topSources: SourceMeta[];
  messageId: string;
  locale: 'ko';
}

export type BlockEvent = ChecklistEvent | ComparisonEvent | TimelineEvent | RelatedEvent;

// ---------------------------------------------------------------------------
// OrderViolationError (REQ-STRUCT-003)
// Thrown when a structured event is emitted before prose_done flag is set.
// ---------------------------------------------------------------------------
export class OrderViolationError extends Error {
  constructor(eventType: string) {
    super(`structured event emitted before prose_done: ${eventType}`);
    this.name = 'OrderViolationError';
  }
}

// ---------------------------------------------------------------------------
// Token budget constants
// ---------------------------------------------------------------------------
const MAX_INPUT_TOKENS = 4096;
const MAX_OUTPUT_TOKENS = 2048;

// ---------------------------------------------------------------------------
// Internal helper: call the fast model with a single prompt, return text.
// AbortSignal is propagated to prevent orphaned LLM calls on client disconnect.
// ---------------------------------------------------------------------------
async function callFast(
  model: LanguageModel,
  prompt: string,
  signal: AbortSignal | undefined,
): Promise<string> {
  // Truncate prompt if it would exceed MAX_INPUT_TOKENS (rough char estimate)
  const truncatedPrompt =
    prompt.length > MAX_INPUT_TOKENS * 4 ? prompt.slice(0, MAX_INPUT_TOKENS * 4) : prompt;

  const response = await generateText({
    model,
    maxTokens: MAX_OUTPUT_TOKENS,
    abortSignal: signal,
    messages: [{ role: 'user', content: truncatedPrompt }],
  });

  return response.text ?? '';
}

// ---------------------------------------------------------------------------
// Internal helper: call classifier, return true if the model says 'yes'.
// ---------------------------------------------------------------------------
async function classify(
  model: LanguageModel,
  prompt: string,
  signal: AbortSignal | undefined,
): Promise<boolean> {
  const text = await callFast(model, prompt, signal);
  return /^\s*yes\s*$/i.test(text.trim());
}

// ---------------------------------------------------------------------------
// Internal helper: call generator and parse JSON response.
// Returns null on parse failure (REQ-STRUCT-006: skip on Zod parse error).
// ---------------------------------------------------------------------------
async function generate<T>(
  model: LanguageModel,
  prompt: string,
  schema: { safeParse: (data: unknown) => { success: boolean; data?: T } },
  signal: AbortSignal | undefined,
): Promise<T | null> {
  const raw = await callFast(model, prompt, signal);

  // Strip markdown code fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    logger.error(`[structured-blocks] JSON parse error. Raw snippet: ${raw.slice(0, 500)}`);
    return null;
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    logger.error(`[structured-blocks] Zod parse error. Raw snippet: ${raw.slice(0, 500)}`);
    return null;
  }

  return result.data ?? null;
}

// ---------------------------------------------------------------------------
// generateStructuredBlocks — main exported async generator (REQ-STRUCT-001)
// Yields BlockEvents in fixed order: checklist? → comparison? → timeline? → related
// ---------------------------------------------------------------------------
export async function* generateStructuredBlocks(
  input: StructuredInput,
  signal?: AbortSignal,
): AsyncGenerator<BlockEvent> {
  const model = getLlmFastModel();
  const promptInput = {
    question: input.question,
    prose: input.prose,
    topSources: input.topSources.slice(0, 3),
    locale: input.locale,
  };

  // --- checklist (classifier first) ---
  if (!signal?.aborted) {
    try {
      const shouldEmit = await classify(model, buildChecklistClassifier(promptInput), signal);

      if (shouldEmit && !signal?.aborted) {
        const block = await generate(
          model,
          buildChecklistGenerator(promptInput),
          ChecklistBlockSchema,
          signal,
        );

        if (block && !signal?.aborted) {
          yield { type: 'checklist', items: block.items } satisfies ChecklistEvent;
        }
      }
    } catch (err) {
      if (signal?.aborted) return;
      logger.error('[structured-blocks] checklist error:', err);
    }
  }

  // --- comparison (classifier first) ---
  if (!signal?.aborted) {
    try {
      const shouldEmit = await classify(model, buildComparisonClassifier(promptInput), signal);

      if (shouldEmit && !signal?.aborted) {
        const block = await generate(
          model,
          buildComparisonGenerator(promptInput),
          ComparisonBlockSchema,
          signal,
        );

        if (block && !signal?.aborted) {
          yield {
            type: 'comparison',
            title: block.title,
            cols: block.cols,
            rows: block.rows,
          } satisfies ComparisonEvent;
        }
      }
    } catch (err) {
      if (signal?.aborted) return;
      logger.error('[structured-blocks] comparison error:', err);
    }
  }

  // --- timeline (classifier first) ---
  if (!signal?.aborted) {
    try {
      const shouldEmit = await classify(model, buildTimelineClassifier(promptInput), signal);

      if (shouldEmit && !signal?.aborted) {
        const block = await generate(
          model,
          buildTimelineGenerator(promptInput),
          TimelineBlockSchema,
          signal,
        );

        if (block && !signal?.aborted) {
          yield { type: 'timeline', items: block.items } satisfies TimelineEvent;
        }
      }
    } catch (err) {
      if (signal?.aborted) return;
      logger.error('[structured-blocks] timeline error:', err);
    }
  }

  // --- related — always generated, no classifier (REQ-STRUCT-005, REQ-STRUCT-008) ---
  if (!signal?.aborted) {
    try {
      let block = await generate(
        model,
        buildRelatedGenerator(promptInput),
        RelatedBlockSchema,
        signal,
      );

      // Retry once if fewer than 3 items (REQ-STRUCT-008)
      if (block === null && !signal?.aborted) {
        const retryPrompt = `${buildRelatedGenerator(promptInput)}\n\n반드시 3~5개를 생성하라.`;
        block = await generate(model, retryPrompt, RelatedBlockSchema, signal);
      }

      if (block && !signal?.aborted) {
        yield { type: 'related', items: block.items } satisfies RelatedEvent;
      }
    } catch (err) {
      if (signal?.aborted) return;
      logger.error('[structured-blocks] related error:', err);
    }
  }
}
