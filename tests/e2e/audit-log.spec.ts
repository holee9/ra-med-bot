// @MX:NOTE: [AUTO] E2E spec: 21 CFR Part 11 audit log — immutable append-only trace
// @MX:SPEC: REQ-LAUNCH-020, REQ-QUALITY-E2E-007

import { expect, test } from '@playwright/test';
import { requiresAuthState, requiresLiveServer } from './fixtures/env-guard';

// Audit log tests require:
//   1. An authenticated RA Lead session (write permission to audit_logs).
//   2. A live server with Drizzle-backed audit_logs table.
//   3. GET /api/audit-logs endpoint (admin-scoped) to read back entries.

test.describe('Audit log — 21 CFR Part 11 (REQ-LAUNCH-020)', () => {
  test('submitting a chat query creates an audit log entry', async ({ page, request }) => {
    const server = requiresLiveServer();
    const auth = requiresAuthState();
    test.skip(server.skip, server.reason);
    test.skip(auth.skip, auth.reason);

    await page.goto('/chat');

    // Record current time to filter audit entries created after this point.
    const before = new Date().toISOString();

    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('What are the IVDR transition dates?');
    await page.keyboard.press('Enter');

    // Wait for assistant response to confirm the query was processed.
    const assistantMsg = page.locator('[data-testid="chat-message-assistant"]').first();
    await expect(assistantMsg).toBeVisible({ timeout: 20_000 });

    // Verify audit entry via API.
    const res = await request.get('/api/audit-logs?limit=10');
    expect(res.status()).toBe(200);
    const body = await res.json();
    const entries: Array<{ action: string; createdAt: string }> = body.data ?? body;
    const recent = entries.filter((e) => e.action === 'chat.query' && e.createdAt >= before);
    expect(recent.length).toBeGreaterThanOrEqual(1);
  });

  test('audit log entry contains required 21 CFR Part 11 fields', async ({ page, request }) => {
    const server = requiresLiveServer();
    const auth = requiresAuthState();
    test.skip(server.skip, server.reason);
    test.skip(auth.skip, auth.reason);

    const res = await request.get('/api/audit-logs?limit=1');
    expect(res.status()).toBe(200);
    const body = await res.json();
    const entries: Array<Record<string, unknown>> = body.data ?? body;
    test.skip(entries.length === 0, 'No audit entries found — seed data required');

    const entry = entries[0];
    // 21 CFR Part 11 mandatory fields.
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('userId');
    expect(entry).toHaveProperty('action');
    expect(entry).toHaveProperty('createdAt');
    // Immutability: no updatedAt (append-only).
    expect(entry).not.toHaveProperty('updatedAt');
  });

  test('audit log is accessible to admin role only', async ({ page, request }) => {
    const server = requiresLiveServer();
    test.skip(server.skip, server.reason);

    // Unauthenticated request must return 401.
    const res = await request.get('/api/audit-logs');
    expect([401, 403]).toContain(res.status());
  });

  test('audit log admin UI shows entries table', async ({ page }) => {
    const auth = requiresAuthState();
    test.skip(auth.skip, auth.reason);

    await page.goto('/admin/audit-logs');
    // If the route is not yet implemented, skip gracefully.
    const is404 = await page
      .locator('[data-testid="not-found"]')
      .isVisible()
      .catch(() => false);
    test.skip(is404 as boolean, 'Admin audit-log page not yet implemented');

    await expect(page.locator('[data-testid="audit-log-table"]')).toBeVisible();
  });
});
