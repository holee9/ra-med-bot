
// @MX:LEGACY archived from app
'use client';
// @MX:SPEC SPEC-REGULA-ESUBMIT-001
// Card view for a single submission package in the list.

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-ink-100 text-ink-600',
  validating: 'bg-amber-100 text-amber-700',
  validated: 'bg-blue-100 text-blue-700',
  submitted: 'bg-purple-100 text-purple-700',
  rta: 'bg-red-100 text-red-600',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  validating: 'Validating',
  validated: 'Validated',
  submitted: 'Submitted',
  rta: 'RTA',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

const JURISDICTION_STYLES: Record<string, string> = {
  FDA: 'bg-blue-50 text-blue-700 border-blue-200',
  EU: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  MFDS: 'bg-purple-50 text-purple-700 border-purple-200',
  NMPA: 'bg-orange-50 text-orange-700 border-orange-200',
  PMDA: 'bg-pink-50 text-pink-700 border-pink-200',
};

const SUBMISSION_TYPE_LABELS: Record<string, string> = {
  '510k': '510(k)',
  de_novo: 'De Novo',
  pma: 'PMA',
  cer: 'CER',
  pccp: 'PCCP',
  mfds_import: 'MFDS 수입',
  nmpa_ecdt: 'NMPA eCDT',
};

export interface PackageSummary {
  id: string;
  submissionType: string;
  jurisdiction: string;
  deviceName: string;
  submissionNumber: string | null;
  version: string;
  status: string;
  createdAt: string;
  submittedAt: string | null;
}

interface Props {
  pkg: PackageSummary;
  onSelect: (id: string) => void;
}

export function ESubmitCard({ pkg, onSelect }: Props) {
  const jurisdictionStyle =
    JURISDICTION_STYLES[pkg.jurisdiction] ?? 'bg-ink-50 text-ink-600 border-ink-200';
  const statusStyle = STATUS_STYLES[pkg.status] ?? 'bg-ink-100 text-ink-600';

  return (
    <button
      type="button"
      onClick={() => onSelect(pkg.id)}
      className="w-full text-left rounded-lg border border-ink-200 bg-white p-4 hover:border-brand-300 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-ink-900 truncate">{pkg.deviceName}</h3>
            <span
              className={`rounded border px-2 py-0.5 text-xs font-semibold ${jurisdictionStyle}`}
            >
              {pkg.jurisdiction}
            </span>
            <span className="rounded bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-700">
              {SUBMISSION_TYPE_LABELS[pkg.submissionType] ?? pkg.submissionType}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-500">
            <span>v{pkg.version}</span>
            {pkg.submissionNumber && <span className="font-mono">{pkg.submissionNumber}</span>}
            {pkg.submittedAt && (
              <span suppressHydrationWarning>
                제출: {new Date(pkg.submittedAt).toLocaleDateString('ko-KR')}
              </span>
            )}
            <span suppressHydrationWarning>
              {new Date(pkg.createdAt).toLocaleDateString('ko-KR')} 생성
            </span>
          </div>
        </div>
        <span className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${statusStyle}`}>
          {STATUS_LABELS[pkg.status] ?? pkg.status}
        </span>
      </div>
    </button>
  );
}
