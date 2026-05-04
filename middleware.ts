// @MX:ANCHOR Auth-wall middleware — gates every non-public route at the edge.
// @MX:REASON Single chokepoint for unauthenticated traffic. Changing the
// matcher or the redirect target affects every page in the app, so any edit
// requires a Phase-level review.
// @MX:SPEC SPEC-REGULA-FOUNDATION-001 (REQ-FND-053)

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const SESSION_COOKIE_NAMES = ['authjs.session-token', '__Secure-authjs.session-token'];

export function middleware(req: NextRequest) {
  const isAuthed = SESSION_COOKIE_NAMES.some((name) => Boolean(req.cookies.get(name)?.value));
  const { pathname } = req.nextUrl;

  if (process.env.E2E_AUTH_BYPASS === 'true' && pathname !== '/') {
    return NextResponse.next();
  }

  // Already-signed-in users hitting /login are redirected to the app root.
  // Without this, the SSO callback would loop back to /login on every visit.
  if (isAuthed && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  // Unauthenticated traffic to gated paths is redirected to /login.
  // The exempt list (login, sso/callback, api/auth, robots.txt, public) is
  // expressed in the matcher below, so by the time we get here we know the
  // request is for a gated path.
  if (!isAuthed) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }

  return NextResponse.next();
}

// REQ-FND-053: matcher pattern is exact and load-bearing. Any change must be
// reviewed against the public-route allow-list in handoff §16.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|sso/callback|api/auth|robots.txt|public).*)',
  ],
};
