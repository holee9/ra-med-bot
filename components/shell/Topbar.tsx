// @MX:NOTE Topbar — REQ-FND-020. 56px-tall bar with breadcrumb slot, theme
// toggle, and "전문가 검토" entry point. All controls are placeholders pending
// Phase 2 wiring.
// T-007: ManualFlagButton (🚩) added (REQ-ENTERPRISE-028). The existing
// "전문가 검토" button is preserved for backward compatibility with REQ-FND-020.
// Issue 158 Group C: Added expert-review link (gated by role).

// T-007 — [BEGIN T-007 addition REQ-ENTERPRISE-028]
import TopbarClient from './TopbarClient';
// T-007 — [END T-007 addition]

export default async function Topbar() {
  let userInitial = 'U';
  let showExpertReview = false;
  try {
    const { auth } = await import('@/lib/kernel/auth');
    const { hasRole } = await import('@/lib/kernel/auth/rbac');
    const session = await auth();
    const name = (session?.user as { name?: string } | undefined)?.name ?? '';
    userInitial = name.charAt(0).toUpperCase() || 'U';
    const userRole = (session?.user as { role?: string } | undefined)?.role;
    if (userRole) {
      showExpertReview = hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-lead');
    }
  } catch {
    // Non-critical in test/build environments
  }

  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between border-b border-ink-100 bg-surface px-4"
      aria-label="상단 바"
    >
      <nav aria-label="이동 경로" className="min-w-0 truncate text-sm text-ink-600">
        {/* Breadcrumb placeholder; populated by route-level metadata in Phase 2. */}
      </nav>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="테마 전환"
          className="rounded-md border border-ink-200 px-2 py-1.5 text-xs text-ink-700 hover:bg-ink-50"
        >
          ☾
        </button>
        {/* Issue 158 Group C: Expert-review link (gated by role) */}
        {showExpertReview && (
          <a
            href="/expert-review"
            className="rounded-md border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
            aria-label="전문가 검토 대시보드로 이동"
          >
            전문가 검토
          </a>
        )}
        {/* T-007: Manual flag button for expert review (REQ-ENTERPRISE-028) */}
        <TopbarClient />
        {/* User avatar indicator — data-testid required by auth E2E spec */}
        <div
          data-testid="user-avatar"
          aria-label="사용자 프로필"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-800 text-xs font-semibold text-white"
        >
          {userInitial}
        </div>
      </div>
    </header>
  );
}
