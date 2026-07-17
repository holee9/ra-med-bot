// SPEC-REGULA-WORKFLOWS-LLM-002 (AC-04 / REQ-WFLLM-002 / M4)
// SSE /events route for the audit-response workflow.
//
// GET /api/ra/workflows/audit-response/[runId]/events
//   → 200 text/event-stream (WorkflowStreamEvent stream)
//   → 400 Invalid runId
//   → 403 No org context
//   → 404 Run not found (or belongs to another org — IDOR)
//   → 409 Run is not in `queued` state

import { withPermission } from '@/lib/auth/with-permission';
import { buildEventsResponse } from '@/lib/workflows/_shared/events-route';
import { wireAuditResponseInput } from '@/lib/workflows/_shared/input-wiring';
import { executeStep as executeAuditResponseStep } from '@/lib/workflows/audit-response/executor';

// 6 audit-response steps (matches executor.ts switch cases).
const AUDIT_RESPONSE_STEPS = [
  'deficiency_analysis',
  'root_cause_identification',
  'corrective_action_plan',
  'regulatory_reference_mapping',
  'response_drafting',
  'legal_review_gate',
] as const;

export const GET = withPermission('consult.create', async (_request, ctx, session) => {
  const resolvedParams = ctx.params && 'then' in ctx.params ? await ctx.params : (ctx.params ?? {});
  const runId = String(resolvedParams.runId ?? '');

  return buildEventsResponse(runId, session.user.id, session.user.organizationId, {
    workflowType: 'audit_response',
    steps: [...AUDIT_RESPONSE_STEPS],
    executor: executeAuditResponseStep,
    wireInput: (workflowInput) =>
      wireAuditResponseInput({
        workflowInput,
        // CER context is optional for audit-response.
        cerResults: null,
      }) as unknown as Record<string, unknown>,
  });
});
