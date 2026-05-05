// @MX:NOTE: [AUTO] Security headers E2E — REQ-QUAL-020~023, REQ-LAUNCH-034.
// Verifies that middleware.ts stamps the four required headers (CSP with
// nonce, X-Frame-Options, HSTS, X-Content-Type-Options) on every response
// produced by the app, including /api/ra/* routes. Run via:
//   pnpm test:e2e --grep @security-headers
// @MX:SPEC: SPEC-REGULA-QUALITY-001 (REQ-QUAL-020~023), SPEC-REGULA-LAUNCH-001 (REQ-LAUNCH-034)

import { expect, test } from '@playwright/test';

// REQ-QUAL-020: this test must pass in CI on chromium against a build
// representative of production. Locally `pnpm dev` is sufficient because
// middleware.ts (not Vercel's static headers config) is the source of
// truth for these headers — the same middleware runs in dev and prod.
//
// We still expose `test.skip` so the meta-test in tests/unit/security-e2e-shape.test.ts
// continues to recognize the production-skip guard pattern. The guard only
// triggers when no base URL is wired (e.g., promptfoo-style smoke runs).
const SKIP_REASON =
  !process.env.PLAYWRIGHT_BASE_URL && process.env.CI === 'true'
    ? 'No PLAYWRIGHT_BASE_URL configured in CI environment'
    : '';

// `/api/ra/sources` is one of the protected /api/ra/* routes. Unauthenticated
// requests are 307-redirected to /login by middleware.ts, but the security
// headers are stamped on the redirect response itself — which is exactly
// what REQ-QUAL-021 requires us to verify.
const API_RA_ROUTE = '/api/ra/sources';

test.describe('@security-headers Security Headers (REQ-QUAL-020~023)', () => {
  test.beforeEach(() => {
    test.skip(Boolean(SKIP_REASON), SKIP_REASON);
  });

  test('@security-headers /api/ra/* response includes X-Frame-Options: DENY', async ({
    request,
  }) => {
    const response = await request.get(API_RA_ROUTE, { maxRedirects: 0 });
    expect(response.headers()['x-frame-options']).toBe('DENY');
  });

  test('@security-headers /api/ra/* response includes X-Content-Type-Options: nosniff', async ({
    request,
  }) => {
    const response = await request.get(API_RA_ROUTE, { maxRedirects: 0 });
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('@security-headers /api/ra/* response includes Strict-Transport-Security with max-age >= 31536000', async ({
    request,
  }) => {
    const response = await request.get(API_RA_ROUTE, { maxRedirects: 0 });
    const hsts = response.headers()['strict-transport-security'];
    expect(hsts).toBeDefined();
    expect(hsts).toContain('max-age=');
    expect(hsts).toContain('includeSubDomains');

    const match = hsts?.match(/max-age=(\d+)/);
    expect(match).not.toBeNull();
    const maxAge = match ? Number.parseInt(match[1] ?? '0', 10) : 0;
    expect(maxAge).toBeGreaterThanOrEqual(31_536_000);
  });

  test('@security-headers /api/ra/* response includes Content-Security-Policy with nonce', async ({
    request,
  }) => {
    const response = await request.get(API_RA_ROUTE, { maxRedirects: 0 });
    const csp = response.headers()['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
  });

  test('@security-headers HTML response CSP nonce matches inline <script nonce=…> attributes', async ({
    page,
  }) => {
    // Capture the response headers for the document navigation. Subsequent
    // navigations (e.g., login page) carry the same middleware-applied
    // headers because the middleware runs on every gated path.
    const responsePromise = page.waitForResponse((r) => r.request().resourceType() === 'document');
    await page.goto('/');
    const response = await responsePromise;

    const csp = response.headers()['content-security-policy'];
    expect(csp, 'CSP header must be present on HTML response').toBeDefined();

    const nonceMatch = csp?.match(/'nonce-([A-Za-z0-9+/=]+)'/);
    expect(nonceMatch, 'CSP must contain a nonce-XXX directive').not.toBeNull();
    const cspNonce = nonceMatch?.[1];
    expect(cspNonce).toBeTruthy();

    // REQ-QUAL-022: every inline <script nonce=…> must match the CSP nonce.
    // Inline scripts without a nonce attribute are out of scope here — the
    // 'unsafe-inline' fallback in the CSP allows the FOUT-prevention script
    // in app/layout.tsx (which intentionally has no nonce) to execute on
    // legacy browsers; modern browsers honor the nonce-only path.
    const scriptNonces = await page.$$eval('script[nonce]', (scripts) =>
      scripts.map((s) => s.getAttribute('nonce')).filter((n): n is string => Boolean(n)),
    );

    for (const scriptNonce of scriptNonces) {
      expect(scriptNonce, `inline <script nonce> should equal CSP nonce ${cspNonce}`).toBe(
        cspNonce,
      );
    }
  });

  test('@security-headers Referrer-Policy is set to a privacy-preserving value', async ({
    request,
  }) => {
    const response = await request.get(API_RA_ROUTE, { maxRedirects: 0 });
    const referrer = response.headers()['referrer-policy'];
    expect(referrer).toBeDefined();
    expect(referrer).toMatch(/no-referrer|strict-origin|same-origin/);
  });
});
