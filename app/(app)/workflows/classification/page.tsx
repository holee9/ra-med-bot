// @MX:SPEC SPEC-REGULA-CLASSIFY-001 (REQ-CLASSIFY-001)
import { BetaBadge } from '@/components/ui/BetaBadge';
import { ClassificationWizard } from './_components/ClassificationWizard';

export const metadata = {
  title: 'Device Classification Wizard — Regula',
  description:
    'Multi-jurisdiction medical device classification for FDA, EU MDR, MFDS, NMPA, and PMDA',
};

export default function ClassificationPage() {
  return (
    <section className="mx-auto flex max-w-content flex-col gap-6">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-3xl text-brand-800">
            Device Classification Wizard
          </h1>
          <BetaBadge />
        </div>
        <p className="mt-2 text-sm text-ink-600">
          Multi-jurisdiction classification — FDA, EU MDR, MFDS, NMPA, PMDA
        </p>
      </header>

      <ClassificationWizard />
    </section>
  );
}
