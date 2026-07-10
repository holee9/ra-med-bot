// @MX:ANCHOR [AUTO] Streaming chain — gx10 streaming + generateObject wrapper.
// @MX:REASON fan_in >= 3: M1/M2/M3 executors call streamSection (prose) +
//          judgeStructured (Zod object); workflow-runner calls withTimeout to
//          bound every LLM stage; tests mock getLlmModel. This is the FIRST
//          implementation of the SSE streaming layer for workflows — prior to
//          M0, workflow routes returned 202 JSON with a streamEventsUrl to a
//          non-existent /events route (plan-auditor gap doc BLOCK-2).
// @MX:SPEC SPEC-REGULA-WORKFLOWS-LLM-002 (REQ-WFLLM-002/010, AC-04/10)

import { getLlmModel } from '@/lib/ai/llm-provider';
import { generateObject, streamText } from 'ai';
import type { z } from 'zod';

/**
 * Default per-step timeout. Mirrors TRIAGE_TIMEOUT_MS pattern
 * (lib/domains/triage/run-triage.ts:62) — bounds every LLM stage so a hung
 * gx10 stream cannot block the whole workflow. Configurable via the
 * `timeoutMs` parameter on each call.
 */
export const DEFAULT_STREAM_TIMEOUT_MS = 30_000;

/**
 * Typed error thrown when the streaming chain times out or the LLM fails.
 * The workflow-runner catches this, persists the partial draft, and emits a
 * `workflow.llm_call` audit row with `meta.status = 'failed'`
 * (REQ-WFLLM-010 / AC-10).
 */
export class WorkflowLlmError extends Error {
  readonly kind: 'timeout' | 'runtime' | 'schema';
  readonly stepName: string;
  constructor(kind: 'timeout' | 'runtime' | 'schema', stepName: string, message: string) {
    super(message);
    this.name = 'WorkflowLlmError';
    this.kind = kind;
    this.stepName = stepName;
  }
}

/**
 * Rx-style delta callback — the runner wires this to the SSE encoder so each
 * text-delta becomes a `step_delta` event on the wire.
 */
export type DeltaEmitter = (delta: string) => void;

export interface StreamSectionParams {
  stepName: string;
  systemPrompt: string;
  /** Chunk context / retrieved evidence to ground citations (RAG). */
  context?: string;
  prompt: string;
  /** Per-call timeout (default 30s). Bounds the whole streamText stage. */
  timeoutMs?: number;
  /** Delta callback for SSE emission. If absent, deltas are buffered. */
  onDelta?: DeltaEmitter;
  /** Max tokens for the generated section. */
  maxTokens?: number;
}

export interface StreamSectionResult {
  /** Full accumulated prose. */
  text: string;
  /** `failed` when a timeout/runtime error truncated the stream. */
  status: 'ok' | 'failed';
  /** Error details when status === 'failed'. */
  error?: WorkflowLlmError;
}

/**
 * Stream a prose section from gx10 with an overall timeout.
 *
 * Pattern: lib/domains/triage/run-triage.ts:52 (Promise.race + AbortController).
 * On timeout: aborts the in-flight streamText, returns `status: 'failed'`
 * with partial text so the runner can persist the partial draft
 * (REQ-WFLLM-010). The runner — not this function — writes the audit row.
 */
export async function streamSection(params: StreamSectionParams): Promise<StreamSectionResult> {
  const {
    stepName,
    systemPrompt,
    context,
    prompt,
    timeoutMs = DEFAULT_STREAM_TIMEOUT_MS,
    onDelta,
    maxTokens = 2048,
  } = params;

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(
        new WorkflowLlmError('timeout', stepName, `streamSection timed out after ${timeoutMs}ms`),
      );
    }, timeoutMs);
  });

  const system = context ? `${systemPrompt}\n\n${context}` : systemPrompt;

  let accumulated = '';
  try {
    const result = await Promise.race([
      (async () => {
        const r = await streamText({
          model: getLlmModel(),
          system,
          prompt,
          maxTokens,
          abortSignal: controller.signal,
        });
        for await (const part of r.fullStream) {
          if (part.type === 'text-delta' && part.textDelta) {
            accumulated += part.textDelta;
            onDelta?.(part.textDelta);
          }
        }
        return accumulated;
      })(),
      timeoutPromise,
    ]);
    return { text: result, status: 'ok' };
  } catch (err) {
    // Partial text accumulated before the failure is preserved so the runner
    // can persist a partial draft (REQ-WFLLM-010 / AC-10).
    const error =
      err instanceof WorkflowLlmError
        ? err
        : new WorkflowLlmError(
            'runtime',
            stepName,
            err instanceof Error ? err.message : String(err),
          );
    return {
      text: accumulated,
      status: 'failed',
      error: timedOut
        ? new WorkflowLlmError('timeout', stepName, `streamSection timed out after ${timeoutMs}ms`)
        : error,
    };
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Generate a structured judgment (Zod schema) via gx10 `generateObject`.
 *
 * Proven pattern: lib/cer/evidence-synthesis.ts:136 uses the identical
 * `generateObject({ model, schema, prompt })` call shape against gx10
 * (SPEC-LLM-MIGRATION-BC). Used for per-step structured decisions (device
 * classification, SE verdict, 3-axis impact judgment).
 *
 * On schema-parse failure: throws WorkflowLlmError(kind='schema') so the
 * runner can fall back to a prose retry or flag for expert review.
 */
export async function judgeStructured<T>(params: {
  stepName: string;
  schema: z.ZodType<T>;
  prompt: string;
  systemPrompt?: string;
  timeoutMs?: number;
}): Promise<T> {
  const { stepName, schema, prompt, systemPrompt, timeoutMs } = params;

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(
        new WorkflowLlmError(
          'timeout',
          stepName,
          `judgeStructured timed out after ${timeoutMs ?? DEFAULT_STREAM_TIMEOUT_MS}ms`,
        ),
      );
    }, timeoutMs ?? DEFAULT_STREAM_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([
      generateObject({
        model: getLlmModel(),
        schema,
        system: systemPrompt,
        prompt,
        abortSignal: controller.signal,
      }),
      timeoutPromise,
    ]);
    return result.object as T;
  } catch (err) {
    if (err instanceof WorkflowLlmError) throw err;
    throw new WorkflowLlmError(
      'schema',
      stepName,
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
