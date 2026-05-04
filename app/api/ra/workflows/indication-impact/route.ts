import { withPermission } from '@/lib/auth/with-permission';
import { IndicationImpactInputSchema } from '@/lib/workflows/types';

async function postIndicationImpact(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid input', details: {} }, { status: 400 });
  }

  const result = IndicationImpactInputSchema.safeParse(body);
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
      streamEventsUrl: `/api/ra/workflows/indication-impact/${runId}/events`,
      workflowType: 'indication_impact',
      status: 'queued',
      message: 'Indication Impact Analyzer workflow queued',
      input: data,
      queuedAt: new Date().toISOString(),
    },
    { status: 202 },
  );
}

export const POST = withPermission('consult.create', async (request) =>
  postIndicationImpact(request),
);
