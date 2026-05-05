// @MX:NOTE: [AUTO] Saved session fixture for authenticated Playwright tests
// @MX:SPEC: REQ-LAUNCH-015

import { test as base } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';

// Auth.js v5 uses a database session strategy (REQ-FND-052).
// The session cookie name is "authjs.session-token" in production
// and "__Secure-authjs.session-token" behind HTTPS.
// In test environments, the plain name is used.
const SESSION_COOKIE_NAME = 'authjs.session-token';

/**
 * Resolves the base URL for the current test run.
 * Prefers PLAYWRIGHT_BASE_URL env var, falls back to localhost.
 */
function resolveBaseUrl(): string {
  return process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
}

/**
 * Injects a pre-serialized Auth.js storage state into the browser context.
 *
 * The storage state JSON must be produced by a one-time `playwright auth`
 * script that drives the real OAuth flow and serializes the resulting
 * cookies + localStorage via `context.storageState({ path })`.
 *
 * When the file is absent (local dev without SSO), the fixture falls back to
 * an unauthenticated context and sets a window marker so tests can detect it.
 *
 * Prerequisite for full activation (SPEC-REGULA-RELEASE-HARDENING-001):
 *   - Run `pnpm playwright:auth` to generate tests/e2e/fixtures/.auth.json
 *   - Or set PLAYWRIGHT_AUTH_STATE env var to a pre-generated state file path
 *   - Or set PLAYWRIGHT_SESSION_TOKEN env var to inject a raw session token
 *     (useful in CI where a seed script can create a DB session directly)
 */
async function applyAuthState(context: BrowserContext): Promise<boolean> {
  const fs = await import('node:fs');

  // Strategy 1: inject raw session token from env (CI-friendly).
  // CI can create a test user + DB session via a seed script and pass the token.
  const rawToken = process.env.PLAYWRIGHT_SESSION_TOKEN;
  if (rawToken) {
    const baseUrl = new URL(resolveBaseUrl());
    await context.addCookies([
      {
        name: SESSION_COOKIE_NAME,
        value: rawToken,
        domain: baseUrl.hostname,
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    return true;
  }

  // Strategy 2: load full storageState JSON produced by playwright:auth script.
  const storageStatePath = process.env.PLAYWRIGHT_AUTH_STATE ?? 'tests/e2e/fixtures/.auth.json';

  if (fs.existsSync(storageStatePath)) {
    // storageState() on an existing context is not supported directly;
    // we read the file and apply cookies + origins manually.
    const raw = fs.readFileSync(storageStatePath, 'utf-8');
    const state: {
      cookies?: Parameters<BrowserContext['addCookies']>[0];
      origins?: { origin: string; localStorage: { name: string; value: string }[] }[];
    } = JSON.parse(raw);

    if (state.cookies?.length) {
      await context.addCookies(state.cookies);
    }

    if (state.origins?.length) {
      for (const { origin, localStorage } of state.origins) {
        if (localStorage.length) {
          // Navigate to origin to set localStorage (browser security boundary).
          const page = await context.newPage();
          await page.goto(origin, { waitUntil: 'commit' });
          await page.evaluate((entries) => {
            for (const { name, value } of entries) {
              window.localStorage.setItem(name, value);
            }
          }, localStorage);
          await page.close();
        }
      }
    }

    return true;
  }

  return false;
}

// Extend the base test with an authenticatedPage fixture.
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ browser }, use) => {
    // Create a fresh browser context so auth state does not leak between tests.
    const context = await browser.newContext();

    const authenticated = await applyAuthState(context);

    // Inject a window marker so tests can detect the auth state.
    await context.addInitScript((isAuth: boolean) => {
      (window as Window & { __E2E_AUTH_LOADED__?: boolean }).__E2E_AUTH_LOADED__ = isAuth;
    }, authenticated);

    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
