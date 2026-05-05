// @MX:NOTE [AUTO] WorkflowsPage — lists all available regulatory workflows.
// Server component: no client state, displays mock/static data from WORKFLOW_REGISTRY.
// @MX:SPEC SPEC-REGULA-WORKFLOWS-001 (M6)

import { BetaBadge } from '@/components/ui/BetaBadge';
import { MockDataDisclosure } from '@/components/ui/MockDataDisclosure';
import { WorkflowCard } from '@/components/workflows/WorkflowCard';
import { WORKFLOW_REGISTRY } from '@/lib/workflows/registry';

export default function WorkflowsPage() {
  return (
    <section className="mx-auto flex max-w-content flex-col gap-6">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-3xl text-brand-800">Regulatory Workflows</h1>
          <BetaBadge />
        </div>
        <p className="mt-2 text-sm text-ink-600">Automated regulatory document generation</p>
      </header>

      <MockDataDisclosure />

      <div className="grid gap-4 md:grid-cols-3">
        {WORKFLOW_REGISTRY.map((workflow) => (
          <WorkflowCard
            key={workflow.id}
            title={workflow.title}
            description={workflow.description}
            href={workflow.href}
            stepCount={workflow.stepCount}
          />
        ))}
      </div>
    </section>
  );
}
