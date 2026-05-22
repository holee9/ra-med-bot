'use client';

// @MX:NOTE Sidebar — REQ-FND-019. Fixed 260px navigation with the eight
// canonical destinations in handoff §7 order, plus a "새 상담" primary action.
// REQ-BREADTH-044: real project list added below nav links.
// T-007: showExpertReview prop added (REQ-ENTERPRISE-029). Passed from AppLayout
// which calls auth() server-side.
// Wave 1: project-switcher dropdown + locale-aware nav-chat testid added.

import { useProjects } from '@/lib/queries/useProjects';
import type { ProjectSummary } from '@/lib/queries/useProjects';
import { useUIStore } from '@/stores/ui';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type NavItem = { label: string; href: string; testId?: string };

// @MX:ANCHOR Order is contractually fixed by REQ-FND-019; tests assert it.
// @MX:REASON Reordering breaks UX expectations and the frontend-shell test.
const NAV_ITEMS: NavItem[] = [
  { label: '홈', href: '/' },
  { label: '새 상담', href: '/chat', testId: 'nav-chat' },
  { label: '히스토리', href: '/history' },
  { label: '템플릿', href: '/templates' },
  { label: '지식 베이스', href: '/knowledge' },
  { label: '규제 업데이트', href: '/updates' },
  { label: '대시보드', href: '/dashboard' },
  { label: '설정', href: '/settings' },
];

const CHAT_LABELS: Record<string, string> = { ko: '채팅', en: 'Chat' };

interface SidebarProps {
  showExpertReview?: boolean;
}

export default function Sidebar(props?: SidebarProps) {
  const showExpertReview = props?.showExpertReview ?? false;
  const currentProjectId = useUIStore((s) => s.currentProjectId);
  const setCurrentProjectId = useUIStore((s) => s.setCurrentProjectId);
  const { data = [] } = useProjects();
  const projects = data as ProjectSummary[];
  const currentProject = projects.find((p) => p.id === currentProjectId) ?? null;

  const [locale, setLocale] = useState<string>('ko');
  const [projectsOpen, setProjectsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Read locale from localStorage on mount.
  useEffect(() => {
    const stored = localStorage.getItem('regula-locale');
    if (stored) setLocale(stored);
  }, []);

  // Close project dropdown when clicking outside.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProjectsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const chatLabel = CHAT_LABELS[locale] ?? '채팅';

  return (
    <aside
      className="flex w-[260px] shrink-0 flex-col border-r border-ink-100 bg-surface-elevated"
      aria-label="주 메뉴"
    >
      {/* project-header: shows selected project name across all pages */}
      {currentProject && (
        <div
          data-testid="project-header"
          className="border-b border-ink-100 px-4 py-2 text-xs font-medium text-brand-700 bg-brand-50 truncate"
          title={currentProject.name}
        >
          {currentProject.name}
        </div>
      )}

      <div className="px-4 py-5">
        <Link
          href="/chat"
          className="flex w-full items-center justify-center rounded-md bg-brand-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          새 상담
        </Link>
      </div>

      <nav aria-label="메인 내비게이션" className="flex flex-col gap-1 px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const label = item.testId === 'nav-chat' ? chatLabel : item.label;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={item.testId}
              className="rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* T-007: Expert Review conditional link (REQ-ENTERPRISE-029) */}
      {showExpertReview && (
        <nav className="px-2 py-1">
          <Link
            href="/expert-review"
            data-testid="sidebar-expert-review-link"
            className="rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 block"
          >
            전문가 검토
          </Link>
        </nav>
      )}

      {/* REQ-BREADTH-044: Project switcher dropdown */}
      <section className="mt-2 px-2 py-2">
        <p className="mb-1 px-3 text-[10px] uppercase tracking-widest text-ink-400">프로젝트</p>
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            data-testid="project-switcher"
            aria-expanded={projectsOpen}
            aria-haspopup="listbox"
            onClick={() => setProjectsOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
          >
            <span className="truncate">
              {currentProject ? currentProject.name : '프로젝트 선택'}
            </span>
            <ChevronDown
              size={14}
              className={`shrink-0 text-ink-400 transition-transform ${projectsOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {projectsOpen && (
            <ul
              data-testid="project-list"
              role="listbox"
              aria-label="프로젝트 목록"
              className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-md border border-ink-200 bg-white py-1 shadow-md"
            >
              {projects.length === 0 ? (
                <li className="px-3 py-2 text-xs text-ink-400">프로젝트 없음</li>
              ) : (
                projects.map((project) => {
                  const isActive = project.id === currentProjectId;
                  return (
                    <li key={project.id}>
                      <button
                        type="button"
                        data-testid="project-item"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => {
                          setCurrentProjectId(project.id);
                          setProjectsOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-ink-50 ${
                          isActive ? 'font-medium text-brand-700' : 'text-ink-700'
                        }`}
                      >
                        {project.name}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </div>
      </section>
    </aside>
  );
}
