// @MX:NOTE: [AUTO] Saved session fixture for authenticated Playwright tests.
// storageState is now configured at project level in playwright.config.ts.
// This fixture provides a named authenticatedPage alias for clarity in
// auth-specific tests. The window.__E2E_AUTH_LOADED__ marker has been removed
// because project-level storageState handles auth state injection.
// @MX:SPEC: REQ-LAUNCH-015, SPEC-REGULA-E2EFIX-001 (REQ-E2EFIX-006)

import { test as base } from '@playwright/test';
import type { Page } from '@playwright/test';

// Extend the base test with an authenticatedPage fixture.
// storageState is configured at project level (playwright.config.ts use.storageState).
// This fixture provides a named page alias for clarity in auth-specific tests.
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    await use(page);
  },
});

export { expect } from '@playwright/test';
