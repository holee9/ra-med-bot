import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import type { AuthSession } from '@/lib/auth/with-permission';
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
  await writeAudit({
    actor_id: session.user.id,
    action: 'workflow.start',
    resource_type: 'workflow',
    resource_id: runId,
    meta_json: { workflowType: 'submission_drafter' },
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
    },
    { status: 202 },
  );
}

export const POST = withPermission('consult.create', async (request, _ctx, session) =>
  postSubmissionDrafter(request, session),
);
