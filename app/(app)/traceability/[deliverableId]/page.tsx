// @MX:NOTE [AUTO] Evidence packet view — tree + issues + export.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-006, REQ-007, REQ-008, REQ-010)
//
// Server Component: fetches the packet via the shared `getEvidencePacket` helper
// (no self-fetch). The export buttons + edge manage controls are client islands.
// REQ-006: surfaces missing citations, stale sources, and unresolved reviews with
// BOTH icon and text (WCAG 2.1 AA — color is never the only signal).

import { EdgeManage } from '@/components/traceability/EdgeManage';
import { PacketExport } from '@/components/traceability/PacketExport';
import { auth } from '@/lib/kernel/auth';
import { type Role, hasRole } from '@/lib/kernel/auth/rbac';
import { db } from '@/lib/kernel/db/client';
import type {
  EvidencePacket,
  EvidencePacketNode,
  PacketIssueKind,
} from '@/lib/traceability/client';
import { getEvidencePacket } from '@/lib/traceability/evidence-packet';
import { listStaleNodeIds } from '@/lib/traceability/stale-propagation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: '근거 패킷 | Regula',
  robots: { index: false, follow: false },
};

const ISSUE_LABELS: Record<PacketIssueKind, string> = {
  missing_citation: '출처 누락',
  stale_source: 'stale 출처',
  unresolved_review: '검토 미완료',
};

const RELATION_LABELS: Record<string, string> = {
  root: '산출물',
  derived_from: '도출됨',
  cites: '인용',
  reviewed_by: '검토됨',
  exported_in: '내보내기됨',
  mitigates: '완화함',
  satisfies: '충족함',
};

function PacketTreeNode({ node, depth }: { node: EvidencePacketNode; depth: number }) {
  const isRoot = node.relation === 'root';
  return (
    <li role="treeitem" aria-expanded={node.children.length > 0 ? 'true' : undefined}>
      <div
        className="flex flex-wrap items-center gap-2 py-1"
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        <span className="text-xs font-medium text-ink-700">
          {isRoot ? '' : `${RELATION_LABELS[node.relation] ?? node.relation} → `}
          <span className="font-mono text-[11px] text-ink-500">{node.nodeType}</span>
        </span>
        <span className="text-xs text-ink-600">
          {node.authority ?? node.refTable}:{node.refId.slice(0, 8)}
          {node.version ? ` v${node.version}` : ''}
        </span>
        {node.stale && (
          <span
            className="inline-flex items-center gap-1 rounded bg-warn-bg px-1.5 py-0.5 text-[11px] font-medium text-warn"
            data-testid={`packet-stale-${node.id}`}
          >
            <span aria-hidden="true">⌛</span> stale
          </span>
        )}
        {node.artifactHash && (
          <span className="font-mono text-[10px] text-ink-400">
            sha256:{node.artifactHash.slice(0, 12)}
          </span>
        )}
      </div>
      {node.children.length > 0 && (
        // biome-ignore lint/a11y/useSemanticElements: <ul role="group"> is the WAI-ARIA tree pattern (role="tree" parent); <fieldset> would be semantically wrong here.
        <ul role="group">
          {node.children.map((child) => (
            <PacketTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default async function EvidencePacketPage({
  params,
}: {
  params: Promise<{ deliverableId: string }>;
}) {
  const { deliverableId } = await params;

  let role: Role | undefined;
  let orgId: string | undefined;
  try {
    const session = await auth();
    const user = session?.user as { role?: string; organizationId?: string } | undefined;
    role = user?.role as Role | undefined;
    orgId = user?.organizationId;
  } catch {
    // auth() throws in test/build environments.
  }

  const canView = role ? hasRole(role, 'ra-member') : false;
  const canManage = role ? hasRole(role, 'ra-lead') : false;

  if (!canView || !orgId) {
    return (
      <section className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8">
        <p className="rounded-lg border border-ink-150 bg-surface p-4 text-sm text-ink-500">
          이 페이지를 볼 권한이 없습니다.
        </p>
      </section>
    );
  }

  const staleNodeIds = await listStaleNodeIds(db, orgId);
  const packet = (await getEvidencePacket(db, {
    orgId,
    deliverableId,
    staleNodeIds,
  })) as EvidencePacket | null;
  if (!packet) {
    notFound();
  }

  return (
    <section className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8">
      <header>
        <p className="text-xs text-ink-500">
          <Link
            href="/traceability"
            className="hover:underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            ← 추적 매트릭스
          </Link>
        </p>
        <h1 className="mt-2 font-serif text-3xl text-brand-800">근거 패킷</h1>
        <p className="mt-2 text-sm text-ink-600">
          {packet.deliverable.nodeType} · {packet.deliverable.refTable}:{packet.deliverable.refId}
        </p>
      </header>

      {/* REQ-008: export buttons (client island triggers browser download). */}
      <PacketExport deliverableId={deliverableId} />

      {/* REQ-006: issues surfaced with icon + text (color is not the only signal). */}
      <section
        aria-labelledby="issues-heading"
        className="rounded-lg border border-ink-150 bg-surface p-4"
      >
        <h2 id="issues-heading" className="text-sm font-medium text-ink-700">
          이슈 ({packet.issues.length})
        </h2>
        {packet.issues.length === 0 ? (
          <p className="mt-2 text-xs text-success" data-testid="packet-no-issues">
            ✓ 알려진 이슈가 없습니다.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1" data-testid="packet-issues">
            {packet.issues.map((issue, i) => (
              <li
                key={`${issue.kind}:${i}`}
                className="flex items-center gap-2 text-xs text-warn"
                data-testid={`packet-issue-${issue.kind}`}
              >
                <span aria-hidden="true">⚠</span>
                <span className="font-medium">{ISSUE_LABELS[issue.kind]}</span>
                <span className="text-ink-500">— {issue.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* REQ-007: evidence packet tree. */}
      <section
        aria-labelledby="tree-heading"
        className="rounded-lg border border-ink-150 bg-surface p-4"
      >
        <h2 id="tree-heading" className="text-sm font-medium text-ink-700">
          근거 트리
        </h2>
        <ul role="tree" aria-label="근거 패킷 트리" className="mt-2">
          <PacketTreeNode node={packet.deliverable} depth={0} />
        </ul>
      </section>

      {/* REQ-001/010: edge manage (ra-lead only — EdgeManage returns null for non-ra-lead). */}
      <EdgeManage fromNodeId={deliverableId} canManage={canManage} />
    </section>
  );
}
