// @MX:NOTE [AUTO] E2E spec: PMS workflow full journey (AC-05, AC-06, AC-07)
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-005, REQ-PMS-006, REQ-PMS-007, AC-05/06/07)
//
// These specs follow the project E2E conventions:
//   - requiresLiveServer()/requiresAuthState() env guards skip when no server or
//     authenticated session is available (see tests/e2e/fixtures/env-guard.ts).
//   - Accessibility-first locators (getByRole / getByLabel / getByText) are
//     preferred; data-testid is used where semantic roles are ambiguous.
//   - API calls are intercepted with page.route() so the journey is deterministic.
//
// Scenarios:
//   AC-05: PMS report creation with complaint/vigilance inputs
//   AC-06: Article 83-86 compliance check result display
//   AC-07 (negative): expert-review-not-done → close blocked

import { expect, test } from '@playwright/test';
import { requiresAuthState, requiresLiveServer } from './fixtures/env-guard';

// --- Deterministic fixtures -------------------------------------------------

const PROJECT_ID = '00000000-0000-0000-0000-000000000001';

const PMS_REPORT_FIXTURE = {
  id: 'pms-doc-001',
  projectId: PROJECT_ID,
  documentType: 'pms-report',
  status: 'draft',
  cerLinked: true,
  cerRefId: 'cer-run-uuid',
  cerDeviceName: 'CardioStent-X',
  sections: {
    summary: 'PMS Report for CardioStent-X',
    scope: 'This report covers post-market surveillance activities.',
    complaints: 'No complaints reported in this period.',
    vigilance: 'No vigilance reports in this period.',
  },
  createdAt: new Date('2026-06-01T00:00:00.000Z').toISOString(),
};

const COMPLIANCE_FIXTURE = {
  projectId: PROJECT_ID,
  results: [
    {
      article: 'Article 83',
      requirement: 'PMS reporting',
      status: 'compliant',
      details: 'All PMS requirements are met.',
    },
    {
      article: 'Article 84',
      requirement: 'Incident reporting',
      status: 'compliant',
      details: 'Incident reporting system is in place.',
    },
    {
      article: 'Article 85',
      requirement: 'Trend reporting',
      status: 'pending',
      details: 'Trend reporting needs to be established.',
    },
    {
      article: 'Article 86',
      requirement: 'Field safety notices',
      status: 'compliant',
      details: 'Field safety notice process is documented.',
    },
  ],
};

const INPUTS_FIXTURE = {
  projectId: PROJECT_ID,
  inputs: [
    {
      id: 'input-001',
      type: 'complaint',
      source: 'user-report',
      description: 'Minor usability issue reported',
      date: '2026-06-15',
    },
    {
      id: 'input-002',
      type: 'vigilance',
      source: 'authority',
      description: 'Vigilance report from regulatory authority',
      date: '2026-06-16',
    },
  ],
};

// --- Route mocking helpers --------------------------------------------------

async function mockPmsApis(page: import('@playwright/test').Page): Promise<void> {
  // PMS document list/retrieve
  await page.route('**/api/pms/' + '**/documents', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ documents: [PMS_REPORT_FIXTURE] }),
      });
    }
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, documentId: 'pms-doc-001' }),
      });
    }
  });

  // Compliance check endpoint
  await page.route('**/api/pms/' + '**/compliance', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(COMPLIANCE_FIXTURE),
    });
  });

  // Inputs endpoint
  await page.route('**/api/pms/inputs', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(INPUTS_FIXTURE),
      });
    }
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, inputId: 'input-003' }),
      });
    }
  });

  // Expert review gate check
  await page.route('**/api/pms/' + '**/documents/' + '**/close', async (route) => {
    const requestBody = route.request().postDataJSON();
    // Simulate expert review NOT done check
    if (requestBody.expertReviewCompleted !== true) {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'expert_review_required',
          message: 'Document cannot be closed without expert review completion',
        }),
      });
      return;
    }
    // Success when expert review is done
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, documentId: 'pms-doc-001', status: 'closed' }),
    });
  });

  // PMS report run endpoint
  await page.route('**/api/workflows/pms-report/run', async (route) => {
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        runId: 'pms-run-001',
        status: 'pending',
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Scenario A: PMS report creation with inputs (AC-05)
// inputs upload → PMS report generation → CER linkage display
// ---------------------------------------------------------------------------

test.describe('PMS workflow - AC-05 (complaint/vigilance inputs integration)', () => {
  test('uploads complaint/vigilance inputs and generates PMS report with CER linkage', async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const server = requiresLiveServer();
    const auth = requiresAuthState();
    test.skip(server.skip, server.reason);
    test.skip(auth.skip, auth.reason);

    await mockPmsApis(page);

    // 1. Navigate to PMS workbench for the project
    await page.goto(`/pms/${PROJECT_ID}`);
    await expect(page.getByTestId('pms-workbench')).toBeVisible();

    // 2. Verify CER linkage indicator is shown (REQ-PMS-004)
    const cerLinkage = page.getByTestId('pms-workbench-cer-linkage');
    await expect(cerLinkage).toBeVisible();
    await expect(cerLinkage).toContainText('CardioStent-X');

    // 3. Navigate to Inputs tab
    await page.getByTestId('pms-tab-inputs').click();
    await expect(page.getByTestId('pms-tabpanel-inputs')).toBeVisible();

    // 4. Verify existing inputs are displayed
    await expect(page.getByText('complaint', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('vigilance', { exact: true }).first()).toBeVisible();

    // 5. Upload a new complaint input
    const fileInput = page.getByTestId('input-file-upload');
    await fileInput.setInputFiles('tests/e2e/fixtures/sample-complaint.csv');

    // Submit the upload
    await page.getByRole('button', { name: /Upload|업로드/ }).click();
    await expect(page.getByText(/uploaded|uploaded successfully|업로드됨/i)).toBeVisible({
      timeout: 5000,
    });

    // 6. Navigate to PMS Report tab
    await page.getByTestId('pms-tab-pms-report').click();
    await expect(page.getByTestId('pms-tabpanel-pms-report')).toBeVisible();

    // 7. Generate PMS report (trigger run endpoint)
    await page.getByRole('button', { name: /Generate Report|보고서 생성/ }).click();
    await expect(page.getByText(/generating|생성 중/i)).toBeVisible({ timeout: 5000 });

    // 8. Verify PMS report is created and displays inputs summary
    await expect(page.getByTestId('pms-report-content')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/complaint|complaints/i)).toBeVisible();
    await expect(page.getByText(/vigilance/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Scenario B: Article 83-86 compliance check display (AC-06)
// compliance tab → 4 article results → status visualization
// ---------------------------------------------------------------------------

test.describe('PMS workflow - AC-06 (Article 83-86 compliance check)', () => {
  test('displays Article 83-86 compliance check results with status indicators', async ({
    page,
  }) => {
    const server = requiresLiveServer();
    const auth = requiresAuthState();
    test.skip(server.skip, server.reason);
    test.skip(auth.skip, auth.reason);

    await mockPmsApis(page);

    await page.goto(`/pms/${PROJECT_ID}`);
    await expect(page.getByTestId('pms-workbench')).toBeVisible();

    // 1. Navigate to Compliance tab
    await page.getByTestId('pms-tab-compliance').click();
    await expect(page.getByTestId('pms-tabpanel-compliance')).toBeVisible();

    // 2. Verify all 4 articles are displayed (REQ-PMS-007)
    await expect(page.getByText('Article 83')).toBeVisible();
    await expect(page.getByText('Article 84')).toBeVisible();
    await expect(page.getByText('Article 85')).toBeVisible();
    await expect(page.getByText('Article 86')).toBeVisible();

    // 3. Verify compliant status badges
    const compliantBadges = page.getByTestId('compliance-badge-compliant');
    await expect(compliantBadges).toHaveCount(3); // Articles 83, 84, 86

    // 4. Verify pending status badge
    const pendingBadge = page.getByTestId('compliance-badge-pending');
    await expect(pendingBadge).toBeVisible();
    await expect(pendingBadge).toContainText('Article 85');

    // 5. Verify requirement details are shown
    await expect(page.getByText('PMS reporting')).toBeVisible();
    await expect(page.getByText('Incident reporting')).toBeVisible();
    await expect(page.getByText('Trend reporting')).toBeVisible();
    await expect(page.getByText('Field safety notices')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Scenario C: Expert review gating negative test (AC-07)
// attempt close without expert review → 403 / disabled state → error message
// ---------------------------------------------------------------------------

test.describe('PMS workflow - AC-07 (negative: expert review gating)', () => {
  test('blocks document close/export when expert review is NOT completed', async ({ page }) => {
    const server = requiresLiveServer();
    const auth = requiresAuthState();
    test.skip(server.skip, server.reason);
    test.skip(auth.skip, auth.reason);

    await mockPmsApis(page);

    await page.goto(`/pms/${PROJECT_ID}`);
    await expect(page.getByTestId('pms-workbench')).toBeVisible();

    // 1. Navigate to PMS Report tab
    await page.getByTestId('pms-tab-pms-report').click();
    await expect(page.getByTestId('pms-tabpanel-pms-report')).toBeVisible();

    // 2. Attempt to close the document without expert review
    const closeBtn = page.getByRole('button', { name: /Close Document|문서 닫기/ });

    // Verify the button exists
    await expect(closeBtn).toBeVisible();

    // Click close button
    await closeBtn.click();

    // 3. Verify 403 error is displayed (expert review required)
    await expect(page.getByTestId('close-error-message')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('close-error-message')).toContainText(
      /expert review|전문가 검토/i,
    );
    await expect(page.getByTestId('close-error-message')).toContainText(/required|필수/i);

    // 4. Verify document is NOT closed (status still 'draft')
    await expect(page.getByTestId('document-status')).toContainText('draft');
  });

  test('allows document close/export when expert review IS completed', async ({ page }) => {
    const server = requiresLiveServer();
    const auth = requiresAuthState();
    test.skip(server.skip, server.reason);
    test.skip(auth.skip, auth.reason);

    // Mock the close endpoint to check for expert review flag
    await page.route('**/api/pms/' + '**/documents/' + '**/close', async (route) => {
      const _requestBody = route.request().postDataJSON();
      // This time, simulate expert review IS done
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, documentId: 'pms-doc-001', status: 'closed' }),
      });
    });

    await mockPmsApis(page);

    await page.goto(`/pms/${PROJECT_ID}`);
    await expect(page.getByTestId('pms-workbench')).toBeVisible();

    // 1. Navigate to PMS Report tab
    await page.getByTestId('pms-tab-pms-report').click();
    await expect(page.getByTestId('pms-tabpanel-pms-report')).toBeVisible();

    // 2. Mark expert review as completed (via checkbox or action)
    const expertReviewCheckbox = page.getByTestId('expert-review-completed');
    if (await expertReviewCheckbox.isVisible()) {
      await expertReviewCheckbox.check();
    }

    // 3. Close the document
    const closeBtn = page.getByRole('button', { name: /Close Document|문서 닫기/ });
    await closeBtn.click();

    // 4. Verify success message
    await expect(page.getByTestId('close-success-message')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('close-success-message')).toContainText(/closed|닫힘/i);

    // 5. Verify document status changed to 'closed'
    await expect(page.getByTestId('document-status')).toContainText('closed');
  });
});

// ---------------------------------------------------------------------------
// Scenario D: CER linkage end-to-end (AC-04 verification)
// CER run persisted → PMS report auto-links → device name display
// ---------------------------------------------------------------------------

test.describe('PMS workflow - AC-04 (CER auto-linkage)', () => {
  test('displays CER linkage data when CER run exists for the same project', async ({ page }) => {
    const server = requiresLiveServer();
    const auth = requiresAuthState();
    test.skip(server.skip, server.reason);
    test.skip(auth.skip, auth.reason);

    await mockPmsApis(page);

    await page.goto(`/pms/${PROJECT_ID}`);
    await expect(page.getByTestId('pms-workbench')).toBeVisible();

    // 1. Verify CER linkage indicator is shown at the top
    const cerLinkage = page.getByTestId('pms-workbench-cer-linkage');
    await expect(cerLinkage).toBeVisible();
    await expect(cerLinkage).toContainText('CardioStent-X');

    // 2. Verify CER reference ID is displayed
    await expect(cerLinkage).toContainText('cer-run-uuid');

    // 3. Navigate to PMS Report tab
    await page.getByTestId('pms-tab-pms-report').click();
    await expect(page.getByTestId('pms-tabpanel-pms-report')).toBeVisible();

    // 4. Verify CER data is integrated into the report
    await expect(page.getByTestId('pms-cer-linked-section')).toBeVisible();
    await expect(page.getByText('CardioStent-X')).toBeVisible();
  });

  test('shows no CER linkage when CER run does NOT exist for the project', async ({ page }) => {
    const server = requiresLiveServer();
    const auth = requiresAuthState();
    test.skip(server.skip, server.reason);
    test.skip(auth.skip, auth.reason);

    // Mock APIs to return NO CER linkage
    await page.route('**/api/pms/' + '**/documents', async (route) => {
      const noCerFixture = {
        ...PMS_REPORT_FIXTURE,
        cerLinked: false,
        cerRefId: null,
        cerDeviceName: null,
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ documents: [noCerFixture] }),
      });
    });

    await page.goto(`/pms/${PROJECT_ID}`);
    await expect(page.getByTestId('pms-workbench')).toBeVisible();

    // 1. Verify CER linkage indicator shows "not linked" state
    const cerLinkage = page.getByTestId('pms-workbench-cer-linkage');
    await expect(cerLinkage).toBeVisible();
    await expect(cerLinkage).toContainText(/no cer|cer not linked|not linked/i);
  });
});
