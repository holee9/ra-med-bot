// @MX:NOTE [AUTO] Knowledge Gap queue page — RA classification + replay workflow.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-008, REQ-009, REQ-014, REQ-015, AC-04, AC-06, Issue #35)
//
// Architecture: Server Component by default (reads the queue directly from the DB
// via the shared `listQueueItems` helper — no self-fetch). Role-gating for the
// classify/replay actions is resolved here from `auth()` + `hasRole` and passed
// as booleans to the `QueueActions` client island. Filters (status/reason/
// classification) are read from searchParams; a small client island drives the
// <select> changes via URL navigation so the list stays SSR-friendly.

import { QueueActions } from '@/components/knowledge-gap/QueueActions';
import QueueFilters from '@/components/knowledge-gap/QueueFilters';
import { auth } from '@/lib/kernel/auth';
import { type Role, hasRole } from '@/lib/kernel/auth/rbac';
import { listQueueItems } from '@/lib/knowledge-gap/queue-query';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '미답변 큐 | Regula',
  robots: { index: false, follow: false },
};

type SearchParams = {
  status?: string;
  reason?: string;
  classification?: string;
  page?: string;
};

const STATUS_LABELS: Record<string, string> = {
  open: '미처리',
  classified: '분류됨',
  resolved: '해결됨',
};
const REASON_LABELS: Record<string, string> = {
  low_confidence: '신뢰도 낮음',
  low_citation: '출처 부족',
  no_results: '검색 결과 없음',
  policy_blocked: '정책상 차단',
};
const CLASSIFICATION_LABELS: Record<string, string> = {
  ra_project_gap: 'RA 프로젝트 지식 누락',
  md_process_gap: 'MD-process SOP 누락',
  external_regulation_needed: '외부 규제 원문 필요',
  bug: '제품 버그',
};

function pick<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

const STATUSES = ['open', 'classified', 'resolved'] as const;
const REASONS = ['low_confidence', 'low_citation', 'no_results', 'policy_blocked'] as const;
const CLASSIFICATIONS = [
  'ra_project_gap',
  'md_process_gap',
  'external_regulation_needed',
  'bug',
] as const;

export default async function KnowledgeGapPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? '1') || 1;

  // Resolve role server-side; defaults to least-privileged when auth is
  // unavailable (build / test environments).
  let role: Role | undefined;
  let orgId: string | undefined;
  try {
    const session = await auth();
    const user = session?.user as { role?: string; organizationId?: string } | undefined;
    role = user?.role as Role | undefined;
    orgId = user?.organizationId;
  } catch {
    // auth() throws in test/build environments — fall through with no perms.
  }

  const canClassify = role ? hasRole(role, 'ra-lead') : false;
  const canReplay = role ? hasRole(role, 'ra-lead') : false;
  const canView = role ? hasRole(role, 'ra-member') : false;

  const items = canView
    ? await listQueueItems({
        orgId,
        status: pick(sp.status, STATUSES),
        reason: pick(sp.reason, REASONS),
        classification: pick(sp.classification, CLASSIFICATIONS),
        page,
      })
    : [];

  return (
    <section className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="font-serif text-3xl text-brand-800">미답변 큐</h1>
        <p className="mt-2 text-sm text-ink-600">
          답변하지 못한 질문을 추적하고 분류하여 지식베이스를 보강합니다. 모든 접근은 audit_logs에
          기록됩니다.
        </p>
      </header>

      {!canView ? (
        <p className="rounded-lg border border-ink-150 bg-surface p-4 text-sm text-ink-500">
          이 페이지를 볼 권한이 없습니다.
        </p>
      ) : (
        <>
          <QueueFilters />

          <div className="overflow-x-auto rounded-lg border border-ink-150">
            <table className="min-w-full text-sm">
              <caption className="sr-only">미답변 큐 항목 목록</caption>
              <thead className="bg-ink-50 text-left text-xs uppercase text-ink-600">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    질문 (PII 제거됨)
                  </th>
                  <th scope="col" className="px-3 py-2">
                    원인
                  </th>
                  <th scope="col" className="px-3 py-2">
                    상태
                  </th>
                  <th scope="col" className="px-3 py-2">
                    분류
                  </th>
                  <th scope="col" className="px-3 py-2">
                    클러스터
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Issue
                  </th>
                  <th scope="col" className="px-3 py-2">
                    생성
                  </th>
                  <th scope="col" className="px-3 py-2">
                    분류 / 재실행
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-6 text-center text-ink-500"
                      data-testid="queue-empty"
                    >
                      조건을 만족하는 미답변 항목이 없습니다.
                    </td>
                  </tr>
                )}
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-ink-100 align-top">
                    <td className="max-w-md px-3 py-2 text-xs text-ink-800">
                      <span data-testid="queue-question">{item.redactedQuestion}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {REASON_LABELS[item.gapReason] ?? item.gapReason}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className="rounded bg-ink-50 px-2 py-0.5"
                        data-testid={`queue-status-${item.id}`}
                      >
                        {STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </td>
                    <td
                      className="px-3 py-2 text-xs"
                      data-testid={`queue-classification-${item.id}`}
                    >
                      {item.classification
                        ? (CLASSIFICATION_LABELS[item.classification] ?? item.classification)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-ink-500">
                      {item.clusterId ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {item.githubIssueNumber ? (
                        <span className="font-mono">#{item.githubIssueNumber}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-500">
                      {new Date(item.createdAt).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-3 py-2">
                      <QueueActions
                        queueId={item.id}
                        currentClassification={item.classification}
                        canClassify={canClassify}
                        canReplay={canReplay}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-ink-400">페이지 {page}</p>
        </>
      )}
    </section>
  );
}
