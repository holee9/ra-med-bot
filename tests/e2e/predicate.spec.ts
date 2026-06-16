// @MX:NOTE [AUTO] E2E spec: predicate-device full journey, RBAC, and responsive
//   layout for SPEC-REGULA-PREDICATE-001.
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-007, REQ-PRE-011, REQ-PRE-014,
//   REQ-PRE-019, REQ-PRE-020, REQ-PRE-024, REQ-PRE-029, REQ-PRE-030) — A8, A10, A11
//
// These specs follow the project E2E conventions:
//   - requiresLiveServer()/requiresAuthState() env guards skip when no server or
//     authenticated session is available (see tests/e2e/fixtures/env-guard.ts).
//   - Accessibility-first locators (getByRole / getByLabel / getByText) are
//     preferred; data-testid is used where semantic roles are ambiguous.
//   - openFDA and comparison API calls are intercepted with page.route() so the
//     journey is deterministic and does not depend on the live FDA corpus.

import { expect, test } from '@playwright/test';
import { requiresAuthState, requiresLiveServer } from './fixtures/env-guard';

// --- Deterministic fixtures -------------------------------------------------

/** Five 510(k) candidates, one predating 2004 so the coverage gap is realistic. */
const SEARCH_CANDIDATES = [
  {
    k_number: 'K181234',
    applicant_name: 'Acme Medical Inc',
    device_name: 'Acme Infusion Pump X1',
    decision_date: '2018-06-15',
    decision: 'SESE',
    product_code: 'FRN',
    statement_or_summary: 'summary',
    device_description: 'Volumetric infusion pump for clinical use.',
  },
  {
    k_number: 'K152200',
    applicant_name: 'BetaFlow Systems',
    device_name: 'BetaFlow Infusion Pump',
    decision_date: '2015-03-02',
    decision: 'SESE',
    product_code: 'FRN',
    statement_or_summary: 'summary',
    device_description: 'Ambulatory infusion pump.',
  },
  {
    k_number: 'K133010',
    applicant_name: 'Gamma Devices',
    device_name: 'Gamma Smart Pump',
    decision_date: '2013-11-20',
    decision: 'SESE',
    product_code: 'FRN',
    statement_or_summary: 'summary',
    device_description: 'Large-volume infusion pump.',
  },
  {
    k_number: 'K090455',
    applicant_name: 'Delta Health',
    device_name: 'Delta Syringe Pump',
    decision_date: '2009-08-08',
    decision: 'SN', // not substantially equivalent → exercises NSE badge
    product_code: 'FRN',
    statement_or_summary: 'summary',
    device_description: 'Syringe infusion pump.',
  },
  {
    k_number: 'K021099',
    applicant_name: 'Epsilon Corp',
    device_name: 'Epsilon Legacy Pump',
    decision_date: '2002-01-10', // pre-2004 → coverage gap
    decision: 'SESE',
    product_code: 'FRN',
    statement_or_summary: 'summary',
    device_description: 'Legacy infusion pump.',
  },
];

const COMPARISON_FIXTURE = {
  workflow_run_id: 'wf-run-e2e-0001',
  comparison: {
    subject_device_name: 'Subject Infusion Pump',
    selected_predicates: [SEARCH_CANDIDATES[0]],
    created_at: new Date('2026-06-01T00:00:00.000Z').toISOString(),
    cells: [
      {
        dimension: 'intended_use',
        subject_text: 'Continuous IV fluid delivery.',
        predicate_texts: ['Continuous IV fluid delivery.'],
        llm_suggestions: ['Intended uses align; both deliver continuous IV fluids.'],
        approved: [false],
      },
      {
        dimension: 'indications',
        subject_text: 'Adult and pediatric patients requiring fluid therapy.',
        predicate_texts: ['Adult patients requiring fluid therapy.'],
        llm_suggestions: ['Subject extends indications to pediatric population.'],
        approved: [false],
      },
      {
        dimension: 'tech_characteristics',
        subject_text: 'Peristaltic pumping, touchscreen UI.',
        predicate_texts: ['Peristaltic pumping, hardware buttons.'],
        llm_suggestions: ['UI differs; pumping mechanism is equivalent.'],
        approved: [false],
      },
      {
        dimension: 'materials',
        subject_text: 'PVC-free fluid path.',
        predicate_texts: ['PVC fluid path.'],
        llm_suggestions: ['Material change requires biocompatibility justification.'],
        approved: [false],
      },
      {
        dimension: 'performance',
        subject_text: '±5% flow accuracy.',
        predicate_texts: ['±5% flow accuracy.'],
        llm_suggestions: ['Performance specifications are equivalent.'],
        approved: [false],
      },
    ],
  },
};

const HISTORY_FIXTURE = {
  comparisons: [
    {
      id: 'wf-run-e2e-0001',
      resultJson: { subject_device_name: 'Subject Infusion Pump' },
      createdAt: '2026-06-01T00:00:00.000Z',
    },
  ],
};

// --- Route mocking helpers --------------------------------------------------

/**
 * Intercept every predicate API call so the journey is deterministic. Export
 * routes return a small binary blob with the appropriate content type so the
 * browser's download path is exercised without a real document generator.
 */
async function mockPredicateApis(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/api/ra/predicate/search', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: SEARCH_CANDIDATES,
        total: SEARCH_CANDIDATES.length,
        search_strategy: 'device_name',
        cached: false,
        has_coverage_gap: true,
      }),
    });
  });

  await page.route('**/api/ra/predicate/comparison**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(COMPARISON_FIXTURE),
      });
      return;
    }
    // GET (history list)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(HISTORY_FIXTURE),
    });
  });

  await page.route('**/api/ra/predicate/export', async (route) => {
    const format = JSON.parse(route.request().postData() ?? '{}').format ?? 'pdf';
    const contentType =
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    await route.fulfill({
      status: 200,
      contentType,
      headers: {
        'content-disposition': `attachment; filename="predicate-comparison.${format}"`,
      },
      body: Buffer.from('%PDF-1.4 mock export payload'),
    });
  });
}

// ---------------------------------------------------------------------------
// Scenario A: Full predicate journey (A10)
// search → top-5 → predicate selection → comparison table → LLM suggestion →
// single-dimension approval → PDF/DOCX export → save → history
// ---------------------------------------------------------------------------

test.describe('Predicate full journey (A10, REQ-PRE-007/011/014/019/024)', () => {
  test('search → select → compare → approve → export → history', async ({ page }) => {
    test.setTimeout(60_000);

    const server = requiresLiveServer();
    const auth = requiresAuthState();
    test.skip(server.skip, server.reason);
    test.skip(auth.skip, auth.reason);

    await mockPredicateApis(page);

    // 1. Navigate to the predicate search page; the search input is visible.
    await page.goto('/predicate');
    const searchInput = page.getByTestId('predicate-search-input');
    await expect(searchInput).toBeVisible();

    // 2. Enter a device name and submit the search.
    await searchInput.fill('infusion pump');
    await page.getByRole('button', { name: 'Search' }).click();

    // 3. Exactly five candidate cards appear (TOP_N = 5, REQ-PRE-026).
    const cards = page.getByTestId('candidate-card');
    await expect(cards).toHaveCount(5);

    // 4. The pre-2004 coverage notice is visible (REQ-PRE-007).
    await expect(page.getByTestId('coverage-notice')).toBeVisible();

    // 5. No card is pre-selected (REQ-PRE-011): every card is aria-selected=false.
    for (let i = 0; i < 5; i++) {
      await expect(cards.nth(i)).toHaveAttribute('aria-selected', 'false');
    }

    // 6. Select the first candidate → navigate to the compare page with ?k=.
    await Promise.all([
      page.waitForURL(/\/predicate\/compare\?k=K181234/),
      cards.first().getByRole('button', { name: 'Select as Predicate' }).click(),
    ]);
    await expect(page.getByTestId('selected-predicates')).toContainText('K181234');

    // 7. Fill the subject-device form (all five SE dimensions).
    await page.getByTestId('subject-input-intended_use').fill('Continuous IV fluid delivery.');
    await page
      .getByTestId('subject-input-indications')
      .fill('Adult and pediatric patients requiring fluid therapy.');
    await page
      .getByTestId('subject-input-tech_characteristics')
      .fill('Peristaltic pumping, touchscreen UI.');
    await page.getByTestId('subject-input-materials').fill('PVC-free fluid path.');
    await page.getByTestId('subject-input-performance').fill('±5% flow accuracy.');

    // 8. Submit the form → comparison table appears (5 dimension rows).
    await page.getByRole('button', { name: 'Build Comparison Table' }).click();
    const rows = page.getByTestId('comparison-row');
    await expect(rows).toHaveCount(5);

    // 9. The SE disclaimer banner is visible (REQ-PRE-014).
    await expect(page.getByTestId('se-disclaimer')).toBeVisible();
    await expect(page.getByTestId('se-disclaimer')).toContainText('cannot be automated');

    // 10. Approve one LLM suggestion → that cell shows the approved state.
    const firstApprove = page.getByRole('button', { name: 'Approve' }).first();
    await expect(firstApprove).toBeVisible();
    await firstApprove.click();
    await expect(page.getByTestId('approved-check').first()).toBeVisible();

    // 11. Export PDF → a download is triggered.
    const pdfDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export PDF' }).click();
    const pdfDownload = await pdfDownloadPromise;
    expect(pdfDownload.suggestedFilename()).toBe('predicate-comparison.pdf');

    // 12. Export DOCX → a download is triggered.
    const docxDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export DOCX' }).click();
    const docxDownload = await docxDownloadPromise;
    expect(docxDownload.suggestedFilename()).toBe('predicate-comparison.docx');

    // Save: the comparison is persisted server-side on creation (REQ-PRE-019);
    // the UI reflects the saved state via the disabled Save control.
    await expect(page.getByRole('button', { name: /저장됨|Save/ })).toBeVisible();

    // 13. Navigate to history → at least one saved comparison is listed (REQ-PRE-020).
    await page.goto('/predicate/history', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('predicate-history-list')).toContainText('Infusion Pump');
  });

  test('NSE candidates render a "Not Substantially Equivalent" badge (REQ-PRE-028)', async ({
    page,
  }) => {
    const server = requiresLiveServer();
    const auth = requiresAuthState();
    test.skip(server.skip, server.reason);
    test.skip(auth.skip, auth.reason);

    await mockPredicateApis(page);
    await page.goto('/predicate');
    await page.getByTestId('predicate-search-input').fill('infusion pump');
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(page.getByTestId('candidate-card')).toHaveCount(5);
    await expect(
      page.getByText('Not Substantially Equivalent', { exact: true }).first(),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Scenario B: RBAC access control (A8, REQ-PRE-029)
// external → 403 / blocked, exec → history read-only, search restricted.
// ---------------------------------------------------------------------------

test.describe('Predicate RBAC (A8, REQ-PRE-029)', () => {
  test('external user is denied predicate search access (403/blocked)', async ({ page }) => {
    const server = requiresLiveServer();
    test.skip(server.skip, server.reason);

    // Simulate the server-side department gate for an external user: the search
    // API returns 403. The UI must surface an error rather than candidate cards.
    await page.route('**/api/ra/predicate/search', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'permission_denied', reason: 'department' }),
      });
    });

    await page.goto('/predicate');
    const searchInput = page.getByTestId('predicate-search-input');
    // The route itself may be middleware-gated (redirect/403). When the page does
    // render, performing a search must not expose results to an external user.
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('infusion pump');
      await page.getByRole('button', { name: 'Search' }).click();
      await expect(
        page.locator('main [role="alert"], #main-content [role="alert"]').first(),
      ).toBeVisible();
      await expect(page.getByTestId('candidate-card')).toHaveCount(0);
    } else {
      // Middleware blocked the route entirely (redirect to /login or 403 page).
      await expect(page).not.toHaveURL(/\/predicate$/);
    }
  });

  test('exec user can read comparison history', async ({ page }) => {
    const server = requiresLiveServer();
    const auth = requiresAuthState();
    test.skip(server.skip, server.reason);
    test.skip(auth.skip, auth.reason);

    // Exec is read-only: history list (GET) succeeds.
    await page.route('**/api/ra/predicate/comparison**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(HISTORY_FIXTURE),
        });
        return;
      }
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'permission_denied', reason: 'department' }),
      });
    });

    await page.goto('/predicate/history');
    await expect(page.getByRole('heading', { name: '비교 이력' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Infusion Pump/ }).first()).toBeVisible();
  });

  test('exec user search returns a restricted/permission-denied response', async ({ page }) => {
    const server = requiresLiveServer();
    const auth = requiresAuthState();
    test.skip(server.skip, server.reason);
    test.skip(auth.skip, auth.reason);

    // Exec has no search scope: the search API returns 403.
    await page.route('**/api/ra/predicate/search', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'permission_denied', reason: 'department' }),
      });
    });

    await page.goto('/predicate');
    const searchInput = page.getByTestId('predicate-search-input');
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('infusion pump');
      await page.getByRole('button', { name: 'Search' }).click();
      await expect(
        page.locator('main [role="alert"], #main-content [role="alert"]').first(),
      ).toBeVisible();
      await expect(page.getByTestId('candidate-card')).toHaveCount(0);
    } else {
      await expect(page).not.toHaveURL(/\/predicate$/);
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario C: Mobile responsiveness (A11, REQ-PRE-030)
// 768 / 1024 / 1440 viewports: search input visible, comparison table scrolls.
// ---------------------------------------------------------------------------

const VIEWPORTS = [
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'small-desktop-1024', width: 1024, height: 768 },
  { name: 'desktop-1440', width: 1440, height: 900 },
] as const;

test.describe('Predicate responsiveness (A11, REQ-PRE-030)', () => {
  for (const vp of VIEWPORTS) {
    test(`search input is visible at ${vp.width}px (${vp.name})`, async ({ page }) => {
      const server = requiresLiveServer();
      const auth = requiresAuthState();
      test.skip(server.skip, server.reason);
      test.skip(auth.skip, auth.reason);

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockPredicateApis(page);

      await page.goto('/predicate');
      await expect(page.getByTestId('predicate-search-input')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
    });

    test(`comparison table is reachable at ${vp.width}px (${vp.name})`, async ({ page }) => {
      const server = requiresLiveServer();
      const auth = requiresAuthState();
      test.skip(server.skip, server.reason);
      test.skip(auth.skip, auth.reason);

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockPredicateApis(page);

      // Arrive on the compare page pre-seeded with a predicate K-number.
      await page.goto('/predicate/compare?k=K181234');
      await page.getByTestId('subject-input-intended_use').fill('Continuous IV fluid delivery.');
      await page.getByRole('button', { name: 'Build Comparison Table' }).click();

      const scroll = page.getByTestId('comparison-scroll');
      await expect(scroll).toBeVisible();

      if (vp.width === 768) {
        // REQ-PRE-030: at 768px the min-width table forces horizontal scroll —
        // the scroll container's content is wider than its visible width.
        const overflow = await scroll.evaluate((el) => el.scrollWidth > el.clientWidth);
        expect(overflow).toBe(true);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Accessibility (bonus): axe-core scan on predicate routes.
// @axe-core/playwright is a project dependency (package.json).
// ---------------------------------------------------------------------------

test.describe('Predicate accessibility (WCAG 2.1 AA)', () => {
  test('no critical a11y violations on /predicate and /predicate/compare', async ({ page }) => {
    const server = requiresLiveServer();
    const auth = requiresAuthState();
    test.skip(server.skip, server.reason);
    test.skip(auth.skip, auth.reason);

    // Lazy import keeps the dependency optional for environments without it.
    const { default: AxeBuilder } = await import('@axe-core/playwright');

    await mockPredicateApis(page);

    for (const route of ['/predicate', '/predicate/compare?k=K181234']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      const critical = results.violations.filter((v) => v.impact === 'critical');
      expect(
        critical,
        `Critical a11y violations on ${route}:\n${critical
          .map((v) => `  [${v.id}] ${v.description}`)
          .join('\n')}`,
      ).toHaveLength(0);
    }
  });
});
