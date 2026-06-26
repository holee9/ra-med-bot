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
import { useQueryClient } from '@tanstack/react-query';
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
  { label: '내 라이브러리', href: '/library', testId: 'nav-library' },
  { label: '규제 캘린더', href: '/calendar', testId: 'nav-calendar' },
  { label: '템플릿', href: '/templates' },
  { label: '지식 베이스', href: '/knowledge' },
  { label: '규제 업데이트', href: '/updates' },
  { label: '대시보드', href: '/dashboard' },
  { label: '설정', href: '/settings' },
];

const CHAT_LABELS: Record<string, string> = { ko: '채팅', en: 'Chat' };

interface SidebarProps {
  showExpertReview?: boolean;
  // SPEC-REGULA-PREDICATE-001 (REQ-PRE-029): Predicate Search is visible only to
  // RA/Dev/Exec departments. Gated server-side and passed down as a prop.
  showPredicate?: boolean;
  // SPEC-REGULA-KNOWLEDGE-GAP-001 (Issue #35): Knowledge Gap queue is visible to
  // roles with knowledgegap.view (ra-member+). Gated server-side and passed down.
  showKnowledgeGap?: boolean;
  // SPEC-REGULA-CLASSIFY-001 (Issue #59): Device Classification wizard is visible
  // to roles with classify.view (ra-member+). Gated server-side and passed down.
  showClassify?: boolean;
  // SPEC-REGULA-TRACEABILITY-001 (Issue #47): Traceability matrix is visible to
  // roles with traceability.view (ra-member+). Gated server-side and passed down.
  showTraceability?: boolean;
  // SPEC-REGULA-PMS-001 (Issue #53): PMS Workbench is visible to roles with
  // pms.view (ra-member+). Gated server-side and passed down.
  showPms?: boolean;
  // SPEC-REGULA-CHANGE-CONTROL-001 (Issue #54): Change Control is visible to
  // roles with change.view (ra-member+). Gated server-side and passed down.
  showChangeControl?: boolean;
  // SPEC-REGULA-LABELING-001 (Issue #66): Labeling workbench is visible to
  // roles with label.view (ra-member+). Gated server-side and passed down.
  showLabeling?: boolean;
  // SPEC-REGULA-CAPA-001 (Issue #68): CAPA complaint/closed-loop workbench is
  // visible to roles with complaint.view (ra-member+). Gated server-side.
  showCapa?: boolean;
  // SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69): Clinical Investigation planner
  // is visible to roles with clinical_investigation.view (ra-member+).
  showClinicalInvestigation?: boolean;
  // SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48): Governance dashboard is visible
  // to roles with sourcegov.view (ra-member+). Gated server-side and passed down.
  showGovernance?: boolean;
  // SPEC-REGULA-RLHF-001 (Issue #56): Quality heatmap nav gated to ra-member+
  // (rlhf.feedback submitters). The page route uses audit.read, but ra-member+
  // feedback submitters also see the nav so they can track answer quality.
  showQualityHeatmap?: boolean;
  // SPEC-REGULA-KNOWLEDGE-PROMO-001 (Issue #50): Team Knowledge (promoted
  // answers library) nav gated to ra-member+ (knowledgepromo.view). Gated
  // server-side and passed down.
  showTeamKnowledge?: boolean;
  initialLocale?: string;
}

export default function Sidebar(props?: SidebarProps) {
  const showExpertReview = props?.showExpertReview ?? false;
  const showPredicate = props?.showPredicate ?? false;
  const showKnowledgeGap = props?.showKnowledgeGap ?? false;
  const showClassify = props?.showClassify ?? false;
  const showTraceability = props?.showTraceability ?? false;
  const showPms = props?.showPms ?? false;
  const showChangeControl = props?.showChangeControl ?? false;
  const showLabeling = props?.showLabeling ?? false;
  const showCapa = props?.showCapa ?? false;
  const showClinicalInvestigation = props?.showClinicalInvestigation ?? false;
  const showGovernance = props?.showGovernance ?? false;
  const showQualityHeatmap = props?.showQualityHeatmap ?? false;
  const showTeamKnowledge = props?.showTeamKnowledge ?? false;
  const currentProjectId = useUIStore((s) => s.currentProjectId);
  const setCurrentProjectId = useUIStore((s) => s.setCurrentProjectId);
  const { data = [] } = useProjects();
  const queryClient = useQueryClient();
  const projects = data as ProjectSummary[];
  const currentProject = projects.find((p) => p.id === currentProjectId) ?? null;

  // initialLocale is passed from the server component (AppLayout) via cookies(),
  // ensuring SSR renders the correct locale without waiting for a client-side useEffect.
  const [locale, setLocale] = useState<string>(props?.initialLocale ?? 'ko');
  const [creatingProject, setCreatingProject] = useState(false);
  const dropdownRef = useRef<HTMLDetailsElement>(null);

  // Sync locale from cookie after client-side navigation (SPA transitions without full reload).
  useEffect(() => {
    const match = document.cookie.split('; ').find((row) => row.startsWith('regula-locale='));
    const cookieLocale = match?.split('=')[1];
    if (cookieLocale && cookieLocale !== locale) setLocale(cookieLocale);
  }, [locale]);

  // Close project dropdown when clicking outside.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        dropdownRef.current.open = false;
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const chatLabel = CHAT_LABELS[locale] ?? '채팅';

  async function createDefaultProject() {
    setCreatingProject(true);
    try {
      const res = await fetch('/api/ra/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '기본 검증 프로젝트',
          deviceClass: 'Class II',
          targetMarkets: ['FDA'],
        }),
      });
      if (res.ok) {
        const body = (await res.json()) as { project?: ProjectSummary };
        if (body.project?.id) {
          setCurrentProjectId(body.project.id);
        }
        await queryClient.invalidateQueries({ queryKey: ['projects'] });
        if (dropdownRef.current) dropdownRef.current.open = false;
      }
    } finally {
      setCreatingProject(false);
    }
  }

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

      {/* SPEC-REGULA-KNOWLEDGE-GAP-001: Knowledge Gap queue link (Issue #35). */}
      {showKnowledgeGap && (
        <nav className="px-2 py-1">
          <Link
            href="/knowledge-gap"
            data-testid="sidebar-knowledge-gap-link"
            className="rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 block"
          >
            미답변 큐
          </Link>
        </nav>
      )}

      {/* SPEC-REGULA-CLASSIFY-001 (Issue #59): Device Classification wizard link. */}
      {showClassify && (
        <nav className="px-2 py-1">
          <Link
            href="/workflows/classification"
            data-testid="sidebar-classify-link"
            className="rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 block"
          >
            기기 분류
          </Link>
        </nav>
      )}

      {/* SPEC-REGULA-TRACEABILITY-001 (Issue #47): Traceability matrix conditional link. */}
      {showTraceability && (
        <nav className="px-2 py-1">
          <Link
            href="/traceability"
            data-testid="sidebar-traceability-link"
            className="rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 block"
          >
            추적 매트릭스
          </Link>
        </nav>
      )}

      {/* SPEC-REGULA-PMS-001 (Issue #53): PMS Workbench conditional link. */}
      {showPms && (
        <nav className="px-2 py-1">
          <Link
            href="/pms"
            data-testid="sidebar-pms-link"
            className="rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 block"
          >
            PMS 워크벤치
          </Link>
        </nav>
      )}

      {/* SPEC-REGULA-CHANGE-CONTROL-001 (Issue #54): Change Control conditional link. */}
      {showChangeControl && (
        <nav className="px-2 py-1">
          <Link
            href="/change-control"
            data-testid="sidebar-change-control-link"
            className="rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 block"
          >
            변경 관리
          </Link>
        </nav>
      )}

      {/* SPEC-REGULA-LABELING-001 (Issue #66): Labeling workbench conditional link. */}
      {showLabeling && (
        <nav className="px-2 py-1">
          <Link
            href="/labeling"
            data-testid="sidebar-labeling-link"
            className="rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 block"
          >
            라벨링·IFU
          </Link>
        </nav>
      )}

      {/* SPEC-REGULA-CAPA-001 (Issue #68): CAPA complaint/closed-loop conditional link. */}
      {showCapa && (
        <nav className="px-2 py-1">
          <Link
            href="/capa"
            data-testid="sidebar-capa-link"
            className="rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 block"
          >
            불만·CAPA
          </Link>
        </nav>
      )}

      {/* SPEC-REGULA-CLINICAL-INVESTIGATION-001 (Issue #69): Clinical Investigation conditional link. */}
      {showClinicalInvestigation && (
        <nav className="px-2 py-1">
          <Link
            href="/clinical-investigation"
            data-testid="sidebar-clinical-investigation-link"
            className="rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 block"
          >
            임상조사
          </Link>
        </nav>
      )}

      {/* SPEC-REGULA-PREDICATE-001: Predicate Search conditional link (REQ-PRE-029) */}
      {showPredicate && (
        <nav className="px-2 py-1">
          <Link
            href="/predicate"
            data-testid="sidebar-predicate-link"
            className="rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 block"
          >
            Predicate 검색
          </Link>
        </nav>
      )}

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

      {/* SPEC-REGULA-SOURCE-GOVERNANCE-001 (Issue #48): Governance dashboard link. */}
      {showGovernance && (
        <nav className="px-2 py-1">
          <Link
            href="/governance"
            data-testid="sidebar-governance-link"
            className="rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 block"
          >
            출처 거버넌스
          </Link>
        </nav>
      )}

      {/* SPEC-REGULA-RLHF-001 (Issue #56): Quality heatmap conditional link. */}
      {showQualityHeatmap && (
        <nav className="px-2 py-1">
          <Link
            href="/quality/heatmap"
            data-testid="sidebar-quality-heatmap-link"
            className="rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 block"
          >
            품질 히트맵
          </Link>
        </nav>
      )}

      {/* SPEC-REGULA-KNOWLEDGE-PROMO-001 (Issue #50): Team Knowledge (promoted
          answers library) conditional link. Visible to ra-member+ (knowledgepromo.view). */}
      {showTeamKnowledge && (
        <nav className="px-2 py-1">
          <Link
            href="/library?tab=team"
            data-testid="sidebar-team-knowledge-link"
            className="rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 block"
          >
            팀 지식
          </Link>
        </nav>
      )}

      {/* REQ-BREADTH-044: Project switcher dropdown.
          Uses <details>/<summary> for hydration-safe toggle — Playwright can open
          the dropdown before React attaches onClick (native browser behavior). */}
      <section className="mt-2 px-2 py-2">
        <p className="mb-1 px-3 text-[10px] uppercase tracking-widest text-ink-500">프로젝트</p>
        <details ref={dropdownRef} className="relative">
          <summary
            data-testid="project-switcher"
            aria-haspopup="listbox"
            className="flex w-full cursor-pointer list-none items-center justify-between rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
          >
            <span className="truncate">
              {currentProject ? currentProject.name : '프로젝트 선택'}
            </span>
            <ChevronDown size={14} className="shrink-0 text-ink-400" />
          </summary>

          <ul
            data-testid="project-list"
            role="menu"
            aria-label="프로젝트 목록"
            tabIndex={-1}
            className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-md border border-ink-200 bg-white py-1 shadow-md"
          >
            {projects.length === 0 ? (
              <li className="px-3 py-2 text-xs text-ink-500">
                <p>프로젝트 없음</p>
                <button
                  type="button"
                  data-testid="project-empty-create"
                  disabled={creatingProject}
                  onClick={() => void createDefaultProject()}
                  className="mt-2 rounded border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
                >
                  {creatingProject ? '생성 중...' : '기본 프로젝트 만들기'}
                </button>
              </li>
            ) : (
              projects.map((project) => {
                const isActive = project.id === currentProjectId;
                return (
                  <li key={project.id}>
                    <button
                      type="button"
                      data-testid="project-item"
                      role="menuitem"
                      aria-current={isActive ? 'true' : undefined}
                      onClick={() => {
                        setCurrentProjectId(project.id);
                        if (dropdownRef.current) dropdownRef.current.open = false;
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
        </details>
      </section>
    </aside>
  );
}
