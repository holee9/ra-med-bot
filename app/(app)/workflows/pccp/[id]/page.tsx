import { BetaBadge } from '@/components/ui/BetaBadge';
import { db } from '@/lib/db/client';
import { pccpComponents, pccpVersions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-025)
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PccpDetailPage({ params }: Props) {
  const { id } = await params;

  const [version] = await db.select().from(pccpVersions).where(eq(pccpVersions.id, id)).limit(1);

  if (!version) notFound();

  const components = await db
    .select()
    .from(pccpComponents)
    .where(eq(pccpComponents.pccpVersionId, id));

  const statusColor: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-800',
    submitted: 'bg-blue-100 text-blue-800',
    cleared: 'bg-green-100 text-green-800',
    superseded: 'bg-ink-100 text-ink-600',
  };

  return (
    <section className="mx-auto flex max-w-content flex-col gap-6">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-3xl text-brand-800">{version.deviceName}</h1>
          <BetaBadge />
        </div>
        <p className="mt-1 text-sm text-ink-500">
          PCCP v{version.version} · {version.manufacturer}
        </p>
      </header>

      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusColor[version.status] ?? 'bg-ink-100 text-ink-600'}`}
        >
          {version.status}
        </span>
        <span className="text-sm text-ink-500" suppressHydrationWarning>
          Created {new Date(version.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Components summary */}
      <div className="rounded-lg border border-ink-200 bg-white p-6">
        <h2 className="mb-4 font-medium text-ink-900">Components ({components.length} / 5)</h2>
        <ul className="space-y-2">
          {[
            'modification_description',
            'sps',
            'acp',
            'impact_assessment',
            'performance_testing',
          ].map((type) => {
            const comp = components.find((c) => c.componentType === type);
            return (
              <li key={type} className="flex items-center justify-between text-sm">
                <span className="text-ink-700 capitalize">{type.replace(/_/g, ' ')}</span>
                <span className={comp?.completedAt ? 'text-green-600 font-medium' : 'text-ink-400'}>
                  {comp?.completedAt ? 'Completed' : 'Pending'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Export actions */}
      {version.status !== 'superseded' && (
        <div className="rounded-lg border border-ink-200 bg-white p-6">
          <h2 className="mb-4 font-medium text-ink-900">Export</h2>
          <div className="flex gap-3">
            <a
              href={`/api/ra/workflows/pccp/${id}/export`}
              className="rounded border border-ink-300 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50"
            >
              Download DOCX
            </a>
            <a
              href={`/api/ra/workflows/pccp/${id}/export`}
              className="rounded border border-ink-300 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50"
            >
              Download PDF
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
