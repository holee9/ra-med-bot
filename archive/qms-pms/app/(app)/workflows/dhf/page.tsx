// @MX:SPEC SPEC-REGULA-DHF-001
import { BetaBadge } from '@/components/ui/BetaBadge';

// @MX:LEGACY archived from app
import { DHFList } from './_components/DHFList';

export const metadata = {
  title: 'Design History File — Regula',
  description: 'Design History File (DHF) integrated management — 21 CFR 820 / ISO 13485 / EU MDR',
};

export default function DHFPage() {
  return (
    <section className="mx-auto flex max-w-content flex-col gap-6">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-3xl text-brand-800">Design History File</h1>
          <BetaBadge />
        </div>
        <p className="mt-2 text-sm text-ink-600">
          21 CFR 820.30 · ISO 13485 · EU MDR — Design inputs, V&amp;V, and design reviews in one
          place
        </p>
      </header>

      <DHFList />
    </section>
  );
}
