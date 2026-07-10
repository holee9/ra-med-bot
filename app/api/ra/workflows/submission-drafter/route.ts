import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import type { AuthSession } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { workflowRuns } from '@/lib/db/schema';
import { SubmissionDrafterInputSchema } from '@/lib/workflows/types';

async function postSubmissionDrafter(request: Request, session: AuthSession): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid input', details: {} }, { status: 400 });
  }

  const result = SubmissionDrafterInputSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: 'Invalid input', details: result.error.format() },
      { status: 400 },
    );
  }

  const data = result.data;
  const runId = crypto.randomUUID();
  const organizationId = session.user.organizationId;

  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  // @MX:NOTE [AUTO] SPEC-REGULA-WORKFLOWS-LLM-002 M1/M4 — executors now call gx10
  //   gpt-oss:120b (judgeStructured/streamSection). isMock=false (real LLM).
  //   The 202 + streamEventsUrl contract is preserved; the SSE /events route
  //   (runWorkflow) is the streaming consumer (AC-04).
  // @MX:SPEC SPEC-REGULA-WORKFLOWS-LLM-002 (REQ-WFLLM-001/009)
  const isMock = false; // M1: executors are real gx10 LLM (no longer Beta scaffold)

  // 21 CFR Part 11 §11.10(e) — Issue #378: INSERT + audit ride the same
  // db.transaction so a failure between them rolls back both.
  await db.transaction(async (tx) => {
    await tx
      .insert(workflowRuns)
      .values({
        id: runId,
        userId: session.user.id,
        organizationId,
        projectId: data.project_id,
        workflowType: 'submission_drafter',
        status: 'queued',
        inputJson: data,
        resultJson: null,
        stepProgress: null,
        reviewRequired: true,
      })
      .returning();

    await writeAudit(
      {
        actor_id: session.user.id,
        action: 'workflow.start',
        resource_type: 'workflow',
        resource_id: runId,
        meta_json: {
          workflowType: 'submission_drafter',
          mock_data: isMock,
          workflow_run_id: runId,
        },
      },
      tx,
    );
  });

  return Response.json(
    {
      runId,
      workflowRunId: runId,
      streamEventsUrl: `/api/ra/workflows/submission-drafter/${runId}/events`,
      workflowType: 'submission_drafter',
      status: 'queued',
      message: 'Submission Drafter workflow queued',
      input: data,
      queuedAt: new Date().toISOString(),
      _mock: isMock, // Mock disclosure flag
    },
    { status: 202 },
  );
}

export const POST = withPermission('consult.create', async (request, _ctx, session) =>
  postSubmissionDrafter(request, session),
);
