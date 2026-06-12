// @MX:NOTE [AUTO] CerPage — Clinical Evaluation Report workflow landing.
// Server component: static framing (header, MEDDEV stage tracker) wraps the
// interactive CerStartForm client component which drives the actual run.
// @MX:SPEC SPEC-REGULA-CER-001

import { BetaBadge } from '@/components/ui/BetaBadge';
import { MockDataDisclosure } from '@/components/ui/MockDataDisclosure';
import { CerStartForm } from './_components/CerStartForm';

// MEDDEV 2.7/1 Rev4 — the 10 clinical evaluation stages presented to the user.
const MEDDEV_STAGES: ReadonlyArray<{ id: number; title: string }> = [
  { id: 1, title: 'Scope definition' },
  { id: 2, title: 'Clinical evaluation plan' },
  { id: 3, title: 'Literature search & retrieval' },
  { id: 4, title: 'Literature appraisal (SIGN 50 / GRADE)' },
  { id: 5, title: 'Equivalence assessment (Article 61(4))' },
  { id: 6, title: 'Clinical data analysis' },
  { id: 7, title: 'Benefit-risk determination' },
  { id: 8, title: 'PMS & PMCF integration' },
  { id: 9, title: 'Conclusions' },
  { id: 10, title: 'CER report assembly' },
];

export default function CerPage() {
  return (
    <section className="mx-auto flex max-w-content flex-col gap-6">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-3xl text-brand-800">Clinical Evaluation Report Builder</h1>
          <BetaBadge />
        </div>
        <p className="mt-2 text-sm text-ink-600">
          EU MDR Annex XIV / MEDDEV 2.7/1 Rev4 methodology
        </p>
      </header>

      <MockDataDisclosure />

      <CerStartForm />

      <div className="rounded-lg border border-ink-200 bg-surface p-5">
        <h2 className="font-serif text-lg text-ink-900">10-stage progress tracker</h2>
        <p className="mt-1 text-sm text-ink-600">
          Each CER run is structured across the ten MEDDEV 2.7/1 Rev4 stages below.
        </p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2">
          {MEDDEV_STAGES.map((stage) => (
            <li key={stage.id} className="flex items-start gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xs font-medium text-brand-700">
                {stage.id}
              </span>
              <span className="pt-0.5 text-ink-700">{stage.title}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
