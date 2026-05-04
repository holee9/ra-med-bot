import { GET } from '@/app/api/ra/workflows/indication-impact/[runId]/status/route';
import { POST } from '@/app/api/ra/workflows/indication-impact/route';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(async () => ({
    user: { id: 'test-user', role: 'ra-member', organizationId: 'test-org' },
  })),
}));

vi.mock('@/lib/audit', () => ({
  writeAudit: vi.fn(async () => undefined),
}));

vi.mock('@/lib/auth/acl', () => ({
  isOrgMember: vi.fn(async () => true),
  isProjectMember: vi.fn(async () => true),
}));

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';

const validBody = {
  project_id: VALID_PROJECT_ID,
  current_indication:
    'Intended for use in the diagnosis and monitoring of cardiovascular conditions in adult patients.',
  proposed_indication:
    'Intended for use in the diagnosis and monitoring of cardiovascular conditions in adult and pediatric patients.',
  target_markets: ['US', 'EU'],
};

describe('POST /api/ra/workflows/indication-impact', () => {
  it('returns 202 with trigger contract for valid input', async () => {
    const req = new Request('http://localhost/api/ra/workflows/indication-impact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    const res = await POST(req);
    expect(res.status).toBe(202);

    const json = await res.json();
    expect(json.workflowType).toBe('indication_impact');
    expect(json.status).toBe('queued');
    expect(typeof json.runId).toBe('string');
    expect(json.runId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(json.workflowRunId).toBe(json.runId);
    expect(json.streamEventsUrl).toBe(`/api/ra/workflows/indication-impact/${json.runId}/events`);
    expect(json.queuedAt).toBeDefined();
    expect(json.input).toMatchObject(validBody);
  });

  it('returns 400 when current_indication is too short (< 20 chars)', async () => {
    const body = { ...validBody, current_indication: 'Too short' };

    const req = new Request('http://localhost/api/ra/workflows/indication-impact', {
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

  it('returns 400 when target_markets is an empty array', async () => {
    const body = { ...validBody, target_markets: [] };

    const req = new Request('http://localhost/api/ra/workflows/indication-impact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when target_markets has more than 5 items', async () => {
    const body = {
      ...validBody,
      target_markets: ['US', 'EU', 'KR', 'JP', 'CN', 'US'],
    };

    const req = new Request('http://localhost/api/ra/workflows/indication-impact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/ra/workflows/indication-impact/[runId]/status', () => {
  it('returns 200 with status payload for a valid UUID runId', async () => {
    const req = new Request(
      `http://localhost/api/ra/workflows/indication-impact/${VALID_UUID}/status`,
    );
    const params = Promise.resolve({ runId: VALID_UUID });

    const res = await GET(req, { params });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.workflowRunId).toBe(VALID_UUID);
    expect(json.workflowType).toBe('indication_impact');
    expect(json.status).toBe('queued');
    expect(json.totalSteps).toBe(6);
    expect(json.currentStep).toBeNull();
  });

  it('returns 400 for a non-UUID runId', async () => {
    const req = new Request(
      'http://localhost/api/ra/workflows/indication-impact/not-a-uuid/status',
    );
    const params = Promise.resolve({ runId: 'not-a-uuid' });

    const res = await GET(req, { params });
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Invalid workflow run ID');
  });

  it('returns 400 for runId with invalid format (too short)', async () => {
    const req = new Request('http://localhost/api/ra/workflows/indication-impact/12345/status');
    const params = Promise.resolve({ runId: '12345' });

    const res = await GET(req, { params });
    expect(res.status).toBe(400);
  });
});
