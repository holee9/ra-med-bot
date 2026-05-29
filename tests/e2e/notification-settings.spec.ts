// @MX:NOTE: [AUTO] E2E spec: notification preferences settings UI
// @MX:SPEC: SPEC-REGULA-NOTIFICATIONS-001 (REQ-NOTIFY-001..002)

import { expect, test } from '@playwright/test';
import { requiresAuthState, requiresLiveServer } from './fixtures/env-guard';

test.describe('Notification Settings (SPEC-REGULA-NOTIFICATIONS-001)', () => {
  test.beforeEach(async ({ page }) => {
    const server = requiresLiveServer();
    const auth = requiresAuthState();
    test.skip(server.skip, server.reason);
    test.skip(auth.skip, auth.reason);

    await page.goto('/settings');
    await expect(page.locator('[data-testid="notification-settings-section"]')).toBeVisible();
  });

  test('notification settings section is visible (REQ-NOTIFY-002)', async ({ page }) => {
    const settings = page.locator('[data-testid="notification-settings"]');
    await expect(settings).toBeVisible({ timeout: 10_000 });
  });

  test('all 7 event types have email and slack checkboxes (REQ-NOTIFY-002)', async ({ page }) => {
    await expect(page.locator('[data-testid="notification-settings"]')).toBeVisible({ timeout: 10_000 });

    const events = [
      'expert_review_assigned',
      'expert_review_sla_warning',
      'regulatory_update_high_risk',
      'regulatory_update_weekly_digest',
      'workflow_completed',
      'batch_query_completed',
      'knowledge_gap_detected',
    ];

    for (const event of events) {
      await expect(page.locator(`[data-testid="notification-${event}-email"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="notification-${event}-slack"]`)).toBeVisible();
    }
  });

  test('toggling a preference saves and shows saved indicator (REQ-NOTIFY-002)', async ({ page }) => {
    await expect(page.locator('[data-testid="notification-settings"]')).toBeVisible({ timeout: 10_000 });

    const checkbox = page.locator('[data-testid="notification-knowledge_gap_detected-email"]');
    const initialState = await checkbox.isChecked();

    // Toggle the checkbox.
    await checkbox.click();

    // Wait for save indicator.
    await expect(page.locator('[data-testid="notification-settings-saved"]')).toBeVisible({
      timeout: 5_000,
    });

    // State should have changed.
    expect(await checkbox.isChecked()).toBe(!initialState);
  });
});
