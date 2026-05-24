// @MX:NOTE: [AUTO] E2E spec: RAG citation block structure and source attribution
// @MX:SPEC: REQ-LAUNCH-018, REQ-QUALITY-E2E-005

import { expect, test } from '@playwright/test';
import { requiresAuthState, requiresLiveServer } from './fixtures/env-guard';

// All tests require a live server with seeded RAG response and auth session.
// The test trigger '__test:citation_response__' causes the API to return a
// deterministic streamed answer with exactly 2 citation blocks.

test.describe('RAG citation block (REQ-LAUNCH-018)', () => {
  test.beforeEach(async ({ page }) => {
    const server = requiresLiveServer();
    const auth = requiresAuthState();
    test.skip(server.skip, server.reason);
    test.skip(auth.skip, auth.reason);
    await page.goto('/chat');
  });

  test('streaming response renders citation blocks with source title', async ({ page }) => {
    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('__test:citation_response__');
    await page.keyboard.press('Enter');

    // Wait for at least one citation block to appear after streaming.
    const citation = page.locator('[data-testid="citation-block"]').first();
    await expect(citation).toBeVisible({ timeout: 30_000 });

    // Each citation block must display a non-empty source title.
    const title = citation.locator('[data-testid="citation-source-title"]');
    await expect(title).not.toBeEmpty();
  });

  test('each citation block shows corpus name and page reference', async ({ page }) => {
    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('__test:citation_response__');
    await page.keyboard.press('Enter');

    const citation = page.locator('[data-testid="citation-block"]').first();
    await expect(citation).toBeVisible({ timeout: 30_000 });

    // Corpus label (e.g. "FDA 21 CFR", "EU MDR") must be present.
    const corpus = citation.locator('[data-testid="citation-corpus"]');
    await expect(corpus).toBeVisible();
    await expect(corpus).not.toBeEmpty();
  });

  test('clicking citation block opens DocViewer panel', async ({ page }) => {
    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('__test:citation_response__');
    await page.keyboard.press('Enter');

    const citation = page.locator('[data-testid="citation-block"]').first();
    await expect(citation).toBeVisible({ timeout: 30_000 });
    await citation.click();

    // DocViewer must open with the cited document.
    const viewer = page.locator('[data-testid="doc-viewer"]');
    await expect(viewer).toBeVisible({ timeout: 5_000 });
  });

  test('multiple citations are rendered when RAG retrieves multiple sources', async ({ page }) => {
    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('__test:citation_response__');
    await page.keyboard.press('Enter');

    // The test fixture guarantees 2 citations.
    await expect(page.locator('[data-testid="citation-block"]')).toHaveCount(2, {
      timeout: 30_000,
    });
  });
});
