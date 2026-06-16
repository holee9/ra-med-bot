import { BookOpenCheck, ClipboardCheck, DatabaseZap, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

const quickCards = [
  {
    title: '새 규제 상담',
    description: '근거 문서와 citation이 포함된 RA 답변을 생성합니다.',
    href: '/chat',
  },
  {
    title: '전문가 검토',
    description: '저신뢰 또는 고위험 답변을 RA 리드가 검토합니다.',
    href: '/expert-review',
  },
  {
    title: '템플릿',
    description: '반복 제출 문서와 체크리스트를 빠르게 확인합니다.',
    href: '/templates',
  },
  {
    title: '규제 업데이트',
    description: 'FDA, EU MDR, MFDS 등 주요 변경사항을 확인합니다.',
    href: '/updates',
  },
];

const personaLanes = [
  {
    role: 'RA 실무자',
    outcome: '질문을 근거 문서와 함께 빠르게 정리',
    href: '/chat',
    icon: BookOpenCheck,
  },
  {
    role: 'RA Lead',
    outcome: '저신뢰·고위험 답변을 검토 큐에서 승인',
    href: '/expert-review',
    icon: ClipboardCheck,
  },
  {
    role: '지식 관리자',
    outcome: '읽기 전용 외부 지식과 내부 문서 범위를 확인',
    href: '/knowledge',
    icon: DatabaseZap,
  },
  {
    role: '시스템 관리자',
    outcome: '업로드·RBAC·redaction 경계를 운영 상태로 확인',
    href: '/admin/documents',
    icon: ShieldCheck,
  },
];

const trustSignals = ['근거 citation', '전문가 검토', '조직별 source 경계', '업로드 PII redaction'];

export default function HomePage() {
  return (
    <section className="mx-auto flex max-w-content flex-col gap-8 px-6 py-10">
      <header>
        <p className="text-xs font-medium uppercase tracking-widest text-ink-500">Regula</p>
        <h1 className="mt-2 font-serif text-4xl text-brand-800">의료기기 RA 상담 워크스페이스</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-600">
          규제 질문, 근거 문서, 구조화 답변, 전문가 검토, 감사 로그를 한 흐름에서 관리합니다.
        </p>
      </header>

      <section className="grid gap-3 lg:grid-cols-4" aria-label="역할별 시작점">
        {personaLanes.map((lane) => {
          const Icon = lane.icon;
          return (
            <Link
              key={lane.role}
              href={lane.href}
              className="rounded-lg border border-ink-150 bg-surface p-4 transition-colors hover:border-brand-200 hover:bg-brand-50"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-brand-700">
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{lane.role}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-700">{lane.outcome}</p>
            </Link>
          );
        })}
      </section>

      <section className="rounded-lg border border-ink-150 bg-ink-50 p-4" aria-label="신뢰 상태">
        <h2 className="text-sm font-semibold text-ink-900">실사용 신뢰 기준</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {trustSignals.map((signal) => (
            <div
              key={signal}
              className="rounded-md border border-ink-150 bg-surface px-3 py-2 text-sm text-ink-700"
            >
              {signal}
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        {quickCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-lg border border-ink-150 bg-surface p-4 transition-colors hover:border-brand-200 hover:bg-brand-50"
          >
            <h2 className="font-serif text-lg text-ink-900">{card.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">{card.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
