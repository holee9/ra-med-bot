// @MX:NOTE: [AUTO] E2E spec: full Q&A -> citation -> export journey in one flow
// @MX:SPEC: SPEC-REGULA-EXPORT-HUB-001 (REQ-EXP-001, REQ-EXP-002), REQ-LAUNCH-018, #202 BLOCK-5

import { expect, test } from '@playwright/test';
import type { Download, Page } from '@playwright/test';
import { requiresAuthState, requiresLiveServer } from './fixtures/env-guard';

// This spec exercises the production "Q&A -> citation -> export" journey in a
// single user flow: ask a RAG question, receive a streamed answer with
// citation blocks, then export that cited answer. It fills the BLOCK-5 gap
// where rag-citation.spec.ts and export-hub.spec.ts each cover one piece but
// no single test asserts the end-to-end journey holds together.
//
// The citation trigger produces both a streamed answer and exactly 2 citation
// blocks (per rag-citation.spec.ts), so the export step acts on a real cited
// answer rather than the standalone export fixture trigger.

const CITATION_TEST_TRIGGER = '__test:citation_response__';

test.describe('Q&A -> Citation -> Export journey (#202 BLOCK-5)', () => {
  test.beforeEach(async ({ page }) => {
    const server = requiresLiveServer();
    const auth = requiresAuthState();
    test.skip(server.skip, server.reason);
    test.skip(auth.skip, auth.reason);
    await page.goto('/chat');
  });

  test('full journey: cited answer can be exported as Markdown', async ({ page }) => {
    // Step 1 — ask a RAG question that yields a cited answer.
    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill(CITATION_TEST_TRIGGER);
    await page.keyboard.press('Enter');

    // Step 2 — confirm the streamed answer renders citation blocks.
    const citation = page.locator('[data-testid="citation-block"]').first();
    await expect(citation).toBeVisible({ timeout: 30_000 });
    const sourceTitle = citation.locator('[data-testid="citation-source-title"]');
    await expect(sourceTitle).not.toBeEmpty();

    // Step 3 — export the cited answer as Markdown.
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });

    const exportButton = page.locator('button[aria-label="내보내기"]').first();
    await exportButton.click();

    const formatMenu = page.locator('[role="menu"][aria-label="내보내기 형식 선택"]');
    await expect(formatMenu).toBeVisible();

    const markdownItem = page.locator('[role="menuitem"]').filter({ hasText: 'Markdown' });
    await markdownItem.click();

    // Step 4 — assert the export artifact is produced.
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.md$/);
  });

  test('full journey: cited answer can be exported as DOCX', async ({ page }) => {
    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill(CITATION_TEST_TRIGGER);
    await page.keyboard.press('Enter');

    const citation = page.locator('[data-testid="citation-block"]').first();
    await expect(citation).toBeVisible({ timeout: 30_000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });

    const exportButton = page.locator('button[aria-label="내보내기"]').first();
    await exportButton.click();

    const docxItem = page.locator('[role="menuitem"]').filter({ hasText: 'DOCX' });
    await docxItem.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.docx$/);
  });

  test('negative: export button is disabled before any answer exists', async ({ page }) => {
    // Navigate to chat but do not send a message. The export button should be
    // disabled because there is no answer to export. This guards the journey
    // entry point: export cannot begin without a produced answer.
    await page.goto('/chat');

    const exportButton = page.locator('button[aria-label="내보내기"]').first();
    await expect(exportButton).toBeDisabled();
  });

  test('citation -> doc-viewer -> export: open cited source then export the answer', async ({
    page,
  }) => {
    // Ask a cited question.
    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill(CITATION_TEST_TRIGGER);
    await page.keyboard.press('Enter');

    const citation = page.locator('[data-testid="citation-block"]').first();
    await expect(citation).toBeVisible({ timeout: 30_000 });

    // Open the doc viewer for the cited source (rag-citation pattern).
    await citation.click();
    const viewer = page.locator('[data-testid="doc-viewer"]');
    await expect(viewer).toBeVisible({ timeout: 5_000 });

    // Close the viewer (Escape) so it does not obscure the export button.
    await page.keyboard.press('Escape');
    await expect(viewer).not.toBeVisible({ timeout: 3_000 });

    // Export the cited answer as Markdown.
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });

    const exportButton = page.locator('button[aria-label="내보내기"]').first();
    await exportButton.click();

    const markdownItem = page.locator('[role="menuitem"]').filter({ hasText: 'Markdown' });
    await markdownItem.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.md$/);
  });
});

// Helper retained for parity with export-hub.spec.ts content-assertion pattern.
// Not used in the journey tests above (which assert the download filename,
// sufficient for the journey contract), but available if a later iteration
// wants to assert exported content includes citation references.
async function _getDownloadContent(_page: Page, download: Download): Promise<string> {
  const path = await download.path();
  const fs = await import('node:fs');
  return fs.readFileSync(path, 'utf-8');
}
