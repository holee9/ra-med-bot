'use client';

import { useProjects } from '@/lib/queries/useProjects';
import { CircleHelp, FileText, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function OnboardingPage() {
  const { data: projects, isLoading } = useProjects();
  const router = useRouter();
  const [showTooltip, setShowTooltip] = useState(false);
  const currentStep = 1;

  useEffect(() => {
    if (!isLoading && projects && projects.length > 0) {
      const firstProject = projects[0];
      if (firstProject) {
        router.push(`/projects/${firstProject.id}`);
      }
    }
  }, [projects, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-700" />
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <section className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8">
        <header>
          <h1 className="font-serif text-3xl text-brand-800">시작하기</h1>
          <p className="mt-2 text-sm text-ink-600">
            Regula에 오신 것을 환영합니다. 첫 프로젝트를 만들어보세요.
          </p>
        </header>

        {/* 진행률 표시 */}
        <div className="rounded-lg border border-ink-150 bg-surface p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-600">진행률</span>
            <span className="text-xs font-medium text-brand-700">1/3 단계</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full bg-brand-700 transition-all duration-300"
              style={{ width: `${(currentStep / 3) * 100}%` }}
            />
          </div>
          <div className="mt-2 flex gap-2 text-xs text-ink-600">
            <span className={currentStep >= 1 ? 'text-brand-700' : ''}>1. 프로젝트 생성</span>
            <span>→</span>
            <span className={currentStep >= 2 ? 'text-brand-700' : ''}>2. 규제 분석</span>
            <span>→</span>
            <span className={currentStep >= 3 ? 'text-brand-700' : ''}>3. 전문가 검토</span>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <div className="w-full max-w-2xl">
            <div className="rounded-lg border border-dashed border-ink-200 bg-ink-50 p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <FileText className="h-8 w-8" aria-hidden="true" />
              </div>
              <h2 className="font-serif text-xl text-ink-900">첫 프로젝트를 만들어보세요</h2>
              <p className="mt-2 text-sm text-ink-600">
                프로젝트를 생성하면 의료기기 분류, 규제 대응, 전문가 검토 등의 기능을 사용할 수
                있습니다.
              </p>

              {/* 툴팁 */}
              <div className="relative mt-4">
                <button
                  type="button"
                  onClick={() => setShowTooltip(!showTooltip)}
                  className="inline-flex items-center gap-1 text-xs text-brand-700 underline"
                >
                  <CircleHelp className="h-4 w-4" aria-hidden="true" />
                  프로젝트란 무엇인가요?
                </button>

                {showTooltip && (
                  <div className="absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded-lg border border-ink-200 bg-white p-3 shadow-lg">
                    <p className="text-xs text-ink-700">
                      프로젝트는 의료기기 규제 대응을 위한 작업 공간입니다. 분류, 문서화, 규제 분석,
                      전문가 검토를 하나의 프로젝트에서 관리할 수 있습니다.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowTooltip(false)}
                      className="mt-2 text-xs text-brand-700 hover:underline"
                    >
                      닫기
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push('/projects/new')}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-800"
                >
                  <Plus className="h-5 w-5" aria-hidden="true" />
                  프로젝트 생성
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/help')}
                  className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-6 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50"
                >
                  도움말
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return null;
}
