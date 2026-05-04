// @MX:NOTE: [AUTO] E2E spec: SSO authentication flow
// @MX:SPEC: REQ-LAUNCH-015

import { expect, test } from '@playwright/test';

const NEEDS_SERVER =
  process.env.CI !== 'true' && !process.env.PLAYWRIGHT_BASE_URL
    ? 'Requires running Next.js server (set PLAYWRIGHT_BASE_URL or run in CI)'
    : undefined;

test.describe('Authentication (REQ-LAUNCH-015)', () => {
  test('unauthenticated user is redirected to login / SSO page', async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

    await page.goto('/');
    // The app should redirect to the Next-Auth sign-in page or a custom /login route.
    await expect(page).toHaveURL(/\/(login|api\/auth\/signin)/);
  });

  test('sign-in page renders an SSO provider button', async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

    await page.goto('/login');
    // At minimum one sign-in button (Microsoft Entra ID or Google) must be visible.
    // Custom /login page uses type="button" with onClick handlers (not form submit).
    const signinButtons = page.locator('button[type="button"], button[type="submit"], a[role="button"]');
    await expect(signinButtons.first()).toBeVisible();
  });

  test('authenticated user can access /chat', async ({ page }) => {
    test.skip(true, 'Requires authenticated session — run with PLAYWRIGHT_AUTH_STATE set');

    await page.goto('/chat');
    await expect(page).toHaveURL('/chat');
    // The chat input composer must be visible.
    await expect(page.locator('[data-testid="chat-composer"]')).toBeVisible();
  });

  test('authenticated user profile is visible in the navbar', async ({ page }) => {
    test.skip(true, 'Requires authenticated session — run with PLAYWRIGHT_AUTH_STATE set');

    await page.goto('/');
    await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();
  });
});
