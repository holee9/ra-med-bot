'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginButtons() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl: '/',
    });
    console.log('[LoginButtons] signIn result:', result);
    setLoading(false);
    if (result?.error) {
      setError('이메일/비밀번호가 올바르지 않거나 아직 승인 대기 중입니다');
      console.error('[LoginButtons] signIn error:', result.error);
    } else {
      router.push('/dashboard');
    }
  }

  return (
    <div className="mt-8 flex w-full flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          name="email"
          placeholder="이메일"
          aria-label="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-md border border-ink-200 bg-surface px-4 py-3 text-sm text-ink-800 outline-none focus:border-brand-500"
        />
        <input
          type="password"
          name="password"
          placeholder="비밀번호"
          aria-label="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="rounded-md border border-ink-200 bg-surface px-4 py-3 text-sm text-ink-800 outline-none focus:border-brand-500"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-700 px-4 py-3 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>

      <p className="text-center text-sm text-ink-500">
        계정이 없으신가요?{' '}
        <a href="/signup" className="text-brand-700 underline">
          신규 신청
        </a>
      </p>
    </div>
  );
}
