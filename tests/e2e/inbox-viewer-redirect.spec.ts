// @MX:NOTE [AUTO] E2E spec: viewer role redirect from /inbox → /chat (REQ-V3-UI-030)
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-030, Issue 329)
//
// 현재 globalSetup이 ra-member 세션만 직렬화하므로, viewer 세션 E2E는
// viewer 전용 storageState fixture가 선행되어야 활성화.
// REQ-V3-UI-030 redirect 자체는 단위 테스트(app/(app)/inbox/page.test.tsx)에서
// 이미 검증됨 — 본 E2E는 viewer 실세션 통합 검증용.

import { expect, test } from '@playwright/test';
import { requiresLiveServer } from './fixtures/env-guard';

test.describe('Inbox viewer redirect (REQ-V3-UI-030)', () => {
  test.skip(true, 'viewer storageState fixture 선행 필요 — globalSetup이 ra-member 전용');

  test('viewer visiting /inbox is redirected to /chat', async ({ browser }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);

    // TODO: viewer storageState fixture(.auth-viewer.json) 적용 후 활성화.
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto('/inbox');
    await expect(page).toHaveURL('/chat');
    await ctx.close();
  });
});
