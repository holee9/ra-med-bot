'use client';
// @MX:NOTE [AUTO] 5×5 ISO 14971 risk matrix visualization component.
// @MX:SPEC SPEC-REGULA-RISK-001 (T4.1, REQ-RISK-011~015)

import { DEFAULT_RISK_MATRIX, type RiskLevel } from '@/lib/risk/risk-evaluation';

const RISK_COLORS: Record<RiskLevel, string> = {
  acc: 'bg-green-100 text-green-800 border-green-300',
  alarp: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  unacc: 'bg-red-100 text-red-800 border-red-300',
};

const RISK_LABELS: Record<RiskLevel, string> = {
  acc: 'Acc',
  alarp: 'ALARP',
  unacc: 'Unacc',
};

const SEVERITY_LABELS = ['Negligible', 'Marginal', 'Serious', 'Critical', 'Catastrophic'];
const PROBABILITY_LABELS = ['Incredible', 'Remote', 'Occasional', 'Probable', 'Frequent'];

interface RiskMatrixProps {
  /** Optional highlighted cell (severity 1-5, probability 1-5) */
  highlight?: { severity: number; probability: number };
  className?: string;
}

export function RiskMatrix({ highlight, className = '' }: RiskMatrixProps) {
  return (
    <div className={`overflow-auto ${className}`}>
      <table className="border-collapse text-xs font-mono">
        <thead>
          <tr>
            <th className="p-1 border text-left text-gray-500 min-w-[80px]">S \ P</th>
            {PROBABILITY_LABELS.map((label, pi) => (
              <th key={pi} className="p-1 border text-center min-w-[70px] text-gray-700">
                P{pi + 1}
                <br />
                <span className="text-[10px] font-normal">{label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DEFAULT_RISK_MATRIX.map((row, si) => (
            <tr key={si}>
              <td className="p-1 border text-gray-700 font-semibold">
                S{si + 1}
                <br />
                <span className="text-[10px] font-normal">{SEVERITY_LABELS[si]}</span>
              </td>
              {row.map((level, pi) => {
                const isHighlighted =
                  highlight?.severity === si + 1 && highlight?.probability === pi + 1;
                return (
                  <td
                    key={pi}
                    className={`p-1 border text-center font-semibold ${RISK_COLORS[level]} ${
                      isHighlighted ? 'ring-2 ring-blue-500 ring-inset' : ''
                    }`}
                  >
                    {RISK_LABELS[level]}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex gap-3 text-xs">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-green-200 border border-green-300" />
          Acceptable
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-yellow-200 border border-yellow-300" />
          ALARP
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-red-200 border border-red-300" />
          Unacceptable
        </span>
      </div>
    </div>
  );
}

export default RiskMatrix;
