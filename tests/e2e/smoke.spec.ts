// @MX:NOTE: [AUTO] E2E smoke spec — basic routing gate, no auth required.
// Verifies the app boots and public routing works correctly without
// authenticated state. Designed to run in offline / MSW mode where no
// real DB or SSO provider is needed.
// @MX:SPEC: SPEC-REGULA-LAUNCH-001 (REQ-LAUNCH-014), REQ-LAUNCH-081

import { expect, test } from '@playwright/test';

// All smoke tests use a fresh unauthenticated context so they never
// depend on storageState set by globalSetup. This makes them runnable
// even when E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD are absent.

test.describe('Smoke — basic routing (no auth required)', () => {
  test('앱이 시작되고 로그인 페이지로 리다이렉트된다', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    try {
      await page.goto('/');
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    } finally {
      await ctx.close();
    }
  });

  test('로그인 페이지가 정상 렌더링된다', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    try {
      await page.goto('/login');
      // At least one sign-in trigger element must be visible.
      await expect(page.getByRole('button', { name: /로그인|Sign in|sign in|Login/i })).toBeVisible(
        { timeout: 10_000 },
      );
    } finally {
      await ctx.close();
    }
  });

  test('대시보드 라우트가 인증 없이 접근 시 리다이렉트된다', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    try {
      await page.goto('/chat');
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    } finally {
      await ctx.close();
    }
  });

  test('/login 페이지는 인증 없이 직접 접근 가능하다', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    try {
      const response = await page.goto('/login');
      // The login page must return HTTP 200, not a redirect loop.
      expect(response?.status()).toBe(200);
      // URL should remain on /login (no redirect away from login for unauthed users).
      await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
    } finally {
      await ctx.close();
    }
  });
});
