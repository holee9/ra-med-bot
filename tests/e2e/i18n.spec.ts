// @MX:NOTE: [AUTO] E2E spec: Korean / English language toggle
// @MX:SPEC: REQ-LAUNCH-020, SPEC-REGULA-E2EFIX-001 (REQ-E2EFIX-002)

import { expect, test } from '@playwright/test';
import { requiresAuthState, requiresLiveServer } from './fixtures/env-guard';

const STRINGS = {
  en: { chat: 'Chat', projects: 'Projects' },
  ko: { chat: '채팅', projects: '프로젝트' },
};

test.describe('i18n language toggle (REQ-LAUNCH-020)', () => {
  test.describe.configure({ mode: 'serial' });

  test('locale toggle button is visible in settings or navbar', async ({ page }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    await page.goto('/');
    const toggle = page.locator('[data-testid="locale-toggle"]');
    await expect(toggle).toBeVisible();
  });

  test('switching to Korean changes UI labels', async ({ page }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    await page.goto('/');

    const toggle = page.locator('[data-testid="locale-toggle"]');
    await toggle.click();
    await page.locator('[data-testid="locale-option-ko"]').click();

    const navChat = page.locator('[data-testid="nav-chat"]');
    await expect(navChat).toContainText(STRINGS.ko.chat);
  });

  test('switching back to English restores English labels', async ({ page }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    await page.goto('/');

    const toggle = page.locator('[data-testid="locale-toggle"]');
    await toggle.click();
    await page.locator('[data-testid="locale-option-ko"]').click();
    await expect(page.locator('[data-testid="nav-chat"]')).toContainText(STRINGS.ko.chat);

    await toggle.click();
    await page.locator('[data-testid="locale-option-en"]').click();

    const navChat = page.locator('[data-testid="nav-chat"]');
    await expect(navChat).toContainText(STRINGS.en.chat);
  });

  test('selected locale persists across page reload', async ({ page }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    await page.goto('/');

    const toggle = page.locator('[data-testid="locale-toggle"]');
    await toggle.click();
    await page.locator('[data-testid="locale-option-ko"]').click();
    await expect(page.locator('[data-testid="nav-chat"]')).toContainText(STRINGS.ko.chat);

    await page.reload({ waitUntil: 'domcontentloaded' });

    const navChat = page.locator('[data-testid="nav-chat"]');
    await expect(navChat).toContainText(STRINGS.ko.chat);
  });

  test('i18n toggle is keyboard accessible', async ({ page }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    await page.goto('/');

    const toggle = page.locator('[data-testid="locale-toggle"]');
    await toggle.focus();
    await page.keyboard.press('Enter');

    const dropdown = page.locator('[data-testid="locale-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 3_000 });
  });
});
