import { withPermission } from '@/lib/auth/with-permission';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveRunId(ctx: unknown): Promise<string> {
  const raw = (ctx as { params?: unknown }).params;
  const p = raw instanceof Promise ? await raw : raw;
  return (p as { runId?: string })?.runId ?? '';
}

export const GET = withPermission('workflow.execute', async (_req, ctx) => {
  const runId = await resolveRunId(ctx);

  if (!UUID_REGEX.test(runId)) {
    return Response.json({ error: 'Invalid workflow run ID' }, { status: 400 });
  }

  return Response.json(
    {
      workflowRunId: runId,
      workflowType: 'indication_impact',
      status: 'queued',
      currentStep: null,
      totalSteps: 6,
      message: 'Status lookup not yet connected to DB',
    },
    { status: 200 },
  );
});
