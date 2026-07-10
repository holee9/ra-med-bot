// SPEC-REGULA-WORKFLOWS-LLM-002 (AC-04 / REQ-WFLLM-002 / M4)
// SSE /events route for the submission-drafter workflow.
//
// GET /api/ra/workflows/submission-drafter/[runId]/events
//   → 200 text/event-stream (WorkflowStreamEvent stream)
//   → 400 Invalid runId
//   → 403 No org context
//   → 404 Run not found (or belongs to another org — IDOR)
//   → 409 Run is not in `queued` state
//
// The POST route (/api/ra/workflows/submission-drafter) returns 202 with
// streamEventsUrl pointing here. This route loads the queued run, invokes
// runWorkflow, and streams progress events to the client.

import { withPermission } from '@/lib/auth/with-permission';
import { buildEventsResponse } from '@/lib/workflows/_shared/events-route';
import { wireSubmissionDrafterInput } from '@/lib/workflows/_shared/input-wiring';
import { executeStep as executeSubmissionDrafterStep } from '@/lib/workflows/submission-drafter/executor';

// 6 FDA 510(k) eCopy steps (matches executor.ts switch cases).
const SUBMISSION_DRAFTER_STEPS = [
  'device_classification',
  'predicate_search',
  'substantial_equivalence',
  'performance_summary',
  'labeling_review',
  'submission_assembly',
] as const;

export const GET = withPermission('consult.create', async (_request, ctx, session) => {
  const resolvedParams = ctx.params && 'then' in ctx.params ? await ctx.params : (ctx.params ?? {});
  const runId = String(resolvedParams.runId ?? '');

  return buildEventsResponse(runId, session.user.id, session.user.organizationId, {
    workflowType: 'submission_drafter',
    steps: [...SUBMISSION_DRAFTER_STEPS],
    executor: executeSubmissionDrafterStep,
    wireInput: (workflowInput) =>
      wireSubmissionDrafterInput({
        workflowInput,
        // Stub dependencies (#22 predicate search) — logged by input-wiring.
        predicateResults: null,
      }) as unknown as Record<string, unknown>,
  });
});
