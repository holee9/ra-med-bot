// @MX:SPEC SPEC-REGULA-RISK-001 (T5.4, REQ-RISK-001)
import { BetaBadge } from '@/components/ui/BetaBadge';
import Link from 'next/link';

export const metadata = {
  title: 'Risk Management — Regula',
  description:
    'ISO 14971 Risk Management workflow — hazard identification, risk evaluation, and control measures',
};

export default function RiskWorkflowPage() {
  return (
    <section className="mx-auto flex max-w-content flex-col gap-6">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-3xl text-brand-800">Risk Management</h1>
          <BetaBadge />
        </div>
        <p className="mt-2 text-sm text-ink-600">
          ISO 14971 Risk Management — Hazard Identification · Risk Evaluation · Control Measures ·
          Residual Risk
        </p>
      </header>

      <RiskRunList />
    </section>
  );
}

async function RiskRunList() {
  // Server component: list risk runs for the current org
  // Data fetched from /api/ra/risk/runs at runtime
  return (
    <div data-testid="risk-run-list" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-ink-800">Risk Assessment Runs</h2>
        <Link
          href="/workflows/risk/new"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          New Risk Assessment
        </Link>
      </div>

      {/* Run list rendered client-side to avoid blocking page shell */}
      <RiskRunListClient />
    </div>
  );
}

function RiskRunListClient() {
  // Placeholder: full list component lives in _components/RiskRunList.tsx
  // Imported here as a lightweight stub until the component is fully built
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-8 text-center text-ink-500">
      <p className="text-sm">No risk assessment runs yet. Start a new assessment above.</p>
    </div>
  );
}
