// @MX:NOTE [AUTO] VigilancePage — Post-Market Surveillance adverse event report workflow.
// Server component: static framing wraps the interactive VigilanceForm client component.
// @MX:SPEC SPEC-REGULA-VIGILANCE-001

import { BetaBadge } from '@/components/ui/BetaBadge';
import { MockDataDisclosure } from '@/components/ui/MockDataDisclosure';
import { VigilanceForm } from './_components/VigilanceForm';

const REPORT_TYPES: ReadonlyArray<{
  id: string;
  label: string;
  deadline: string;
  regulation: string;
}> = [
  {
    id: 'fda_mdr',
    label: 'FDA MDR (3500A)',
    deadline: '30-day / 5-day',
    regulation: '21 CFR Part 803',
  },
  {
    id: 'eu_mdv',
    label: 'EU MDV Initial Report',
    deadline: '2-day / 15-day / 30-day',
    regulation: 'EU MDR Article 87',
  },
  {
    id: 'fsca',
    label: 'FSCA Notice',
    deadline: 'As required',
    regulation: 'EU MDR Article 88 / FDA 21 CFR 806',
  },
];

export default function VigilancePage() {
  return (
    <section className="mx-auto flex max-w-content flex-col gap-6">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-3xl text-brand-800">유해사례 보고서 초안기</h1>
          <BetaBadge />
        </div>
        <p className="mt-2 text-sm text-ink-600">
          FDA MDR (21 CFR Part 803) · EU MDV (Article 87) · FSCA 포스트마켓 감시 보고서 자동 초안
        </p>
      </header>

      <MockDataDisclosure />

      <VigilanceForm />

      <div className="rounded-lg border border-ink-200 bg-surface p-5">
        <h2 className="font-serif text-lg text-ink-900">지원 보고서 유형</h2>
        <p className="mt-1 text-sm text-ink-600">
          유해사례 정보를 입력하면 해당 규정에 따라 필요한 보고서 초안을 자동으로 생성합니다.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {REPORT_TYPES.map((rt) => (
            <li key={rt.id} className="rounded-md border border-ink-200 bg-white p-3">
              <p className="text-sm font-medium text-ink-900">{rt.label}</p>
              <p className="mt-1 text-xs text-ink-500">기한: {rt.deadline}</p>
              <p className="mt-0.5 text-xs text-ink-400">{rt.regulation}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
