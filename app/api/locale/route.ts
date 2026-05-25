import type { NextRequest } from 'next/server';

// Cookie-based locale switch endpoint. Works without JS hydration.
// Uses raw Response + explicit Set-Cookie header because NextResponse.redirect().cookies.set()
// can be dropped by Next.js 15 when the redirect is intercepted by middleware.
export function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get('locale') === 'en' ? 'en' : 'ko';
  const raw = searchParams.get('returnTo') ?? '/';
  const returnTo = raw.startsWith('/') ? raw : '/';
  const redirectUrl = new URL(returnTo, request.url).toString();

  return new Response(null, {
    status: 307,
    headers: {
      Location: redirectUrl,
      'Set-Cookie': `regula-locale=${locale}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`,
    },
  });
}
