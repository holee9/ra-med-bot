import { withPermission } from '@/lib/auth/with-permission';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getAuditResponseStatus(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await params;

  if (!UUID_REGEX.test(runId)) {
    return Response.json({ error: 'Invalid workflow run ID' }, { status: 400 });
  }

  return Response.json(
    {
      workflowRunId: runId,
      workflowType: 'audit_response',
      status: 'queued',
      currentStep: null,
      totalSteps: 6,
      message: 'Status lookup not yet connected to DB',
    },
    { status: 200 },
  );
}

export const GET = withPermission('consult.create', async (request, ctx) =>
  getAuditResponseStatus(request, ctx as unknown as { params: Promise<{ runId: string }> }),
);
