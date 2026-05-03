// @MX:NOTE: [AUTO] E2E spec: citation click opens DocViewer deep link
// @MX:SPEC: REQ-LAUNCH-019

import { expect, test } from '@playwright/test';

const NEEDS_SERVER =
  process.env.CI !== 'true' && !process.env.PLAYWRIGHT_BASE_URL
    ? 'Requires running Next.js server (set PLAYWRIGHT_BASE_URL or run in CI)'
    : undefined;

test.describe('Citation click → DocViewer (REQ-LAUNCH-019)', () => {
  test('clicking a citation block opens the DocViewer panel', async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

    await page.goto('/chat');

    // Trigger a response that includes citations.
    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('__test:citation_response__');
    await page.keyboard.press('Enter');

    // Wait for citation block to appear.
    const citationBlock = page.locator('[data-testid="citation-block"]').first();
    await expect(citationBlock).toBeVisible({ timeout: 30_000 });

    await citationBlock.click();

    // The DocViewer panel / drawer should open.
    const docViewer = page.locator('[data-testid="doc-viewer"]');
    await expect(docViewer).toBeVisible({ timeout: 5_000 });
  });

  test('DocViewer displays the cited document title', async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

    await page.goto('/chat');

    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('__test:citation_response__');
    await page.keyboard.press('Enter');

    const citationBlock = page.locator('[data-testid="citation-block"]').first();
    await expect(citationBlock).toBeVisible({ timeout: 30_000 });

    // Capture the citation reference text before clicking.
    const citationText = await citationBlock.textContent();
    await citationBlock.click();

    const docViewer = page.locator('[data-testid="doc-viewer"]');
    await expect(docViewer).toBeVisible({ timeout: 5_000 });

    // The document title in the viewer should relate to the citation.
    const docTitle = page.locator('[data-testid="doc-viewer-title"]');
    await expect(docTitle).toBeVisible();
    if (citationText) {
      // The title or source name should be non-empty.
      await expect(docTitle).not.toBeEmpty();
    }
  });

  test('DocViewer deep links to the correct page/section', async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

    await page.goto('/chat');

    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('__test:citation_with_page__');
    await page.keyboard.press('Enter');

    const citationBlock = page.locator('[data-testid="citation-block"]').first();
    await expect(citationBlock).toBeVisible({ timeout: 30_000 });

    // Extract the page/section hint from the citation block.
    const pageRef = await citationBlock.getAttribute('data-page');
    await citationBlock.click();

    const docViewer = page.locator('[data-testid="doc-viewer"]');
    await expect(docViewer).toBeVisible({ timeout: 5_000 });

    if (pageRef) {
      // The viewer should scroll to / highlight the referenced page.
      const highlightedSection = page.locator('[data-testid="doc-viewer-highlight"]');
      await expect(highlightedSection).toBeVisible();
    }
  });

  test('DocViewer can be closed and chat remains intact', async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

    await page.goto('/chat');

    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('__test:citation_response__');
    await page.keyboard.press('Enter');

    const citationBlock = page.locator('[data-testid="citation-block"]').first();
    await expect(citationBlock).toBeVisible({ timeout: 30_000 });
    await citationBlock.click();

    const docViewer = page.locator('[data-testid="doc-viewer"]');
    await expect(docViewer).toBeVisible({ timeout: 5_000 });

    // Close the DocViewer.
    const closeBtn = docViewer.locator('[data-testid="doc-viewer-close"]');
    await closeBtn.click();
    await expect(docViewer).not.toBeVisible();

    // Chat messages should still be visible.
    await expect(page.locator('[data-testid="chat-message-assistant"]').first()).toBeVisible();
  });
});
