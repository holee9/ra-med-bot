// @MX:NOTE: [AUTO] E2E spec: SSO authentication flow
// @MX:SPEC: REQ-LAUNCH-015, SPEC-REGULA-E2EFIX-001 (REQ-E2EFIX-002)

import { expect, test } from '@playwright/test';
import { requiresAuthState, requiresLiveServer } from './fixtures/env-guard';

test.describe('Authentication (REQ-LAUNCH-015)', () => {
  test('unauthenticated user is redirected to login / SSO page', async ({ page }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);

    await page.goto('/');
    // The app should redirect to the Next-Auth sign-in page or a custom /login route.
    await expect(page).toHaveURL(/\/(login|api\/auth\/signin)/);
  });

  test('sign-in page renders an SSO provider button', async ({ page }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);

    await page.goto('/login');
    // At minimum one sign-in button (Microsoft Entra ID or Google) must be visible.
    // Custom /login page uses type="button" with onClick handlers (not form submit).
    const signinButtons = page.locator(
      'button[type="button"], button[type="submit"], a[role="button"]',
    );
    await expect(signinButtons.first()).toBeVisible();
  });

  test('authenticated user can access /chat', async ({ page }) => {
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    await page.goto('/chat');
    await expect(page).toHaveURL('/chat');
    // The chat input composer must be visible.
    await expect(page.locator('[data-testid="chat-composer"]')).toBeVisible();
  });

  test('authenticated user profile is visible in the navbar', async ({ page }) => {
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    await page.goto('/');
    await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();
  });
});
