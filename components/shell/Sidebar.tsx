// @MX:NOTE Sidebar — REQ-FND-019. Fixed 260px navigation with the eight
// canonical destinations in handoff §7 order, plus a "새 상담" primary action.

import Link from 'next/link';

type NavItem = { label: string; href: string };

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
    </aside>
  );
}
