// @MX:ANCHOR [AUTO] SSE /events route helper — shared by the 3 workflow GET handlers.
// @MX:REASON fan_in >= 3: submission-drafter, audit-response, indication-impact
//          route files all call buildEventsResponse. This is the FIRST
//          implementation of the SSE /events endpoint — plan-auditor gap D1
//          flagged that POST routes return streamEventsUrl to a non-existent
//          /events route. This helper closes that gap (AC-04 / REQ-WFLLM-002).
// @MX:SPEC SPEC-REGULA-WORKFLOWS-LLM-002 (REQ-WFLLM-002, AC-04/M4)
//
// 21 CFR Part 11 §11.10(e): the runner handles in-tx audit (workflow.draft_version,
// workflow.llm_call, workflow.expert_flagged). This route does NOT call writeAudit
// — the POST route already wrote workflow.start when the run was queued. No
// double-audit.
//
// IDOR: the run lookup is org-scoped (row.organizationId === session.user.organizationId).
// A run from another org returns 404 (not 403 — prevents existence disclosure).

import { db } from '@/lib/kernel/db/client';
import { workflowRuns } from '@/lib/kernel/db/schema';
import { logger } from '@/lib/observability/logger';
import { and, eq } from 'drizzle-orm';
import {
  type RunWorkflowResult,
  type StepExecutor,
  type WorkflowStreamEvent,
  encodeWorkflowEvent,
  runWorkflow,
} from './workflow-runner';

/**
 * Per-type configuration for the SSE /events route. Each workflow type
 * (submission_drafter, indication_impact) provides its step list, executor,
 * input-wiring function, and RBAC permission. (audit_response archived —
 * CAPA = QMS, Charter [지양-3], #520.)
 */
export interface WorkflowEventsConfig {
  /** The workflow_type pgEnum value (e.g. 'submission_drafter'). */
  workflowType: 'submission_drafter' | 'indication_impact';
  /** Ordered step names (6 per type — matches the executor's switch cases). */
  steps: string[];
  /** The M1/M2/M3 executor (executeStep). */
  executor: StepExecutor;
  /**
   * Wire the raw row.inputJson into the executor's expected input shape.
   * Handles stub dependencies (predicateResults, pccpContext) per input-wiring.ts.
   */
  wireInput: (workflowInput: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Validate UUID format (mirrors the status route's regex).
 * Returns true if the string is a valid UUID.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidRunId(runId: string): boolean {
  return UUID_RE.test(runId);
}

/**
 * Build the SSE Response for a workflow run.
 *
 * Flow:
 * 1. Validate runId (UUID).
 * 2. Load the workflow_runs row (org-scoped — IDOR guard).
 * 3. Status guard: only `queued` runs can be started. Non-queued → 409.
 * 4. Wire input from row.inputJson via the per-type wiring function.
 * 5. Build a ReadableStream that:
 *    - Creates an emit callback writing `data: ${JSON}\n\n` chunks.
 *    - Calls runWorkflow with the per-type config.
 *    - On completion: writes the final run_complete event (already emitted by
 *      the runner, but we flush + close the stream).
 *    - On error: writes an `error` event + closes.
 * 6. Return 200 with text/event-stream headers.
 *
 * @param runId - The workflow run ID from the URL.
 * @param actorId - The session user ID (for audit actor_id).
 * @param organizationId - The session user's org ID (for IDOR scope).
 * @param config - Per-type workflow config.
 */
export async function buildEventsResponse(
  runId: string,
  actorId: string,
  organizationId: string | undefined,
  config: WorkflowEventsConfig,
): Promise<Response> {
  // 1. Validate runId format.
  if (!isValidRunId(runId)) {
    return Response.json({ error: 'Invalid workflow run ID' }, { status: 400 });
  }

  // 2. Org-scoped run lookup (IDOR guard). No org → 403.
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  const row = await db.query.workflowRuns.findFirst({
    where: and(
      eq(workflowRuns.id, runId),
      eq(workflowRuns.organizationId, organizationId),
      eq(workflowRuns.workflowType, config.workflowType),
    ),
  });

  // IDOR: 404 (not 403) to avoid disclosing that the run exists in another org.
  if (!row) {
    return Response.json({ error: 'Workflow run not found' }, { status: 404 });
  }

  // 3. Status guard: only `queued` runs can start streaming.
  //    running/completed/failed → 409 Conflict.
  if (row.status !== 'queued') {
    return Response.json(
      {
        error: 'Workflow run is not in a startable state',
        currentStatus: row.status,
        runId,
      },
      { status: 409 },
    );
  }

  // 4. Wire input from the stored row.
  const wiredInput = config.wireInput((row.inputJson ?? {}) as Record<string, unknown>);

  // 5. Build the SSE stream.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const emit = (event: WorkflowStreamEvent): void => {
        if (closed) return;
        const chunk = encodeWorkflowEvent(event);
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Controller may be closed by the client disconnecting.
          closed = true;
        }
      };

      try {
        await runWorkflow({
          runId,
          workflowType: config.workflowType,
          actorId,
          steps: config.steps,
          executor: config.executor,
          input: wiredInput,
          emit,
          // streamingSteps is intentionally omitted: the M1-M3 executors
          // handle prose streaming internally via their own streamSection
          // calls (with schema validation + citation coverage). Populating
          // streamingSteps here would bypass the executor and duplicate
          // prompts. The SSE stream still emits run_start/step_start/
          // step_complete/step_failed/run_complete events.
          stepTimeoutMs: undefined,
        });

        // The runner emits run_complete as its last event via emit().
        // Flush + close.
        if (!closed) {
          controller.close();
          closed = true;
        }
      } catch (err) {
        // The runner is designed to NOT throw on step failures (it catches
        // per-step errors and continues). If we reach here, it's a
        // persistence or infrastructure error.
        const message = err instanceof Error ? err.message : String(err);
        logger.error('workflow events stream failed', {
          runId,
          workflowType: config.workflowType,
          error: message,
        });

        if (!closed) {
          const errorEvent: WorkflowStreamEvent = {
            type: 'error',
            runId,
            message,
          };
          try {
            controller.enqueue(encoder.encode(encodeWorkflowEvent(errorEvent)));
            controller.close();
          } catch {
            // Client already disconnected.
          }
          closed = true;
        }
      }
    },
    cancel() {
      // Client disconnected (e.g. closed the browser tab). The runWorkflow
      // promise continues in the background — the runner persists results
      // + audit regardless of SSE consumer presence. This is by design:
      // 21 CFR Part 11 requires the audit trail regardless of client state.
      logger.info('workflow events stream cancelled by client', {
        runId,
        workflowType: config.workflowType,
      });
    },
  });

  // 6. Return SSE response.
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Disable proxy buffering (nginx, Cloudflare) so SSE chunks flush immediately.
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * Consume a ReadableStream<Uint8Array> and collect all chunks into a string.
 * Test utility for asserting SSE wire bytes.
 */
export async function collectSseStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode(); // flush
  return result;
}

/**
 * Parse an SSE wire string into a list of WorkflowStreamEvent objects.
 * Splits on `data: {...}\n\n` boundaries. Test utility.
 */
export function parseSseEvents(sseString: string): WorkflowStreamEvent[] {
  const events: WorkflowStreamEvent[] = [];
  const chunks = sseString.split('\n\n');
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed.startsWith('data: ')) continue;
    const json = trimmed.slice('data: '.length);
    try {
      events.push(JSON.parse(json) as WorkflowStreamEvent);
    } catch {
      // Skip malformed chunks (shouldn't happen in tests).
    }
  }
  return events;
}

// Re-export RunWorkflowResult for tests that need to assert on the return value.
export type { RunWorkflowResult };
