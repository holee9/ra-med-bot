// @MX:NOTE: [AUTO] E2E spec: chat consultation — query → stream → citation
// @MX:SPEC: REQ-LAUNCH-016

import { expect, test } from '@playwright/test';

const NEEDS_SERVER =
  process.env.CI !== 'true' && !process.env.PLAYWRIGHT_BASE_URL
    ? 'Requires running Next.js server (set PLAYWRIGHT_BASE_URL or run in CI)'
    : undefined;

test.describe('Consultation flow (REQ-LAUNCH-016)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');
    // Navigate to chat — assumes auth fixture or bypassed auth in CI
    await page.goto('/chat');
  });

  test('user can submit a regulatory query', async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

    const composer = page.locator('[data-testid="chat-composer"]');
    await expect(composer).toBeVisible();
    await composer.fill('What are the MDR Article 10 requirements for Class IIa devices?');
    await page.keyboard.press('Enter');

    // The AI response should begin streaming — look for the typing indicator or first token.
    await expect(
      page.locator('[data-testid="chat-message-assistant"], [data-testid="streaming-indicator"]'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('streaming response renders incremental tokens', async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('List the key requirements for CE marking under EU MDR.');
    await page.keyboard.press('Enter');

    // Wait for the first assistant message to appear.
    const assistantMsg = page.locator('[data-testid="chat-message-assistant"]').first();
    await expect(assistantMsg).toBeVisible({ timeout: 15_000 });

    // The streamed text should be non-empty.
    await expect(assistantMsg).not.toBeEmpty();
  });

  test('response includes citation blocks after streaming completes', async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('Summarise Annex XIV of EU MDR.');
    await page.keyboard.press('Enter');

    // Wait for streaming to finish — the citation block appears after the last token.
    const citationBlock = page.locator('[data-testid="citation-block"]').first();
    await expect(citationBlock).toBeVisible({ timeout: 30_000 });
  });

  test('submit button is disabled while response is streaming', async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

    const composer = page.locator('[data-testid="chat-composer"]');
    const submitBtn = page.locator('[data-testid="chat-submit"]');

    await composer.fill('Quick question about IVDR scope.');
    await submitBtn.click();

    // During streaming the submit button (or composer) should be disabled.
    await expect(submitBtn).toBeDisabled({ timeout: 5_000 });
  });
});
