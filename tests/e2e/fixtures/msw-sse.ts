// @MX:NOTE: [AUTO] MSW SSE mock fixture for Playwright E2E tests
// @MX:SPEC: REQ-LAUNCH-016

import { test as base } from '@playwright/test';
import type { Page } from '@playwright/test';

// Extend the base test with an mswSse fixture.
// In production, this injects a Mock Service Worker (MSW) service worker
// into the page and registers a handler that streams fake SSE tokens
// for POST /api/ra/consult, allowing consultation tests to run without
// a live AI backend.
export const test = base.extend<{ mswSse: null }>({
  mswSse: async ({ page }, use) => {
    // Inject a window marker so tests can detect MSW is active.
    // The real MSW service worker registration would happen here.
    await page.addInitScript(() => {
      (window as Window & { __MSW_READY__?: boolean }).__MSW_READY__ = false;
    });

    // TODO: register MSW service worker and /api/ra/consult SSE handler
    // when MSW browser integration is wired up for E2E tests.

    await use(null);

    // Cleanup: unregister service worker if registered.
  },
});

export type { Page };
export { expect } from '@playwright/test';
