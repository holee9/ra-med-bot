'use client';

// @MX:NOTE ComparisonTable — sticky first column, th scope="col", vertical-align top.
// Validates row/col length mismatch client-side as secondary defense (Zod is primary).
// @MX:SPEC SPEC-REGULA-STRUCTURED-001 (REQ-STRUCT-022~023)

import { useState } from 'react';
import { ExportHub } from '../export/ExportHub';
import type { ExportArtifact } from '../export/FormatOptions';

interface ComparisonTableProps {
  title: string;
  cols: string[];
  rows: string[][];
}

export function ComparisonTable({ title, cols, rows }: ComparisonTableProps) {
  // Client-side secondary defense — REQ-STRUCT-023
  const hasLengthMismatch = rows.some((row) => row.length !== cols.length);
  const exportArtifact: ExportArtifact = {
    title: title || 'Regula Comparison',
    content: [
      `# ${title || 'Regula Comparison'}`,
      '',
      `| ${cols.join(' | ')} |`,
      `| ${cols.map(() => '---').join(' | ')} |`,
      ...rows.map((row) => `| ${row.join(' | ')} |`),
    ].join('\n'),
    artifactType: 'comparison',
    filenameBase: `comparison-${(title || 'export').toLowerCase().replace(/[^a-z0-9가-힣]+/gi, '-')}`,
  };

  if (hasLengthMismatch) {
    return (
      <div className="rounded-lg bg-warn-50 px-4 py-3 text-sm text-warn-700">
        표 데이터 형식 오류
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {title && <p className="font-medium text-sm text-ink-800">{title}</p>}

      <div className="flex items-center justify-between">
        <div className="text-xs text-ink-500">
          {rows.length}행 × {cols.length}열
        </div>
        <ExportHub artifact={exportArtifact} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-surface-3">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-2">
              {cols.map((col, i) => (
                <th
                  key={i}
                  scope="col"
                  className={`px-3 py-2 text-left font-medium text-ink-700 ${
                    i === 0 ? 'sticky left-0 z-10 bg-surface-2 border-r border-surface-3' : ''
                  }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-t border-surface-3 hover:bg-surface-1">
                {row.map((cell, colIdx) => (
                  <td
                    key={colIdx}
                    className={`px-3 py-2 align-top text-ink-700 ${
                      colIdx === 0
                        ? 'sticky left-0 z-10 bg-surface-2 border-r border-surface-3 font-medium'
                        : ''
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
