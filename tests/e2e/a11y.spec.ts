// @MX:NOTE: [AUTO] E2E spec: axe-core accessibility scan for 6 core routes
// @MX:SPEC: REQ-LAUNCH-021

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const NEEDS_SERVER =
  process.env.CI !== 'true' && !process.env.PLAYWRIGHT_BASE_URL
    ? 'Requires running Next.js server (set PLAYWRIGHT_BASE_URL or run in CI)'
    : undefined;

const ROUTES_TO_CHECK = [
  '/',
  '/chat',
  '/projects',
  '/expert-review',
  '/settings',
  '/compliance',
] as const;

test.describe('Accessibility — WCAG 2.1 AA (REQ-LAUNCH-021)', () => {
  for (const route of ROUTES_TO_CHECK) {
    test(`${route} has no critical accessibility violations`, async ({ page }) => {
      test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

      await page.goto(route);

      // Wait for the page to finish hydrating before running the scan.
      await page.waitForLoadState('networkidle');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      const criticalViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === 'critical',
      );

      expect(
        criticalViolations,
        `Critical a11y violations on ${route}:\n${criticalViolations
          .map((v) => `  [${v.id}] ${v.description} (${v.nodes.length} node(s))`)
          .join('\n')}`,
      ).toHaveLength(0);
    });
  }

  test('/ has no serious or critical violations', async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    expect(
      seriousOrCritical,
      `Serious/critical violations on /:\n${seriousOrCritical
        .map((v) => `  [${v.id}] ${v.description}`)
        .join('\n')}`,
    ).toHaveLength(0);
  });
});
