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
