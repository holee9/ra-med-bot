// @MX:SPEC SPEC-REGULA-ESUBMIT-001
import { BetaBadge } from '@/components/ui/BetaBadge';
import { ESubmitList } from './_components/ESubmitList';

export const metadata = {
  title: 'Electronic Submission — Regula',
  description:
    'Electronic submission package builder — FDA 510(k)/De Novo/PMA, EU MDR CER, PCCP, MFDS, NMPA',
};

export default function ESubmitPage() {
  return (
    <section className="mx-auto flex max-w-content flex-col gap-6">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-3xl text-brand-800">전자 제출 패키지</h1>
          <BetaBadge />
        </div>
        <p className="mt-2 text-sm text-ink-600">
          FDA 510(k) · De Novo · PMA · EU MDR CER · PCCP · MFDS · NMPA — 제출 패키지 빌더
        </p>
      </header>

      <ESubmitList />
    </section>
  );
}
