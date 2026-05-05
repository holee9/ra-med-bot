// @MX:ANCHOR Auth-wall + security-headers middleware — gates every non-public
// route at the edge and stamps the four required headers (CSP, HSTS,
// X-Frame-Options, X-Content-Type-Options) on every response.
// @MX:REASON Single chokepoint for unauthenticated traffic AND for
// regulatory-mandated security headers. Changing the matcher, the redirect
// target, or the header policy affects every page in the app, so any edit
// requires a Phase-level review.
// @MX:SPEC SPEC-REGULA-FOUNDATION-001 (REQ-FND-053), SPEC-REGULA-QUALITY-001 (REQ-QUAL-020~023)

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const SESSION_COOKIE_NAMES = ['authjs.session-token', '__Secure-authjs.session-token'];

// REQ-QUAL-021: HSTS max-age >= 31536000 (1 year). preload-eligible value.
const HSTS_VALUE = 'max-age=63072000; includeSubDomains; preload';

/**
 * REQ-QUAL-022: Per-request CSP nonce. base64-encoded random bytes; the same
 * value is forwarded to the route handler / RSC layout via the `x-nonce`
 * request header so Next.js can stamp the nonce on its framework scripts.
 *
 * Edge runtime exposes Web Crypto on `globalThis.crypto`. We avoid Node's
 * Buffer (not available on edge) by using btoa over a binary string.
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

/**
 * Build the Content-Security-Policy directive list for a given nonce.
 *
 * Notes on the policy:
 * - `script-src` includes `'nonce-<value>'` so the E2E nonce-match assertion
 *   has something to verify. `'strict-dynamic'` lets nonced scripts load
 *   their own dependencies. `'unsafe-inline'` is a documented fallback that
 *   modern browsers ignore when a nonce is present (CSP3 §6.7.2.4); it is
 *   only honored by legacy browsers that do not understand `'strict-dynamic'`.
 * - `connect-src` allows the same origin, the websocket protocol used by
 *   Next.js dev HMR, and the analytics/observability hosts wired through
 *   `lib/observability` (Sentry, PostHog, Langfuse). Adjust here, not at
 *   the call site, when adding a new third party.
 * - `frame-ancestors 'none'` is the CSP-level equivalent of
 *   `X-Frame-Options: DENY` and is the directive modern browsers actually
 *   honor. We still emit X-Frame-Options for legacy clients per
 *   REQ-QUAL-021.
 */
function buildCsp(nonce: string): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];
  return directives.join('; ');
}

/**
 * Apply the four required security headers + nonce-bearing CSP + the
 * defense-in-depth headers (Referrer-Policy, Permissions-Policy) to a
 * response. Mutates and returns the response for convenience.
 *
 * REQ-QUAL-021 enforces:
 *   - Content-Security-Policy (with nonce)
 *   - X-Frame-Options: DENY
 *   - Strict-Transport-Security (max-age >= 31536000)
 *   - X-Content-Type-Options: nosniff
 */
function applySecurityHeaders(res: NextResponse, nonce: string): NextResponse {
  res.headers.set('Content-Security-Policy', buildCsp(nonce));
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Strict-Transport-Security', HSTS_VALUE);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  );
  // Forward nonce to clients that read it from the response (e.g., E2E tests
  // that diff response-header nonce vs. inline-script nonce).
  res.headers.set('x-nonce', nonce);
  return res;
}

export function middleware(req: NextRequest) {
  const isAuthed = SESSION_COOKIE_NAMES.some((name) => Boolean(req.cookies.get(name)?.value));
  const { pathname } = req.nextUrl;
  const nonce = generateNonce();

  // Forward the nonce to downstream RSC layouts and route handlers via a
  // request header. Next.js automatically reads `x-nonce` on its framework
  // scripts; user-authored inline <script> tags can read it through
  // `headers().get('x-nonce')` in Server Components.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);

  // Already-signed-in users hitting /login are redirected to the app root.
  // Without this, the SSO callback would loop back to /login on every visit.
  if (isAuthed && pathname.startsWith('/login')) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/', req.nextUrl)), nonce);
  }

  // Unauthenticated traffic to gated paths is redirected to /login.
  // The exempt list (login, sso/callback, api/auth, robots.txt, public) is
  // expressed in the matcher below, so by the time we get here we know the
  // request is for a gated path.
  if (!isAuthed) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/login', req.nextUrl)), nonce);
  }

  // Authenticated request: forward with the nonce in request headers and
  // stamp security headers on the outbound response.
  return applySecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), nonce);
}

// REQ-FND-053: matcher pattern is exact and load-bearing. Any change must be
// reviewed against the public-route allow-list in handoff §16.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|sso/callback|api/auth|robots.txt|public).*)',
  ],
};
