// @MX:SPEC Issue #170
import type { Metadata } from 'next';
import { BetaBadge } from '@/components/ui/BetaBadge';
import { ChecklistShell } from './_components/ChecklistShell';

export const metadata: Metadata = {
  title: 'Regulatory Checklist — Regula',
  description: '자동 규제 체크리스트 생성 및 갭 분석 — FDA 510(k) · EU MDR · MFDS',
};

export default function ChecklistPage() {
  return (
    <section className="mx-auto flex max-w-content flex-col gap-6">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-3xl text-brand-800">Regulatory Checklist</h1>
          <BetaBadge />
        </div>
        <p className="mt-2 text-sm text-ink-600">
          자동 규제 체크리스트 생성 및 갭 분석 — FDA 510(k) · EU MDR · MFDS
        </p>
      </header>

      <ChecklistShell />
    </section>
  );
}
