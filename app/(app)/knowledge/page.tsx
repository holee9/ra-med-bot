// @MX:NOTE [AUTO] Knowledge base page — switched from hard-coded corpus list to dynamic API-backed view.
// @MX:SPEC SPEC-REGULA-RELEASE-HARDENING-001 (TASK-002)
// @MX:SPEC Issue #199 (Hybrid RA sync status section added)

import { headers } from 'next/headers';
import { Suspense } from 'react';
import { HybridSyncStatus } from '@/components/knowledge/HybridSyncStatus';

export const dynamic = 'force-dynamic';

interface CorpusRow {
  corpus: string;
  documentCount: number;
  sectionCount: number;
  lastUpdated: string | null;
}

// Mapping of corpus labels (from sources.org_label) to a display group used by the UI.
// Corpora not listed here fall through to "기타".
const CORPUS_GROUPS: Record<string, string> = {
  FDA: '공식 규제 기관',
  'EU MDR': '공식 규제 기관',
  MFDS: '공식 규제 기관',
  NMPA: '공식 규제 기관',
  PMDA: '공식 규제 기관',
  'ISO 13485': '국제 표준',
  'IEC 62304': '국제 표준',
  'ISO 14971': '국제 표준',
  'Internal SOPs': '사내 지식',
  'MD-process': '사내 지식',
  'ra-project': '사내 지식',
};

const KNOWLEDGE_BOUNDARIES = [
  {
    source: 'GitHub ra-project',
    mode: 'read-only',
    owner: 'upstream knowledge project',
    issueRoute: '운영 중 발견된 누락·충돌은 원 소유 레포 이슈로 회수',
  },
  {
    source: 'GitHub MD-process',
    mode: 'read-only',
    owner: 'upstream process project',
    issueRoute: '프로세스 문서 변경 요구는 원 소유 레포 이슈로 회수',
  },
  {
    source: 'Gitea ra-llm-wiki',
    mode: 'read-only',
    owner: 'upstream wiki project',
    issueRoute: '위키 품질·범위 이슈는 원 소유 레포 이슈로 회수',
  },
  {
    source: 'SaaS RA backend',
    mode: 'integration target',
    owner: 'external backend project',
    issueRoute: 'API 계약·인증·동기화 문제는 연동 이슈로 분리 추적',
  },
];

async function fetchCorpora(): Promise<CorpusRow[]> {
  // Same-origin server-side fetch — forward auth/cookies via inbound headers.
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const cookie = h.get('cookie') ?? '';

  const res = await fetch(`${proto}://${host}/api/ra/sources`, {
    headers: { cookie },
    cache: 'no-store',
  });

  if (!res.ok) {
    return [];
  }
  const body = (await res.json()) as { corpora?: CorpusRow[] };
  return body.corpora ?? [];
}

function groupCorpora(rows: CorpusRow[]): Array<{ title: string; sources: CorpusRow[] }> {
  const buckets = new Map<string, CorpusRow[]>();
  for (const row of rows) {
    const group = CORPUS_GROUPS[row.corpus] ?? '기타';
    if (!buckets.has(group)) buckets.set(group, []);
    buckets.get(group)?.push(row);
  }
  // Stable display order with known groups first.
  const order = ['공식 규제 기관', '국제 표준', '사내 지식', '기타'];
  return order
    .filter((title) => buckets.has(title))
    .map((title) => ({ title, sources: buckets.get(title) ?? [] }));
}

async function CorpusGrid() {
  const rows = await fetchCorpora();
  const groups = groupCorpora(rows);

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-ink-150 bg-surface p-6 text-sm text-ink-600">
        등록된 지식 베이스 출처가 없습니다.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {groups.map((group) => (
        <section key={group.title} className="rounded-lg border border-ink-150 bg-surface p-4">
          <h2 className="font-serif text-lg text-ink-900">{group.title}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {group.sources.map((source) => (
              <li
                key={source.corpus}
                className="flex flex-col gap-0.5 rounded-md bg-ink-50 px-3 py-2 text-sm text-ink-700"
              >
                <span className="font-medium">{source.corpus}</span>
                <span className="text-xs text-ink-500">
                  문서 {source.documentCount} · 섹션 {source.sectionCount}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function CorpusGridFallback() {
  return (
    <div className="grid gap-3 md:grid-cols-3" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-32 rounded-lg border border-ink-150 bg-surface p-4"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <section className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="font-serif text-3xl text-brand-800">지식 베이스</h1>
        <p className="mt-2 text-sm text-ink-600">
          Regula가 답변 근거로 사용하는 규제 문서와 사내 지식 범위를 확인합니다.
        </p>
      </header>

      <section className="rounded-lg border border-ink-150 bg-ink-50 p-4">
        <h2 className="text-sm font-semibold text-ink-900">연계 지식 경계</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          외부 지식 프로젝트는 이 저장소에서 훼손하지 않고 읽기 전용으로 참조합니다. 운영 중
          발견되는 누락, 충돌, 품질 문제는 각 소유 프로젝트 이슈로 회수해 함께 개선합니다.
        </p>
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {KNOWLEDGE_BOUNDARIES.map((item) => (
            <div key={item.source} className="rounded-md border border-ink-150 bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-ink-900">{item.source}</span>
                <span className="rounded-md bg-brand-50 px-2 py-1 text-xs text-brand-700">
                  {item.mode}
                </span>
              </div>
              <p className="mt-2 text-xs text-ink-500">{item.owner}</p>
              <p className="mt-1 text-sm text-ink-700">{item.issueRoute}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-900">Hybrid RA 동기화 상태</h2>
        <HybridSyncStatus />
      </section>

      <Suspense fallback={<CorpusGridFallback />}>
        <CorpusGrid />
      </Suspense>
    </section>
  );
}
