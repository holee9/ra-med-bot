// @MX:NOTE: [AUTO] E2E spec: low-confidence gating → expert review queue → resolve
// @MX:SPEC: REQ-LAUNCH-017, SPEC-REGULA-E2EFIX-001 (REQ-E2EFIX-002)

import { expect, test } from '@playwright/test';
import { requiresAuthState, requiresLiveServer } from './fixtures/env-guard';

test.describe('Expert review flow (REQ-LAUNCH-017)', () => {
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
    await expect(callout).toContainText(/expert|review/i);
  });

  test('clicking "Send for expert review" enqueues the item', async ({ page }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);
    // TODO: SPEC-REGULA-RELEASE-HARDENING-001 REQ-QUALITY-E2E — callout submit button not yet implemented
    test.skip(true, 'Blocked: ExpertReviewCallout missing "Send for expert review" button');
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
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);
    // TODO: SPEC-REGULA-RELEASE-HARDENING-001 REQ-QUALITY-E2E — needs seeded DB data + "Resolve" button
    test.skip(true, 'Blocked: requires seeded review item and Resolve button implementation');
  });
});
