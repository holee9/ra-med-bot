'use client';

// @MX:NOTE Sidebar — REQ-FND-019. Fixed 260px navigation with the eight
// canonical destinations in handoff §7 order, plus a "새 상담" primary action.
// REQ-BREADTH-044: real project list added below nav links.

import Link from 'next/link';
import { useProjects } from '@/lib/queries/useProjects';
import { useUIStore } from '@/stores/ui';

type NavItem = { label: string; href: string };
type ProjectRow = { id: string; name: string };

// @MX:ANCHOR Order is contractually fixed by REQ-FND-019; tests assert it.
// @MX:REASON Reordering breaks UX expectations and the frontend-shell test.
const NAV_ITEMS: NavItem[] = [
  { label: '홈', href: '/' },
  { label: '새 상담', href: '/chat' },
  { label: '히스토리', href: '/history' },
  { label: '템플릿', href: '/templates' },
  { label: '지식 베이스', href: '/knowledge' },
  { label: '규제 업데이트', href: '/updates' },
  { label: '대시보드', href: '/dashboard' },
  { label: '설정', href: '/settings' },
];

export default function Sidebar() {
  const currentProjectId = useUIStore((s) => s.currentProjectId);
  const setCurrentProjectId = useUIStore((s) => s.setCurrentProjectId);
  const { data = [] } = useProjects();
  const projects = data as ProjectRow[];

  return (
    <aside
      className="flex w-[260px] shrink-0 flex-col border-r border-ink-100 bg-surface-elevated"
      aria-label="주 메뉴"
    >
      <div className="px-4 py-5">
        <Link
          href="/chat"
          className="flex w-full items-center justify-center rounded-md bg-brand-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          새 상담
        </Link>
      </div>
      <nav className="flex flex-col gap-1 px-2 py-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* REQ-BREADTH-044: Projects section */}
      {projects.length > 0 && (
        <section className="mt-2 px-2 py-2">
          <p className="mb-1 px-3 text-[10px] uppercase tracking-widest text-ink-400">
            프로젝트
          </p>
          <ul className="flex flex-col gap-0.5">
            {projects.map((project) => {
              const isActive = project.id === currentProjectId;
              return (
                <li key={project.id}>
                  <button
                    type="button"
                    data-active={isActive ? 'true' : undefined}
                    aria-current={isActive ? 'true' : undefined}
                    onClick={() => setCurrentProjectId(project.id)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-ink-50 ${
                      isActive ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-700'
                    }`}
                  >
                    {project.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </aside>
  );
}
