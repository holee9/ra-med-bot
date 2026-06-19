import { GET } from '@/app/api/ra/workflows/submission-drafter/[runId]/status/route';
import { POST } from '@/app/api/ra/workflows/submission-drafter/route';
import { describe, expect, it, vi } from 'vitest';

// Mock withPermission: pass-through with fixed session
vi.mock('@/lib/audit', () => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, {
          user: { id: 'user-001', role: 'ra-member', organizationId: 'org-001' },
        }),
  ),
}));

// Mock db/client for status route DB query
vi.mock('@/lib/db/client', () => ({
  db: {
    query: {
      workflowRuns: {
        findFirst: vi.fn().mockResolvedValue({
          id: '123e4567-e89b-12d3-a456-426614174000',
          workflowType: 'submission_drafter',
          status: 'queued',
          stepProgress: null,
          inputJson: {},
          resultJson: null,
          startedAt: new Date().toISOString(),
          completedAt: null,
          reviewRequired: true,
          confidenceAggregate: null,
        }),
      },
    },
  },
}));

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';

const validBody = {
  product_name: 'TestDevice Pro',
  device_class: 'II',
  indications_for_use:
    'Intended for use in the diagnosis and monitoring of cardiovascular conditions.',
  target_jurisdiction: 'US_FDA',
  project_id: VALID_PROJECT_ID,
};

describe('POST /api/ra/workflows/submission-drafter', () => {
  it('returns 202 with trigger contract for valid input', async () => {
    const req = new Request('http://localhost/api/ra/workflows/submission-drafter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    const res = await POST(req);
    expect(res.status).toBe(202);

    const json = await res.json();
    expect(json.workflowType).toBe('submission_drafter');
    expect(json.status).toBe('queued');
    expect(typeof json.runId).toBe('string');
    expect(json.runId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(json.workflowRunId).toBe(json.runId);
    expect(json.streamEventsUrl).toBe(`/api/ra/workflows/submission-drafter/${json.runId}/events`);
    expect(json.queuedAt).toBeDefined();
    expect(json.input).toMatchObject(validBody);
  });

  it('returns 400 for missing required field (product_name)', async () => {
    const { product_name: _productName, ...body } = validBody;

    const req = new Request('http://localhost/api/ra/workflows/submission-drafter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Invalid input');
    expect(json.details).toBeDefined();
  });

  it('returns 400 for invalid device_class value', async () => {
    const body = { ...validBody, device_class: 'IV' };

    const req = new Request('http://localhost/api/ra/workflows/submission-drafter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for product_name that is too short (< 3 chars)', async () => {
    const body = { ...validBody, product_name: 'AB' };

    const req = new Request('http://localhost/api/ra/workflows/submission-drafter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/ra/workflows/submission-drafter/[runId]/status', () => {
  it('returns 200 with status payload for a valid UUID runId', async () => {
    const req = new Request(
      `http://localhost/api/ra/workflows/submission-drafter/${VALID_UUID}/status`,
    );
    const params = Promise.resolve({ runId: VALID_UUID });

    const res = await GET(req, { params });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.workflowRunId).toBe(VALID_UUID);
    expect(json.workflowType).toBe('submission_drafter');
    expect(json.status).toBe('queued');
    expect(json.totalSteps).toBe(6);
    expect(json.currentStep).toBeNull();
  });

  it('returns 400 for a non-UUID runId', async () => {
    const req = new Request(
      'http://localhost/api/ra/workflows/submission-drafter/not-a-uuid/status',
    );
    const params = Promise.resolve({ runId: 'not-a-uuid' });

    const res = await GET(req, { params });
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Invalid workflow run ID');
  });

  it('returns 400 for runId with invalid format (too short)', async () => {
    const req = new Request('http://localhost/api/ra/workflows/submission-drafter/12345/status');
    const params = Promise.resolve({ runId: '12345' });

    const res = await GET(req, { params });
    expect(res.status).toBe(400);
  });
});
