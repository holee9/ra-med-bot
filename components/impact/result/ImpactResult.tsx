import type { ImpactCheckResponse } from '@/lib/queries/useImpactCheck';
import { LLMClassification } from './LLMClassification';
import type { MatrixItem } from './MatrixTable';
import { MatrixTable } from './MatrixTable';
import { SignalLight } from './SignalLight';
import { SimilarCasesCard } from './SimilarCasesCard';
import { TicketCTA } from './TicketCTA';

interface ImpactResultProps {
  data: ImpactCheckResponse;
}

export function ImpactResult({ data }: ImpactResultProps) {
  const matrix = data.matrix as MatrixItem[];

  return (
    <div className="space-y-6 p-6">
      <section>
        <SignalLight signal={data.signal} />
      </section>

      <section>
        <MatrixTable matrix={matrix} />
      </section>

      <section>
        <LLMClassification classification={data.classification} />
      </section>

      <section>
        <SimilarCasesCard similarCases={data.similarCases} />
      </section>

      <section>
        <TicketCTA ticketId={data.ticketId ?? undefined} />
      </section>
    </div>
  );
}
