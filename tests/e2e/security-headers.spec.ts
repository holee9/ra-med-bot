// @MX:NOTE: [AUTO] Security headers E2E smoke test — REQ-LAUNCH-034
// @MX:SPEC: SPEC-REGULA-LAUNCH-001 (REQ-LAUNCH-034)
// Requires production/staging deployment. All tests are skipped in local dev.

import { expect, test } from '@playwright/test';

// Skip all tests when no production URL is provided (localhost not valid for HSTS/security headers)
const NEEDS_PRODUCTION =
  !process.env.PLAYWRIGHT_BASE_URL || process.env.PLAYWRIGHT_BASE_URL.includes('localhost');

test.describe('Security Headers (REQ-LAUNCH-034)', () => {
  test.beforeEach(() => {
    test.skip(NEEDS_PRODUCTION, 'Requires production/staging deployment');
  });

  test('X-Frame-Options is DENY', async ({ request }) => {
    const response = await request.get('/');
    expect(response.headers()['x-frame-options']).toBe('DENY');
  });

  test('Strict-Transport-Security is set', async ({ request }) => {
    const response = await request.get('/');
    const hsts = response.headers()['strict-transport-security'];
    expect(hsts).toBeDefined();
    expect(hsts).toContain('max-age=');
    expect(hsts).toContain('includeSubDomains');
  });

  test('X-Content-Type-Options is nosniff', async ({ request }) => {
    const response = await request.get('/');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('Content-Security-Policy header is present', async ({ request }) => {
    const response = await request.get('/');
    const csp = response.headers()['content-security-policy'];
    expect(csp).toBeDefined();
  });

  test('Referrer-Policy is set', async ({ request }) => {
    const response = await request.get('/');
    expect(response.headers()['referrer-policy']).toBeDefined();
  });
});
