import { Callout } from '@/components/ui/Callout';
import { ReadinessBadge } from '@/components/ui/ReadinessBadge';
import { auth } from '@/lib/auth';
import { hasRole } from '@/lib/auth/rbac';
import {
  BarChart3,
  BookOpenCheck,
  ClipboardCheck,
  DatabaseZap,
  FileText,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

// @MX:NOTE [AUTO] HomePage — Issue #158 Group C (Home + Shell).
// Role-aware persona-based work start points.
// Shows different entry points based on user role (ra-lead, admin, viewer, ra-member).
// #157 owning-project routing indicator: honest "pending" status (backend not built).
// @MX:SPEC Issue #158 (Group C - Home)

type Role = 'admin' | 'qa-lead' | 'ra-lead' | 'ra-member' | 'viewer' | 'auditor';

interface RoleEntry {
  role: string;
  outcome: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Role-based entry points configuration
const ROLE_ENTRIES: Record<Role, RoleEntry[]> = {
  'ra-lead': [
    {
      role: 'RA 전략 시작',
      outcome: '510(k) 작성, 규제 전략 수립',
      href: '/chat',
      icon: BookOpenCheck,
    },
    {
      role: '전문가 검토 큐',
      outcome: '저신뢰·고위험 답변 검토 및 승인',
      href: '/expert-review',
      icon: ClipboardCheck,
    },
    {
      role: '프로젝트 메모리',
      outcome: '프로젝트 문맥 관리 및 검토',
      href: '/workflows/project-memory',
      icon: FileText,
    },
  ],
  admin: [
    {
      role: '시스템 설정',
      outcome: '사용자 관리, RBAC, 감사 로그',
      href: '/settings',
      icon: Settings,
    },
    {
      role: '감사 대시보드',
      outcome: '시스템 운영 상태 및 접근 권한 확인',
      href: '/audit',
      icon: ShieldCheck,
    },
  ],
  viewer: [
    {
      role: '대시보드',
      outcome: '읽기 전용 전체 현황 확인',
      href: '/dashboard',
      icon: BarChart3,
    },
    {
      role: '지식 베이스',
      outcome: '프로모트된 답변 및 팀 지식 확인',
      href: '/knowledge',
      icon: DatabaseZap,
    },
    {
      role: '템플릿',
      outcome: '반복 제출 문서 및 체크리스트 확인',
      href: '/templates',
      icon: FileText,
    },
  ],
  'ra-member': [
    {
      role: '새 규제 상담',
      outcome: '근거 문서와 citation이 포함된 RA 답변 생성',
      href: '/chat',
      icon: BookOpenCheck,
    },
    {
      role: '히스토리',
      outcome: '이전 상담 내역 및 문서 확인',
      href: '/history',
      icon: FileText,
    },
    {
      role: '내 라이브러리',
      outcome: '개인 북마크 및 태그 관리',
      href: '/library',
      icon: DatabaseZap,
    },
  ],
  'qa-lead': [
    {
      role: '새 규제 상담',
      outcome: '근거 문서와 citation이 포함된 RA 답변 생성',
      href: '/chat',
      icon: BookOpenCheck,
    },
    {
      role: '전문가 검토 큐',
      outcome: '저신뢰·고위험 답변 검토 및 승인',
      href: '/expert-review',
      icon: ClipboardCheck,
    },
  ],
  auditor: [
    {
      role: '감사 대시보드',
      outcome: '감사 로그 및 패키지 생성',
      href: '/audit',
      icon: ShieldCheck,
    },
  ],
};

// Fallback entries for unknown roles or errors
const DEFAULT_ENTRIES: RoleEntry[] = [
  {
    role: '새 규제 상담',
    outcome: '근거 문서와 citation이 포함된 RA 답변 생성',
    href: '/chat',
    icon: BookOpenCheck,
  },
  {
    role: '대시보드',
    outcome: '전체 현황 확인',
    href: '/dashboard',
    icon: BarChart3,
  },
];

const trustSignals = ['근거 citation', '전문가 검토', '조직별 source 경계', '업로드 PII redaction'];

export default async function HomePage() {
  const session = await auth();
  const userRole = ((session?.user as { role?: string } | undefined)?.role as Role) ?? 'viewer';

  // Get role-specific entries
  const entries = ROLE_ENTRIES[userRole] || DEFAULT_ENTRIES;

  return (
    <section className="mx-auto flex max-w-content flex-col gap-8 px-6 py-10">
      <header>
        <p className="text-xs font-medium uppercase tracking-widest text-ink-500">Regula</p>
        <h1 className="mt-2 font-serif text-4xl text-brand-800">의료기기 RA 상담 워크스페이스</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-600">
          규제 질문, 근거 문서, 구조화 답변, 전문가 검토, 감사 로그를 한 흐름에서 관리합니다.
        </p>
      </header>

      {/* #157 owning-project routing indicator - honest pending status */}
      <Callout variant="info" title="프로젝트 라우팅 상태">
        <div className="flex items-center gap-3">
          <ReadinessBadge status="pending" />
          <p className="text-sm">
            자동 프로젝트 라우팅은 현재 개발 중입니다 (
            <Link href="/expert-review" className="text-brand-700 underline hover:text-brand-800">
              Issue #157
            </Link>
            ). 현재는 수동 라우팅만 지원됩니다.
          </p>
        </div>
      </Callout>

      {/* Role-based entry points */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-ink-900">
          {userRole === 'ra-lead' && 'RA Lead 작업 시작점'}
          {userRole === 'admin' && '관리자 작업 시작점'}
          {userRole === 'viewer' && '조회자 작업 시작점'}
          {userRole === 'ra-member' && 'RA 실무자 작업 시작점'}
          {userRole === 'qa-lead' && 'QA Lead 작업 시작점'}
          {userRole === 'auditor' && '감사자 작업 시작점'}
        </h2>
        <div className="grid gap-3 lg:grid-cols-3" aria-label="역할별 시작점">
          {entries.map((entry) => {
            const Icon = entry.icon;
            return (
              <Link
                key={entry.href}
                href={entry.href}
                className="rounded-lg border border-ink-150 bg-surface p-4 transition-colors hover:border-brand-200 hover:bg-brand-50"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-brand-700">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{entry.role}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink-700">{entry.outcome}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Trust signals */}
      <section className="rounded-lg border border-ink-150 bg-ink-50 p-4" aria-label="신뢰 상태">
        <h2 className="text-sm font-semibold text-ink-900">실사용 신뢰 기준</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {trustSignals.map((signal) => (
            <div
              key={signal}
              className="rounded-md border border-ink-150 bg-surface px-3 py-2 text-sm text-ink-700"
            >
              {signal}
            </div>
          ))}
        </div>
      </section>

      {/* Quick access cards */}
      <div className="grid gap-3 md:grid-cols-2">
        <Link
          href="/templates"
          className="rounded-lg border border-ink-150 bg-surface p-4 transition-colors hover:border-brand-200 hover:bg-brand-50"
        >
          <h2 className="font-serif text-lg text-ink-900">템플릿</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">
            반복 제출 문서와 체크리스트를 빠르게 확인합니다.
          </p>
        </Link>
        <Link
          href="/calendar"
          className="rounded-lg border border-ink-150 bg-surface p-4 transition-colors hover:border-brand-200 hover:bg-brand-50"
        >
          <h2 className="font-serif text-lg text-ink-900">규제 캘린더</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">
            FDA, EU MDR, MFDS 등 주요 변경사항을 확인합니다.
          </p>
        </Link>
      </div>
    </section>
  );
}
