// @MX:NOTE [AUTO] WorkflowCard — displays a single workflow with title, description,
// step count badge, status badge, and a "Start Workflow" link.
// @MX:SPEC SPEC-REGULA-WORKFLOWS-001 (M6)

import Link from 'next/link';

type WorkflowAvailability = 'available' | 'beta' | 'coming_soon';

const AVAILABILITY_BADGE: Record<WorkflowAvailability, { label: string; className: string }> = {
  available: { label: 'Available', className: 'bg-green-100 text-green-700 border-green-300' },
  beta: { label: 'Beta', className: 'bg-blue-100 text-blue-700 border-blue-300' },
  coming_soon: { label: 'Coming Soon', className: 'bg-gray-100 text-gray-500 border-gray-300' },
};

interface WorkflowCardProps {
  title: string;
  description: string;
  href: string;
  stepCount: number;
  status?: WorkflowAvailability;
}

export function WorkflowCard({
  title,
  description,
  href,
  stepCount,
  status = 'available',
}: WorkflowCardProps) {
  const badge = AVAILABILITY_BADGE[status];
  const isDisabled = status === 'coming_soon';

  return (
    <article className="flex flex-col gap-4 rounded-lg border border-ink-200 bg-surface p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-lg text-ink-900">{title}</h2>
          <p className="mt-1 text-sm text-ink-600">{description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`rounded border px-2 py-0.5 text-xs font-medium ${badge.className}`}>
            {badge.label}
          </span>
          <span className="rounded border border-ink-200 bg-ink-50 px-2 py-0.5 text-xs text-ink-500">
            {stepCount} steps
          </span>
        </div>
      </div>

      {isDisabled ? (
        <span className="mt-auto inline-flex w-full cursor-not-allowed items-center justify-center rounded-md border border-ink-200 px-4 py-2 text-sm text-ink-400">
          Start Workflow
        </span>
      ) : (
        <Link
          href={href}
          className="mt-auto inline-flex w-full items-center justify-center rounded-md border border-brand-300 px-4 py-2 text-sm text-brand-700 hover:bg-brand-50"
        >
          Start Workflow
        </Link>
      )}
    </article>
  );
}
