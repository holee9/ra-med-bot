// SPEC-REGULA-WORKFLOWS-LLM-002 (AC-04 / REQ-WFLLM-002 / M4)
// SSE /events route for the indication-impact workflow.
//
// GET /api/ra/workflows/indication-impact/[runId]/events
//   → 200 text/event-stream (WorkflowStreamEvent stream)
//   → 400 Invalid runId
//   → 403 No org context
//   → 404 Run not found (or belongs to another org — IDOR)
//   → 409 Run is not in `queued` state

import { withPermission } from '@/lib/auth/with-permission';
import { buildEventsResponse } from '@/lib/workflows/_shared/events-route';
import { wireIndicationImpactInput } from '@/lib/workflows/_shared/input-wiring';
import { executeStep as executeIndicationImpactStep } from '@/lib/workflows/indication-impact/executor';

// 6 indication-impact steps (matches executor.ts switch cases).
// The 3-axis impact chain (REQ-WFLLM-005):
//   predicate_impact_analysis     → 510(k) SE re-assessment
//   regulatory_pathway_assessment → EU MDR classification change
//   clinical_data_gap_analysis    → clinical data gap
const INDICATION_IMPACT_STEPS = [
  'indication_comparison',
  'regulatory_pathway_assessment',
  'predicate_impact_analysis',
  'clinical_data_gap_analysis',
  'market_specific_requirements',
  'impact_report_generation',
] as const;

export const GET = withPermission('consult.create', async (_request, ctx, session) => {
  const resolvedParams = ctx.params && 'then' in ctx.params ? await ctx.params : (ctx.params ?? {});
  const runId = String(resolvedParams.runId ?? '');

  return buildEventsResponse(runId, session.user.id, session.user.organizationId, {
    workflowType: 'indication_impact',
    steps: [...INDICATION_IMPACT_STEPS],
    executor: executeIndicationImpactStep,
    wireInput: (workflowInput) =>
      wireIndicationImpactInput({
        workflowInput,
        // PCCP context (#24) is optional for indication-impact.
        pccpResults: null,
      }) as unknown as Record<string, unknown>,
  });
});
