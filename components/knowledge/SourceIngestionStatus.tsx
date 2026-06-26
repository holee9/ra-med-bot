// @MX:NOTE [AUTO] Source Ingestion Status — shows ingestion totals and pending states.
// Surfaces #155 (Gitea ra-llm-wiki) and #156 (hybrid-ra-saas) pending status honestly.
// @MX:SPEC Issue #158 (Group B2 - Knowledge ingestion totals)

import { ReadinessBadge } from '@/components/ui/ReadinessBadge';

interface SourceStatusProps {
  source: string;
  status: 'ready' | 'pending' | 'blocked';
  documentCount?: number;
  issueLink?: string;
}

function SourceStatus({ source, status, documentCount, issueLink }: SourceStatusProps) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-ink-50 px-3 py-2 text-sm text-ink-700">
      <div className="flex items-center justify-between">
        <span className="font-medium">{source}</span>
        <ReadinessBadge status={status} />
      </div>
      <div className="flex items-center gap-2 text-xs text-ink-500">
        {documentCount !== undefined ? (
          <span>문서 {documentCount.toLocaleString()}개</span>
        ) : (
          <span>문서 수 불러오는 중...</span>
        )}
        {issueLink && (
          <a
            href={issueLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-700 hover:underline"
          >
            관련 이슈 →
          </a>
        )}
      </div>
    </div>
  );
}

export function SourceIngestionStatus() {
  return (
    <section className="rounded-lg border border-ink-150 bg-surface p-4">
      <h2 className="mb-3 font-serif text-lg text-ink-900">지식 베이스 연동 상태</h2>
      <p className="mb-4 text-sm text-ink-600">
        각 지식 출처의 동기화 상태와 문서 수량을 표시합니다. 대기 중인 항목은 백엔드 구현이 진행
        중입니다.
      </p>

      <div className="flex flex-col gap-2">
        <SourceStatus
          source="Gitea ra-llm-wiki"
          status="pending"
          issueLink="https://github.com/abyz-lab/ra-med-bot/issues/155"
        />
        <SourceStatus
          source="Hybrid RA SaaS"
          status="pending"
          issueLink="https://github.com/abyz-lab/ra-med-bot/issues/156"
        />
      </div>
    </section>
  );
}
