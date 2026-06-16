// @MX:NOTE: [AUTO] E2E spec: citation click opens DocViewer deep link
// @MX:SPEC: REQ-LAUNCH-019

import { expect, test } from '@playwright/test';
import { requiresAuthState } from './fixtures/env-guard';

const NEEDS_SERVER =
  process.env.CI !== 'true' && !process.env.PLAYWRIGHT_BASE_URL
    ? 'Requires running Next.js server (set PLAYWRIGHT_BASE_URL or run in CI)'
    : undefined;

test.describe('Citation click → DocViewer (REQ-LAUNCH-019)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');
    const auth = requiresAuthState();
    test.skip(auth.skip, auth.reason);

    // Submit citation_response trigger and wait for streaming to finish.
    await page.goto('/chat');
    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('__test:citation_response__');
    await page.keyboard.press('Enter');

    // Wait for at least one citation block to appear.
    await expect(page.locator('[data-testid="citation-block"]').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('clicking a citation block opens the DocViewer panel', async ({ page }) => {
    await page.locator('[data-testid="citation-block"]').first().click();

    const docViewer = page.locator('[data-testid="doc-viewer"]');
    await expect(docViewer).toBeVisible({ timeout: 5_000 });
  });

  test('DocViewer displays the cited document title', async ({ page }) => {
    await page.locator('[data-testid="citation-block"]').first().click();

    const docViewer = page.locator('[data-testid="doc-viewer"]');
    await expect(docViewer).toBeVisible({ timeout: 5_000 });

    // Title must be visible with actual document content (not loading placeholder).
    const title = docViewer.locator('[data-testid="doc-viewer-title"]');
    await expect(title).toBeVisible();
    // Wait up to 10s for the source fetch to resolve (mock API in E2E mode).
    await expect(title).not.toHaveText('불러오는 중...', { timeout: 10_000 });
    await expect(title).not.toBeEmpty();
  });

  test('DocViewer deep links to the correct page/section', async ({ page }) => {
    await page.locator('[data-testid="citation-block"]').first().click();

    const docViewer = page.locator('[data-testid="doc-viewer"]');
    await expect(docViewer).toBeVisible({ timeout: 5_000 });

    // URL hash must encode the source index.
    await expect(page).toHaveURL(/#source=/, { timeout: 5_000 });
  });

  test('DocViewer can be closed and chat remains intact', async ({ page }) => {
    await page.locator('[data-testid="citation-block"]').first().click();

    const docViewer = page.locator('[data-testid="doc-viewer"]');
    await expect(docViewer).toBeVisible({ timeout: 5_000 });

    // Close via the close button.
    await docViewer.locator('[data-testid="doc-viewer-close"]').click();
    await expect(docViewer).not.toBeVisible({ timeout: 3_000 });

    // Chat content must still be intact.
    await expect(page.locator('[data-testid="citation-block"]').first()).toBeVisible();
  });
});
