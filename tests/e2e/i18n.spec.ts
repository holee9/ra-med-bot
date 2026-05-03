// @MX:NOTE: [AUTO] E2E spec: Korean ↔ English language toggle
// @MX:SPEC: REQ-LAUNCH-020

import { expect, test } from '@playwright/test';

const NEEDS_SERVER =
  process.env.CI !== 'true' && !process.env.PLAYWRIGHT_BASE_URL
    ? 'Requires running Next.js server (set PLAYWRIGHT_BASE_URL or run in CI)'
    : undefined;

// Known UI strings that change between locales.
const STRINGS = {
  en: { chat: 'Chat', projects: 'Projects' },
  ko: { chat: '채팅', projects: '프로젝트' },
};

test.describe('i18n language toggle (REQ-LAUNCH-020)', () => {
  test('locale toggle button is visible in settings or navbar', async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

    await page.goto('/');
    const toggle = page.locator('[data-testid="locale-toggle"]');
    await expect(toggle).toBeVisible();
  });

  test('switching to Korean changes UI labels to 한국어', async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

    await page.goto('/');

    // Switch to Korean locale.
    const toggle = page.locator('[data-testid="locale-toggle"]');
    await toggle.click();
    const koOption = page.locator('[data-testid="locale-option-ko"]');
    await koOption.click();

    // Wait for the page to reflect the new locale.
    await page.waitForLoadState('networkidle');

    // A known translated string should now appear in Korean.
    const navChat = page.locator('[data-testid="nav-chat"]');
    await expect(navChat).toContainText(STRINGS.ko.chat);
  });

  test('switching back to English restores English labels', async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

    await page.goto('/');

    // Switch to Korean first.
    const toggle = page.locator('[data-testid="locale-toggle"]');
    await toggle.click();
    await page.locator('[data-testid="locale-option-ko"]').click();
    await page.waitForLoadState('networkidle');

    // Switch back to English.
    await toggle.click();
    await page.locator('[data-testid="locale-option-en"]').click();
    await page.waitForLoadState('networkidle');

    const navChat = page.locator('[data-testid="nav-chat"]');
    await expect(navChat).toContainText(STRINGS.en.chat);
  });

  test('selected locale persists across page reload', async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

    await page.goto('/');

    const toggle = page.locator('[data-testid="locale-toggle"]');
    await toggle.click();
    await page.locator('[data-testid="locale-option-ko"]').click();
    await page.waitForLoadState('networkidle');

    // Reload the page.
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Korean locale should still be active.
    const navChat = page.locator('[data-testid="nav-chat"]');
    await expect(navChat).toContainText(STRINGS.ko.chat);
  });

  test('i18n toggle is keyboard accessible', async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

    await page.goto('/');

    const toggle = page.locator('[data-testid="locale-toggle"]');
    await toggle.focus();
    await page.keyboard.press('Enter');

    // The locale options dropdown should appear.
    const dropdown = page.locator('[data-testid="locale-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 3_000 });
  });
});
