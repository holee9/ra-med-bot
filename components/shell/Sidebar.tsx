'use client';

// @MX:NOTE Sidebar — REQ-FND-019. Fixed 260px navigation.
// 2026-10-20 scope purge #2: duplicated "새 상담" primary button and 홈 entry
// removed (both duplicated /chat — 홈 now redirects), project switcher,
// governance nav, and the tier system deleted with their routes/components.
// Restore from git history if the RA purpose validation ever demands one.

import { type Role, hasRole } from '@/lib/kernel/auth/rbac';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type NavItem = { label: string; href: string; testId?: string; minRole?: Role };

// @MX:ANCHOR Order is contractually fixed by REQ-FND-019; tests assert it.
// @MX:REASON Reordering breaks UX expectations and the frontend-shell test.
const NAV_ITEMS: NavItem[] = [
  { label: '채팅', href: '/chat', testId: 'nav-chat', minRole: 'viewer' },
  { label: '히스토리', href: '/history', minRole: 'viewer' },
  { label: '설정', href: '/settings', minRole: 'viewer' },
];

interface SidebarProps {
  showExpertReview?: boolean;
  // SPEC-V3-UI-001 (Issue 320): Inbox nav gated to ra-member+ (inbox.view).
  showInbox?: boolean;
  userRole?: Role;
  initialLocale?: string;
}

export default function Sidebar(props?: SidebarProps) {
  const showExpertReview = props?.showExpertReview ?? false;
  // SPEC-V3-UI-001 (Issue 320): Inbox nav gated to ra-member+ (inbox.view).
  const showInbox = props?.showInbox ?? false;
  // 2026-06-29: default 'viewer' (최소 권한 — 명시적 role 없으면 전사 직원 사이드바).
  const userRole: Role = props?.userRole ?? 'viewer';

  // initialLocale is passed from the server component (AppLayout) via cookies(),
  // ensuring SSR renders the correct locale without waiting for a client-side useEffect.
  const [locale, setLocale] = useState<string>(props?.initialLocale ?? 'ko');

  // Sync locale from cookie after client-side navigation (SPA transitions without full reload).
  useEffect(() => {
    const match = document.cookie.split('; ').find((row) => row.startsWith('regula-locale='));
    const cookieLocale = match?.split('=')[1];
    if (cookieLocale && cookieLocale !== locale) setLocale(cookieLocale);
  }, [locale]);

  const chatLabel = locale === 'en' ? 'Chat' : '채팅';

  return (
    <aside
      className="flex shrink-0 flex-col border-r border-ink-100 bg-surface-elevated"
      style={{ width: 'var(--nav-w)' }}
      aria-label="주 메뉴"
    >
      <nav aria-label="메인 내비게이션" className="flex flex-col gap-1 px-2 py-2">
        {NAV_ITEMS.filter((item) => !item.minRole || hasRole(userRole, item.minRole)).map(
          (item) => {
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
          },
        )}
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

      {/* SPEC-V3-UI-001 (Issue 320, REQ-V3-UI-031): Inbox Kanban board nav gated to ra-member+ (inbox.view). */}
      {showInbox && (
        <nav className="px-2 py-1">
          <Link
            href="/inbox"
            data-testid="sidebar-inbox-link"
            className="rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 block"
          >
            인박스
          </Link>
        </nav>
      )}

      {/* 운영 콘솔 — t3610 서비스 상황판 + RA 성장 대시보드 (2026-10-20).
          Admin-only: reads the sidecar-collected status snapshot, no
          privileges in the web process. */}
      {hasRole(userRole, 'admin') && (
        <nav className="px-2 py-1">
          <Link
            href="/ops"
            data-testid="sidebar-ops-link"
            className="rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 block"
          >
            운영 콘솔
          </Link>
        </nav>
      )}
    </aside>
  );
}
