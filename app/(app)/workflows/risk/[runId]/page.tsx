// @MX:SPEC SPEC-REGULA-RISK-001 (T5.4, REQ-RISK-001~020)
import { RiskMatrix } from '@/components/risk/RiskMatrix';
import { HazardTable } from '@/components/risk/HazardTable';
import { RiskApprovalGate } from '@/components/risk/RiskApprovalGate';

interface RiskRunPageProps {
  params: Promise<{ runId: string }>;
}

export default async function RiskRunPage({ params }: RiskRunPageProps) {
  const { runId } = await params;

  return (
    <section className="mx-auto flex max-w-content flex-col gap-8">
      <header>
        <h1 className="font-serif text-3xl text-brand-800">Risk Assessment</h1>
        <p className="mt-1 font-mono text-xs text-ink-500">{runId}</p>
      </header>

      {/* Risk Matrix visualization */}
      <div className="rounded-lg border border-ink-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-ink-800">Risk Matrix (ISO 14971)</h2>
        <RiskMatrix />
      </div>

      {/* Hazard table */}
      <div className="rounded-lg border border-ink-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-ink-800">Hazard Items</h2>
        <HazardTable items={[]} />
      </div>

      {/* Approval gate — only ra-lead can approve */}
      <RiskApprovalGate
        runId={runId}
        isApproved={false}
        approvedBy={null}
        currentUserRole="ra-member"
      />
    </section>
  );
}
