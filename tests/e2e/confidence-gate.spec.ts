// @MX:NOTE: [AUTO] E2E spec: low-confidence gate — AI blocks response and escalates to expert review
// @MX:SPEC: REQ-LAUNCH-017, REQ-QUALITY-E2E-006

import { expect, test } from '@playwright/test';
import { requiresAuthState, requiresLiveServer } from './fixtures/env-guard';

// Tests use '__test:low_confidence__' trigger which forces the RAG pipeline to
// return a response with confidence < 0.5, activating the expert-review gate.

test.describe('Confidence gate (REQ-LAUNCH-017)', () => {
  test.beforeEach(async ({ page }) => {
    const server = requiresLiveServer();
    const auth = requiresAuthState();
    test.skip(server.skip, server.reason);
    test.skip(auth.skip, auth.reason);
    await page.goto('/chat');
  });

  test('low-confidence response shows expert-review callout', async ({ page }) => {
    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('__test:low_confidence__');
    await page.keyboard.press('Enter');

    const callout = page.locator('[data-testid="expert-review-callout"]');
    await expect(callout).toBeVisible({ timeout: 15_000 });
  });

  test('expert-review callout displays confidence score', async ({ page }) => {
    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('__test:low_confidence__');
    await page.keyboard.press('Enter');

    const callout = page.locator('[data-testid="expert-review-callout"]');
    await expect(callout).toBeVisible({ timeout: 15_000 });

    // Confidence score label must be visible (e.g. "신뢰도 45%").
    const score = callout.locator('[data-testid="confidence-score"]');
    await expect(score).toBeVisible();
  });

  test('expert-review callout shows disclaimer text', async ({ page }) => {
    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('__test:low_confidence__');
    await page.keyboard.press('Enter');

    const callout = page.locator('[data-testid="expert-review-callout"]');
    await expect(callout).toBeVisible({ timeout: 15_000 });
    // Callout must mention review or expert keyword for compliance.
    await expect(callout).toContainText(/전문가|expert|review/i);
  });

  test('high-confidence response does NOT show expert-review callout', async ({ page }) => {
    const composer = page.locator('[data-testid="chat-composer"]');
    // Use the normal citation fixture which yields confidence >= 0.8.
    await composer.fill('__test:citation_response__');
    await page.keyboard.press('Enter');

    // Wait for assistant response to appear.
    const assistantMsg = page.locator('[data-testid="chat-message-assistant"]').first();
    await expect(assistantMsg).toBeVisible({ timeout: 20_000 });

    // No callout should be rendered.
    await expect(page.locator('[data-testid="expert-review-callout"]')).not.toBeVisible();
  });
});
