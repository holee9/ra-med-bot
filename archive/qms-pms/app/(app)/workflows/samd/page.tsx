// @MX:SPEC SPEC-REGULA-SAMD-001
import { BetaBadge } from '@/components/ui/BetaBadge';
import { SaMDAssessmentList } from './_components/SaMDAssessmentList';

export const metadata = {
  title: 'SaMD Pathway Builder — Regula',
  description:
    'AI/ML Software as a Medical Device Regulatory Pathway Builder (IMDRF N12 / FDA / EU AI Act)',
};

export default function SaMDPage() {
  return (
    <section className="mx-auto flex max-w-content flex-col gap-6">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-3xl text-brand-800">SaMD Pathway Builder</h1>
          <BetaBadge />
        </div>
        <p className="mt-2 text-sm text-ink-600">
          AI/ML Software as a Medical Device — IMDRF N12 Classification · FDA AI/ML Guidance · EU AI
          Act
        </p>
      </header>

      <SaMDAssessmentList />
    </section>
  );
}
