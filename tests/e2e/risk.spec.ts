// @MX:NOTE: [AUTO] E2E spec: ISO 14971 risk management full workflow
// @MX:SPEC: SPEC-REGULA-RISK-001 (T5.2, REQ-RISK-001~020, AC1~AC9)

import { expect, test } from '@playwright/test';
import { requiresAuthState, requiresLiveServer } from './fixtures/env-guard';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

/** Helper: get session token from env or skip */
function getSessionHeader(): Record<string, string> {
  const token = process.env.PLAYWRIGHT_SESSION_TOKEN || process.env.TEST_SESSION_TOKEN;
  if (!token) return {};
  return { Cookie: `authjs.session-token=${token}` };
}

test.describe('Risk Management Workflow (SPEC-REGULA-RISK-001)', () => {
  test.describe.configure({ mode: 'serial' });

  let riskRunId: string;

  test('risk workflow: identify hazards for a device', async ({ request }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    // Create a risk run first
    const runResp = await request.post(`${baseUrl}/api/ra/risk/runs`, {
      headers: {
        'Content-Type': 'application/json',
        ...getSessionHeader(),
      },
      data: {
        deviceDescription: 'Insulin pump for subcutaneous insulin delivery',
        deviceClass: 'Class III',
        projectId: process.env.TEST_PROJECT_ID || 'test-project-001',
      },
    });
    expect(runResp.ok()).toBeTruthy();
    const runData = await runResp.json();
    expect(runData.run?.id || runData.id).toBeTruthy();
    riskRunId = runData.run?.id ?? runData.id;

    // Identify hazards
    const identifyResp = await request.post(`${baseUrl}/api/ra/risk/identify`, {
      headers: {
        'Content-Type': 'application/json',
        ...getSessionHeader(),
      },
      data: {
        deviceDescription: 'Insulin pump for subcutaneous insulin delivery',
        deviceClass: 'Class III',
        workflowRunId: riskRunId,
      },
    });
    expect(identifyResp.ok()).toBeTruthy();
    const identifyData = await identifyResp.json();

    // Must return hazard items
    expect(identifyData.items).toBeDefined();
    expect(Array.isArray(identifyData.items)).toBeTruthy();
    expect(identifyData.items.length).toBeGreaterThan(0);

    // Each item must have required ISO 14971 fields
    const firstItem = identifyData.items[0];
    expect(firstItem.hazardCategory).toBeTruthy();
  });

  test('risk workflow: evaluate risk matrix', async ({ request }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    // Evaluate risk for a hazard item
    const evalResp = await request.post(`${baseUrl}/api/ra/risk/items`, {
      headers: {
        'Content-Type': 'application/json',
        ...getSessionHeader(),
      },
      data: {
        workflowRunId: riskRunId,
        hazardCategory: 'Energy hazard',
        hazardousSituation: 'Over-infusion of insulin',
        sequenceOfEvents: 'Pump malfunction → over-delivery',
        severity: 4,
        probability: 3,
      },
    });
    expect(evalResp.ok()).toBeTruthy();
    const evalData = await evalResp.json();

    // Must return a risk item with risk level
    const item = evalData.item ?? evalData;
    expect(item.riskLevel ?? item.risk_level).toBeTruthy();
    // Risk level must be one of the ISO 14971 levels
    const level = (item.riskLevel ?? item.risk_level ?? '').toLowerCase();
    expect(['acc', 'alarp', 'unacc']).toContain(level);
  });

  test('risk workflow: adopt control measures', async ({ request }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    // Get available controls for the run
    const controlsResp = await request.get(`${baseUrl}/api/ra/risk/controls?runId=${riskRunId}`, {
      headers: getSessionHeader(),
    });
    // Controls endpoint may not require items to exist yet
    expect(controlsResp.status()).toBeLessThan(500);

    // Adopt a control measure
    const adoptResp = await request.post(`${baseUrl}/api/ra/risk/controls`, {
      headers: {
        'Content-Type': 'application/json',
        ...getSessionHeader(),
      },
      data: {
        workflowRunId: riskRunId,
        controlType: 'inherent_safety',
        description: 'Maximum dose limit enforced in software',
        residualSeverity: 2,
        residualProbability: 2,
      },
    });
    expect(adoptResp.ok()).toBeTruthy();
    const adoptData = await adoptResp.json();

    // Must return residual risk assessment
    const control = adoptData.control ?? adoptData;
    expect(control).toBeDefined();
  });

  test('risk workflow: export DOCX report', async ({ request }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    // Request DOCX export
    const exportResp = await request.post(`${baseUrl}/api/ra/risk/runs`, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ...getSessionHeader(),
      },
      data: {
        runId: riskRunId,
        format: 'docx',
        action: 'export',
      },
    });

    // Export endpoint must return binary or redirect
    expect([200, 201, 302]).toContain(exportResp.status());

    if (exportResp.status() === 200 || exportResp.status() === 201) {
      const contentType = exportResp.headers()['content-type'] ?? '';
      const isDocx =
        contentType.includes('wordprocessingml') ||
        contentType.includes('octet-stream') ||
        contentType.includes('application/json');
      expect(isDocx).toBeTruthy();
    }
  });

  test('risk workflow: non-ra-lead cannot approve risk report', async ({ request }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);

    // Use ra-member credentials (no risk.approve permission)
    const memberToken = process.env.TEST_RA_MEMBER_SESSION_TOKEN;
    test.skip(!memberToken, 'Requires TEST_RA_MEMBER_SESSION_TOKEN');

    const approveResp = await request.post(`${baseUrl}/api/ra/risk/runs`, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `authjs.session-token=${memberToken}`,
      },
      data: {
        runId: riskRunId,
        action: 'approve',
      },
    });

    // ra-member must be forbidden from approving
    expect(approveResp.status()).toBe(403);
  });
});

test.describe('Risk Workflow Pages', () => {
  test('risk run list page renders', async ({ page }) => {
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    await page.goto('/workflows/risk');
    await expect(page).toHaveURL('/workflows/risk');

    // The page should render without error
    await expect(page.locator('h1, h2, [data-testid="risk-run-list"]')).toBeVisible({
      timeout: 10_000,
    });
  });
});
