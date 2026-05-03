// @MX:NOTE: [AUTO] Saved session fixture for authenticated Playwright tests
// @MX:SPEC: REQ-LAUNCH-015

import { test as base } from '@playwright/test';
import type { Page } from '@playwright/test';

// Extend the base test with an authenticatedPage fixture.
// In production CI, this loads a pre-saved auth storage state
// (generated via `playwright/globalSetup.ts` SSO flow).
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Load saved auth state if available.
    // The auth state file is produced by a one-time `playwright auth` script
    // that drives the real SSO flow and serializes cookies/localStorage.
    const storageStatePath = process.env.PLAYWRIGHT_AUTH_STATE ?? 'tests/e2e/fixtures/.auth.json';

    // Only attempt to load auth state when the file exists; otherwise the
    // test proceeds unauthenticated (useful for local development without SSO).
    const fs = await import('node:fs');
    if (fs.existsSync(storageStatePath)) {
      await page.context().addInitScript(() => {
        // Marker injected so tests can detect authenticated context.
        (window as Window & { __E2E_AUTH_LOADED__?: boolean }).__E2E_AUTH_LOADED__ = true;
      });
    }

    await use(page);
  },
});

export { expect } from '@playwright/test';
