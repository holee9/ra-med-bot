'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? '가입에 실패했습니다');
      return;
    }

    router.push('/login?registered=1');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-12">
      <h1 className="font-serif text-3xl text-brand-800">Regula</h1>
      <p className="mt-2 text-ink-600">신규 계정 신청</p>

      <form onSubmit={handleSubmit} className="mt-8 flex w-full flex-col gap-3">
        <input
          type="text"
          placeholder="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-md border border-ink-200 bg-surface px-4 py-3 text-sm text-ink-800 outline-none focus:border-brand-500"
        />
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-md border border-ink-200 bg-surface px-4 py-3 text-sm text-ink-800 outline-none focus:border-brand-500"
        />
        <input
          type="password"
          placeholder="비밀번호 (8자 이상)"
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
          {loading ? '처리 중...' : '신청하기'}
        </button>
      </form>

      <p className="mt-4 text-sm text-ink-500">
        이미 계정이 있으신가요?{' '}
        <a href="/login" className="text-brand-700 hover:underline">
          로그인
        </a>
      </p>
    </main>
  );
}
