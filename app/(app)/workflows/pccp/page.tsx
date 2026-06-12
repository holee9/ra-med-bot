// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-025)
import { BetaBadge } from '@/components/ui/BetaBadge';
import { PccpWizardForm } from './_components/PccpWizardForm';

export const metadata = {
  title: 'PCCP Builder — Regula',
  description: 'Predetermined Change Control Plan (FDA AI/ML Final Guidance 2024)',
};

export default function PccpPage() {
  return (
    <section className="mx-auto flex max-w-content flex-col gap-6">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-3xl text-brand-800">PCCP Builder</h1>
          <BetaBadge />
        </div>
        <p className="mt-2 text-sm text-ink-600">
          Predetermined Change Control Plan — FDA AI/ML SaMD Final Guidance (April 2024)
        </p>
      </header>

      <PccpWizardForm />
    </section>
  );
}
