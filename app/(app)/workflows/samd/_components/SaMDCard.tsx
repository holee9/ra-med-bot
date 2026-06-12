'use client';
// @MX:SPEC SPEC-REGULA-SAMD-001
// Assessment card for SaMD list view.

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-ink-100 text-ink-600',
  in_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  archived: 'bg-ink-200 text-ink-500',
};

const CATEGORY_STYLES: Record<string, string> = {
  I: 'bg-green-50 text-green-700 border-green-200',
  II: 'bg-amber-50 text-amber-700 border-amber-200',
  III: 'bg-orange-50 text-orange-700 border-orange-200',
  IV: 'bg-red-50 text-red-700 border-red-200',
};

const AI_ML_LABELS: Record<string, string> = {
  locked: 'Locked',
  adaptive: 'Adaptive',
  continuously_learning: 'Continuously Learning',
};

const EU_RISK_LABELS: Record<string, string> = {
  minimal: 'Minimal',
  general_purpose: 'General Purpose',
  high_risk: 'High Risk',
  prohibited: 'Prohibited',
};

interface SaMDAssessment {
  id: string;
  title: string;
  aiMlType: string;
  imdrfCategory: string | null;
  fdaPathway: string | null;
  euAiRiskLevel: string | null;
  pccpRequired: boolean;
  status: string;
  createdAt: string;
}

export function SaMDCard({ assessment }: { assessment: SaMDAssessment }) {
  const categoryStyle = assessment.imdrfCategory
    ? (CATEGORY_STYLES[assessment.imdrfCategory] ?? 'bg-ink-50 text-ink-600 border-ink-200')
    : 'bg-ink-50 text-ink-400 border-ink-200';
  const statusStyle = STATUS_STYLES[assessment.status] ?? 'bg-ink-100 text-ink-600';

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4 hover:border-brand-300 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-ink-900 truncate">{assessment.title}</h3>
            {assessment.imdrfCategory && (
              <span
                className={`rounded border px-2 py-0.5 text-xs font-semibold ${categoryStyle}`}
              >
                IMDRF {assessment.imdrfCategory}
              </span>
            )}
            {assessment.pccpRequired && (
              <span className="rounded bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs text-purple-700">
                PCCP Required
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-500">
            <span>
              AI/ML: <span className="font-medium">{AI_ML_LABELS[assessment.aiMlType] ?? assessment.aiMlType}</span>
            </span>
            {assessment.fdaPathway && (
              <span>
                FDA: <span className="font-medium uppercase">{assessment.fdaPathway.replace('_', ' ')}</span>
              </span>
            )}
            {assessment.euAiRiskLevel && (
              <span>
                EU AI Act: <span className="font-medium">{EU_RISK_LABELS[assessment.euAiRiskLevel] ?? assessment.euAiRiskLevel}</span>
              </span>
            )}
          </div>
        </div>
        <span className={`shrink-0 rounded px-2 py-1 text-xs font-medium capitalize ${statusStyle}`}>
          {assessment.status.replace('_', ' ')}
        </span>
      </div>
    </div>
  );
}
