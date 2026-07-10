// @MX:NOTE: [AUTO] E2E spec: impact wizard 4-step flow -> signal-light + matrix + similar cases journey
// @MX:SPEC: SPEC-V3-IMPACT-UI-001 (REQ-IMP-UI-001..006), #202 BLOCK-5

import { expect, test } from '@playwright/test';
import { requiresAuthState, requiresLiveServer } from './fixtures/env-guard';

// This spec exercises the production "impact wizard -> result" journey
// (#202 Journey 3). It fills the BLOCK-5 gap where the individual Step
// components each have unit tests but no single E2E test asserts the full
// 4-step flow holds together end-to-end.
//
// Journey contract (SPEC-V3-IMPACT-UI-001):
//   1. User navigates to /impact and steps through the 4-step wizard
//      (product -> category -> detail -> markets).
//   2. On submit, the result page renders: signal-light + matrix-table +
//      llm-classification + similar-cases (+ optional ticket-cta).
//   3. When confidence < 80%, a ticket is created and TicketCTA renders.
//   4. Similar cases carry citation markers (Charter [지양-2] citation 강제).
//
// The wizard POSTs to /api/impact-check. Rather than depend on the live
// 4-layer pipeline (deterministic retest matrix + gx10 LLM classification +
// ra-llm-wiki RAG), we mock the endpoint with a deterministic response. This
// keeps the spec CI-safe + env-guarded while asserting the full UI journey.

// Deterministic mock response mirroring ImpactCheckResponse (useImpactCheck.ts).
// High-confidence scenario: signal=yellow, confidence 0.92, 3 similar cases,
// no ticket (confidence >= 0.8 so no RA Inbox ticket is created).
const HIGH_CONFIDENCE_RESPONSE = {
  matrix: [
    { market: 'us', level: 'required', ref: 'FDA 510(k)', note: 'Full submission required.' },
    { market: 'eu', level: 'conditional', ref: 'MDR Annex IX', note: 'Notified body assessment.' },
    { market: 'kr', level: 'required', ref: 'MFDS 고시', note: '신고 의무.' },
  ],
  signal: 'yellow' as const,
  classification: {
    category: 'software',
    confidence: 0.92,
    reason: 'Firmware change affecting device control logic.',
  },
  similarCases: [
    {
      id: 'case-001',
      title: 'CardioMonitor X1 firmware recall',
      content: 'Class II recall.',
      similarity: 0.88,
    },
    {
      id: 'case-002',
      title: 'NeuroStim Pro software update',
      content: 'CAPA required.',
      similarity: 0.81,
    },
    { id: 'case-003', title: 'InfusePump v3 patch', content: '510(k) approved.', similarity: 0.76 },
  ],
  recommendation: 'high-confidence-auto-approve',
};

// Low-confidence scenario: confidence 0.62 -> ticket created (Layer 3).
const LOW_CONFIDENCE_RESPONSE = {
  matrix: [
    { market: 'us', level: 'required', ref: 'FDA 510(k)', note: 'Full submission required.' },
  ],
  signal: 'red' as const,
  classification: {
    category: 'sterile',
    confidence: 0.62,
    reason: 'Sterilization method change with unclear biocompatibility impact.',
  },
  // similarCases undefined when low-confidence (per SimilarCasesCard contract).
  ticketId: 'TICKET-impact-0042',
  recommendation: 'low-confidence-manual-review',
};

test.describe('Impact wizard 4-step -> result journey (#202 BLOCK-5)', () => {
  test.beforeEach(async ({ page }) => {
    const server = requiresLiveServer();
    const auth = requiresAuthState();
    test.skip(server.skip, server.reason);
    test.skip(auth.skip, auth.reason);
    await page.goto('/impact');
  });

  test('full journey: 4-step wizard yields signal-light + matrix + classification + similar cases', async ({
    page,
  }) => {
    // Mock the impact-check API with a deterministic high-confidence response.
    await page.route('**/api/impact-check**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(HIGH_CONFIDENCE_RESPONSE),
      });
    });

    // Step 1 — product ID entry.
    await expect(page.locator('[data-testid="step1-product"]')).toBeVisible({ timeout: 10_000 });
    const productInput = page.locator('[data-testid="impact-product-input"]');
    await productInput.fill('PROD-cardiomonitor-x3');
    const next1 = page.locator('[data-testid="step1-product"] [data-testid="impact-next-button"]');
    await expect(next1).toBeEnabled();
    await next1.click();

    // Step 2 — change category selection (radio).
    await expect(page.locator('[data-testid="step2-category"]')).toBeVisible({ timeout: 5_000 });
    // Select the 'sw' (software) category radio.
    await page.locator('[data-testid="category-sw"]').check();
    await expect(page.locator('[data-testid="category-description"]')).toBeVisible();
    const next2 = page.locator('[data-testid="step2-category"] [data-testid="impact-next-button"]');
    await expect(next2).toBeEnabled();
    await next2.click();

    // Step 3 — change detail textarea (min 10 chars validation gate).
    await expect(page.locator('[data-testid="step3-detail"]')).toBeVisible({ timeout: 5_000 });
    const detailTextarea = page.locator('[data-testid="impact-detail-textarea"]');
    await detailTextarea.fill(
      'Firmware v4.2 update modifies the arrhythmia detection algorithm thresholds significantly.',
    );
    const next3 = page.locator('[data-testid="step3-detail"] [data-testid="impact-next-button"]');
    await expect(next3).toBeEnabled();
    await next3.click();

    // Step 4 — markets selection (checkboxes).
    await expect(page.locator('[data-testid="step4-markets"]')).toBeVisible({ timeout: 5_000 });
    await page.locator('[data-testid="market-us"]').check();
    await page.locator('[data-testid="market-eu"]').check();
    await page.locator('[data-testid="market-kr"]').check();

    // Submit the wizard.
    const submitButton = page.locator('[data-testid="impact-submit-button"]');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Result — signal-light renders with the mocked signal value.
    const signalLight = page.locator('[data-testid="signal-light"]');
    await expect(signalLight).toBeVisible({ timeout: 15_000 });
    await expect(signalLight).toHaveClass(/signal-yellow/);

    // Result — matrix-table renders the deterministic market rows.
    const matrixTable = page.locator('[data-testid="matrix-table"]');
    await expect(matrixTable).toBeVisible();
    await expect(matrixTable.locator('tbody tr')).toHaveCount(3);
    await expect(matrixTable).toContainText('FDA 510(k)');

    // Result — llm-classification renders with category + confidence.
    const llmClassification = page.locator('[data-testid="llm-classification"]');
    await expect(llmClassification).toBeVisible();
    await expect(llmClassification).toContainText('92%');
    // High confidence (>= 0.8) -> no low-confidence badge.
    await expect(llmClassification).not.toContainText(/low confidence/i);

    // Result — similar-cases renders 3 cited cases (citation markers present).
    const similarCases = page.locator('[data-testid="similar-cases"]');
    await expect(similarCases).toBeVisible();
    await expect(similarCases.locator('.cite')).toHaveCount(3);
    await expect(similarCases).toContainText('CardioMonitor X1');

    // High-confidence -> no ticket CTA (TicketCTA renders null when no ticketId).
    await expect(page.locator('[data-testid="ticket-cta"]')).not.toBeVisible();
  });

  test('low-confidence result auto-creates an RA Inbox ticket (Layer 3)', async ({ page }) => {
    // Mock a low-confidence response (confidence < 0.8) that triggers ticket
    // creation (recommendation = low-confidence-manual-review).
    await page.route('**/api/impact-check**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(LOW_CONFIDENCE_RESPONSE),
      });
    });

    // Drive the wizard through all 4 steps quickly.
    await expect(page.locator('[data-testid="step1-product"]')).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-testid="impact-product-input"]').fill('PROD-sterile-pack-v2');
    await page.locator('[data-testid="step1-product"] [data-testid="impact-next-button"]').click();

    await expect(page.locator('[data-testid="step2-category"]')).toBeVisible({ timeout: 5_000 });
    await page.locator('[data-testid="category-sterile"]').check();
    await page.locator('[data-testid="step2-category"] [data-testid="impact-next-button"]').click();

    await expect(page.locator('[data-testid="step3-detail"]')).toBeVisible({ timeout: 5_000 });
    await page
      .locator('[data-testid="impact-detail-textarea"]')
      .fill(
        'Changing sterilization method from EO to gamma irradiation requires biocompatibility revalidation.',
      );
    await page.locator('[data-testid="step3-detail"] [data-testid="impact-next-button"]').click();

    await expect(page.locator('[data-testid="step4-markets"]')).toBeVisible({ timeout: 5_000 });
    await page.locator('[data-testid="market-us"]').check();
    await page.locator('[data-testid="impact-submit-button"]').click();

    // Result — red signal (high-risk change).
    const signalLight = page.locator('[data-testid="signal-light"]');
    await expect(signalLight).toBeVisible({ timeout: 15_000 });
    await expect(signalLight).toHaveClass(/signal-red/);

    // Low-confidence badge is shown (< 80% threshold).
    const llmClassification = page.locator('[data-testid="llm-classification"]');
    await expect(llmClassification).toBeVisible();
    await expect(llmClassification).toContainText('62%');

    // TicketCTA renders because a ticket was auto-created (Layer 3).
    const ticketCta = page.locator('[data-testid="ticket-cta"]');
    await expect(ticketCta).toBeVisible({ timeout: 5_000 });
    await expect(ticketCta).toContainText('TICKET-impact-0042');
    // The CTA links to the RA Inbox ticket.
    const ticketLink = ticketCta.locator('a');
    await expect(ticketLink).toHaveAttribute('href', '/inbox/TICKET-impact-0042');
  });

  test('step navigation: back button returns to previous step without data loss', async ({
    page,
  }) => {
    await page.route('**/api/impact-check**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(HIGH_CONFIDENCE_RESPONSE),
      });
    });

    // Step 1 -> fill product -> next.
    await expect(page.locator('[data-testid="step1-product"]')).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-testid="impact-product-input"]').fill('PROD-navtest-001');
    await page.locator('[data-testid="step1-product"] [data-testid="impact-next-button"]').click();

    // Step 2 -> back to step 1.
    await expect(page.locator('[data-testid="step2-category"]')).toBeVisible({ timeout: 5_000 });
    await page.locator('[data-testid="impact-back-button"]').click();
    await expect(page.locator('[data-testid="step1-product"]')).toBeVisible();

    // Step 1 input is preserved (no data loss on back navigation).
    await expect(page.locator('[data-testid="impact-product-input"]')).toHaveValue(
      'PROD-navtest-001',
    );
  });

  test('validation gate: step 3 next button disabled until minimum 10 characters', async ({
    page,
  }) => {
    // Step 1 -> step 2 -> step 3.
    await expect(page.locator('[data-testid="step1-product"]')).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-testid="impact-product-input"]').fill('PROD-valid-001');
    await page.locator('[data-testid="step1-product"] [data-testid="impact-next-button"]').click();
    await expect(page.locator('[data-testid="step2-category"]')).toBeVisible({ timeout: 5_000 });
    await page.locator('[data-testid="category-label"]').check();
    await page.locator('[data-testid="step2-category"] [data-testid="impact-next-button"]').click();

    // Step 3 — next disabled with short detail (< 10 chars).
    await expect(page.locator('[data-testid="step3-detail"]')).toBeVisible({ timeout: 5_000 });
    const detailTextarea = page.locator('[data-testid="impact-detail-textarea"]');
    const next3 = page.locator('[data-testid="step3-detail"] [data-testid="impact-next-button"]');

    await detailTextarea.fill('short');
    await expect(next3).toBeDisabled();

    // Error message is shown for under-minimum input.
    await expect(page.locator('[data-testid="impact-error-message"]')).toBeVisible();

    // Next enabled once detail meets the 10-char minimum.
    await detailTextarea.fill('Label artwork color change for EU market compliance update.');
    await expect(next3).toBeEnabled();
  });
});
