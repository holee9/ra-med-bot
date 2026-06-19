'use client';

import Link from 'next/link';

interface EmptyStateProps {
  projectName?: string;
}

export function EmptyState({ projectName = '새 프로젝트' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12">
      <div className="text-center">
        <h2 className="font-serif text-2xl text-brand-800">
          첫 프로젝트를 시작하세요
        </h2>
        <p className="mt-2 text-sm text-ink-600">
          아직 프로젝트가 없습니다. 의료기기 규제 대응을 시작하세요.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-ink-150 bg-surface p-4">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <h3 className="font-serif text-lg text-ink-900">프로젝트 생성</h3>
          <p className="mt-1 text-xs text-ink-600">
            새 프로젝트를 만들고 의료기기 분류를 시작하세요.
          </p>
        </div>

        <div className="rounded-lg border border-ink-150 bg-surface p-4">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="font-serif text-lg text-ink-900">규제 가이드</h3>
          <p className="mt-1 text-xs text-ink-600">
            FDA, EU MDR 등 규제 요건을 확인하고 대응하세요.
          </p>
        </div>

        <div className="rounded-lg border border-ink-150 bg-surface p-4">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-serif text-lg text-ink-900">전문가 검토</h3>
          <p className="mt-1 text-xs text-ink-600">
            RA 전문가의 검토를 받고 안전하게 진행하세요.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-800"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          프로젝트 생성
        </Link>
        <Link
          href="/help"
          className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-6 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50"
        >
          도움말
        </Link>
      </div>
    </div>
  );
}
