'use client';

// @MX:NOTE [AUTO] ComparisonTable — subject-vs-predicate SE comparison grid with
//   per-cell LLM-suggestion approval. Horizontally scrollable for mobile.
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-013, REQ-PRE-014, REQ-PRE-016,
//   REQ-PRE-018, REQ-PRE-030)
//
// REQ-PRE-014: the SE disclaimer is rendered at the top and must always be
// visible so the table is never mistaken for an automated SE determination.

import type {
  ComparisonDimension,
  PredicateComparison,
} from '@/lib/predicate/types';

interface ComparisonTableProps {
  comparison: PredicateComparison;
  onApprove: (dimension: ComparisonDimension, predicateIndex: number) => void;
}

const DIMENSION_LABELS: Record<ComparisonDimension, string> = {
  intended_use: 'Intended Use',
  indications: 'Indications for Use',
  tech_characteristics: 'Technological Characteristics',
  materials: 'Materials',
  performance: 'Performance',
};

const SE_DISCLAIMER =
  'This tool assists with predicate identification only. Substantial equivalence ' +
  'determination requires RA professional review and cannot be automated.';

export default function ComparisonTable({
  comparison,
  onApprove,
}: ComparisonTableProps) {
  const { selected_predicates, cells } = comparison;

  return (
    <div className="flex flex-col gap-4">
      {/* REQ-PRE-014: SE disclaimer banner, always at the top. */}
      <div
        data-testid="se-disclaimer"
        role="note"
        className="rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-700"
      >
        {SE_DISCLAIMER}
      </div>

      {/* REQ-PRE-030: horizontal scroll keeps the table usable at 768px. */}
      <div data-testid="comparison-scroll" className="overflow-x-auto">
        <table className="w-full min-w-[768px] border-collapse text-sm">
          <thead>
            <tr data-testid="comparison-header" className="border-b border-ink-200">
              <th className="w-40 px-3 py-2 text-left font-medium text-ink-700">
                Dimension
              </th>
              <th className="px-3 py-2 text-left font-medium text-ink-700">
                Subject Device
              </th>
              {selected_predicates.map((p) => (
                <th
                  key={p.k_number}
                  className="px-3 py-2 text-left font-mono font-medium text-ink-700"
                >
                  {p.k_number}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cells.map((cell) => (
              <tr
                key={cell.dimension}
                data-testid="comparison-row"
                className="border-b border-ink-100 align-top"
              >
                <th
                  scope="row"
                  className="px-3 py-3 text-left font-medium text-ink-700"
                >
                  {DIMENSION_LABELS[cell.dimension]}
                </th>
                <td className="px-3 py-3 text-ink-800">{cell.subject_text}</td>
                {selected_predicates.map((p, predIndex) => {
                  const predicateText = cell.predicate_texts[predIndex] ?? '';
                  const suggestion = cell.llm_suggestions?.[predIndex];
                  const approved = cell.approved[predIndex] === true;
                  return (
                    <td key={p.k_number} className="px-3 py-3 text-ink-800">
                      <p>{predicateText}</p>
                      {suggestion && (
                        <div className="mt-2 rounded-md border border-ink-150 bg-surface p-2">
                          <p className="text-xs text-ink-500">Suggestion</p>
                          <p className="text-sm text-ink-700">{suggestion}</p>
                          {approved ? (
                            <span
                              data-testid="approved-check"
                              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-success"
                            >
                              <span aria-hidden="true">✓</span> Approved
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onApprove(cell.dimension, predIndex)}
                              className="mt-1 rounded bg-brand-700 px-2 py-1 text-xs font-medium text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-400"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
