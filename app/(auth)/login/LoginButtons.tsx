// @MX:NOTE Login SSO buttons — client child of /login. Calls next-auth signIn
// for Microsoft Entra ID and Google providers (REQ-FND-018).

'use client';

import { signIn } from 'next-auth/react';

export default function LoginButtons() {
  return (
    <div className="mt-8 flex w-full flex-col gap-3">
      <button
        type="button"
        onClick={() => signIn('microsoft-entra-id', { callbackUrl: '/' })}
        className="rounded-md border border-ink-200 bg-surface px-4 py-3 text-sm font-medium text-ink-800 hover:bg-ink-50"
      >
        Microsoft Entra ID로 로그인
      </button>
      <button
        type="button"
        onClick={() => signIn('google', { callbackUrl: '/' })}
        className="rounded-md border border-ink-200 bg-surface px-4 py-3 text-sm font-medium text-ink-800 hover:bg-ink-50"
      >
        Google로 로그인
      </button>
    </div>
  );
}
