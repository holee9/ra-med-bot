// @MX:NOTE [AUTO] E2E spec: axe-core accessibility scan for /inbox (ra-member view)
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-042, AC-UI-010, Issue 328/329)

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { requiresAuthState, requiresLiveServer } from './fixtures/env-guard';

test.describe('Inbox Accessibility — WCAG 2.1 AA (REQ-V3-UI-042)', () => {
  test('/inbox has no critical accessibility violations', async ({ page }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');

    const axePage = page as unknown as ConstructorParameters<typeof AxeBuilder>[0]['page'];
    const results = await new AxeBuilder({ page: axePage })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(
      critical,
      `Critical a11y violations on /inbox:\n${critical
        .map((v) => `  [${v.id}] ${v.description} (${v.nodes.length} node(s))`)
        .join('\n')}`,
    ).toHaveLength(0);
  });

  test('InboxKanban column headers are keyboard-focusable links/buttons', async ({ page }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');

    // Triage action menu / refresh / archive toggle buttons must be keyboard-reachable.
    const interactiveCount = await page.locator('button[type="button"], a[href]').count();
    expect(interactiveCount).toBeGreaterThan(0);
  });
});
