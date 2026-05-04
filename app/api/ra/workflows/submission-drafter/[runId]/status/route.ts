const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
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
      workflowType: 'submission_drafter',
      status: 'queued',
      currentStep: null,
      totalSteps: 6,
      message: 'Status lookup not yet connected to DB',
    },
    { status: 200 },
  );
}
