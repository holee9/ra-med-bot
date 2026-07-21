import { withPermission } from '@/lib/kernel/auth/with-permission';
import { db } from '@/lib/kernel/db/client';
import { workflowRuns } from '@/lib/kernel/db/schema';
import { and, eq } from 'drizzle-orm';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getSubmissionDrafterStatus(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await params;

  if (!UUID_REGEX.test(runId)) {
    return Response.json({ error: 'Invalid workflow run ID' }, { status: 400 });
  }

  // @MX:NOTE DB-backed status lookup — REQ-HARDEN-028: Status route connected to workflow_runs table.
  // @MX:SPEC SPEC-REGULA-RELEASE-HARDENING-001 (REQ-HARDEN-028)
  const workflow = await db.query.workflowRuns.findFirst({
    where: and(eq(workflowRuns.id, runId), eq(workflowRuns.workflowType, 'submission_drafter')),
  });

  if (!workflow) {
    return Response.json({ error: 'Workflow run not found' }, { status: 404 });
  }

  return Response.json(
    {
      workflowRunId: workflow.id,
      workflowType: workflow.workflowType,
      status: workflow.status,
      currentStep: workflow.stepProgress,
      totalSteps: 6, // Submission drafter has 6 steps
      startedAt: workflow.startedAt,
      completedAt: workflow.completedAt,
      input: workflow.inputJson,
      result: workflow.resultJson,
      reviewRequired: workflow.reviewRequired,
      confidenceAggregate: workflow.confidenceAggregate,
    },
    { status: 200 },
  );
}

export const GET = withPermission('consult.create', async (request, ctx) =>
  getSubmissionDrafterStatus(request, ctx as unknown as { params: Promise<{ runId: string }> }),
);
