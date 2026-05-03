const sourceGroups = [
  {
    title: '공식 규제 기관',
    sources: ['FDA', 'EU MDR', 'MFDS', 'NMPA', 'PMDA'],
  },
  {
    title: '국제 표준',
    sources: ['ISO 13485', 'IEC 62304', 'ISO 14971'],
  },
  {
    title: '사내 지식',
    sources: ['Internal SOPs', 'MD-process', 'ra-project'],
  },
];

export default function KnowledgePage() {
  return (
    <section className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="font-serif text-3xl text-brand-800">지식 베이스</h1>
        <p className="mt-2 text-sm text-ink-600">
          Regula가 답변 근거로 사용하는 규제 문서와 사내 지식 범위를 확인합니다.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        {sourceGroups.map((group) => (
          <section key={group.title} className="rounded-lg border border-ink-150 bg-surface p-4">
            <h2 className="font-serif text-lg text-ink-900">{group.title}</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {group.sources.map((source) => (
                <li key={source} className="rounded-md bg-ink-50 px-3 py-2 text-sm text-ink-700">
                  {source}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
