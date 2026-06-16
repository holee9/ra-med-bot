// @MX:NOTE: [AUTO] E2E spec: low-confidence gating → expert review queue → resolve
// @MX:SPEC: REQ-LAUNCH-017, SPEC-REGULA-E2EFIX-001 (REQ-E2EFIX-002)

import { expect, test } from '@playwright/test';
import { requiresAuthState, requiresLiveServer } from './fixtures/env-guard';

test.describe('Expert review flow (REQ-LAUNCH-017)', () => {
  test.describe.configure({ mode: 'serial' });

  test('low-confidence AI response shows expert-review callout', async ({ page }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    await page.goto('/chat');

    // Simulate a query that triggers a low-confidence response.
    // In CI this is driven by a seeded mock that forces confidence < 0.5.
    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('__test:low_confidence__');
    await page.keyboard.press('Enter');

    // The expert-review callout component must appear.
    const callout = page.locator('[data-testid="expert-review-callout"]');
    await expect(callout).toBeVisible({ timeout: 15_000 });
    await expect(callout).toContainText(/전문가|expert|review/i);
  });

  test('clicking "Send for expert review" enqueues the item', async ({ page }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    await page.goto('/chat');
    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('__test:low_confidence__');
    await page.keyboard.press('Enter');

    const callout = page.locator('[data-testid="expert-review-callout"]');
    await expect(callout).toBeVisible({ timeout: 15_000 });

    const sendBtn = callout.locator('[data-testid="send-review-btn"]');
    await expect(sendBtn).toBeVisible();
    await sendBtn.click();

    // After clicking, button must be disabled (sent state = idempotent guard).
    await expect(sendBtn).toBeDisabled({ timeout: 5_000 });
  });

  test('/expert-review queue lists pending items for RA experts', async ({ page }) => {
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    await page.goto('/expert-review');
    await expect(page).toHaveURL('/expert-review');

    // The queue should render at least the column headers.
    await expect(page.locator('[data-testid="review-queue-table"]')).toBeVisible();
  });

  test('expert can resolve a queued item', async ({ page }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    await page.route('**/api/ra/expert-review/*', async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    // First: enqueue a review item via the low-confidence flow.
    await page.goto('/chat');
    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('__test:low_confidence__');
    await page.keyboard.press('Enter');

    const callout = page.locator('[data-testid="expert-review-callout"]');
    await expect(callout).toBeVisible({ timeout: 15_000 });

    const sendBtn = callout.locator('[data-testid="send-review-btn"]');
    await expect(sendBtn).toBeVisible();
    await sendBtn.click();
    await expect(sendBtn).toBeDisabled({ timeout: 5_000 });

    // Navigate to the review queue — item should now be present.
    await page.goto('/expert-review');
    await expect(page.locator('[data-testid="review-queue-table"]')).toBeVisible();

    const cards = page.locator('[data-testid="review-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 5_000 });

    // Advance first pending card to in_progress to expose resolve button.
    const firstCard = cards.first();
    const startBtn = firstCard.locator('[data-testid="start-review-btn"]');
    if (await startBtn.isVisible()) {
      await startBtn.dispatchEvent('click');
      await expect(firstCard.locator('[data-status="in_progress"]')).toBeVisible({
        timeout: 10_000,
      });
    }

    // resolve-btn must appear after in_progress transition.
    const resolveBtn = firstCard.locator('[data-testid="resolve-btn"]');
    await expect(resolveBtn).toBeVisible({ timeout: 10_000 });
    await resolveBtn.dispatchEvent('click');
    // After resolve, button should disappear (status becomes resolved).
    await expect(resolveBtn).not.toBeVisible({ timeout: 5_000 });
  });
});
