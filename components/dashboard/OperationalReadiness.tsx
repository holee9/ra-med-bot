// @MX:NOTE [AUTO] Operational Readiness Section — Dashboard operational status.
// Surfaces blockers/pending states from #149, #152, #153, #156, #157 honestly.
// @MX:SPEC Issue #158 (Group B1 - Dashboard readiness)

import { Callout } from '@/components/ui/Callout';
import { ReadinessBadge } from '@/components/ui/ReadinessBadge';

interface ReadinessItem {
  id: string;
  title: string;
  status: 'ready' | 'pending' | 'blocked';
  description: string;
  issueLink?: string;
}

const READINESS_ITEMS: ReadinessItem[] = [
  {
    id: 'quality-gate',
    title: '품질 게이트 복구',
    status: 'blocked',
    description: '프로덕션 준비를 위한 주요 품질 게이트 복구 작업이 필요합니다.',
    issueLink: 'https://github.com/abyz-lab/ra-med-bot/issues/149',
  },
  {
    id: 'workflow-demo',
    title: '워크플로우 디모킹',
    status: 'pending',
    description: '실제 운영 데이터를 사용하는 워크플로우로 전환 작업이 진행 중입니다.',
    issueLink: 'https://github.com/abyz-lab/ra-med-bot/issues/152',
  },
  {
    id: 'ssot',
    title: '단일 진실 공급처(SSoT)',
    status: 'blocked',
    description: '데이터 일관성을 위한 단일 진실 공급처 구축이 차단되었습니다.',
    issueLink: 'https://github.com/abyz-lab/ra-med-bot/issues/153',
  },
  {
    id: 'hybrid-adapter',
    title: 'Hybrid RA SaaS 어댑터',
    status: 'pending',
    description: '타입 안전 어댑터와 계약 테스트 구현이 진행 중입니다.',
    issueLink: 'https://github.com/abyz-lab/ra-med-bot/issues/156',
  },
  {
    id: 'issue-routing',
    title: '소유 프로젝트 이슈 라우팅',
    status: 'pending',
    description: '연동 프로젝트 간 자동화된 이슈 라우팅 구현이 대기 중입니다.',
    issueLink: 'https://github.com/abyz-lab/ra-med-bot/issues/157',
  },
];

function ReadinessCard({ item }: { item: ReadinessItem }) {
  return (
    <div className="rounded-lg border border-ink-150 bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ink-900">{item.title}</h3>
        <ReadinessBadge status={item.status} />
      </div>
      <p className="mb-2 text-xs text-ink-600">{item.description}</p>
      {item.issueLink && (
        <a
          href={item.issueLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-brand-700 hover:underline"
        >
          관련 이슈 보기 →
        </a>
      )}
    </div>
  );
}

function ReadinessSummary() {
  const blockedCount = READINESS_ITEMS.filter((i) => i.status === 'blocked').length;
  const pendingCount = READINESS_ITEMS.filter((i) => i.status === 'pending').length;

  if (blockedCount > 0) {
    return (
      <Callout variant="danger" title="프로덕션 준비 차단 상태">
        <p>
          <strong>현재 {blockedCount}개의 차단</strong> 항목이 있어 프로덕션 준비가 되지 않았습니다.
          {pendingCount > 0 && ` 추가로 ${pendingCount}개의 대기 항목이 있습니다.`}
        </p>
      </Callout>
    );
  }

  if (pendingCount > 0) {
    return (
      <Callout variant="warn" title="운영 준비 진행 중">
        <p>
          현재 <strong>{pendingCount}개의 대기</strong> 항목이 해결되기를 기다리고 있습니다.
        </p>
      </Callout>
    );
  }

  return (
    <Callout variant="info" title="운영 준비 완료">
      <p>모든 주요 시스템이 정상 작동 중입니다.</p>
    </Callout>
  );
}

export function OperationalReadiness() {
  return (
    <section className="mx-auto max-w-content px-6 py-8">
      <div className="mb-6">
        <h2 className="font-serif text-xl text-brand-800">운영 준비 상태</h2>
        <p className="mt-2 text-sm text-ink-600">
          시스템의 주요 운영 준비 상태를 표시합니다. 차단 및 대기 항목은 프로덕션 준비에 영향을
          줍니다.
        </p>
      </div>

      <div className="mb-6">
        <ReadinessSummary />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {READINESS_ITEMS.map((item) => (
          <ReadinessCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
