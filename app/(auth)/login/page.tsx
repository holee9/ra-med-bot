// @MX:NOTE Login page — REQ-FND-018, 058. Server component exporting metadata
// (robots.index=true override); delegates SSO buttons to a client child.

import type { Metadata } from 'next';
import LoginButtons from './LoginButtons';

export const metadata: Metadata = {
  title: 'Regula — Sign in',
  // REQ-FND-058: login is the only indexable surface in the app.
  robots: { index: true, follow: true },
};

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-12">
      <h1 className="font-serif text-3xl text-brand-800">Regula</h1>
      <p className="mt-2 text-ink-600">로그인하여 상담을 시작하세요</p>
      <LoginButtons />
    </main>
  );
}
