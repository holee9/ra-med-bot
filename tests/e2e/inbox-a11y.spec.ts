// @MX:NOTE [AUTO] E2E spec: axe-core accessibility scan for /inbox + /inbox/[id] (ra-member view)
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-042, AC-UI-010, Issue 329)

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { requiresAuthState, requiresLiveServer } from './fixtures/env-guard';

// @MX:NOTE [AUTO] AxeBuilder v4 expects a Playwright Page typed against its own forked types;
// the runtime object is the standard Playwright Page. This cast bridges the version skew.
function axePage(page: import('@playwright/test').Page) {
  return page as unknown as ConstructorParameters<typeof AxeBuilder>[0]['page'];
}

async function runAxe(page: import('@playwright/test').Page) {
  return new AxeBuilder({ page: axePage(page) })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
}

function expectNoCritical(results: Awaited<ReturnType<typeof runAxe>>, where: string) {
  const critical = results.violations.filter((v) => v.impact === 'critical');
  expect(
    critical,
    `Critical a11y violations on ${where}:\n${critical
      .map((v) => `  [${v.id}] ${v.description} (${v.nodes.length} node(s))`)
      .join('\n')}`,
  ).toHaveLength(0);
}

test.describe('Inbox Accessibility — WCAG 2.1 AA (REQ-V3-UI-042)', () => {
  test('/inbox has no critical accessibility violations', async ({ page }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');

    expectNoCritical(await runAxe(page), '/inbox');
  });

  test('/inbox interactive elements are reachable via keyboard (Tab)', async ({ page }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');

    // REQ-V3-UI-042: all action buttons keyboard-reachable. Tab must land focus on a
    // genuinely interactive element (not a stale <body>). axe's tabindex rule is the
    // authoritative check; this is the explicit behavioral assertion.
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName ?? '');
    expect(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(focused);
  });

  test('/inbox icon-only buttons expose an accessible name (aria-label)', async ({ page }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');

    // REQ-V3-UI-042: icon-only buttons must carry an accessible name. axe's button-name
    // rule already enforces this in the critical scan above; we assert it explicitly so
    // a future regression surfaces with the offending element rather than a generic axe dump.
    const buttons = page.locator('button');
    const total = await buttons.count();
    expect(total).toBeGreaterThan(0);

    for (let i = 0; i < total; i++) {
      const btn = buttons.nth(i);
      const { text, ariaLabel, title } = await btn.evaluate((el) => {
        const b = el as HTMLButtonElement;
        return {
          text: (b.textContent ?? '').trim(),
          ariaLabel: b.getAttribute('aria-label'),
          title: b.getAttribute('title'),
        };
      });
      // Buttons with visible text are fine. Icon-only buttons need aria-label/title.
      if (text.length === 0) {
        expect(
          (ariaLabel?.length ?? 0) > 0 || (title?.length ?? 0) > 0,
          `Icon-only button #${i} missing aria-label/title`,
        ).toBeTruthy();
      }
    }
  });

  test('/inbox/[id] detail (incl. ApproveDialog form) has no critical axe violations', async ({
    page,
  }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');

    // TicketCard renders <Link href="/inbox/{id}">. Resolve the first ticket href
    // straight from the rendered Kanban — same path a ra-lead takes clicking a card,
    // and avoids coupling the a11y scan to the /api/inbox response shape.
    const ticketLink = page.locator('a[href*="/inbox/"]').first();
    const href = await ticketLink.getAttribute('href').catch(() => null);
    test.skip(!href, 'no ticket links rendered on /inbox — /inbox/[id] axe skipped');

    await page.goto(href as string);
    await page.waitForLoadState('networkidle');

    // ApproveDialog is an inline form (data-testid="approve-dialog") on this route,
    // so a full-page axe scan covers REQ-V3-UI-042 for the dialog as well.
    expectNoCritical(await runAxe(page), href as string);
  });
});
