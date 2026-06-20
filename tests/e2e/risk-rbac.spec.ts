// @MX:NOTE: [AUTO] E2E spec: ISO 14971 risk management RBAC enforcement
// @MX:SPEC: SPEC-REGULA-RISK-001 (T5.3, REQ-RISK-019~020, AC9)

import { expect, test } from '@playwright/test';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// Test risk run ID — must exist in the test database or be created in beforeAll
const TEST_RISK_RUN_ID = process.env.TEST_RISK_RUN_ID || 'test-risk-run-rbac-001';

test.describe('Risk RBAC (SPEC-REGULA-RISK-001 REQ-RISK-019~020)', () => {
  test('RBAC: ra-member approve returns 403', async ({ request }) => {
    const memberToken = process.env.TEST_RA_MEMBER_SESSION_TOKEN;
    if (!memberToken) {
      test.skip(true, 'Requires TEST_RA_MEMBER_SESSION_TOKEN env var');
      return;
    }

    const resp = await request.post(`${baseUrl}/api/ra/risk/runs`, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `authjs.session-token=${memberToken}`,
      },
      data: {
        runId: TEST_RISK_RUN_ID,
        action: 'approve',
      },
    });

    // ra-member does not have risk.approve permission → 403
    expect(resp.status()).toBe(403);

    const body = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    // Error must indicate permission denial
    const errMsg = String(body.error ?? body.message ?? '').toLowerCase();
    expect(errMsg).toMatch(/forbidden|permission|unauthorized|not_allowed/);
  });

  test('RBAC: ra-lead approve returns 200 or 201', async ({ request }) => {
    const leadToken = process.env.TEST_RA_LEAD_SESSION_TOKEN;
    if (!leadToken) {
      test.skip(true, 'Requires TEST_RA_LEAD_SESSION_TOKEN env var');
      return;
    }

    const resp = await request.post(`${baseUrl}/api/ra/risk/runs`, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `authjs.session-token=${leadToken}`,
      },
      data: {
        runId: TEST_RISK_RUN_ID,
        action: 'approve',
      },
    });

    // ra-lead has risk.approve permission → 200 or 201
    expect([200, 201]).toContain(resp.status());
  });

  test('RBAC: unauthenticated access to risk identify returns 401', async ({ request }) => {
    const resp = await request.post(`${baseUrl}/api/ra/risk/identify`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        deviceDescription: 'Test device',
        deviceClass: 'Class II',
        workflowRunId: TEST_RISK_RUN_ID,
      },
    });

    // No session → 401 Unauthorized
    expect(resp.status()).toBe(401);
  });

  test('RBAC: unauthenticated access to risk runs returns 401', async ({ request }) => {
    const resp = await request.get(`${baseUrl}/api/ra/risk/runs`, {
      headers: { 'Content-Type': 'application/json' },
    });

    expect(resp.status()).toBe(401);
  });

  test('RBAC: unauthenticated access to risk controls returns 401', async ({ request }) => {
    const resp = await request.get(`${baseUrl}/api/ra/risk/controls?runId=${TEST_RISK_RUN_ID}`);

    expect(resp.status()).toBe(401);
  });

  test('RBAC: unauthenticated access to risk items returns 401', async ({ request }) => {
    const resp = await request.post(`${baseUrl}/api/ra/risk/items`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        workflowRunId: TEST_RISK_RUN_ID,
        hazardCategory: 'Energy hazard',
        severity: 3,
        probability: 2,
      },
    });

    expect(resp.status()).toBe(401);
  });
});
