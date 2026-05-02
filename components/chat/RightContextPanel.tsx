'use client';

// @MX:NOTE RightContextPanel — 3 sections: current project (real data via
// useProjects), top 5 sources skeleton, 3 regulatory updates skeleton.
// Phase 4 will wire sources and updates.
// @MX:SPEC SPEC-REGULA-STRUCTURED-001 (REQ-STRUCT-029~033)
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-046, REQ-BREADTH-050)

import { useProjects } from '@/lib/queries/useProjects';

type ProjectRow = { id: string; name: string };

interface RightContextPanelProps {
  currentProjectId: string | null;
  latestMessageId: string | null;
}

export function RightContextPanel({ currentProjectId }: RightContextPanelProps) {
  // REQ-BREADTH-046: resolve project name from the shared projects list.
  const { data = [] } = useProjects();
  const allProjects = data as ProjectRow[];
  const currentProject = currentProjectId
    ? allProjects.find((p) => p.id === currentProjectId)
    : undefined;

  return (
    // REQ-STRUCT-033: hidden below 1100px via lg:block
    <aside className="hidden min-w-0 w-[360px] flex-shrink-0 flex-col gap-6 overflow-y-auto p-4 xl:flex">
      {/* Section 1: Current Project */}
      <section>
        <p
          data-section-header
          className="mb-2 font-serif text-[10px] uppercase tracking-widest text-ink-400"
        >
          현재 프로젝트
        </p>
        {currentProject ? (
          // REQ-BREADTH-046: show real project name
          <div className="flex items-center gap-2 rounded-lg border border-surface-3 p-3 text-sm text-ink-700">
            <span className="h-2 w-2 rounded-full bg-brand-400 flex-shrink-0" />
            {currentProject.name}
          </div>
        ) : currentProjectId ? (
          // projectId set but not yet resolved (still loading)
          <div className="flex items-center gap-2 rounded-lg border border-surface-3 p-3 text-sm text-ink-500">
            <span className="h-2 w-2 rounded-full bg-brand-400 flex-shrink-0" />
            로딩 중…
          </div>
        ) : (
          // REQ-STRUCT-030: null → subdued placeholder
          <div className="rounded-lg border border-surface-3 p-3 text-sm text-ink-400">
            프로젝트를 선택하세요
          </div>
        )}
      </section>

      {/* Section 2: Top 5 Sources */}
      <section>
        <p
          data-section-header
          className="mb-2 font-serif text-[10px] uppercase tracking-widest text-ink-400"
        >
          활용 출처
        </p>
        {/* REQ-STRUCT-031: loading skeleton — 5 rows with pulse animation */}
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              data-skeleton="source-row"
              className="flex items-center gap-2 animate-pulse"
            >
              <div className="h-4 w-4 rounded bg-surface-3 flex-shrink-0" />
              <div className="flex flex-col gap-1 flex-1">
                <div className="h-3 w-3/4 rounded bg-surface-3" />
                <div className="h-2 w-1/2 rounded bg-surface-3" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Regulatory Updates */}
      <section>
        <p
          data-section-header
          className="mb-2 font-serif text-[10px] uppercase tracking-widest text-ink-400"
        >
          관련 규제 업데이트
        </p>
        {/* REQ-STRUCT-032: loading skeleton — 3 card placeholders */}
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              data-skeleton="update-card"
              className="flex animate-pulse gap-3 rounded-lg border border-surface-3 p-3"
            >
              <div className="h-full w-[3px] rounded bg-surface-3 flex-shrink-0" />
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="h-3 w-3/4 rounded bg-surface-3" />
                <div className="h-2 w-1/2 rounded bg-surface-3" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
