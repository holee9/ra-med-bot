// @MX:NOTE [AUTO] E2E spec: viewer role redirect from /inbox → /chat (REQ-V3-UI-030)
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-030, Issue 329)
//
// globalSetup serializes a viewer session to .auth-viewer.json (E2E_VIEWER_USER_EMAIL).
// We open /inbox inside a viewer-authenticated context and assert the server-side
// gate (app/(app)/inbox/page.tsx) redirects to /chat. Unit test page.test.tsx
// already covers the redirect branch in isolation; this is the live integration check.

import * as fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { requiresLiveServer } from './fixtures/env-guard';

const viewerAuthPath =
  process.env.PLAYWRIGHT_VIEWER_AUTH_STATE ?? 'tests/e2e/fixtures/.auth-viewer.json';

test.describe('Inbox viewer redirect (REQ-V3-UI-030)', () => {
  test('viewer visiting /inbox is redirected to /chat', async ({ browser }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);

    // Skip cleanly when the viewer fixture has not been generated (e.g. creds unset).
    test.skip(
      !fs.existsSync(viewerAuthPath),
      `${viewerAuthPath} 없음 — globalSetup viewer 로그인(E2E_VIEWER_USER_EMAIL) 확인 필요`,
    );

    const ctx = await browser.newContext({ storageState: viewerAuthPath });
    const page = await ctx.newPage();
    try {
      await page.goto('/inbox');
      // REQ-V3-UI-030: viewer/employee is server-redirected to /chat.
      await expect(page).toHaveURL(/\/chat(?:\b|$)/);
    } finally {
      await ctx.close();
    }
  });
});
