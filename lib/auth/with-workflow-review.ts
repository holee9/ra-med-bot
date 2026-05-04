import { z } from 'zod';

// @MX:ANCHOR: [AUTO] withWorkflowReview — mandatory HOC for workflow review API routes
// @MX:REASON: fan_in >= 3: approval, signature, verification route handlers all use this wrapper

export const WorkflowReviewContextSchema = z.object({
  workflowRunId: z.string().min(1),
  userId: z.string().min(1),
  role: z.string().min(1),
  organizationId: z.string().min(1),
});

export type WorkflowReviewContext = z.infer<typeof WorkflowReviewContextSchema>;

const REQUIRED_HEADERS = [
  'x-workflow-run-id',
  'x-user-id',
  'x-user-role',
  'x-organization-id',
] as const;

/**
 * HOC that wraps an API route handler with workflow review gate authentication.
 *
 * Reads workflow context from request headers:
 *   x-workflow-run-id, x-user-id, x-user-role, x-organization-id
 *
 * Returns 400 if any required header is missing.
 * On success, calls handler with parsed context and wraps result in Response.json().
 */
export function withWorkflowReview<T>(
  handler: (ctx: WorkflowReviewContext, req: Request) => Promise<T>,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    // Check all required headers are present
    for (const header of REQUIRED_HEADERS) {
      if (!req.headers.get(header)) {
        return Response.json(
          { error: 'Missing required workflow context headers' },
          { status: 400 },
        );
      }
    }

    const workflowRunId = req.headers.get('x-workflow-run-id');
    const userId = req.headers.get('x-user-id');
    const role = req.headers.get('x-user-role');
    const organizationId = req.headers.get('x-organization-id');

    if (!workflowRunId || !userId || !role || !organizationId) {
      return Response.json({ error: 'Missing required workflow context headers' }, { status: 400 });
    }

    const ctx: WorkflowReviewContext = { workflowRunId, userId, role, organizationId };

    const result = await handler(ctx, req);
    return Response.json(result);
  };
}
