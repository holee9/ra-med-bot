// @MX:NOTE [AUTO] Traceability matrix page — per-project evidence matrix.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-004, REQ-005, REQ-006, REQ-012)
//
// Architecture: Server Component by default (calls the shared `buildMatrix` +
// `listStaleNodeIds` helpers directly — no self-fetch, mirrors the
// knowledge-gap page pattern). Filters are read from searchParams and drive
// a URL-navigation-based client island (MatrixFilters). Role gating:
// matrix is visible to ra-member+; edge manage controls are passed a boolean
// and hidden entirely for non-ra-lead (never show a button that 403s on click).

import MatrixFilters from '@/components/traceability/MatrixFilters';
import { auth } from '@/lib/auth';
import { type Role, hasRole } from '@/lib/auth/rbac';
import { db } from '@/lib/db/client';
import type { MatrixGapKind, MatrixResult } from '@/lib/traceability/client';
import { buildMatrix } from '@/lib/traceability/matrix';
import { listStaleNodeIds } from '@/lib/traceability/stale-propagation';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '추적 매트릭스 | Regula',
  robots: { index: false, follow: false },
};

type SearchParams = {
  projectId?: string;
  jurisdiction?: string;
  product?: string;
  packageId?: string;
  riskLevel?: string;
  stale?: string;
};

function pick<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

const RISK_LEVELS = ['acceptable', 'alarp', 'unacceptable', 'unacc'] as const;
const STALE_MODES = ['only', 'exclude'] as const;

const NODE_TYPE_LABELS: Record<string, string> = {
  message: '상담 답변',
  workflow_run: '워크플로우 산출물',
  risk_item: '위험 항목',
  source_section: '규제 출처',
  citation: '인용',
  expert_review: '전문가 검토',
  submission_package: '제출 패키지',
};

const GAP_LABELS: Record<MatrixGapKind, string> = {
  missing_citation: '출처 누락',
  stale_source: 'stale 출처',
  unresolved_review: '검토 미완료',
};

/**
 * REQ-TRACEABILITY-006: every gap + stale flag has BOTH an icon and text
 * (color is never the only signal — WCAG 2.1 AA).
 */
function GapBadge({ kind }: { kind: MatrixGapKind }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded bg-warn-bg px-1.5 py-0.5 text-[11px] font-medium text-warn"
      data-testid={`gap-${kind}`}
    >
      <span aria-hidden="true">⚠</span>
      {GAP_LABELS[kind]}
    </span>
  );
}

function StaleBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded bg-warn-bg px-1.5 py-0.5 text-[11px] font-medium text-warn"
      data-testid="stale-badge"
    >
      <span aria-hidden="true">⌛</span>
      stale
    </span>
  );
}

export default async function TraceabilityMatrixPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

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

  const canView = role ? hasRole(role, 'ra-member') : false;
  const canManage = role ? hasRole(role, 'ra-lead') : false;

  let result: MatrixResult = { rows: [], summary: { totalRows: 0, withGaps: 0, stale: 0 } };
  if (canView && orgId) {
    const staleNodeIds = await listStaleNodeIds(db, orgId);
    result = await buildMatrix(
      db,
      {
        orgId,
        projectId: sp.projectId,
        jurisdiction: sp.jurisdiction,
        product: sp.product,
        packageId: sp.packageId,
        riskLevel: pick(sp.riskLevel, RISK_LEVELS),
        stale: pick(sp.stale, STALE_MODES),
      },
      { staleNodeIds },
    );
  }

  return (
    <section className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="font-serif text-3xl text-brand-800">추적 매트릭스</h1>
        <p className="mt-2 text-sm text-ink-600">
          요구사항·위험·제출 섹션이 어떤 근거 출처에 연결되어 있는지 한눈에 추적합니다. stale 출처와
          출처 누락이 플래그됩니다. 모든 조회는 audit_logs에 기록됩니다.
        </p>
      </header>

      {!canView ? (
        <p className="rounded-lg border border-ink-150 bg-surface p-4 text-sm text-ink-500">
          이 페이지를 볼 권한이 없습니다.
        </p>
      ) : (
        <>
          <MatrixFilters />

          <p className="text-xs text-ink-500" data-testid="matrix-summary">
            총 {result.summary.totalRows}행 · 출처 누락/검토 미완료 {result.summary.withGaps}행 ·
            stale {result.summary.stale}행
          </p>

          {result.rows.length === 0 ? (
            <p
              className="rounded-lg border border-ink-150 bg-surface p-4 text-sm text-ink-500"
              data-testid="matrix-empty"
            >
              조건을 만족하는 산출물이 없습니다. 프로젝트를 선택하거나 필터를 조정하세요.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-ink-150">
              <table className="min-w-full text-sm">
                <caption className="sr-only">추적 매트릭스 — 산출물 × 근거/답변/검토/제출</caption>
                <thead className="bg-ink-50 text-left text-xs uppercase text-ink-600">
                  <tr>
                    <th scope="col" className="px-3 py-2">
                      산출물
                    </th>
                    <th scope="col" className="px-3 py-2">
                      유형
                    </th>
                    <th scope="col" className="px-3 py-2">
                      근거 출처
                    </th>
                    <th scope="col" className="px-3 py-2">
                      답변 상태
                    </th>
                    <th scope="col" className="px-3 py-2">
                      검토 상태
                    </th>
                    <th scope="col" className="px-3 py-2">
                      제출 패키지
                    </th>
                    <th scope="col" className="px-3 py-2">
                      갭 / stale
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr
                      key={`${row.nodeType}:${row.refId}`}
                      className="border-t border-ink-100 align-top"
                    >
                      <td className="px-3 py-2 text-xs">
                        <Link
                          href={`/traceability/${encodeURIComponent(row.refId)}`}
                          className="font-medium text-brand-700 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                          data-testid={`matrix-row-${row.refId}`}
                        >
                          {row.label}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-ink-600">
                        {NODE_TYPE_LABELS[row.nodeType] ?? row.nodeType}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {row.evidence.length === 0 ? (
                          <span className="text-ink-400">—</span>
                        ) : (
                          <ul
                            className="flex flex-col gap-0.5"
                            data-testid={`matrix-evidence-${row.refId}`}
                          >
                            {row.evidence.map((e, i) => (
                              <li key={`${e.nodeType}:${i}`} className="text-ink-700">
                                {e.authority ?? e.nodeType}
                                {e.version ? ` v${e.version}` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">{row.answer.status}</td>
                      <td className="px-3 py-2 text-xs">{row.reviewer.status}</td>
                      <td className="px-3 py-2 text-xs">
                        {row.exportMeta.submissionPackageId ? (
                          <span className="font-mono text-ink-600">
                            {row.exportMeta.submissionPackageId.slice(0, 8)}
                            {row.exportMeta.version ? ` (v${row.exportMeta.version})` : ''}
                          </span>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="flex flex-col gap-1">
                          {row.stale && <StaleBadge />}
                          {row.gaps.length === 0 && !row.stale && (
                            <span className="text-ink-400">—</span>
                          )}
                          {row.gaps.map((g) => (
                            <GapBadge key={g} kind={g} />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canManage && (
            <p className="text-xs text-ink-400">
              근거 연결 관리는 산출물 상세 페이지의 “근거 연결” 패널에서 가능합니다 (ra-lead 전용).
            </p>
          )}
        </>
      )}
    </section>
  );
}
