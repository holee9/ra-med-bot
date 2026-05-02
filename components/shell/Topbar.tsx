// @MX:NOTE Topbar — REQ-FND-020. 56px-tall bar with breadcrumb slot, theme
// toggle, and "전문가 검토" entry point. All controls are placeholders pending
// Phase 2 wiring.

export default function Topbar() {
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
        <button
          type="button"
          className="rounded-md border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
        >
          전문가 검토
        </button>
      </div>
    </header>
  );
}
