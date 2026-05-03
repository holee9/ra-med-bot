// @MX:NOTE: [AUTO] E2E spec: low-confidence gating → expert review queue → resolve
// @MX:SPEC: REQ-LAUNCH-017

import { expect, test } from '@playwright/test';

const NEEDS_SERVER =
  process.env.CI !== 'true' && !process.env.PLAYWRIGHT_BASE_URL
    ? 'Requires running Next.js server (set PLAYWRIGHT_BASE_URL or run in CI)'
    : undefined;

test.describe('Expert review flow (REQ-LAUNCH-017)', () => {
  test('low-confidence AI response shows expert-review callout', async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

    await page.goto('/chat');

    // Simulate a query that triggers a low-confidence response.
    // In CI this is driven by a seeded mock that forces confidence < 0.5.
    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('__test:low_confidence__');
    await page.keyboard.press('Enter');

    // The expert-review callout component must appear.
    const callout = page.locator('[data-testid="expert-review-callout"]');
    await expect(callout).toBeVisible({ timeout: 15_000 });
    await expect(callout).toContainText(/expert|review/i);
  });

  test('clicking "Send for expert review" enqueues the item', async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

    await page.goto('/chat');

    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('__test:low_confidence__');
    await page.keyboard.press('Enter');

    const callout = page.locator('[data-testid="expert-review-callout"]');
    await expect(callout).toBeVisible({ timeout: 15_000 });

    const sendBtn = callout.locator('button', { hasText: /send.*expert|request.*review/i });
    await sendBtn.click();

    // After submission, a confirmation toast or updated callout status should appear.
    await expect(
      page.locator('[data-testid="expert-review-submitted"], [role="status"]'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('/expert-review queue lists pending items for RA experts', async ({ page }) => {
    test.skip(true, 'Requires authenticated RA expert session');

    await page.goto('/expert-review');
    await expect(page).toHaveURL('/expert-review');

    // The queue should render at least the column headers.
    await expect(page.locator('[data-testid="review-queue-table"]')).toBeVisible();
  });

  test('expert can resolve a queued item', async ({ page }) => {
    test.skip(true, 'Requires authenticated RA expert session with seeded review item');

    await page.goto('/expert-review');

    const firstItem = page.locator('[data-testid="review-card"]').first();
    await expect(firstItem).toBeVisible();

    const resolveBtn = firstItem.locator('button', { hasText: /resolve/i });
    await resolveBtn.click();

    // The item should disappear from the queue or move to "Resolved" state.
    await expect(firstItem).not.toBeVisible({ timeout: 5_000 });
  });
});
