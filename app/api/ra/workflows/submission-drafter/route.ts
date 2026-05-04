import { withPermission } from '@/lib/auth/with-permission';
import { SubmissionDrafterInputSchema } from '@/lib/workflows/types';

export const POST = withPermission('workflow.execute', async (request, _ctx, _session) => {
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
  return Response.json(
    {
      runId,
      workflowRunId: runId,
      workflowType: 'submission_drafter',
      status: 'queued',
      message: 'Submission Drafter workflow queued',
      streamEventsUrl: `/api/ra/workflows/submission-drafter/${runId}/events`,
      input: data,
      queuedAt: new Date().toISOString(),
    },
    { status: 202 },
  );
});
