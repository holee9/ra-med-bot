// @MX:NOTE [AUTO] Issue Routing Indicator — shows ops loop indicator for owning-project routing.
// Surfaces 157 (owning-project issue routing) status honestly.
// @MX:SPEC Issue #158 (Group B2 - Knowledge ops loop indicator 157)

interface RoutingIndicatorProps {
  status: 'ready' | 'pending' | 'manual';
}

function RoutingIndicator({ status }: RoutingIndicatorProps) {
  const statusStyles = {
    ready: 'text-success-700 bg-success-50 border-success-200',
    pending: 'text-amber-700 bg-amber-50 border-amber-200',
    manual: 'text-ink-600 bg-ink-50 border-ink-200',
  };

  const statusLabels = {
    ready: '자동 라우팅',
    pending: '자동 라우팅 대기 중',
    manual: '수동 라우팅',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

export function IssueRoutingIndicator() {
  return (
    <section className="rounded-lg border border-ink-150 bg-surface p-4">
      <h2 className="mb-3 font-serif text-lg text-ink-900">이슈 라우팅 상태</h2>
      <p className="mb-4 text-sm text-ink-600">
        지식 베이스 운영 중 발견되는 누락, 충돌, 품질 문제를 각 소유 프로젝트로 자동 라우팅합니다.
      </p>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-md bg-ink-50 px-3 py-2 text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-ink-900">GitHub ra-project</span>
            <span className="text-xs text-ink-500">upstream knowledge project</span>
          </div>
          <RoutingIndicator status="pending" />
        </div>

        <div className="flex items-center justify-between rounded-md bg-ink-50 px-3 py-2 text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-ink-900">GitHub MD-process</span>
            <span className="text-xs text-ink-500">upstream process project</span>
          </div>
          <RoutingIndicator status="pending" />
        </div>

        <div className="flex items-center justify-between rounded-md bg-ink-50 px-3 py-2 text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-ink-900">Gitea ra-llm-wiki</span>
            <span className="text-xs text-ink-500">upstream wiki project</span>
          </div>
          <RoutingIndicator status="pending" />
        </div>
      </div>

      <div className="mt-4 text-xs text-ink-500">
        <a
          href="https://github.com/abyz-lab/ra-med-bot/issues/157"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-700 hover:underline"
        >
          자동화 구현 이슈 (157) 보기 →
        </a>
      </div>
    </section>
  );
}
