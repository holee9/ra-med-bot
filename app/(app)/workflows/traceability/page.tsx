import { BetaBadge } from '@/components/ui/BetaBadge';
// @MX:SPEC Issue #169
import type { Metadata } from 'next';
import { TraceabilityShell } from './_components/TraceabilityShell';

export const metadata: Metadata = {
  title: 'Traceability — Regula',
  description: '규제 추적 그래프 스캔 및 변경 영향 분석',
};

export default function TraceabilityPage() {
  return (
    <section className="mx-auto flex max-w-content flex-col gap-6">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-3xl text-brand-800">Traceability</h1>
          <BetaBadge />
        </div>
        <p className="mt-2 text-sm text-ink-600">규제 추적 그래프 스캔 및 변경 영향 분석</p>
      </header>

      <TraceabilityShell />
    </section>
  );
}
