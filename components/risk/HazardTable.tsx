'use client';
// @MX:NOTE [AUTO] Editable hazard item table for risk management workflow.
// @MX:SPEC SPEC-REGULA-RISK-001 (T4.2, REQ-RISK-001~015)

import type { RiskLevel } from '@/lib/risk/risk-evaluation';

interface HazardItem {
  id: string;
  hazard: string;
  sequenceOfEvents: string;
  hazardousSituation: string;
  harm: string;
  severity: number;
  probability: number;
  riskLevel: RiskLevel;
  lowConfidence: boolean;
  citation: Array<{ source: string; id: string }>;
}

const RISK_BADGE: Record<RiskLevel, string> = {
  acc: 'bg-green-100 text-green-800',
  alarp: 'bg-yellow-100 text-yellow-800',
  unacc: 'bg-red-100 text-red-800',
};

const RISK_TEXT: Record<RiskLevel, string> = {
  acc: 'Acceptable',
  alarp: 'ALARP',
  unacc: 'Unacceptable',
};

interface HazardTableProps {
  items: HazardItem[];
  onEdit?: (item: HazardItem) => void;
  onDelete?: (id: string) => void;
  loading?: boolean;
}

export function HazardTable({ items, onEdit, onDelete, loading = false }: HazardTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        Identifying hazards...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-gray-400 border rounded-md">
        No hazards identified yet. Run hazard identification to populate this table.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Hazard</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Harm</th>
            <th className="px-3 py-2 text-center font-semibold text-gray-700">Severity</th>
            <th className="px-3 py-2 text-center font-semibold text-gray-700">Probability</th>
            <th className="px-3 py-2 text-center font-semibold text-gray-700">Risk Level</th>
            <th className="px-3 py-2 text-center font-semibold text-gray-700">Citations</th>
            {(onEdit || onDelete) && (
              <th className="px-3 py-2 text-center font-semibold text-gray-700">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr
              key={item.id}
              className={item.lowConfidence ? 'bg-orange-50' : 'bg-white hover:bg-gray-50'}
            >
              <td className="px-3 py-2">
                {item.hazard}
                {item.lowConfidence && (
                  <span className="ml-1 text-[10px] text-orange-600 font-medium">
                    [low confidence]
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-gray-700">{item.harm}</td>
              <td className="px-3 py-2 text-center font-mono">{item.severity}</td>
              <td className="px-3 py-2 text-center font-mono">{item.probability}</td>
              <td className="px-3 py-2 text-center">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${RISK_BADGE[item.riskLevel]}`}
                >
                  {RISK_TEXT[item.riskLevel]}
                </span>
              </td>
              <td className="px-3 py-2 text-center text-xs text-gray-500">
                {item.citation.length > 0
                  ? item.citation.map((c) => `${c.source}:${c.id}`).join(', ')
                  : '—'}
              </td>
              {(onEdit || onDelete) && (
                <td className="px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default HazardTable;
