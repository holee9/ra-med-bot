// @MX:ANCHOR [AUTO] Edge middleware for Cloudflare Workers — auth-wall + noindex.
// @MX:REASON Replaces middleware.ts for Workers runtime. Single chokepoint for
// unauthenticated traffic at the edge. Must use Edge-compatible APIs only (no Node.js).
// @MX:SPEC SPEC-REGULA-CLOUDFLARE-001 (REQ-CF-005, REQ-CF-006, REQ-CF-007, REQ-CF-008)
//
// DO NOT import @vercel/edge or @vercel/og — REQ-CF-009.
// Use standard Web APIs (Request, Response, Headers, URL) only.

// Paths that do not require authentication or noindex header.
const PUBLIC_PATHS = [
  '/login',
  '/sso/callback',
  '/api/auth',
  '/robots.txt',
  '/public',
  '/_next/static',
  '/_next/image',
  '/favicon.ico',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

/**
 * Checks if a request carries a valid session cookie.
 * In production this defers to Auth.js v5 KV session store.
 * For edge middleware we do a lightweight cookie presence check;
 * full validation happens server-side.
 */
function hasSessionCookie(req: Request): boolean {
  const cookie = req.headers.get('cookie') ?? '';
  // Auth.js v5 default cookie name (JWT or session)
  return (
    cookie.includes('authjs.session-token') ||
    cookie.includes('__Secure-authjs.session-token') ||
    cookie.includes('next-auth.session-token')
  );
}

export default function middleware(req: Request): Response {
  const url = new URL(req.url);
  const { pathname } = url;

  // Public paths bypass all middleware logic (no noindex header, no auth check).
  if (isPublicPath(pathname)) {
    return new Response(null, { status: 200 });
  }

  const isAuthed = hasSessionCookie(req);

  // Unauthenticated traffic → redirect to /login
  if (!isAuthed) {
    const loginUrl = new URL('/login', url);
    return Response.redirect(loginUrl.toString(), 302);
  }

  // Authenticated response: add X-Robots-Tag to prevent indexing of app pages.
  const headers = new Headers();
  headers.set('x-robots-tag', 'noindex');
  return new Response(null, { status: 200, headers });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|sso/callback|api/auth|robots.txt|public).*)',
  ],
};
