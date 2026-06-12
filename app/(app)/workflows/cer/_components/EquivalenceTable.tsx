'use client';

// @MX:NOTE [AUTO] EquivalenceTable — renders the EU MDR Article 61(4)
// equivalence assessment. Prop shape mirrors EquivalenceAssessment from
// lib/cer/equivalence-builder so dimension/claim/satisfied need no remapping.
// @MX:SPEC SPEC-REGULA-CER-001 (REQ-CER-003, REQ-CER-004)

export interface EquivalenceDimensionView {
  dimension: 'clinical' | 'technical' | 'biological';
  claimText: string;
  satisfied: boolean;
}

export interface EquivalenceAssessmentView {
  deviceName: string;
  equivalentDevice: string;
  dimensions: EquivalenceDimensionView[];
  overallEquivalent: boolean;
}

interface EquivalenceTableProps {
  assessment?: EquivalenceAssessmentView;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function EquivalenceTable({ assessment }: EquivalenceTableProps) {
  if (!assessment) {
    return (
      <p className="rounded-md border border-ink-200 bg-surface px-4 py-6 text-center text-sm text-ink-500">
        No equivalence assessment yet
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-ink-600">
          {assessment.deviceName} vs. {assessment.equivalentDevice}
        </p>
        <span
          className={`rounded border px-2 py-0.5 text-xs font-medium ${
            assessment.overallEquivalent
              ? 'border-green-300 bg-green-100 text-green-700'
              : 'border-danger bg-danger-bg text-danger'
          }`}
        >
          {assessment.overallEquivalent ? 'Equivalent' : 'Not equivalent'}
        </span>
      </div>

      <div className="overflow-hidden rounded-md border border-ink-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-ink-50 text-left text-xs text-ink-600">
              <th className="px-3 py-2 font-medium">Dimension</th>
              <th className="px-3 py-2 font-medium">Claim</th>
              <th className="px-3 py-2 font-medium">Satisfied</th>
            </tr>
          </thead>
          <tbody>
            {assessment.dimensions.map((dim) => (
              <tr key={dim.dimension} className="border-t border-ink-200 align-top">
                <td className="px-3 py-2 font-medium text-ink-900">{capitalize(dim.dimension)}</td>
                <td className="px-3 py-2 text-ink-700">
                  {dim.claimText.trim().length > 0 ? dim.claimText : '—'}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded border px-2 py-0.5 text-xs font-medium ${
                      dim.satisfied
                        ? 'border-green-300 bg-green-100 text-green-700'
                        : 'border-danger bg-danger-bg text-danger'
                    }`}
                  >
                    {dim.satisfied ? 'Yes' : 'No'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
