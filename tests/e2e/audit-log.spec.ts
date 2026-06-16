// @MX:NOTE: [AUTO] E2E spec: 21 CFR Part 11 audit log — immutable append-only trace
// @MX:SPEC: REQ-LAUNCH-020, REQ-QUALITY-E2E-007

import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { requiresAuthState, requiresLiveServer } from './fixtures/env-guard';

const ADMIN_AUTH_STATE =
  process.env.PLAYWRIGHT_ADMIN_AUTH_STATE ?? 'tests/e2e/fixtures/.admin-auth.json';

async function countChatQueryAuditLogs(): Promise<number> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return 0;

  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const rows = await sql<{ count: number }[]>`
      select count(*)::int as count
      from audit_logs
      where action = 'chat.query'
    `;
    return rows[0]?.count ?? 0;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// Audit log tests require:
//   1. An authenticated admin session (read permission to audit_logs).
//   2. A live server with Drizzle-backed audit_logs table.
//   3. GET /api/audit-logs endpoint (admin-scoped) to read back entries.

test.describe('Audit log — 21 CFR Part 11 (REQ-LAUNCH-020)', () => {
  test.describe.configure({ mode: 'serial' });

  test('submitting a chat query creates an audit log entry', async ({ request }) => {
    const server = requiresLiveServer();
    const auth = requiresAuthState();
    test.skip(server.skip, server.reason);
    test.skip(auth.skip, auth.reason);

    const consultRes = await request.post('/api/ra/consult', {
      data: {
        question: '__test:citation_response__',
        sourceFilter: 'all',
        locale: 'ko',
      },
      timeout: 20_000,
    });
    expect(consultRes.status()).toBe(200);
    await consultRes.text();

    // Verify audit append directly in the E2E database; admin API read access is covered below.
    await expect.poll(countChatQueryAuditLogs, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
  });

  test('audit log entry contains required 21 CFR Part 11 fields', async ({
    playwright,
    baseURL,
  }) => {
    const server = requiresLiveServer();
    const auth = requiresAuthState();
    test.skip(server.skip, server.reason);
    test.skip(auth.skip, auth.reason);

    const adminCtx = await playwright.request.newContext({
      baseURL: baseURL ?? 'http://localhost:3000',
      storageState: ADMIN_AUTH_STATE,
    });
    try {
      const res = await adminCtx.get('/api/audit-logs?limit=1');
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
    } finally {
      await adminCtx.dispose();
    }
  });

  test('audit log is accessible to admin role only', async ({ request, playwright, baseURL }) => {
    const server = requiresLiveServer();
    test.skip(server.skip, server.reason);

    const userRes = await request.get('/api/audit-logs');
    expect(userRes.status()).toBe(403);

    // Explicitly empty storageState forces a truly unauthenticated request.
    const anonymousCtx = await playwright.request.newContext({
      baseURL: baseURL ?? 'http://localhost:3000',
      storageState: { cookies: [], origins: [] },
    });
    try {
      const res = await anonymousCtx.get('/api/audit-logs');
      expect([401, 403]).toContain(res.status());
    } finally {
      await anonymousCtx.dispose();
    }

    const adminCtx = await playwright.request.newContext({
      baseURL: baseURL ?? 'http://localhost:3000',
      storageState: ADMIN_AUTH_STATE,
    });
    try {
      const adminRes = await adminCtx.get('/api/audit-logs?limit=1');
      expect(adminRes.status()).toBe(200);
    } finally {
      await adminCtx.dispose();
    }
  });

  test('audit log admin UI shows entries table', async ({ browser, baseURL }) => {
    const auth = requiresAuthState();
    test.skip(auth.skip, auth.reason);

    const context = await browser.newContext({ storageState: ADMIN_AUTH_STATE });
    const page = await context.newPage();
    try {
      await page.goto(`${baseURL ?? 'http://localhost:3000'}/admin/audit-logs`);
      await expect(page.locator('[data-testid="audit-log-table"]')).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
