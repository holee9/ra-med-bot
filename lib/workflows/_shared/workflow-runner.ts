// @MX:ANCHOR [AUTO] Workflow runner — executeStep orchestrator + SSE emitter.
// @MX:REASON fan_in >= 3: M1/M2/M3 route handlers call runWorkflow; the
//          runner calls executeStep per step, the streaming-chain, the
//          citation-enforcer, and writes audit in-tx. This is the FIRST
//          implementation of the SSE pipeline — prior to M0, executeStep had
//          ZERO call sites (plan-auditor gap doc BLOCK-2 "greenfield").
// @MX:SPEC SPEC-REGULA-WORKFLOWS-LLM-002 (REQ-WFLLM-001/002/008/010, AC-04/10)
//
// 21 CFR Part 11 §11.10(e): every workflow_runs mutation rides the SAME
// db.transaction as its audit rows (pattern: lib/domains/impact/analyzer.ts:67).

import { writeAudit } from '@/lib/kernel/audit';
import { db } from '@/lib/kernel/db/client';
import { workflowRuns } from '@/lib/kernel/db/schema';
import { logger } from '@/lib/observability/logger';
import { aggregateScores } from '@/lib/workflows/common/confidence-aggregator';
import { eq, sql } from 'drizzle-orm';
import {
  CITATION_COVERAGE_THRESHOLD,
  aggregateCoverage,
  enforceSectionCitations,
} from './citation-enforcer';
import { shouldFlagForExpertReview } from './review-gate';
import { DEFAULT_STREAM_TIMEOUT_MS, WorkflowLlmError, streamSection } from './streaming-chain';

/**
 * Step executor signature — matches the existing `executeStep` in
 * lib/workflows/{submission-drafter,audit-response,indication-impact}/executor.ts.
 * The runner is executor-agnostic: it loops whatever step list + executor the
 * route provides, so M1-M3 can swap in real LLM-backed executors without
 * touching the runner.
 */
export type StepExecutor = (step: string, ctx: StepExecutionContext) => Promise<StepResult>;

export type StepResult = {
  stepName: string;
  output: Record<string, unknown>;
  confidenceScores: Array<{ source: string; score: number; weight: number }>;
  completedAt: string;
};

export type StepExecutionContext = {
  workflowRunId: string;
  input: Record<string, unknown>;
  previousResults: StepResult[];
};

/**
 * SSE event union for the workflow streaming layer. This is the FIRST
 * implementation of the SSE contract — SPEC-REGULA-WORKFLOWS-001 spec.md
 * describes `[runId]/events/route.ts` (SSE progress) but no route or event
 * type existed before M0. These events are workflow-domain-specific and
 * intentionally separate from the chat-domain `StreamEvent` union in
 * types/streaming.ts.
 *
 * Wire format: `data: ${JSON.stringify(event)}\n\n` (matches
 * lib/ai/streaming.ts encodeSSE).
 */
export type WorkflowStreamEvent =
  | { type: 'run_start'; runId: string; workflowType: string; totalSteps: number }
  | { type: 'step_start'; runId: string; stepName: string; stepIndex: number }
  | { type: 'step_delta'; runId: string; stepName: string; delta: string }
  | {
      type: 'step_complete';
      runId: string;
      stepName: string;
      stepIndex: number;
      citationCoverage: number;
      confidence: number;
    }
  | {
      type: 'step_failed';
      runId: string;
      stepName: string;
      stepIndex: number;
      error: string;
      kind: 'timeout' | 'runtime' | 'schema';
    }
  | {
      type: 'run_complete';
      runId: string;
      overallConfidence: number;
      citationCoverage: number;
      draftVersion: number;
      reviewRequired: boolean;
    }
  | { type: 'error'; runId: string; message: string };

/** Encode a WorkflowStreamEvent as an SSE wire chunk. */
export function encodeWorkflowEvent(event: WorkflowStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export interface RunWorkflowParams {
  runId: string;
  workflowType: string;
  actorId: string;
  /** Ordered step names to execute (e.g. the 6 FDA eCopy sections). */
  steps: string[];
  /** Executor function (the M1-M3 real executor or the current Beta scaffold). */
  executor: StepExecutor;
  /** Wired input for the first step (from input-wiring.ts). */
  input: Record<string, unknown>;
  /** SSE emit callback. If absent, events are swallowed (test-friendly). */
  emit?: (event: WorkflowStreamEvent) => void;
  /** Per-step streaming params (prose sections only). Optional. */
  streamingSteps?: Map<
    string,
    { systemPrompt: string; context?: string; prompt: string; maxTokens?: number }
  >;
  /** Override the default 30s per-step timeout. */
  stepTimeoutMs?: number;
}

export interface RunWorkflowResult {
  runId: string;
  results: StepResult[];
  /** Sections accumulated from streaming steps (for citation coverage). */
  sectionTexts: Record<string, string>;
  overallConfidence: number;
  citationCoverage: number;
  draftVersion: number;
  /** `failed` if any step timed out / errored (partial draft still persisted). */
  status: 'completed' | 'partial' | 'failed';
  /** Per-step errors when status !== 'completed'. */
  errors: Array<{ stepName: string; kind: string; message: string }>;
}

/**
 * Run a workflow: loop steps, stream prose sections, enforce citation
 * coverage, persist results + audit in-tx.
 *
 * Flow per step:
 * 1. emit `step_start`
 * 2. If the step is in `streamingSteps`: streamSection (gx10) with SSE delta
 *    emission → accumulate prose → wrap as a StepResult.
 *    Else: call executor(step, ctx) directly (structured judgment / template).
 * 3. enforceSectionCitations on the accumulated text (citation coverage).
 * 4. emit `step_complete` (or `step_failed` on error/timeout).
 * 5. After all steps: persist workflow_runs update (draft_version bump,
 *    citation_coverage, result_json) + audit rows in ONE db.transaction.
 *
 * REQ-WFLLM-010: on step failure, partial results are still persisted and
 * the audit row records `meta.status = 'failed'` — the run does NOT crash.
 */
export async function runWorkflow(params: RunWorkflowParams): Promise<RunWorkflowResult> {
  const {
    runId,
    workflowType,
    actorId,
    steps,
    executor,
    input,
    emit,
    streamingSteps,
    stepTimeoutMs,
  } = params;

  const results: StepResult[] = [];
  const sectionTexts: Record<string, string> = {};
  const errors: RunWorkflowResult['errors'] = [];

  emitSse(emit, { type: 'run_start', runId, workflowType, totalSteps: steps.length });

  for (let i = 0; i < steps.length; i++) {
    const stepName = steps[i];
    if (!stepName) continue;

    emitSse(emit, { type: 'step_start', runId, stepName, stepIndex: i });

    const ctx: StepExecutionContext = {
      workflowRunId: runId,
      input,
      previousResults: results,
    };

    try {
      let result: StepResult;
      const streaming = streamingSteps?.get(stepName);
      if (streaming) {
        result = await runStreamingStep(runId, stepName, streaming, ctx, emit, stepTimeoutMs);
        sectionTexts[stepName] = result.output.text as string;
      } else {
        result = await executor(stepName, ctx);
        // If the executor returns prose in output.text, track it for coverage.
        if (typeof result.output.text === 'string') {
          sectionTexts[stepName] = result.output.text;
        }
      }

      results.push(result);

      // Citation coverage for this section (only if prose was produced).
      const sectionHtml = sectionTexts[stepName] ?? '';
      const coverage = sectionHtml ? enforceSectionCitations(stepName, sectionHtml) : null;

      emitSse(emit, {
        type: 'step_complete',
        runId,
        stepName,
        stepIndex: i,
        citationCoverage: coverage?.coverage ?? 1,
        confidence: result.confidenceScores[0]?.score ?? 0,
      });
    } catch (err) {
      const kind = err instanceof WorkflowLlmError ? err.kind : 'runtime';
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ stepName, kind, message });

      emitSse(emit, {
        type: 'step_failed',
        runId,
        stepName,
        stepIndex: i,
        error: message,
        kind: kind as 'timeout' | 'runtime' | 'schema',
      });
      // REQ-WFLLM-010: continue to next step — do NOT crash the whole run.
    }
  }

  // Aggregate confidence + citation coverage across all sections.
  const allScores = results.flatMap((r) => r.confidenceScores);
  const overallConfidence = allScores.length > 0 ? aggregateScores(allScores) : 0;
  const coverageResult = aggregateCoverage(Object.values(sectionTexts));

  // 21 CFR Part 11 §11.10(e): persist + audit in ONE transaction.
  const draftVersion = await persistRunResult({
    runId,
    actorId,
    workflowType,
    results,
    overallConfidence,
    citationCoverage: coverageResult.coverage,
    status: deriveRunStatus(errors, coverageResult.passes),
    errors,
  });

  emitSse(emit, {
    type: 'run_complete',
    runId,
    overallConfidence,
    citationCoverage: coverageResult.coverage,
    draftVersion,
    reviewRequired: !coverageResult.passes || errors.length > 0,
  });

  return {
    runId,
    results,
    sectionTexts,
    overallConfidence,
    citationCoverage: coverageResult.coverage,
    draftVersion,
    status: errors.length > 0 ? (results.length > 0 ? 'partial' : 'failed') : 'completed',
    errors,
  };
}

/**
 * Stream a single prose section via gx10 and wrap the accumulated text as a
 * StepResult. Deltas are emitted to the SSE channel as `step_delta` events.
 */
async function runStreamingStep(
  runId: string,
  stepName: string,
  streaming: {
    systemPrompt: string;
    context?: string;
    prompt: string;
    maxTokens?: number;
  },
  _ctx: StepExecutionContext,
  emit: RunWorkflowParams['emit'],
  stepTimeoutMs?: number,
): Promise<StepResult> {
  const stream = await streamSection({
    stepName,
    systemPrompt: streaming.systemPrompt,
    context: streaming.context,
    prompt: streaming.prompt,
    maxTokens: streaming.maxTokens,
    timeoutMs: stepTimeoutMs ?? DEFAULT_STREAM_TIMEOUT_MS,
    onDelta: (delta) => {
      emitSse(emit, { type: 'step_delta', runId, stepName, delta });
    },
  });

  const completedAt = new Date().toISOString();
  return {
    stepName,
    output: {
      text: stream.text,
      status: stream.status,
      ...(stream.error ? { error: stream.error.message } : {}),
    },
    confidenceScores: [{ source: 'llm', score: stream.status === 'ok' ? 0.85 : 0.4, weight: 1 }],
    completedAt,
  };
}

/**
 * Persist workflow_runs update + audit rows in ONE db.transaction.
 *
 * - Bumps draft_version (atomic UPDATE ... SET draft_version = draft_version + 1).
 * - Stores citation_coverage (numeric 5,4).
 * - Stores result_json (step outputs).
 * - Emits workflow.llm_call (per-step, meta.status) + workflow.draft_version
 *   + workflow.expert_flagged (when review gate trips).
 *
 * Returns the new draft_version.
 */
async function persistRunResult(params: {
  runId: string;
  actorId: string;
  workflowType: string;
  results: StepResult[];
  overallConfidence: number;
  citationCoverage: number;
  status: 'completed' | 'partial' | 'failed' | 'pending_review';
  errors: RunWorkflowResult['errors'];
}): Promise<number> {
  const {
    runId,
    actorId,
    workflowType,
    results,
    overallConfidence,
    citationCoverage,
    status,
    errors,
  } = params;

  return db.transaction(async (tx) => {
    // Atomic version bump + coverage + result_json update.
    const [updated] = await tx
      .update(workflowRuns)
      .set({
        draftVersion: sql`${workflowRuns.draftVersion} + 1`,
        citationCoverage: citationCoverage.toFixed(4),
        confidenceAggregate: overallConfidence.toFixed(2),
        resultJson: { steps: results, errors } as unknown as never,
        status: status === 'completed' ? 'pending_review' : (status as never),
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workflowRuns.id, runId))
      .returning({ draftVersion: workflowRuns.draftVersion });

    const draftVersion = updated?.draftVersion ?? 1;

    // workflow.draft_version — the version bump itself is audit-material.
    await writeAudit(
      {
        actor_id: actorId,
        action: 'workflow.draft_version',
        resource_type: 'workflow_run',
        resource_id: runId,
        meta_json: {
          workflowType,
          draftVersion,
          citationCoverage: Number(citationCoverage.toFixed(4)),
          confidence: Number(overallConfidence.toFixed(2)),
          stepCount: results.length,
          status,
        },
      },
      tx,
    );

    // workflow.llm_call — one audit row summarizing the LLM calls for this run.
    await writeAudit(
      {
        actor_id: actorId,
        action: 'workflow.llm_call',
        resource_type: 'workflow_run',
        resource_id: runId,
        meta_json: {
          workflowType,
          steps: results.map((r) => r.stepName),
          status,
          errors: errors.length > 0 ? errors : undefined,
          citationCoverageThreshold: CITATION_COVERAGE_THRESHOLD,
        },
      },
      tx,
    );

    // workflow.expert_flagged — when citation coverage is low or errors occurred,
    // the run is flagged for mandatory expert review (REQ-WFLLM-007/008).
    if (
      shouldFlagForExpertReview({
        citationCoveragePasses: citationCoverage >= CITATION_COVERAGE_THRESHOLD,
        reviewRequired: true,
      })
    ) {
      await writeAudit(
        {
          actor_id: actorId,
          action: 'workflow.expert_flagged',
          resource_type: 'workflow_run',
          resource_id: runId,
          meta_json: {
            workflowType,
            reason:
              citationCoverage < CITATION_COVERAGE_THRESHOLD
                ? 'citation_coverage_low'
                : 'step_errors',
            citationCoverage: Number(citationCoverage.toFixed(4)),
            errorCount: errors.length,
          },
        },
        tx,
      );
    }

    return draftVersion;
  });
}

/** Map errors + coverage to a workflow_status value for the run row. */
function deriveRunStatus(
  errors: RunWorkflowResult['errors'],
  coveragePasses: boolean,
): 'completed' | 'partial' | 'failed' | 'pending_review' {
  if (errors.length > 0) return 'partial';
  if (!coveragePasses) return 'pending_review';
  return 'completed';
}

/** No-op when emit is absent (test-friendly); otherwise encode + emit. */
function emitSse(emit: RunWorkflowParams['emit'] | undefined, event: WorkflowStreamEvent): void {
  emit?.(event);
}

// Re-export for tests / consumers that want the raw encoder.
export { encodeWorkflowEvent as encodeSse };
