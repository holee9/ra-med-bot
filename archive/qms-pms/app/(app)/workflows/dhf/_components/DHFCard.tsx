'use client';
// @MX:SPEC SPEC-REGULA-DHF-001
// Card view for a single DHF in the list.

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-ink-100 text-ink-600',
  in_review: 'bg-amber-100 text-amber-700',
  design_freeze: 'bg-blue-100 text-blue-700',
  archived: 'bg-ink-200 text-ink-500',
};

const JURISDICTION_STYLES: Record<string, string> = {
  FDA: 'bg-blue-50 text-blue-700 border-blue-200',
  EU: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  MFDS: 'bg-purple-50 text-purple-700 border-purple-200',
  NMPA: 'bg-orange-50 text-orange-700 border-orange-200',
  PMDA: 'bg-pink-50 text-pink-700 border-pink-200',
};

const FRAMEWORK_LABELS: Record<string, string> = {
  QSR_QMSR: 'QSR/QMSR',
  ISO_13485: 'ISO 13485',
  EU_MDR: 'EU MDR',
};

export interface DHFSummary {
  id: string;
  deviceName: string;
  deviceModel: string | null;
  jurisdiction: string;
  regulatoryFramework: string;
  status: string;
  completenessScore: number;
  designFreezeDate: string | null;
  createdAt: string;
}

interface Props {
  dhf: DHFSummary;
  onSelect: (id: string) => void;
}

function CompletenessBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 rounded-full bg-ink-100">
        <div
          className={`h-1.5 rounded-full transition-all ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span
        className={`text-xs font-medium ${
          score >= 80 ? 'text-green-700' : score >= 50 ? 'text-amber-700' : 'text-red-600'
        }`}
      >
        {score}%
      </span>
    </div>
  );
}

export function DHFCard({ dhf, onSelect }: Props) {
  const jurisdictionStyle =
    JURISDICTION_STYLES[dhf.jurisdiction] ?? 'bg-ink-50 text-ink-600 border-ink-200';
  const statusStyle = STATUS_STYLES[dhf.status] ?? 'bg-ink-100 text-ink-600';

  return (
    <button
      type="button"
      onClick={() => onSelect(dhf.id)}
      className="w-full text-left rounded-lg border border-ink-200 bg-white p-4 hover:border-brand-300 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-ink-900 truncate">{dhf.deviceName}</h3>
            {dhf.deviceModel && <span className="text-xs text-ink-500">{dhf.deviceModel}</span>}
            <span
              className={`rounded border px-2 py-0.5 text-xs font-semibold ${jurisdictionStyle}`}
            >
              {dhf.jurisdiction}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-500">
            <span className="font-medium">
              {FRAMEWORK_LABELS[dhf.regulatoryFramework] ?? dhf.regulatoryFramework}
            </span>
            {dhf.designFreezeDate && <span>Frozen: {dhf.designFreezeDate}</span>}
            <CompletenessBar score={dhf.completenessScore} />
          </div>
        </div>
        <span className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${statusStyle}`}>
          {dhf.status.replace('_', ' ')}
        </span>
      </div>
    </button>
  );
}
