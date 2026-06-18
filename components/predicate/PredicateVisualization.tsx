'use client';

// @MX:NOTE [AUTO] PredicateVisualization — interactive visualization for predicate comparison analysis
// @MX:SPEC SPEC-PREDICATE-VIS-001 (REQ-VIS-001, REQ-VIS-002, REQ-VIS-003, REQ-VIS-004)

import type { ComparisonDimension, PredicateComparison } from '@/lib/predicate/types';
import { useEffect, useState } from 'react';
import type { TooltipProps } from 'recharts';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface PredicateVisualizationProps {
  comparison: PredicateComparison;
}

type PredicateMetricKey = `predicate_${number}`;

interface ChartRow {
  dimension: string;
  dimensionKey: ComparisonDimension;
  subject: number;
  isRequired: boolean;
  [key: PredicateMetricKey]: number;
}

interface BeforeAfterRow {
  phase: 'Before' | 'After';
  [dimensionLabel: string]: string | number;
}

interface RadarRow {
  dimension: string;
  subject: number;
  [key: PredicateMetricKey]: number | string;
}

const DIMENSION_LABELS: Record<ComparisonDimension, string> = {
  intended_use: 'Intended Use',
  indications: 'Indications for Use',
  tech_characteristics: 'Technological Characteristics',
  materials: 'Materials',
  performance: 'Performance',
};

// Color scheme for required vs optional documents
const REQUIRED_COLOR = 'var(--color-brand-500)';
const OPTIONAL_COLOR = 'var(--color-ink-400)';
const SUBJECT_COLOR = 'var(--color-success)';

function isRequiredDimension(index: number) {
  return index < 3;
}

function getDimensionStatusColor(index: number) {
  return isRequiredDimension(index) ? REQUIRED_COLOR : OPTIONAL_COLOR;
}

export default function PredicateVisualization({ comparison }: PredicateVisualizationProps) {
  const [viewMode, setViewMode] = useState<'table' | 'bar' | 'radar'>('bar');
  const [beforeAfterMode, setBeforeAfterMode] = useState(false);
  const [highlightedDimension, setHighlightedDimension] = useState<ComparisonDimension | null>(
    null,
  );
  const [animationPhase, setAnimationPhase] = useState(0);
  const [demoMode, setDemoMode] = useState(false);

  // Animation effect for demo mode
  useEffect(() => {
    if (demoMode) {
      const phases = [0, 1, 2];
      let currentPhase = 0;

      const interval = setInterval(() => {
        setAnimationPhase(phases[currentPhase] ?? 0);
        currentPhase = (currentPhase + 1) % phases.length;
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [demoMode]);

  // Transform comparison data into chart format
  const chartData: ChartRow[] = comparison.cells.map((cell, idx) => {
    const row: ChartRow = {
      dimension: DIMENSION_LABELS[cell.dimension],
      dimensionKey: cell.dimension,
      subject: cell.subject_text.length, // Text length as proxy for complexity
      isRequired: isRequiredDimension(idx), // First 3 dimensions are typically required
    };

    comparison.selected_predicates.forEach((_, predIdx) => {
      row[`predicate_${predIdx}`] = cell.predicate_texts[predIdx]?.length || 0;
    });

    return row;
  });

  // Before-After comparison data
  const beforeAfterData: BeforeAfterRow[] | null = beforeAfterMode
    ? [
        comparison.cells.reduce<BeforeAfterRow>(
          (row, cell) => {
            row[DIMENSION_LABELS[cell.dimension]] = cell.subject_text.length;
            return row;
          },
          { phase: 'Before' },
        ),
        comparison.cells.reduce<BeforeAfterRow>(
          (row, cell) => {
            row[DIMENSION_LABELS[cell.dimension]] = cell.predicate_texts[0]?.length || 0;
            return row;
          },
          { phase: 'After' },
        ),
      ]
    : null;

  // Prepare radar chart data
  const radarData: RadarRow[] = comparison.cells.map((cell) => {
    const row: RadarRow = {
      dimension: DIMENSION_LABELS[cell.dimension],
      subject: cell.subject_text.length,
    };

    comparison.selected_predicates.forEach((_, predIdx) => {
      row[`predicate_${predIdx}`] = cell.predicate_texts[predIdx]?.length || 0;
    });

    return row;
  });

  const animationDuration = demoMode ? 1500 : 500;
  const animationBegin = demoMode ? animationPhase * 300 : 0;
  const animationKey = demoMode ? animationPhase : 'static';

  return (
    <div className="flex flex-col gap-6">
      {/* View mode toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setViewMode('bar')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            viewMode === 'bar'
              ? 'bg-brand-700 text-white'
              : 'border border-ink-200 text-ink-700 hover:bg-ink-50'
          }`}
        >
          Bar Chart
        </button>
        <button
          type="button"
          onClick={() => setViewMode('radar')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            viewMode === 'radar'
              ? 'bg-brand-700 text-white'
              : 'border border-ink-200 text-ink-700 hover:bg-ink-50'
          }`}
        >
          Radar Chart
        </button>
        <button
          type="button"
          onClick={() => setViewMode('table')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            viewMode === 'table'
              ? 'bg-brand-700 text-white'
              : 'border border-ink-200 text-ink-700 hover:bg-ink-50'
          }`}
        >
          Table View
        </button>

        <div className="ml-auto">
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={beforeAfterMode}
              onChange={(e) => setBeforeAfterMode(e.target.checked)}
              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            Before-After Mode
          </label>
        </div>
      </div>

      {/* Demo mode toggle */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={demoMode}
            onChange={(e) => setDemoMode(e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
          Demo Mode (Animation)
        </label>
      </div>

      {/* Visualization area */}
      <div
        className={`rounded-lg border border-ink-200 bg-white p-6 transition-all duration-500 ${demoMode ? 'shadow-xl scale-105' : ''}`}
      >
        {demoMode && (
          <div className="mb-4 rounded bg-amber-50 px-4 py-2 text-sm text-amber-700">
            🎬 Demo Mode: Interactive animation for investor/customer presentation
          </div>
        )}

        {viewMode === 'bar' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-ink-900">
              {beforeAfterMode ? 'Before-After Comparison' : 'Dimension Comparison'}
            </h3>

            {beforeAfterMode && beforeAfterData ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={beforeAfterData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="phase" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {Object.keys(DIMENSION_LABELS).map((key, idx) => (
                    <Bar
                      key={key}
                      dataKey={DIMENSION_LABELS[key as ComparisonDimension]}
                      fill={getDimensionStatusColor(idx)}
                      animationDuration={animationDuration}
                      animationBegin={animationBegin}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="dimension"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    onClick={(data) => {
                      if (data?.activePayload && data.activePayload.length > 0) {
                        const dimensionKey = data.activePayload[0].payload.dimensionKey;
                        setHighlightedDimension(dimensionKey as ComparisonDimension);
                      }
                    }}
                  />
                  <YAxis />
                  <Tooltip
                    content={({ active, payload }: TooltipProps<number, string>) => {
                      if (active && payload && payload.length) {
                        const data = payload[0]?.payload as ChartRow | undefined;
                        return (
                          <div className="rounded-lg border border-ink-200 bg-white p-3 shadow-lg">
                            <p className="font-semibold text-ink-900">{data?.dimension}</p>
                            <p className="text-sm text-ink-700">
                              Status: {data?.isRequired ? 'Required' : 'Optional'}
                            </p>
                            {payload.map((entry) => (
                              <p key={entry.name} className="text-sm text-ink-600">
                                {entry.name}: {entry.value}
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Bar
                    key={`subject-${animationKey}`}
                    dataKey="subject"
                    fill={SUBJECT_COLOR}
                    name="Subject Device"
                    animationDuration={animationDuration}
                    animationBegin={animationBegin}
                  />
                  {comparison.selected_predicates.map((predicate, idx) => (
                    <Bar
                      key={`${predicate.k_number}-${animationKey}`}
                      dataKey={`predicate_${idx}`}
                      fill={REQUIRED_COLOR}
                      name={predicate.k_number}
                      animationDuration={animationDuration}
                      animationBegin={animationBegin}
                    >
                      {chartData.map((row, rowIdx) => (
                        <Cell
                          key={`${predicate.k_number}-${row.dimensionKey}`}
                          fill={getDimensionStatusColor(rowIdx)}
                        />
                      ))}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {viewMode === 'radar' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-ink-900">Multi-Dimensional Analysis</h3>
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart key={`radar-chart-${animationKey}`} data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="dimension" />
                <PolarRadiusAxis />
                <Radar
                  key={`subject-radar-${animationKey}`}
                  name="Subject Device"
                  dataKey="subject"
                  fill={SUBJECT_COLOR}
                  fillOpacity={demoMode && animationPhase === 0 ? 0.75 : 0.55}
                  animationDuration={animationDuration}
                  animationBegin={animationBegin}
                />
                {comparison.selected_predicates.map((predicate, idx) => (
                  <Radar
                    key={`${predicate.k_number}-radar-${animationKey}`}
                    name={predicate.k_number}
                    dataKey={`predicate_${idx}`}
                    fill={REQUIRED_COLOR}
                    fillOpacity={demoMode && animationPhase === idx % 3 ? 0.75 : 0.45}
                    animationDuration={animationDuration}
                    animationBegin={animationBegin}
                  />
                ))}
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {viewMode === 'table' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-ink-900">Detailed Comparison</h3>

            {/* Dimension highlight panel */}
            {highlightedDimension && (
              <div className="rounded-lg border border-brand-300 bg-brand-50 p-4">
                <h4 className="font-semibold text-brand-900">
                  {DIMENSION_LABELS[highlightedDimension]} Analysis
                </h4>
                <p className="mt-2 text-sm text-brand-700">
                  {comparison.cells.find((c) => c.dimension === highlightedDimension)?.subject_text}
                </p>
                <button
                  type="button"
                  onClick={() => setHighlightedDimension(null)}
                  className="mt-2 rounded border border-brand-300 bg-white px-3 py-1 text-sm text-brand-700 hover:bg-brand-100"
                >
                  Close Detail
                </button>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-ink-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-surface border-b border-ink-200">
                    <th className="w-40 px-4 py-3 text-left font-semibold text-ink-900">
                      <div className="flex items-center gap-2">
                        Dimension
                        <span className="text-xs font-normal text-ink-500">(Status)</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-ink-900">
                      Subject Device
                    </th>
                    {comparison.selected_predicates.map((p, idx) => (
                      <th
                        key={p.k_number}
                        className="px-4 py-3 text-left font-mono font-semibold text-ink-900"
                      >
                        <div className="flex items-center gap-2">
                          {p.k_number}
                          <span
                            className={`text-xs font-normal ${
                              idx < 3 ? 'text-blue-600' : 'text-gray-500'
                            }`}
                          >
                            ({idx < 3 ? 'Required' : 'Optional'})
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.cells.map((cell, cellIdx) => (
                    <tr
                      key={cell.dimension}
                      className={`border-b border-ink-100 transition-colors hover:bg-ink-50 ${
                        highlightedDimension === cell.dimension ? 'bg-brand-50' : ''
                      }`}
                    >
                      <th
                        scope="row"
                        className={`px-4 py-3 text-left font-medium ${
                          isRequiredDimension(cellIdx) ? 'text-blue-700' : 'text-gray-600'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setHighlightedDimension(cell.dimension)}
                          className="flex items-center gap-2 text-left"
                        >
                          {DIMENSION_LABELS[cell.dimension]}
                          <div
                            className={`h-2 w-2 rounded-full ${
                              isRequiredDimension(cellIdx) ? 'bg-blue-500' : 'bg-gray-400'
                            }`}
                          />
                        </button>
                      </th>
                      <td className="px-4 py-3 text-ink-800">{cell.subject_text}</td>
                      {comparison.selected_predicates.map((p, predIndex) => (
                        <td
                          key={p.k_number}
                          className={`px-4 py-3 ${
                            cell.predicate_texts[predIndex] ? 'text-ink-800' : 'text-ink-400 italic'
                          }`}
                        >
                          {cell.predicate_texts[predIndex] || (
                            <span className="text-xs">No data</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Legend for required vs optional */}
      <div className="flex items-center gap-6 rounded-md border border-ink-200 bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: REQUIRED_COLOR }} />
          <span className="text-sm text-ink-700">Required Documents</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: OPTIONAL_COLOR }} />
          <span className="text-sm text-ink-700">Optional Documents</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: SUBJECT_COLOR }} />
          <span className="text-sm text-ink-700">Subject Device</span>
        </div>
      </div>
    </div>
  );
}
