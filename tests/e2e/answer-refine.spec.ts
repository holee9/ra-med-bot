// @MX:NOTE: [AUTO] E2E spec: inline answer refinement with tone presets
// @MX:SPEC: SPEC-REGULA-ANSWER-REFINE-001 (REQ-ANSWER-REFINE-001..002)

import { expect, test } from '@playwright/test';
import { requiresAuthState, requiresLiveServer } from './fixtures/env-guard';

test.describe('Answer Refine (SPEC-REGULA-ANSWER-REFINE-001)', () => {
  test.beforeEach(async ({ page }) => {
    const server = requiresLiveServer();
    const auth = requiresAuthState();
    test.skip(server.skip, server.reason);
    test.skip(auth.skip, auth.reason);

    await page.goto('/chat');
    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('__test:citation_response__');
    await page.keyboard.press('Enter');

    // Wait for the answer prose to appear.
    await expect(page.locator('[data-testid="answer-prose"]')).toBeVisible({ timeout: 20_000 });
  });

  test('refine button is visible in the answer block (REQ-ANSWER-REFINE-001)', async ({ page }) => {
    const refineBtn = page.locator('[data-testid="refine-btn"]');
    await expect(refineBtn).toBeVisible();
  });

  test('clicking refine button opens tone selector popover (REQ-ANSWER-REFINE-001)', async ({
    page,
  }) => {
    await page.locator('[data-testid="refine-btn"]').click();

    const popover = page.locator('[data-testid="refine-popover"]');
    await expect(popover).toBeVisible();

    // All 4 tone options must be present.
    await expect(popover.locator('[data-testid="tone-option-conservative"]')).toBeVisible();
    await expect(popover.locator('[data-testid="tone-option-regulatory-strict"]')).toBeVisible();
    await expect(popover.locator('[data-testid="tone-option-executive-summary"]')).toBeVisible();
    await expect(popover.locator('[data-testid="tone-option-technical-detail"]')).toBeVisible();
  });

  test('selecting a tone refines and replaces the prose (REQ-ANSWER-REFINE-002)', async ({
    page,
  }) => {
    const prose = page.locator('[data-testid="answer-prose"]');
    const originalText = await prose.innerText();

    // Open popover and select "executive-summary".
    await page.locator('[data-testid="refine-btn"]').click();
    await page.locator('[data-testid="tone-option-executive-summary"]').click();

    // Wait for refined label to appear.
    await expect(page.locator('[data-testid="refined-label"]')).toBeVisible({ timeout: 10_000 });

    // Prose must be updated (E2E mock prepends "[경영 요약 톤으로 정제됨]").
    const refinedText = await prose.innerText();
    expect(refinedText).not.toBe(originalText);
    expect(refinedText).toContain('정제됨');
  });
});
