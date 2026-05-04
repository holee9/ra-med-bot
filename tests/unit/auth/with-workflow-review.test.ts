import { describe, it, expect } from 'vitest';
import { withWorkflowReview } from '@/lib/auth/with-workflow-review';

describe('withWorkflowReview', () => {
  const makeRequest = (headers: Record<string, string> = {}): Request => {
    return new Request('http://localhost/api/test', { headers });
  };

  const validHeaders = {
    'x-workflow-run-id': '550e8400-e29b-41d4-a716-446655440000',
    'x-user-id': 'user-123',
    'x-user-role': 'reviewer',
    'x-organization-id': 'org-456',
  };

  describe('missing headers', () => {
    it('returns 400 when x-workflow-run-id header is missing', async () => {
      const { 'x-workflow-run-id': _, ...partialHeaders } = validHeaders;
      const handler = withWorkflowReview(async () => ({ ok: true }));
      const req = makeRequest(partialHeaders);
      const response = await handler(req);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    it('returns 400 when x-user-id header is missing', async () => {
      const { 'x-user-id': _, ...partialHeaders } = validHeaders;
      const handler = withWorkflowReview(async () => ({ ok: true }));
      const req = makeRequest(partialHeaders);
      const response = await handler(req);
      expect(response.status).toBe(400);
    });

    it('returns 400 when x-user-role header is missing', async () => {
      const { 'x-user-role': _, ...partialHeaders } = validHeaders;
      const handler = withWorkflowReview(async () => ({ ok: true }));
      const req = makeRequest(partialHeaders);
      const response = await handler(req);
      expect(response.status).toBe(400);
    });

    it('returns 400 when x-organization-id header is missing', async () => {
      const { 'x-organization-id': _, ...partialHeaders } = validHeaders;
      const handler = withWorkflowReview(async () => ({ ok: true }));
      const req = makeRequest(partialHeaders);
      const response = await handler(req);
      expect(response.status).toBe(400);
    });

    it('returns 400 with correct error message when headers missing', async () => {
      const handler = withWorkflowReview(async () => ({ ok: true }));
      const req = makeRequest({});
      const response = await handler(req);
      const body = await response.json();
      expect(body.error).toBe('Missing required workflow context headers');
    });
  });

  describe('with valid headers', () => {
    it('calls handler with correct context when all headers are present', async () => {
      let capturedCtx: unknown = null;
      const handler = withWorkflowReview(async (ctx) => {
        capturedCtx = ctx;
        return { success: true };
      });

      const req = makeRequest(validHeaders);
      await handler(req);

      expect(capturedCtx).toMatchObject({
        workflowRunId: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-123',
        role: 'reviewer',
        organizationId: 'org-456',
      });
    });

    it('wraps handler result in Response.json', async () => {
      const handler = withWorkflowReview(async () => ({ data: 'result' }));
      const req = makeRequest(validHeaders);
      const response = await handler(req);

      expect(response).toBeInstanceOf(Response);
      const body = await response.json();
      expect(body.data).toBe('result');
    });

    it('returns 200 status for successful handler call', async () => {
      const handler = withWorkflowReview(async () => ({ ok: true }));
      const req = makeRequest(validHeaders);
      const response = await handler(req);
      expect(response.status).toBe(200);
    });
  });
});
