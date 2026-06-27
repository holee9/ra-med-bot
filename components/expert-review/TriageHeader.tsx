// @MX:NOTE [AUTO] Triage/SLA/Readiness Header — Expert Review queue status.
// Shows triage queue state, SLA status, reviewer readiness.
// @MX:SPEC Issue #158 (Group B3 - Expert Review triage/SLA/readiness header)

interface TriageStats {
  pending: number;
  inProgress: number;
  overdue: number;
}

interface TriageHeaderProps {
  stats: TriageStats;
  reviewerReady: boolean;
}

function SLABadge({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700">
        <span className="h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden="true" />
        SLA 준수
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
      SLA 위반 {count}건
    </span>
  );
}

export function TriageHeader({ stats, reviewerReady }: TriageHeaderProps) {
  return (
    <section className="mb-6 rounded-lg border border-ink-150 bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-lg text-ink-900">검토 대기열 상태</h2>
        <div className="flex items-center gap-2">
          <SLABadge count={stats.overdue} />
          {reviewerReady ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700">
              <span className="h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden="true" />
              검토자 준비
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
              검토자 대기 중
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md bg-ink-50 px-3 py-2">
          <p className="text-xs text-ink-500">대기 중</p>
          <p className="mt-1 font-serif text-2xl text-ink-900">{stats.pending}</p>
        </div>
        <div className="rounded-md bg-ink-50 px-3 py-2">
          <p className="text-xs text-ink-500">진행 중</p>
          <p className="mt-1 font-serif text-2xl text-ink-900">{stats.inProgress}</p>
        </div>
        <div className="rounded-md bg-ink-50 px-3 py-2">
          <p className="text-xs text-ink-500">기한 초과</p>
          <p className="mt-1 font-serif text-2xl text-danger-700">{stats.overdue}</p>
        </div>
      </div>
    </section>
  );
}
