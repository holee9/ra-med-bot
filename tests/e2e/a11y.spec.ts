// @MX:NOTE: [AUTO] E2E spec: axe-core accessibility scan for 6 core routes
// @MX:SPEC: REQ-LAUNCH-021, SPEC-REGULA-E2EFIX-001 (REQ-E2EFIX-002)

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { requiresLiveServer } from './fixtures/env-guard';

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
      const s = requiresLiveServer();
      test.skip(s.skip, s.reason);

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
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);

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
