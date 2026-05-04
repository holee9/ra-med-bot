import { SubmissionDrafterInputSchema } from '@/lib/workflows/types';

export async function POST(request: Request): Promise<Response> {
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
  return Response.json(
    {
      workflowRunId: crypto.randomUUID(),
      workflowType: 'submission_drafter',
      status: 'queued',
      message: 'Submission Drafter workflow queued',
      input: data,
      queuedAt: new Date().toISOString(),
    },
    { status: 202 },
  );
}
